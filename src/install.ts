/** Installs/removes the slimcontext hook in the Claude Code settings file. */

import * as fs from "fs";
import * as path from "path";
import { claudeSettingsFile } from "./config";

const HOOK_COMMAND = "slimcontext hook";

interface HookEntry {
  type?: string;
  command?: string;
}
interface HookGroup {
  hooks?: HookEntry[];
}
interface Settings {
  hooks?: { UserPromptSubmit?: HookGroup[]; [k: string]: unknown };
  [k: string]: unknown;
}

function readSettings(file: string): Settings {
  if (!fs.existsSync(file)) return {};
  try {
    const parsed = JSON.parse(fs.readFileSync(file, "utf8"));
    return parsed && typeof parsed === "object" ? (parsed as Settings) : {};
  } catch {
    return {};
  }
}

function groupHasCommand(group: HookGroup): boolean {
  return (group.hooks ?? []).some((h) => h.command === HOOK_COMMAND);
}

export function isHookInstalled(): boolean {
  const groups = readSettings(claudeSettingsFile()).hooks?.UserPromptSubmit;
  return Array.isArray(groups) && groups.some(groupHasCommand);
}

export interface InstallResult {
  settingsPath: string;
  alreadyInstalled: boolean;
  backupPath: string | null;
}

/** Add the UserPromptSubmit hook without clobbering existing settings. */
export function installHook(): InstallResult {
  const file = claudeSettingsFile();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const settings = readSettings(file);

  let backupPath: string | null = null;
  if (fs.existsSync(file)) {
    backupPath = `${file}.slimcontext-backup`;
    fs.copyFileSync(file, backupPath);
  }

  if (!settings.hooks || typeof settings.hooks !== "object") {
    settings.hooks = {};
  }
  const hooks = settings.hooks as { UserPromptSubmit?: HookGroup[] };
  if (!Array.isArray(hooks.UserPromptSubmit)) {
    hooks.UserPromptSubmit = [];
  }

  if (hooks.UserPromptSubmit.some(groupHasCommand)) {
    return { settingsPath: file, alreadyInstalled: true, backupPath };
  }

  hooks.UserPromptSubmit.push({
    hooks: [{ type: "command", command: HOOK_COMMAND }],
  });
  fs.writeFileSync(file, `${JSON.stringify(settings, null, 2)}\n`, "utf8");
  return { settingsPath: file, alreadyInstalled: false, backupPath };
}

export interface UninstallResult {
  settingsPath: string;
  removed: boolean;
}

/** Remove the slimcontext hook, leaving all other settings intact. */
export function uninstallHook(): UninstallResult {
  const file = claudeSettingsFile();
  if (!fs.existsSync(file)) return { settingsPath: file, removed: false };

  const settings = readSettings(file);
  const groups = settings.hooks?.UserPromptSubmit;
  if (!Array.isArray(groups)) return { settingsPath: file, removed: false };

  let removed = false;
  for (const group of groups) {
    if (!Array.isArray(group.hooks)) continue;
    const before = group.hooks.length;
    group.hooks = group.hooks.filter((h) => h.command !== HOOK_COMMAND);
    if (group.hooks.length !== before) removed = true;
  }
  (settings.hooks as { UserPromptSubmit: HookGroup[] }).UserPromptSubmit =
    groups.filter((g) => Array.isArray(g.hooks) && g.hooks.length > 0);

  fs.writeFileSync(file, `${JSON.stringify(settings, null, 2)}\n`, "utf8");
  return { settingsPath: file, removed };
}
