"use strict";
/** Path resolution. Every path is overridable via env vars so tests stay hermetic. */
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
exports.GITHUB_REPO = exports.VERSION = exports.DEFAULT_TOP_K = void 0;
exports.slimHome = slimHome;
exports.parkedDir = parkedDir;
exports.eventsFile = eventsFile;
exports.stateFile = stateFile;
exports.userSkillsDir = userSkillsDir;
exports.projectSkillsDir = projectSkillsDir;
exports.claudeSettingsFile = claudeSettingsFile;
exports.claudeCommandsDir = claudeCommandsDir;
exports.updateCacheFile = updateCacheFile;
const os = __importStar(require("os"));
const path = __importStar(require("path"));
/** slimcontext's own state directory (~/.slimcontext by default). */
function slimHome() {
    return process.env.SLIMCONTEXT_HOME || path.join(os.homedir(), ".slimcontext");
}
/** Where suppressed skills are moved by `apply`. */
function parkedDir() {
    return path.join(slimHome(), "parked");
}
/** Append-only telemetry ledger (JSONL — greppable, no native deps). */
function eventsFile() {
    return path.join(slimHome(), "events.jsonl");
}
/** Tracks what `apply` parked so `restore` is reliable. */
function stateFile() {
    return path.join(slimHome(), "state.json");
}
/** The user-level Claude Code skills directory. */
function userSkillsDir() {
    return (process.env.SLIMCONTEXT_SKILLS_DIR ||
        path.join(os.homedir(), ".claude", "skills"));
}
/** The project-level Claude Code skills directory. */
function projectSkillsDir(cwd) {
    return path.join(cwd, ".claude", "skills");
}
/** Claude Code settings file that `init` writes the hook into. */
function claudeSettingsFile() {
    return (process.env.SLIMCONTEXT_CLAUDE_SETTINGS ||
        path.join(os.homedir(), ".claude", "settings.json"));
}
/** Claude Code custom-commands directory (`/slimcontext` lives here). */
function claudeCommandsDir() {
    return (process.env.SLIMCONTEXT_CLAUDE_COMMANDS ||
        path.join(os.homedir(), ".claude", "commands"));
}
exports.DEFAULT_TOP_K = 8;
/** Current slimcontext version. Bump on release. */
exports.VERSION = "0.1.6";
/** GitHub repo slimcontext updates from. */
exports.GITHUB_REPO = "tommisullivan/slimcontext";
/** Cached result of the daily "is there a newer version?" check. */
function updateCacheFile() {
    return path.join(slimHome(), "update-check.json");
}
