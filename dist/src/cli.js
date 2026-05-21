#!/usr/bin/env node
"use strict";
/** slimcontext command-line interface. */
Object.defineProperty(exports, "__esModule", { value: true });
const commander_1 = require("commander");
const discover_1 = require("./discover");
const score_1 = require("./score");
const apply_1 = require("./apply");
const stats_1 = require("./stats");
const telemetry_1 = require("./telemetry");
const install_1 = require("./install");
const command_1 = require("./command");
const hook_1 = require("./hook");
const update_1 = require("./update");
const config_1 = require("./config");
/* ── colour ──────────────────────────────────────────────────────────── */
const COLOR = process.stdout.isTTY === true && !process.env.NO_COLOR;
const paint = (code, s) => COLOR ? `\x1b[${code}m${s}\x1b[0m` : s;
const green = (s) => paint("32", s);
const bgreen = (s) => paint("92;1", s);
const dim = (s) => paint("90", s);
const yellow = (s) => paint("33", s);
function num(n) {
    return n.toLocaleString("en-US");
}
function bar(pct, width = 24) {
    const filled = Math.round((Math.max(0, Math.min(100, pct)) / 100) * width);
    return `[${"#".repeat(filled)}${"-".repeat(width - filled)}]`;
}
function parsePositiveInt(value, fallback) {
    const n = Number.parseInt(value, 10);
    return Number.isFinite(n) && n > 0 ? n : fallback;
}
/** A subtle footer when a newer version is available. */
function updateFooter() {
    const u = (0, update_1.updateStatus)();
    if (u.updateAvailable) {
        console.log(dim(`  ↑ slimcontext ${u.latest} available (you have ${u.current}) — ` +
            `run 'slimcontext update' or /update-slimcontext\n`));
    }
}
function printScore(result, showAll = false) {
    console.log(`\n  ${dim("task")}  ${yellow(`"${result.query}"`)}\n`);
    if (result.scored.length === 0) {
        console.log(`  ${dim("No skills discovered. Is ~/.claude/skills/ populated?")}\n`);
        return;
    }
    for (const s of result.activated) {
        console.log("  " +
            green(`✓ ON  ${s.score.toFixed(2)}  ${s.skill.name}`) +
            dim(`  (≈${num(s.skill.tokensBody)} tok)`));
    }
    const shown = showAll ? result.suppressed : result.suppressed.slice(0, 3);
    for (const s of shown) {
        console.log(dim(`    off  ${s.score.toFixed(2)}  ${s.skill.name}  (≈${num(s.skill.tokensBody)} tok)`));
    }
    const hidden = result.suppressed.length - shown.length;
    if (hidden > 0)
        console.log(dim(`    off  ...   ${hidden} more skills parked`));
    console.log(`\n  ${result.activated.length}/${result.scored.length} skills active`);
    console.log(dim(`  always-on skill index   ≈${num(result.tokensSlim)} / ${num(result.tokensFull)} tok per turn`));
    console.log("  " + bgreen(`saved ≈${num(result.saved)} tokens every turn  (${result.savedPct}% lighter)`));
    console.log(dim(`  on-demand body pool     ≈${num(result.bodyPoolSlim)} / ${num(result.bodyPoolFull)} tok  (loaded only when a skill runs)`));
    console.log("");
}
const program = new commander_1.Command();
program
    .name("slimcontext")
    .description("Trim your AI coding agent's skill context — keep only the skills a task needs.")
    .version(config_1.VERSION);
program
    .command("list")
    .description("List discovered skills and their token cost")
    .action(() => {
    const skills = (0, discover_1.discoverSkills)();
    if (skills.length === 0) {
        console.log("\n  No skills found in ~/.claude/skills/.\n");
        return;
    }
    let index = 0;
    let body = 0;
    console.log(`\n  ${skills.length} skill(s) discovered:\n`);
    for (const s of skills.sort((a, b) => b.tokensBody - a.tokensBody)) {
        index += s.tokensDescription;
        body += s.tokensBody;
        console.log(`  ${s.source === "user" ? "user   " : "project"}  ` +
            `≈${num(s.tokensBody).padStart(7)} tok  ${s.name}`);
    }
    console.log(dim(`\n  always-on skill index: ≈${num(index)} tok per turn  ·  ` +
        `on-demand body pool: ≈${num(body)} tok\n`));
    updateFooter();
});
program
    .command("score")
    .argument("<task...>", "the task you are about to work on")
    .description("Score skills against a task (read-only, no changes)")
    .option("-k, --top <n>", "max skills to activate", String(config_1.DEFAULT_TOP_K))
    .option("--min <score>", "minimum score to activate (0..1)", "0")
    .option("-a, --all", "show every skill, not just the top few")
    .option("--json", "output JSON")
    .action((taskParts, opts) => {
    const result = (0, score_1.scoreSkills)((0, discover_1.discoverSkills)(), taskParts.join(" "), {
        topK: parsePositiveInt(opts.top, config_1.DEFAULT_TOP_K),
        minScore: Number.parseFloat(opts.min) || 0,
    });
    if (opts.json) {
        console.log(JSON.stringify(result, (k, v) => (k === "skill" ? v.name : v), 2));
    }
    else {
        printScore(result, opts.all);
        updateFooter();
    }
});
program
    .command("apply")
    .argument("<task...>", "the task you are about to work on")
    .description("Park irrelevant skills so a session starts lean (reversible)")
    .option("-k, --top <n>", "max skills to keep active", String(config_1.DEFAULT_TOP_K))
    .option("--min <score>", "minimum score to keep active (0..1)", "0")
    .action((taskParts, opts) => {
    const { score, parked } = (0, apply_1.applySkills)(process.cwd(), taskParts.join(" "), {
        topK: parsePositiveInt(opts.top, config_1.DEFAULT_TOP_K),
        minScore: Number.parseFloat(opts.min) || 0,
    });
    printScore(score);
    console.log(`  Parked ${parked.length} skill(s) → run 'slimcontext restore' to undo.\n`);
    updateFooter();
});
program
    .command("restore")
    .description("Move every parked skill back into place")
    .action(() => {
    const { restored } = (0, apply_1.restoreSkills)();
    console.log(restored.length > 0
        ? `\n  Restored ${restored.length} skill(s).\n`
        : "\n  Nothing parked — nothing to restore.\n");
});
program
    .command("status")
    .description("Show install state and any active staging")
    .action(() => {
    const state = (0, apply_1.readState)();
    console.log(`\n  /slimcontext command: ${(0, command_1.isCommandInstalled)() ? "installed" : "not installed"}`);
    console.log(`  advisory hook:        ${(0, install_1.isHookInstalled)() ? "enabled" : "disabled"}`);
    if (state) {
        console.log(`  staged for task:      "${state.query}"`);
        console.log(`  parked skills:        ${state.parked.length} (since ${state.appliedAt})`);
    }
    else {
        console.log("  staging:              none (full skill set active)");
    }
    console.log("");
    updateFooter();
});
program
    .command("stats")
    .description("Show the token-savings dashboard")
    .option("--reset", "erase the telemetry ledger")
    .action((opts) => {
    if (opts.reset) {
        (0, telemetry_1.clearEvents)();
        console.log("\n  Telemetry ledger cleared.\n");
        return;
    }
    const s = (0, stats_1.summarize)();
    if (s.events === 0) {
        console.log("\n  No telemetry yet. Run 'slimcontext apply' or install the hook.\n");
        return;
    }
    console.log("\n  slimcontext — token savings (always-on skill index)\n");
    console.log(`  events recorded:    ${num(s.events)}`);
    console.log(`  total tokens saved: ≈${num(s.totalSaved)}`);
    console.log(`  average saving:     ${s.avgSavedPct}%  ${bar(s.avgSavedPct)}`);
    console.log(`  best single run:    ${s.bestSavedPct}%  ${bar(s.bestSavedPct)}`);
    console.log(`  by mode:            ${Object.entries(s.byMode).map(([m, c]) => `${m}=${c}`).join("  ")}`);
    console.log(`  ledger:             ${(0, telemetry_1.eventsLocation)()}\n`);
    updateFooter();
});
program
    .command("init")
    .description("One-time setup: install the /slimcontext commands and enable the hook")
    .action(() => {
    const cmd = (0, command_1.installCommand)();
    const hook = (0, install_1.installHook)();
    console.log(`\n  slash commands ${cmd.created ? "installed" : "refreshed"}:`);
    cmd.paths.forEach((p) => console.log(`    ${p}`));
    console.log(`  advisory hook  ${hook.alreadyInstalled ? "already enabled" : "enabled"} → ${hook.settingsPath}`);
    if (hook.backupPath && !hook.alreadyInstalled) {
        console.log(`  settings backup → ${hook.backupPath}`);
    }
    console.log("\n  Restart Claude Code, then type /slimcontext to open the menu.\n");
});
program
    .command("enable")
    .description("Enable the advisory hook")
    .action(() => {
    const r = (0, install_1.installHook)();
    console.log(r.alreadyInstalled
        ? "\n  Advisory hook already enabled.\n"
        : `\n  Advisory hook enabled → ${r.settingsPath}\n`);
});
program
    .command("disable")
    .description("Disable the advisory hook")
    .action(() => {
    const r = (0, install_1.uninstallHook)();
    console.log(r.removed ? "\n  Advisory hook disabled.\n" : "\n  Advisory hook was not enabled.\n");
});
program
    .command("uninstall")
    .description("Remove the /slimcontext commands and the hook")
    .action(() => {
    const cmd = (0, command_1.uninstallCommand)();
    const hook = (0, install_1.uninstallHook)();
    console.log(`\n  slash commands: ${cmd.removed ? "removed" : "were not installed"}`);
    console.log(`  advisory hook:  ${hook.removed ? "disabled" : "was not enabled"}\n`);
});
program
    .command("update")
    .description("Update slimcontext to the latest version from GitHub")
    .action(() => {
    console.log("\n  Updating slimcontext from GitHub...");
    const r = (0, update_1.runUpdate)();
    if (r.ok) {
        console.log("  Done. Run 'slimcontext --version' to confirm.\n");
    }
    else {
        console.log(`  Update failed:\n  ${r.output}\n`);
        process.exitCode = 1;
    }
});
program
    .command("check-update")
    .description("Check GitHub for a newer version")
    .action(async () => {
    await (0, update_1.refreshUpdateCache)();
    const u = (0, update_1.updateStatus)();
    if (u.updateAvailable) {
        console.log(`\n  Update available: ${u.latest} (you have ${u.current}).`);
        console.log("  Run 'slimcontext update' or /update-slimcontext.\n");
    }
    else {
        console.log(`\n  slimcontext ${u.current} is up to date.\n`);
    }
});
program
    .command("hook", { hidden: true })
    .description("Internal: run as a Claude Code UserPromptSubmit hook")
    .action(async () => {
    await (0, hook_1.hookMain)();
});
program
    .command("_refresh-update", { hidden: true })
    .description("Internal: refresh the cached update check")
    .action(async () => {
    await (0, update_1.refreshUpdateCache)();
});
program.parseAsync(process.argv).catch((err) => {
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
});
