"use strict";
/** Public API for slimcontext. */
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
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.runUpdate = exports.updateStatus = exports.refreshUpdateCache = exports.fetchLatestVersion = exports.cacheIsStale = exports.readUpdateCache = exports.isNewer = exports.normalizeManifest = exports.loadManifest = exports.updateCommandPath = exports.menuCommandPath = exports.commandPath = exports.isCommandInstalled = exports.uninstallCommand = exports.installCommand = exports.isHookInstalled = exports.uninstallHook = exports.installHook = exports.runHook = exports.readState = exports.restoreSkills = exports.applySkills = exports.clearEvents = exports.recordScore = exports.logEvent = exports.readEvents = exports.summarize = exports.estimateTokens = exports.tokenize = exports.Bm25 = exports.scoreSkills = exports.parseFrontmatter = exports.discoverSkills = void 0;
__exportStar(require("./types"), exports);
var discover_1 = require("./discover");
Object.defineProperty(exports, "discoverSkills", { enumerable: true, get: function () { return discover_1.discoverSkills; } });
Object.defineProperty(exports, "parseFrontmatter", { enumerable: true, get: function () { return discover_1.parseFrontmatter; } });
var score_1 = require("./score");
Object.defineProperty(exports, "scoreSkills", { enumerable: true, get: function () { return score_1.scoreSkills; } });
var bm25_1 = require("./bm25");
Object.defineProperty(exports, "Bm25", { enumerable: true, get: function () { return bm25_1.Bm25; } });
Object.defineProperty(exports, "tokenize", { enumerable: true, get: function () { return bm25_1.tokenize; } });
var tokens_1 = require("./tokens");
Object.defineProperty(exports, "estimateTokens", { enumerable: true, get: function () { return tokens_1.estimateTokens; } });
var stats_1 = require("./stats");
Object.defineProperty(exports, "summarize", { enumerable: true, get: function () { return stats_1.summarize; } });
var telemetry_1 = require("./telemetry");
Object.defineProperty(exports, "readEvents", { enumerable: true, get: function () { return telemetry_1.readEvents; } });
Object.defineProperty(exports, "logEvent", { enumerable: true, get: function () { return telemetry_1.logEvent; } });
Object.defineProperty(exports, "recordScore", { enumerable: true, get: function () { return telemetry_1.recordScore; } });
Object.defineProperty(exports, "clearEvents", { enumerable: true, get: function () { return telemetry_1.clearEvents; } });
var apply_1 = require("./apply");
Object.defineProperty(exports, "applySkills", { enumerable: true, get: function () { return apply_1.applySkills; } });
Object.defineProperty(exports, "restoreSkills", { enumerable: true, get: function () { return apply_1.restoreSkills; } });
Object.defineProperty(exports, "readState", { enumerable: true, get: function () { return apply_1.readState; } });
var hook_1 = require("./hook");
Object.defineProperty(exports, "runHook", { enumerable: true, get: function () { return hook_1.runHook; } });
var install_1 = require("./install");
Object.defineProperty(exports, "installHook", { enumerable: true, get: function () { return install_1.installHook; } });
Object.defineProperty(exports, "uninstallHook", { enumerable: true, get: function () { return install_1.uninstallHook; } });
Object.defineProperty(exports, "isHookInstalled", { enumerable: true, get: function () { return install_1.isHookInstalled; } });
var command_1 = require("./command");
Object.defineProperty(exports, "installCommand", { enumerable: true, get: function () { return command_1.installCommand; } });
Object.defineProperty(exports, "uninstallCommand", { enumerable: true, get: function () { return command_1.uninstallCommand; } });
Object.defineProperty(exports, "isCommandInstalled", { enumerable: true, get: function () { return command_1.isCommandInstalled; } });
Object.defineProperty(exports, "commandPath", { enumerable: true, get: function () { return command_1.commandPath; } });
Object.defineProperty(exports, "menuCommandPath", { enumerable: true, get: function () { return command_1.menuCommandPath; } });
Object.defineProperty(exports, "updateCommandPath", { enumerable: true, get: function () { return command_1.updateCommandPath; } });
var manifest_1 = require("./manifest");
Object.defineProperty(exports, "loadManifest", { enumerable: true, get: function () { return manifest_1.loadManifest; } });
Object.defineProperty(exports, "normalizeManifest", { enumerable: true, get: function () { return manifest_1.normalizeManifest; } });
var update_1 = require("./update");
Object.defineProperty(exports, "isNewer", { enumerable: true, get: function () { return update_1.isNewer; } });
Object.defineProperty(exports, "readUpdateCache", { enumerable: true, get: function () { return update_1.readUpdateCache; } });
Object.defineProperty(exports, "cacheIsStale", { enumerable: true, get: function () { return update_1.cacheIsStale; } });
Object.defineProperty(exports, "fetchLatestVersion", { enumerable: true, get: function () { return update_1.fetchLatestVersion; } });
Object.defineProperty(exports, "refreshUpdateCache", { enumerable: true, get: function () { return update_1.refreshUpdateCache; } });
Object.defineProperty(exports, "updateStatus", { enumerable: true, get: function () { return update_1.updateStatus; } });
Object.defineProperty(exports, "runUpdate", { enumerable: true, get: function () { return update_1.runUpdate; } });
