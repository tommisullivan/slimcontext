"use strict";
/**
 * Staging: `apply` parks suppressed user skills out of the Claude Code skill
 * directory so a session starts with only the relevant ones; `restore` undoes
 * it. Skills are moved (never deleted), so the operation is fully reversible.
 */
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
exports.readState = readState;
exports.restoreSkills = restoreSkills;
exports.applySkills = applySkills;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const config_1 = require("./config");
const discover_1 = require("./discover");
const score_1 = require("./score");
const telemetry_1 = require("./telemetry");
function readState() {
    const file = (0, config_1.stateFile)();
    if (!fs.existsSync(file))
        return null;
    try {
        return JSON.parse(fs.readFileSync(file, "utf8"));
    }
    catch {
        return null;
    }
}
function writeState(state) {
    fs.mkdirSync(path.dirname((0, config_1.stateFile)()), { recursive: true });
    fs.writeFileSync((0, config_1.stateFile)(), JSON.stringify(state, null, 2), "utf8");
}
function clearState() {
    if (fs.existsSync((0, config_1.stateFile)()))
        fs.rmSync((0, config_1.stateFile)());
}
/** Move every parked skill back into the user skills directory. */
function restoreSkills() {
    const state = readState();
    const restored = [];
    if (!state)
        return { restored };
    for (const base of state.parked) {
        const from = path.join((0, config_1.parkedDir)(), base);
        const to = path.join((0, config_1.userSkillsDir)(), base);
        if (fs.existsSync(from) && !fs.existsSync(to)) {
            fs.renameSync(from, to);
            restored.push(base);
        }
    }
    clearState();
    return { restored };
}
/**
 * Score the full skill set against `query`, then park suppressed *user*
 * skills. Any previous `apply` is restored first so scoring always sees the
 * complete library. Project skills are never parked — they are intentional.
 */
function applySkills(cwd, query, options = {}) {
    // Start from a clean slate so we score every skill, not a stale subset.
    if (readState())
        restoreSkills();
    const skills = (0, discover_1.discoverSkills)(cwd);
    const score = (0, score_1.scoreSkills)(skills, query, options);
    fs.mkdirSync((0, config_1.parkedDir)(), { recursive: true });
    const parked = [];
    for (const sc of score.suppressed) {
        if (sc.skill.source !== "user")
            continue; // never park project skills
        const base = path.basename(sc.skill.dir);
        const from = sc.skill.dir;
        const to = path.join((0, config_1.parkedDir)(), base);
        if (fs.existsSync(from) && !fs.existsSync(to)) {
            fs.renameSync(from, to);
            parked.push(base);
        }
    }
    writeState({
        appliedAt: new Date().toISOString(),
        query,
        parked,
    });
    (0, telemetry_1.recordScore)(score, "apply", "cli");
    return { score, parked };
}
