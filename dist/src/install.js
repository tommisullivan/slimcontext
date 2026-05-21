"use strict";
/** Installs/removes the slimcontext hook in the Claude Code settings file. */
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
exports.isHookInstalled = isHookInstalled;
exports.installHook = installHook;
exports.uninstallHook = uninstallHook;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const config_1 = require("./config");
const HOOK_COMMAND = "slimcontext hook";
function readSettings(file) {
    if (!fs.existsSync(file))
        return {};
    try {
        const parsed = JSON.parse(fs.readFileSync(file, "utf8"));
        return parsed && typeof parsed === "object" ? parsed : {};
    }
    catch {
        return {};
    }
}
function groupHasCommand(group) {
    return (group.hooks ?? []).some((h) => h.command === HOOK_COMMAND);
}
function isHookInstalled() {
    const groups = readSettings((0, config_1.claudeSettingsFile)()).hooks?.UserPromptSubmit;
    return Array.isArray(groups) && groups.some(groupHasCommand);
}
/** Add the UserPromptSubmit hook without clobbering existing settings. */
function installHook() {
    const file = (0, config_1.claudeSettingsFile)();
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const settings = readSettings(file);
    let backupPath = null;
    if (fs.existsSync(file)) {
        backupPath = `${file}.slimcontext-backup`;
        fs.copyFileSync(file, backupPath);
    }
    if (!settings.hooks || typeof settings.hooks !== "object") {
        settings.hooks = {};
    }
    const hooks = settings.hooks;
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
/** Remove the slimcontext hook, leaving all other settings intact. */
function uninstallHook() {
    const file = (0, config_1.claudeSettingsFile)();
    if (!fs.existsSync(file))
        return { settingsPath: file, removed: false };
    const settings = readSettings(file);
    const groups = settings.hooks?.UserPromptSubmit;
    if (!Array.isArray(groups))
        return { settingsPath: file, removed: false };
    let removed = false;
    for (const group of groups) {
        if (!Array.isArray(group.hooks))
            continue;
        const before = group.hooks.length;
        group.hooks = group.hooks.filter((h) => h.command !== HOOK_COMMAND);
        if (group.hooks.length !== before)
            removed = true;
    }
    settings.hooks.UserPromptSubmit =
        groups.filter((g) => Array.isArray(g.hooks) && g.hooks.length > 0);
    fs.writeFileSync(file, `${JSON.stringify(settings, null, 2)}\n`, "utf8");
    return { settingsPath: file, removed };
}
