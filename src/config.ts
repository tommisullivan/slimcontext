/** Path resolution. Every path is overridable via env vars so tests stay hermetic. */

import * as os from "os";
import * as path from "path";

/** slimcontext's own state directory (~/.slimcontext by default). */
export function slimHome(): string {
  return process.env.SLIMCONTEXT_HOME || path.join(os.homedir(), ".slimcontext");
}

/** Where suppressed skills are moved by `apply`. */
export function parkedDir(): string {
  return path.join(slimHome(), "parked");
}

/** Append-only telemetry ledger (JSONL — greppable, no native deps). */
export function eventsFile(): string {
  return path.join(slimHome(), "events.jsonl");
}

/** Tracks what `apply` parked so `restore` is reliable. */
export function stateFile(): string {
  return path.join(slimHome(), "state.json");
}

/** The user-level Claude Code skills directory. */
export function userSkillsDir(): string {
  return (
    process.env.SLIMCONTEXT_SKILLS_DIR ||
    path.join(os.homedir(), ".claude", "skills")
  );
}

/** The project-level Claude Code skills directory. */
export function projectSkillsDir(cwd: string): string {
  return path.join(cwd, ".claude", "skills");
}

/** Claude Code settings file that `init` writes the hook into. */
export function claudeSettingsFile(): string {
  return (
    process.env.SLIMCONTEXT_CLAUDE_SETTINGS ||
    path.join(os.homedir(), ".claude", "settings.json")
  );
}

/** Claude Code custom-commands directory (`/slimcontext` lives here). */
export function claudeCommandsDir(): string {
  return (
    process.env.SLIMCONTEXT_CLAUDE_COMMANDS ||
    path.join(os.homedir(), ".claude", "commands")
  );
}

export const DEFAULT_TOP_K = 8;

/** Current slimcontext version. Bump on release. */
export const VERSION = "0.1.7";

/** GitHub repo slimcontext updates from. */
export const GITHUB_REPO = "tommisullivan/slimcontext";

/** Cached result of the daily "is there a newer version?" check. */
export function updateCacheFile(): string {
  return path.join(slimHome(), "update-check.json");
}
