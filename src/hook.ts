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

/** Core hook logic. Pure apart from telemetry logging — easy to test. */
export function runHook(input: HookInput): HookResult {
  const prompt = (input.prompt ?? "").trim();
  if (!prompt) return { output: "", logged: false };

  const cwd = input.cwd || process.cwd();
  const skills = discoverSkills(cwd);
  if (skills.length === 0) return { output: "", logged: false };

  const result = scoreSkills(skills, prompt);
  recordScore(result, "hook", "claude-code");

  if (result.activated.length === 0) {
    return { output: "", logged: true };
  }

  const upd = updateStatus();
  const updNote = upd.updateAvailable
    ? `  ·  update available → /update-slimcontext`
    : "";

  // user-visible one-liner
  const systemMessage =
    `slimcontext · ${result.activated.length}/${skills.length} skills relevant · ` +
    `≈${result.savedPct}% of the always-on skill index could be parked${updNote}`;

  // model-facing advisory
  const lines = result.activated.map(
    (s) => `- ${s.skill.name}: ${summarize(s.skill.description)}`,
  );
  const additionalContext = [
    `slimcontext: the skills most relevant to this task are —`,
    ...lines,
  ].join("\n");

  const output = JSON.stringify({
    continue: true,
    suppressOutput: true,
    systemMessage,
    hookSpecificOutput: {
      hookEventName: "UserPromptSubmit",
      additionalContext,
    },
  });
  return { output, logged: true };
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
