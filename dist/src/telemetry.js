"use strict";
/** Append-only JSONL telemetry ledger. Greppable, no native dependencies. */
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
exports.logEvent = logEvent;
exports.recordScore = recordScore;
exports.readEvents = readEvents;
exports.clearEvents = clearEvents;
exports.eventsLocation = eventsLocation;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const config_1 = require("./config");
/** Append one event to the ledger. */
function logEvent(event) {
    fs.mkdirSync((0, config_1.slimHome)(), { recursive: true });
    fs.appendFileSync((0, config_1.eventsFile)(), `${JSON.stringify(event)}\n`, "utf8");
}
/** Build and log a telemetry event from a score result. */
function recordScore(result, mode, agent) {
    const event = {
        ts: new Date().toISOString(),
        query: result.query.slice(0, 280),
        agent,
        skillsAvailable: result.scored.length,
        skillsActivated: result.activated.length,
        tokensFull: result.tokensFull,
        tokensSlim: result.tokensSlim,
        saved: result.saved,
        savedPct: result.savedPct,
        mode,
    };
    logEvent(event);
    return event;
}
/** Read every recorded event. Tolerates partial/corrupt lines. */
function readEvents() {
    const file = (0, config_1.eventsFile)();
    if (!fs.existsSync(file))
        return [];
    const out = [];
    for (const line of fs.readFileSync(file, "utf8").split("\n")) {
        if (!line.trim())
            continue;
        try {
            out.push(JSON.parse(line));
        }
        catch {
            // skip a corrupt line rather than fail the whole read
        }
    }
    return out;
}
/** Delete the ledger (used by `slimcontext stats --reset` and tests). */
function clearEvents() {
    const file = (0, config_1.eventsFile)();
    if (fs.existsSync(file))
        fs.rmSync(file);
}
function eventsLocation() {
    return path.normalize((0, config_1.eventsFile)());
}
