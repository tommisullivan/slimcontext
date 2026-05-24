/** Installs/removes the `/slimcontext` and `/update-slimcontext` slash commands. */

import * as fs from "fs";
import * as path from "path";
import { claudeCommandsDir } from "./config";

const MENU_FILE = "slimcontext.md";
const UPDATE_FILE = "update-slimcontext.md";

/** The `/slimcontext` menu — becomes the prompt when a user types /slimcontext. */
const MENU_BODY = `---
description: Open the slimcontext control menu — slim skills + MCP servers, toggle the hook, update, view savings
---

The user invoked the slimcontext control menu. slimcontext trims which Claude Code
skills AND MCP servers load, to cut context tokens. Do the following:

1. Run \`slimcontext status\` (Bash) to read the current state — whether the advisory
   hook is enabled, whether skills are staged, and how many MCP servers are parked.

2. Use AskUserQuestion to show a menu. header: "slimcontext", question:
   "What would you like to do?". Options:
   - "Slim for a task" — park skills AND MCP servers irrelevant to a specific task.
     Reversible. Skills take effect immediately; MCP changes need a Claude Code restart.
   - "Slim skills only" — same but leave MCP servers untouched.
   - "Slim MCP servers only" — same but leave skills untouched.
   - "Restore everything" — un-park all skills and MCP servers.
   - If the hook is currently OFF: "Enable advisory hook" — silently injects routing
     context for the model on every prompt (no chat-visible message). If ON:
     "Disable advisory hook" — turn it off entirely.
   - "Show savings stats" — the token-savings dashboard.
   - "Update slimcontext" — pull the latest version from GitHub.

3. Carry out the chosen action with Bash:
   - Slim for a task: ask the user (plain text) what task they are about to work on,
     then run \`slimcontext apply "<task>"\`. Show the result and remind them they can
     undo with /slimcontext → Restore. If any MCP server was parked, tell them to
     restart Claude Code for MCP changes to take effect.
   - Slim skills only: \`slimcontext apply --skills-only "<task>"\`.
   - Slim MCP servers only: \`slimcontext apply --mcp-only "<task>"\` (remind them to
     restart Claude Code afterwards).
   - Restore everything: run \`slimcontext restore\`.
   - Enable advisory hook: run \`slimcontext enable\`.
   - Disable advisory hook: run \`slimcontext disable\`.
   - Show savings stats: run \`slimcontext stats\`.
   - Update slimcontext: run \`slimcontext update\`.

4. Report the outcome in two or three sentences.

Quality note: "Slim" physically moves skills and MCP server configs out of the way —
if something parked turns out to be needed, restore and re-run with a higher --top
value. The advisory hook never removes skills, so enabling it carries no quality risk.
MCP server changes require a Claude Code restart because servers connect at startup.

Want the chat-visible "slimcontext · N skills relevant" diagnostic line back? It's opt-in
via the environment variable \`SLIMCONTEXT_VERBOSE=1\`. Without it the hook is silent
to the user (the model still gets the routing context).
`;

/** The `/update-slimcontext` command. */
const UPDATE_BODY = `---
description: Update slimcontext to the latest version from GitHub
---

The user wants to update slimcontext. Run \`slimcontext update\` with Bash. It reinstalls
the latest version from GitHub. Then report the result in one or two sentences — the old
version and the new version, or that it was already up to date. If it failed, show the
error and suggest running \`npm install -g github:tommisullivan/slimcontext\` manually.
`;

export function menuCommandPath(): string {
  return path.join(claudeCommandsDir(), MENU_FILE);
}
export function updateCommandPath(): string {
  return path.join(claudeCommandsDir(), UPDATE_FILE);
}

/** Back-compat alias — the primary command path. */
export function commandPath(): string {
  return menuCommandPath();
}

export function isCommandInstalled(): boolean {
  return fs.existsSync(menuCommandPath());
}

export interface CommandInstallResult {
  paths: string[];
  created: boolean;
}

/** Write (or refresh) both slash commands. */
export function installCommand(): CommandInstallResult {
  const dir = claudeCommandsDir();
  fs.mkdirSync(dir, { recursive: true });
  const existed = fs.existsSync(menuCommandPath());
  fs.writeFileSync(menuCommandPath(), MENU_BODY, "utf8");
  fs.writeFileSync(updateCommandPath(), UPDATE_BODY, "utf8");
  return { paths: [menuCommandPath(), updateCommandPath()], created: !existed };
}

export interface CommandUninstallResult {
  removed: boolean;
}

/** Remove both slash commands. */
export function uninstallCommand(): CommandUninstallResult {
  let removed = false;
  for (const p of [menuCommandPath(), updateCommandPath()]) {
    if (fs.existsSync(p)) {
      fs.rmSync(p);
      removed = true;
    }
  }
  return { removed };
}
