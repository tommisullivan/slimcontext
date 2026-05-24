/**
 * MCP server slimming: discover the servers in ~/.claude/.mcp.json, score them
 * against the task, and move suppressed entries out of the live `mcpServers`
 * block into a sibling `_slimcontext_parked_mcpServers` block in the same file.
 * Restore reverses the move. Symmetric to skill parking — fully reversible.
 *
 * Caveat: Claude Code initialises MCP connections at startup, so parking takes
 * effect on the *next* session. The CLI surfaces this as a restart hint.
 */
import { McpScoreResult, McpServer, ScoreOptions } from "./types";
/** Where parked servers live inside the same ~/.claude/.mcp.json file. */
export declare const PARKED_KEY = "_slimcontext_parked_mcpServers";
/**
 * Discover every MCP server known to the user — combines the live `mcpServers`
 * block and anything currently parked, so scoring always sees the full set
 * even mid-staging (same invariant as skill discovery).
 */
export declare function discoverMcpServers(file?: string): McpServer[];
/**
 * Score MCP servers against a query using the same BM25 + name-mention engine
 * the skill scorer uses. Pure — no I/O.
 */
export declare function scoreMcpServers(servers: McpServer[], query: string, options?: ScoreOptions): McpScoreResult;
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
export declare function applyMcp(query: string, options?: ScoreOptions): ApplyMcpResult;
export interface RestoreMcpResult {
    restored: string[];
    file: string;
}
/** Move every parked server back into the live `mcpServers` block. */
export declare function restoreMcp(): RestoreMcpResult;
/** Read-only count of currently parked servers, for `status`. */
export declare function parkedMcpCount(): number;
