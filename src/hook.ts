/**
 * The UserPromptSubmit hook. Claude Code pipes a JSON payload on stdin; the
 * hook scores skills against the prompt, records telemetry, returns an
 * advisory for the model AND a user-visible `systemMessage`.
 *
 * Design rule: the hook must NEVER break a session. Any failure exits 0 with
 * no output.
 */

import * as path from "path";
import { spawn } from "child_process";
import { discoverSkills } from "./discover";
import { scoreSkills } from "./score";
import { recordScore } from "./telemetry";
import { cacheIsStale, updateStatus } from "./update";

export interface HookInput {
  prompt?: string;
  cwd?: string;
  hook_event_name?: string;
  session_id?: string;
}

export interface HookResult {
  /** JSON to print to stdout (empty string = print nothing). */
  output: string;
  /** Whether a telemetry event was recorded. */
  logged: boolean;
}

/** First sentence of a description, capped, for a compact advisory line. */
function summarize(description: string): string {
  const text = description.replace(/\s+/g, " ").trim();
  if (!text) return "(no description)";
  const dot = text.indexOf(". ");
  const sentence = dot > 0 ? text.slice(0, dot + 1) : text;
  return sentence.length > 140 ? `${sentence.slice(0, 137)}...` : sentence;
}

/**
 * Threshold for *which* skills count as "looking relevant" if the user has
 * opted into the verbose chat line. We still apply it (so the count is
 * meaningful when it does appear), even though by default we don't print.
 */
const MIN_SCORE = 0.35;

/**
 * The chat-visible one-liner ("slimcontext · N of M skills look relevant") is
 * opt-in. With 143 verbose skills and common dev vocabulary, lexical scores
 * cluster too tightly for the count to discriminate vague vs specific prompts
 * — so printing it on every chat just adds noise. The model still gets the
 * routing advisory (additionalContext) on every prompt; that's where the
 * actual value lives.
 *
 * Users who want the line back can set `SLIMCONTEXT_VERBOSE=1` in their
 * environment or via the Claude Code hook command.
 */
function verboseEnabled(): boolean {
  const v = process.env.SLIMCONTEXT_VERBOSE;
  return v === "1" || v === "true";
}

/** Core hook logic. Pure apart from telemetry logging — easy to test. */
export function runHook(input: HookInput): HookResult {
  const prompt = (input.prompt ?? "").trim();
  if (!prompt) return { output: "", logged: false };

  const cwd = input.cwd || process.cwd();
  const skills = discoverSkills(cwd);
  if (skills.length === 0) return { output: "", logged: false };

  const result = scoreSkills(skills, prompt, { minScore: MIN_SCORE });
  recordScore(result, "hook", "claude-code");

  if (result.activated.length === 0) {
    return { output: "", logged: true };
  }

  // model-facing advisory — always sent; this is the actual routing value.
  const lines = result.activated.map(
    (s) => `- ${s.skill.name}: ${summarize(s.skill.description)}`,
  );
  const additionalContext = [
    `slimcontext: the skills most relevant to this task are —`,
    ...lines,
  ].join("\n");

  const payload: {
    continue: boolean;
    suppressOutput: boolean;
    systemMessage?: string;
    hookSpecificOutput: { hookEventName: string; additionalContext: string };
  } = {
    continue: true,
    suppressOutput: true,
    hookSpecificOutput: {
      hookEventName: "UserPromptSubmit",
      additionalContext,
    },
  };

  // user-visible one-liner is opt-in via SLIMCONTEXT_VERBOSE.
  if (verboseEnabled()) {
    const upd = updateStatus();
    const updNote = upd.updateAvailable
      ? `  ·  update available → /update-slimcontext`
      : "";
    payload.systemMessage =
      `slimcontext · ${result.activated.length} of ${skills.length} skills look relevant · ` +
      `≈${result.savedPct}% of the always-on skill index could be parked${updNote}`;
  }

  return { output: JSON.stringify(payload), logged: true };
}

/** Read all of stdin (used by the CLI `hook` subcommand). */
export function readStdin(): Promise<string> {
  return new Promise((resolve) => {
    let data = "";
    if (process.stdin.isTTY) {
      resolve("");
      return;
    }
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk) => (data += chunk));
    process.stdin.on("end", () => resolve(data));
    process.stdin.on("error", () => resolve(data));
  });
}

/** Fire-and-forget: refresh the update cache in a detached child, max once/day. */
function maybeRefreshUpdateCache(): void {
  if (!cacheIsStale()) return;
  try {
    const cli = path.join(__dirname, "cli.js");
    const child = spawn(process.execPath, [cli, "_refresh-update"], {
      detached: true,
      stdio: "ignore",
    });
    child.unref();
  } catch {
    // never let an update check disrupt the session
  }
}

/** Entry point for `slimcontext hook`. Never throws; always exits cleanly. */
export async function hookMain(): Promise<void> {
  try {
    const raw = await readStdin();
    if (!raw.trim()) return;
    const input = JSON.parse(raw) as HookInput;
    const { output } = runHook(input);
    if (output) process.stdout.write(output);
    maybeRefreshUpdateCache();
  } catch {
    // Silent by design — a hook must never disrupt the agent session.
  }
}
