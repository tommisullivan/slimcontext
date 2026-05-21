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
import { ScoredSkill, ScoreResult } from "./types";
import { DEFAULT_TOP_K } from "./config";

const VERSION = "0.1.0";

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

function printScore(result: ScoreResult): void {
  console.log(`\n  task: "${result.query}"\n`);
  if (result.scored.length === 0) {
    console.log("  No skills discovered. Is ~/.claude/skills/ populated?\n");
    return;
  }
  for (const s of result.scored) {
    const mark = s.activated ? "✓ ON " : "  off";
    const score = s.score.toFixed(2);
    console.log(
      `  ${mark}  ${score}  ${s.skill.name}  (≈${num(s.skill.tokensBody)} tok)`,
    );
    if (s.activated && s.reasons.length > 0) {
      console.log(`           ↳ ${s.reasons.join(", ")}`);
    }
  }
  console.log(
    `\n  ${result.activated.length}/${result.scored.length} skills active  ·  ` +
      `≈${num(result.tokensSlim)} / ${num(result.tokensFull)} tokens  ·  ` +
      `saved ≈${num(result.saved)} (${result.savedPct}%)\n`,
  );
}

const program = new Command();
program
  .name("slimcontext")
  .description(
    "Free, fully-local skill relevance scorer with a token-savings dashboard.",
  )
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
    let total = 0;
    console.log(`\n  ${skills.length} skill(s) discovered:\n`);
    for (const s of skills.sort((a, b) => b.tokensBody - a.tokensBody)) {
      total += s.tokensBody;
      console.log(
        `  ${s.source === "user" ? "user   " : "project"}  ` +
          `≈${num(s.tokensBody).padStart(7)} tok  ${s.name}`,
      );
    }
    console.log(`\n  Total skill context: ≈${num(total)} tokens\n`);
  });

program
  .command("score")
  .argument("<task...>", "the task you are about to work on")
  .description("Score skills against a task (read-only, no changes)")
  .option("-k, --top <n>", "max skills to activate", String(DEFAULT_TOP_K))
  .option("--min <score>", "minimum score to activate (0..1)", "0")
  .option("--json", "output JSON")
  .action((taskParts: string[], opts: { top: string; min: string; json?: boolean }) => {
    const skills = discoverSkills();
    const result = scoreSkills(skills, taskParts.join(" "), {
      topK: parsePositiveInt(opts.top, DEFAULT_TOP_K),
      minScore: Number.parseFloat(opts.min) || 0,
    });
    if (opts.json) {
      console.log(JSON.stringify(result, (k, v) => (k === "skill" ? (v as ScoredSkill["skill"]).name : v), 2));
    } else {
      printScore(result);
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
    console.log("\n  slimcontext — token savings\n");
    console.log(`  events recorded:   ${num(s.events)}`);
    console.log(`  total tokens saved: ≈${num(s.totalSaved)}`);
    console.log(`  average saving:    ${s.avgSavedPct}%  ${bar(s.avgSavedPct)}`);
    console.log(`  best single run:   ${s.bestSavedPct}%  ${bar(s.bestSavedPct)}`);
    console.log(`  by mode:           ${Object.entries(s.byMode).map(([m, c]) => `${m}=${c}`).join("  ")}`);
    console.log(`  window:            ${s.firstTs ?? "?"}  →  ${s.lastTs ?? "?"}`);
    console.log(`  ledger:            ${eventsLocation()}\n`);
  });

program
  .command("init")
  .description("One-time setup: install the /slimcontext command and enable the hook")
  .action(() => {
    const cmd = installCommand();
    const hook = installHook();
    console.log(`\n  /slimcontext command ${cmd.created ? "installed" : "refreshed"} → ${cmd.path}`);
    console.log(
      `  advisory hook        ${hook.alreadyInstalled ? "already enabled" : "enabled"} → ${hook.settingsPath}`,
    );
    if (hook.backupPath && !hook.alreadyInstalled) {
      console.log(`  settings backup      → ${hook.backupPath}`);
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
      r.removed
        ? "\n  Advisory hook disabled.\n"
        : "\n  Advisory hook was not enabled.\n",
    );
  });

program
  .command("uninstall")
  .description("Remove the /slimcontext command and the hook")
  .action(() => {
    const cmd = uninstallCommand();
    const hook = uninstallHook();
    console.log(`\n  /slimcontext command: ${cmd.removed ? "removed" : "was not installed"}`);
    console.log(`  advisory hook:        ${hook.removed ? "disabled" : "was not enabled"}\n`);
  });

program
  .command("hook", { hidden: true })
  .description("Internal: run as a Claude Code UserPromptSubmit hook")
  .action(async () => {
    await hookMain();
  });

program.parseAsync(process.argv).catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
