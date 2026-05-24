/**
 * MCP server slimming: discover the servers in ~/.claude/.mcp.json, score them
 * against the task, and move suppressed entries out of the live `mcpServers`
 * block into a sibling `_slimcontext_parked_mcpServers` block in the same file.
 * Restore reverses the move. Symmetric to skill parking — fully reversible.
 *
 * Caveat: Claude Code initialises MCP connections at startup, so parking takes
 * effect on the *next* session. The CLI surfaces this as a restart hint.
 */

import * as fs from "fs";
import * as path from "path";
import { Bm25, Bm25Doc, expandQuery, tokenize } from "./bm25";
import { claudeMcpFile, DEFAULT_TOP_K } from "./config";
import { estimateTokens } from "./tokens";
import {
  McpScoreResult,
  McpServer,
  McpServerConfig,
  ScoredMcpServer,
  ScoreOptions,
} from "./types";

/** Where parked servers live inside the same ~/.claude/.mcp.json file. */
export const PARKED_KEY = "_slimcontext_parked_mcpServers";
const ACTIVE_KEY = "mcpServers";

/**
 * Rough per-server overhead — covers MCP tool schemas that Claude Code keeps
 * in the always-on tool list once the server is connected. Real values vary
 * (Cloudflare publishes hundreds of tools, vault publishes a handful), so we
 * label outputs as approximate everywhere we surface them.
 */
const SCHEMA_OVERHEAD_TOKENS = 2000;

interface McpFile {
  [ACTIVE_KEY]?: Record<string, McpServerConfig>;
  [PARKED_KEY]?: Record<string, McpServerConfig>;
  [k: string]: unknown;
}

function readMcpFile(file: string): McpFile {
  if (!fs.existsSync(file)) return {};
  try {
    const parsed = JSON.parse(fs.readFileSync(file, "utf8"));
    return parsed && typeof parsed === "object" ? (parsed as McpFile) : {};
  } catch {
    return {};
  }
}

function writeMcpFile(file: string, data: McpFile): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

/** Synthesize a description from command + args when none is provided. */
function synthesizeDescription(name: string, cfg: McpServerConfig): string {
  const parts: string[] = [];
  if (cfg.command) parts.push(String(cfg.command));
  if (Array.isArray(cfg.args)) parts.push(...cfg.args.map(String));
  if (cfg.url) parts.push(String(cfg.url));
  if (cfg.type) parts.push(String(cfg.type));
  return parts.length > 0 ? `${name} ${parts.join(" ")}` : name;
}

function toServer(name: string, cfg: McpServerConfig): McpServer {
  const description = cfg.description?.trim() || synthesizeDescription(name, cfg);
  return {
    name,
    config: cfg,
    description,
    tokensEstimate: SCHEMA_OVERHEAD_TOKENS + estimateTokens(description),
  };
}

/**
 * Discover every MCP server known to the user — combines the live `mcpServers`
 * block and anything currently parked, so scoring always sees the full set
 * even mid-staging (same invariant as skill discovery).
 */
export function discoverMcpServers(file: string = claudeMcpFile()): McpServer[] {
  const data = readMcpFile(file);
  const out: McpServer[] = [];
  const active = data[ACTIVE_KEY] ?? {};
  const parked = data[PARKED_KEY] ?? {};
  for (const [name, cfg] of Object.entries(active)) {
    if (cfg && typeof cfg === "object") out.push(toServer(name, cfg));
  }
  for (const [name, cfg] of Object.entries(parked)) {
    if (cfg && typeof cfg === "object") out.push(toServer(name, cfg));
  }
  return out;
}

/**
 * Score MCP servers against a query using the same BM25 + name-mention engine
 * the skill scorer uses. Pure — no I/O.
 */
export function scoreMcpServers(
  servers: McpServer[],
  query: string,
  options: ScoreOptions = {},
): McpScoreResult {
  const topK = options.topK ?? DEFAULT_TOP_K;
  const minScore = options.minScore ?? 0;
  const queryLower = query.toLowerCase();
  const queryTokens = expandQuery(tokenize(query));

  const docs: Bm25Doc[] = servers.map((s) => ({
    id: s.name,
    tokens: tokenize(`${s.name} ${s.description}`),
  }));
  const bm25 = new Bm25(docs);
  const rawBm25 = servers.map((s) => bm25.score(s.name, queryTokens));
  const maxBm25 = Math.max(0.0001, ...rawBm25);

  const scored: ScoredMcpServer[] = servers.map((server, i) => {
    const bm = rawBm25[i] / maxBm25;
    const reasons: string[] = [];
    let boost = 0;
    // explicit server-name mention is the strongest possible signal
    if (server.name.length > 2 && queryLower.includes(server.name.toLowerCase())) {
      boost += 0.6;
      reasons.push("server name mentioned");
    }
    const score = Math.min(1, bm * 0.7 + boost);
    if (bm > 0.01) reasons.push(`bm25 relevance ${bm.toFixed(2)}`);
    return {
      server,
      score,
      bm25: bm,
      rawBm25: rawBm25[i],
      reasons,
      activated: false,
    };
  });

  scored.sort((a, b) => b.score - a.score || a.server.name.localeCompare(b.server.name));

  let slots = topK;
  for (const sc of scored) {
    if (slots <= 0) break;
    if (sc.score <= minScore) continue;
    sc.activated = true;
    slots--;
  }

  const activated = scored.filter((s) => s.activated);
  const suppressed = scored.filter((s) => !s.activated);
  const tokensFull = servers.reduce((sum, s) => sum + s.tokensEstimate, 0);
  const tokensSlim = activated.reduce((sum, s) => sum + s.server.tokensEstimate, 0);
  const saved = tokensFull - tokensSlim;
  const savedPct = tokensFull > 0 ? Math.round((saved / tokensFull) * 1000) / 10 : 0;

  return { query, scored, activated, suppressed, tokensFull, tokensSlim, saved, savedPct };
}

export interface ApplyMcpResult {
  score: McpScoreResult;
  /** Server names that were moved into the parked block. */
  parked: string[];
  /** Server names that were already parked from a previous run. */
  restoredFirst: string[];
  /** Absolute path to the .mcp.json file (or the path that would be created). */
  file: string;
  /** True when no .mcp.json exists yet — nothing was changed. */
  fileMissing: boolean;
}

/**
 * Score the full set against `query` and move suppressed servers into the
 * sibling parked block. Any previous staging is restored first so scoring sees
 * the complete set. No-op if .mcp.json is missing — we never create configs.
 */
export function applyMcp(query: string, options: ScoreOptions = {}): ApplyMcpResult {
  const file = claudeMcpFile();
  if (!fs.existsSync(file)) {
    return {
      score: scoreMcpServers([], query, options),
      parked: [],
      restoredFirst: [],
      file,
      fileMissing: true,
    };
  }

  const restoredFirst = restoreMcp().restored;
  const servers = discoverMcpServers(file);
  const score = scoreMcpServers(servers, query, options);

  const data = readMcpFile(file);
  const active = (data[ACTIVE_KEY] = { ...(data[ACTIVE_KEY] ?? {}) });
  const parked = (data[PARKED_KEY] = { ...(data[PARKED_KEY] ?? {}) });

  const parkedNames: string[] = [];
  for (const sc of score.suppressed) {
    const n = sc.server.name;
    if (active[n]) {
      parked[n] = active[n];
      delete active[n];
      parkedNames.push(n);
    }
  }

  writeMcpFile(file, data);
  return { score, parked: parkedNames, restoredFirst, file, fileMissing: false };
}

export interface RestoreMcpResult {
  restored: string[];
  file: string;
}

/** Move every parked server back into the live `mcpServers` block. */
export function restoreMcp(): RestoreMcpResult {
  const file = claudeMcpFile();
  if (!fs.existsSync(file)) return { restored: [], file };

  const data = readMcpFile(file);
  const parked = data[PARKED_KEY] ?? {};
  const restored: string[] = [];
  if (Object.keys(parked).length === 0) return { restored, file };

  const active = (data[ACTIVE_KEY] = { ...(data[ACTIVE_KEY] ?? {}) });
  for (const [name, cfg] of Object.entries(parked)) {
    if (!active[name]) {
      active[name] = cfg;
      restored.push(name);
    }
  }
  // empty the parked block (keep the key for clarity, set to {})
  data[PARKED_KEY] = {};

  writeMcpFile(file, data);
  return { restored, file };
}

/** Read-only count of currently parked servers, for `status`. */
export function parkedMcpCount(): number {
  const file = claudeMcpFile();
  if (!fs.existsSync(file)) return 0;
  return Object.keys(readMcpFile(file)[PARKED_KEY] ?? {}).length;
}
