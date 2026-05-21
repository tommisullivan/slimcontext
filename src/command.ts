/** Installs/removes the `/slimcontext` Claude Code slash command. */

import * as fs from "fs";
import * as path from "path";
import { claudeCommandsDir } from "./config";

const COMMAND_FILE = "slimcontext.md";

/** The slash-command body. Becomes the prompt when a user types /slimcontext. */
const COMMAND_BODY = `---
description: Open the slimcontext control menu — slim skills, toggle the hook, view savings
---

The user invoked the slimcontext control menu. slimcontext trims which Claude Code
skills load, to cut context tokens. Do the following:

1. Run \`slimcontext status\` (Bash) to read the current state — whether the advisory
   hook is enabled and whether skills are currently staged.

2. Use AskUserQuestion to show a menu. header: "slimcontext", question:
   "What would you like to do?". Options:
   - "Slim skills for a task" — park skills irrelevant to a specific task. This is the
     real token cut and is fully reversible.
   - "Restore all skills" — un-park everything; the full skill library comes back.
   - If the hook is currently OFF: "Enable advisory hook" — score + advise on every
     prompt (never removes skills, so it cannot hurt answer quality).
     If the hook is currently ON: "Disable advisory hook".
   - "Show savings stats" — the token-savings dashboard.

3. Carry out the chosen action with Bash:
   - Slim skills: ask the user (plain text) what task they are about to work on, then
     run \`slimcontext apply "<task>"\`. Show the result and remind them they can undo
     with /slimcontext → Restore.
   - Restore all skills: run \`slimcontext restore\`.
   - Enable advisory hook: run \`slimcontext enable\`.
   - Disable advisory hook: run \`slimcontext disable\`.
   - Show savings stats: run \`slimcontext stats\`.

4. Report the outcome in two or three sentences.

Quality note to keep in mind: "Slim skills" physically parks skill folders — if a
parked skill turns out to be needed, restore and re-run with a higher --top value.
The advisory hook never removes skills, so enabling it carries no quality risk.
`;

export function commandPath(): string {
  return path.join(claudeCommandsDir(), COMMAND_FILE);
}

export function isCommandInstalled(): boolean {
  return fs.existsSync(commandPath());
}

export interface CommandInstallResult {
  path: string;
  created: boolean;
}

/** Write (or refresh) the `/slimcontext` slash command. */
export function installCommand(): CommandInstallResult {
  const file = commandPath();
  const existed = fs.existsSync(file);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, COMMAND_BODY, "utf8");
  return { path: file, created: !existed };
}

export interface CommandUninstallResult {
  path: string;
  removed: boolean;
}

/** Remove the `/slimcontext` slash command. */
export function uninstallCommand(): CommandUninstallResult {
  const file = commandPath();
  if (fs.existsSync(file)) {
    fs.rmSync(file);
    return { path: file, removed: true };
  }
  return { path: file, removed: false };
}
