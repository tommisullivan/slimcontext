#!/usr/bin/env node
/** slimcontext command-line interface. */

import { Command } from "commander";
import { discoverSkills } from "./discover";
import { scoreSkills } from "./score";
import { applySkills, restoreSkills, readState } from "./apply";
import { summarize } from "./stats";
import { clearEvents, eventsLocation } from "./telemetry";
import { installHook, uninstallHook, isHookInstalled } from "./install";
import { installCommand, uninstallCommand, isCommandInstalled } from "./command";
import { hookMain } from "./hook";
import { runUpdate, updateStatus, refreshUpdateCache } from "./update";
import { ScoredSkill, ScoreResult } from "./types";
import { DEFAULT_TOP_K, VERSION } from "./config";

/* ── colour ──────────────────────────────────────────────────────────── */
const COLOR = process.stdout.isTTY === true && !process.env.NO_COLOR;
const paint = (code: string, s: string): string =>
  COLOR ? `\x1b[${code}m${s}\x1b[0m` : s;
const green = (s: string) => paint("32", s);
const bgreen = (s: string) => paint("92;1", s);
const dim = (s: string) => paint("90", s);
const yellow = (s: string) => paint("33", s);

function num(n: number): string {
  return n.toLocaleString("en-US");
}
function bar(pct: number, width = 24): string {
  const filled = Math.round((Math.max(0, Math.min(100, pct)) / 100) * width);
  return `[${"#".repeat(filled)}${"-".repeat(width - filled)}]`;
}
function parsePositiveInt(value: string, fallback: number): number {
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

/** A subtle footer when a newer version is available. */
function updateFooter(): void {
  const u = updateStatus();
  if (u.updateAvailable) {
    console.log(
      dim(
        `  ↑ slimcontext ${u.latest} available (you have ${u.current}) — ` +
          `run 'slimcontext update' or /update-slimcontext\n`,
      ),
    );
  }
}

function printScore(result: ScoreResult, showAll = false): void {
  console.log(`\n  ${dim("task")}  ${yellow(`"${result.query}"`)}\n`);
  if (result.scored.length === 0) {
    console.log(`  ${dim("No skills discovered. Is ~/.claude/skills/ populated?")}\n`);
    return;
  }
  for (const s of result.activated) {
    console.log(
      "  " +
        green(`✓ ON  ${s.score.toFixed(2)}  ${s.skill.name}`) +
        dim(`  (≈${num(s.skill.tokensBody)} tok)`),
    );
  }
  const shown = showAll ? result.suppressed : result.suppressed.slice(0, 3);
  for (const s of shown) {
    console.log(
      dim(`    off  ${s.score.toFixed(2)}  ${s.skill.name}  (≈${num(s.skill.tokensBody)} tok)`),
    );
  }
  const hidden = result.suppressed.length - shown.length;
  if (hidden > 0) console.log(dim(`    off  ...   ${hidden} more skills parked`));

  console.log(`\n  ${result.activated.length}/${result.scored.length} skills active`);
  console.log(
    dim(`  always-on skill index   ≈${num(result.tokensSlim)} / ${num(result.tokensFull)} tok per turn`),
  );
  console.log(
    "  " + bgreen(`saved ≈${num(result.saved)} tokens every turn  (${result.savedPct}% lighter)`),
  );
  console.log(
    dim(`  on-demand body pool     ≈${num(result.bodyPoolSlim)} / ${num(result.bodyPoolFull)} tok  (loaded only when a skill runs)`),
  );
  console.log("");
}

const program = new Command();
program
  .name("slimcontext")
  .description("Trim your AI coding agent's skill context — keep only the skills a task needs.")
  .version(VERSION);

program
  .command("list")
  .description("List discovered skills and their token cost")
  .action(() => {
    const skills = discoverSkills();
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
      console.log(
        `  ${s.source === "user" ? "user   " : "project"}  ` +
          `≈${num(s.tokensBody).padStart(7)} tok  ${s.name}`,
      );
    }
    console.log(
      dim(`\n  always-on skill index: ≈${num(index)} tok per turn  ·  ` +
        `on-demand body pool: ≈${num(body)} tok\n`),
    );
    updateFooter();
  });

program
  .command("score")
  .argument("<task...>", "the task you are about to work on")
  .description("Score skills against a task (read-only, no changes)")
  .option("-k, --top <n>", "max skills to activate", String(DEFAULT_TOP_K))
  .option("--min <score>", "minimum score to activate (0..1)", "0")
  .option("-a, --all", "show every skill, not just the top few")
  .option("--json", "output JSON")
  .action((taskParts: string[], opts: { top: string; min: string; all?: boolean; json?: boolean }) => {
    const result = scoreSkills(discoverSkills(), taskParts.join(" "), {
      topK: parsePositiveInt(opts.top, DEFAULT_TOP_K),
      minScore: Number.parseFloat(opts.min) || 0,
    });
    if (opts.json) {
      console.log(
        JSON.stringify(result, (k, v) => (k === "skill" ? (v as ScoredSkill["skill"]).name : v), 2),
      );
    } else {
      printScore(result, opts.all);
      updateFooter();
    }
  });

program
  .command("apply")
  .argument("<task...>", "the task you are about to work on")
  .description("Park irrelevant skills so a session starts lean (reversible)")
  .option("-k, --top <n>", "max skills to keep active", String(DEFAULT_TOP_K))
  .option("--min <score>", "minimum score to keep active (0..1)", "0")
  .action((taskParts: string[], opts: { top: string; min: string }) => {
    const { score, parked } = applySkills(process.cwd(), taskParts.join(" "), {
      topK: parsePositiveInt(opts.top, DEFAULT_TOP_K),
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
    const { restored } = restoreSkills();
    console.log(
      restored.length > 0
        ? `\n  Restored ${restored.length} skill(s).\n`
        : "\n  Nothing parked — nothing to restore.\n",
    );
  });

program
  .command("status")
  .description("Show install state and any active staging")
  .action(() => {
    const state = readState();
    console.log(`\n  /slimcontext command: ${isCommandInstalled() ? "installed" : "not installed"}`);
    console.log(`  advisory hook:        ${isHookInstalled() ? "enabled" : "disabled"}`);
    if (state) {
      console.log(`  staged for task:      "${state.query}"`);
      console.log(`  parked skills:        ${state.parked.length} (since ${state.appliedAt})`);
    } else {
      console.log("  staging:              none (full skill set active)");
    }
    console.log("");
    updateFooter();
  });

program
  .command("stats")
  .description("Show the token-savings dashboard")
  .option("--reset", "erase the telemetry ledger")
  .action((opts: { reset?: boolean }) => {
    if (opts.reset) {
      clearEvents();
      console.log("\n  Telemetry ledger cleared.\n");
      return;
    }
    const s = summarize();
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
    console.log(`  ledger:             ${eventsLocation()}\n`);
    updateFooter();
  });

program
  .command("init")
  .description("One-time setup: install the /slimcontext commands and enable the hook")
  .action(() => {
    const cmd = installCommand();
    const hook = installHook();
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
    const r = installHook();
    console.log(
      r.alreadyInstalled
        ? "\n  Advisory hook already enabled.\n"
        : `\n  Advisory hook enabled → ${r.settingsPath}\n`,
    );
  });

program
  .command("disable")
  .description("Disable the advisory hook")
  .action(() => {
    const r = uninstallHook();
    console.log(
      r.removed ? "\n  Advisory hook disabled.\n" : "\n  Advisory hook was not enabled.\n",
    );
  });

program
  .command("uninstall")
  .description("Remove the /slimcontext commands and the hook")
  .action(() => {
    const cmd = uninstallCommand();
    const hook = uninstallHook();
    console.log(`\n  slash commands: ${cmd.removed ? "removed" : "were not installed"}`);
    console.log(`  advisory hook:  ${hook.removed ? "disabled" : "was not enabled"}\n`);
  });

program
  .command("update")
  .description("Update slimcontext to the latest version from GitHub")
  .action(() => {
    console.log("\n  Updating slimcontext from GitHub...");
    const r = runUpdate();
    if (r.ok) {
      console.log("  Done. Run 'slimcontext --version' to confirm.\n");
    } else {
      console.log(`  Update failed:\n  ${r.output}\n`);
      process.exitCode = 1;
    }
  });

program
  .command("check-update")
  .description("Check GitHub for a newer version")
  .action(async () => {
    await refreshUpdateCache();
    const u = updateStatus();
    if (u.updateAvailable) {
      console.log(`\n  Update available: ${u.latest} (you have ${u.current}).`);
      console.log("  Run 'slimcontext update' or /update-slimcontext.\n");
    } else {
      console.log(`\n  slimcontext ${u.current} is up to date.\n`);
    }
  });

program
  .command("hook", { hidden: true })
  .description("Internal: run as a Claude Code UserPromptSubmit hook")
  .action(async () => {
    await hookMain();
  });

program
  .command("_refresh-update", { hidden: true })
  .description("Internal: refresh the cached update check")
  .action(async () => {
    await refreshUpdateCache();
  });

program.parseAsync(process.argv).catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
