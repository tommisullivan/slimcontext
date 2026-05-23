"use strict";
/** Installs/removes the `/slimcontext` and `/update-slimcontext` slash commands. */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.menuCommandPath = menuCommandPath;
exports.updateCommandPath = updateCommandPath;
exports.commandPath = commandPath;
exports.isCommandInstalled = isCommandInstalled;
exports.installCommand = installCommand;
exports.uninstallCommand = uninstallCommand;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const config_1 = require("./config");
const MENU_FILE = "slimcontext.md";
const UPDATE_FILE = "update-slimcontext.md";
/** The `/slimcontext` menu — becomes the prompt when a user types /slimcontext. */
const MENU_BODY = `---
description: Open the slimcontext control menu — slim skills, toggle the hook, update, view savings
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
   - If the hook is currently OFF: "Enable advisory hook" — silently injects routing
     context for the model on every prompt (no chat-visible message). If ON:
     "Disable advisory hook" — turn it off entirely.
   - "Show savings stats" — the token-savings dashboard.
   - "Update slimcontext" — pull the latest version from GitHub.

3. Carry out the chosen action with Bash:
   - Slim skills: ask the user (plain text) what task they are about to work on, then
     run \`slimcontext apply "<task>"\`. Show the result and remind them they can undo
     with /slimcontext → Restore.
   - Restore all skills: run \`slimcontext restore\`.
   - Enable advisory hook: run \`slimcontext enable\`.
   - Disable advisory hook: run \`slimcontext disable\`.
   - Show savings stats: run \`slimcontext stats\`.
   - Update slimcontext: run \`slimcontext update\`.

4. Report the outcome in two or three sentences.

Quality note: "Slim skills" physically parks skill folders — if a parked skill turns out
to be needed, restore and re-run with a higher --top value. The advisory hook never
removes skills, so enabling it carries no quality risk.

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
function menuCommandPath() {
    return path.join((0, config_1.claudeCommandsDir)(), MENU_FILE);
}
function updateCommandPath() {
    return path.join((0, config_1.claudeCommandsDir)(), UPDATE_FILE);
}
/** Back-compat alias — the primary command path. */
function commandPath() {
    return menuCommandPath();
}
function isCommandInstalled() {
    return fs.existsSync(menuCommandPath());
}
/** Write (or refresh) both slash commands. */
function installCommand() {
    const dir = (0, config_1.claudeCommandsDir)();
    fs.mkdirSync(dir, { recursive: true });
    const existed = fs.existsSync(menuCommandPath());
    fs.writeFileSync(menuCommandPath(), MENU_BODY, "utf8");
    fs.writeFileSync(updateCommandPath(), UPDATE_BODY, "utf8");
    return { paths: [menuCommandPath(), updateCommandPath()], created: !existed };
}
/** Remove both slash commands. */
function uninstallCommand() {
    let removed = false;
    for (const p of [menuCommandPath(), updateCommandPath()]) {
        if (fs.existsSync(p)) {
            fs.rmSync(p);
            removed = true;
        }
    }
    return { removed };
}
