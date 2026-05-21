/**
 * The UserPromptSubmit hook. Claude Code pipes a JSON payload on stdin; the
 * hook scores skills against the prompt, records telemetry, and returns a
 * short advisory naming the relevant skills.
 *
 * Design rule: the hook must NEVER break a session. Any failure exits 0 with
 * no output.
 */

import { discoverSkills } from "./discover";
import { scoreSkills } from "./score";
import { recordScore } from "./telemetry";

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

  const lines = result.activated.map(
    (s) => `- ${s.skill.name}: ${summarize(s.skill.description)}`,
  );
  const context = [
    `slimcontext: ${result.activated.length} of ${skills.length} installed ` +
      `skills look relevant to this task (the rest are ≈${result.savedPct}% ` +
      `of skill context you can skip):`,
    ...lines,
  ].join("\n");

  const output = JSON.stringify({
    hookSpecificOutput: {
      hookEventName: "UserPromptSubmit",
      additionalContext: context,
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

/** Entry point for `slimcontext hook`. Never throws; always exits cleanly. */
export async function hookMain(): Promise<void> {
  try {
    const raw = await readStdin();
    if (!raw.trim()) return;
    const input = JSON.parse(raw) as HookInput;
    const { output } = runHook(input);
    if (output) process.stdout.write(output);
  } catch {
    // Silent by design — a hook must never disrupt the agent session.
  }
}
