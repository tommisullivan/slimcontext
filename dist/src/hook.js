"use strict";
/**
 * The UserPromptSubmit hook. Claude Code pipes a JSON payload on stdin; the
 * hook scores skills against the prompt, records telemetry, returns an
 * advisory for the model AND a user-visible `systemMessage`.
 *
 * Design rule: the hook must NEVER break a session. Any failure exits 0 with
 * no output.
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
exports.runHook = runHook;
exports.readStdin = readStdin;
exports.hookMain = hookMain;
const path = __importStar(require("path"));
const child_process_1 = require("child_process");
const discover_1 = require("./discover");
const score_1 = require("./score");
const telemetry_1 = require("./telemetry");
const update_1 = require("./update");
/** First sentence of a description, capped, for a compact advisory line. */
function summarize(description) {
    const text = description.replace(/\s+/g, " ").trim();
    if (!text)
        return "(no description)";
    const dot = text.indexOf(". ");
    const sentence = dot > 0 ? text.slice(0, dot + 1) : text;
    return sentence.length > 140 ? `${sentence.slice(0, 137)}...` : sentence;
}
/**
 * Threshold for *which* skills count as "looking relevant" if the user has
 * opted into the verbose chat line. We still apply it (so the count is
 * meaningful when it does appear), even though by default we don't print.
 */
const MIN_SCORE = 0.35;
/**
 * The chat-visible one-liner ("slimcontext · N of M skills look relevant") is
 * opt-in. With 143 verbose skills and common dev vocabulary, lexical scores
 * cluster too tightly for the count to discriminate vague vs specific prompts
 * — so printing it on every chat just adds noise. The model still gets the
 * routing advisory (additionalContext) on every prompt; that's where the
 * actual value lives.
 *
 * Users who want the line back can set `SLIMCONTEXT_VERBOSE=1` in their
 * environment or via the Claude Code hook command.
 */
function verboseEnabled() {
    const v = process.env.SLIMCONTEXT_VERBOSE;
    return v === "1" || v === "true";
}
/** Core hook logic. Pure apart from telemetry logging — easy to test. */
function runHook(input) {
    const prompt = (input.prompt ?? "").trim();
    if (!prompt)
        return { output: "", logged: false };
    const cwd = input.cwd || process.cwd();
    const skills = (0, discover_1.discoverSkills)(cwd);
    if (skills.length === 0)
        return { output: "", logged: false };
    const result = (0, score_1.scoreSkills)(skills, prompt, { minScore: MIN_SCORE });
    (0, telemetry_1.recordScore)(result, "hook", "claude-code");
    if (result.activated.length === 0) {
        return { output: "", logged: true };
    }
    // model-facing advisory — always sent; this is the actual routing value.
    const lines = result.activated.map((s) => `- ${s.skill.name}: ${summarize(s.skill.description)}`);
    const additionalContext = [
        `slimcontext: the skills most relevant to this task are —`,
        ...lines,
    ].join("\n");
    const payload = {
        continue: true,
        suppressOutput: true,
        hookSpecificOutput: {
            hookEventName: "UserPromptSubmit",
            additionalContext,
        },
    };
    // user-visible one-liner is opt-in via SLIMCONTEXT_VERBOSE.
    if (verboseEnabled()) {
        const upd = (0, update_1.updateStatus)();
        const updNote = upd.updateAvailable
            ? `  ·  update available → /update-slimcontext`
            : "";
        payload.systemMessage =
            `slimcontext · ${result.activated.length} of ${skills.length} skills look relevant · ` +
                `≈${result.savedPct}% of the always-on skill index could be parked${updNote}`;
    }
    return { output: JSON.stringify(payload), logged: true };
}
/** Read all of stdin (used by the CLI `hook` subcommand). */
function readStdin() {
    return new Promise((resolve) => {
        let data = "";
        if (process.stdin.isTTY) {
            resolve("");
            return;
        }
        process.stdin.setEncoding("utf8");
        process.stdin.on("data", (chunk) => (data += chunk));
        process.stdin.on("end", () => resolve(data));
        process.stdin.on("error", () => resolve(data));
    });
}
/** Fire-and-forget: refresh the update cache in a detached child, max once/day. */
function maybeRefreshUpdateCache() {
    if (!(0, update_1.cacheIsStale)())
        return;
    try {
        const cli = path.join(__dirname, "cli.js");
        const child = (0, child_process_1.spawn)(process.execPath, [cli, "_refresh-update"], {
            detached: true,
            stdio: "ignore",
        });
        child.unref();
    }
    catch {
        // never let an update check disrupt the session
    }
}
/** Entry point for `slimcontext hook`. Never throws; always exits cleanly. */
async function hookMain() {
    try {
        const raw = await readStdin();
        if (!raw.trim())
            return;
        const input = JSON.parse(raw);
        const { output } = runHook(input);
        if (output)
            process.stdout.write(output);
        maybeRefreshUpdateCache();
    }
    catch {
        // Silent by design — a hook must never disrupt the agent session.
    }
}
