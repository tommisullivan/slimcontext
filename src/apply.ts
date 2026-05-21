/**
 * Staging: `apply` parks suppressed user skills out of the Claude Code skill
 * directory so a session starts with only the relevant ones; `restore` undoes
 * it. Skills are moved (never deleted), so the operation is fully reversible.
 */

import * as fs from "fs";
import * as path from "path";
import { parkedDir, stateFile, userSkillsDir } from "./config";
import { discoverSkills } from "./discover";
import { scoreSkills } from "./score";
import { recordScore } from "./telemetry";
import { ScoreOptions, ScoreResult, SlimState } from "./types";

export function readState(): SlimState | null {
  const file = stateFile();
  if (!fs.existsSync(file)) return null;
  try {
    return JSON.parse(fs.readFileSync(file, "utf8")) as SlimState;
  } catch {
    return null;
  }
}

function writeState(state: SlimState): void {
  fs.mkdirSync(path.dirname(stateFile()), { recursive: true });
  fs.writeFileSync(stateFile(), JSON.stringify(state, null, 2), "utf8");
}

function clearState(): void {
  if (fs.existsSync(stateFile())) fs.rmSync(stateFile());
}

/** Move every parked skill back into the user skills directory. */
export function restoreSkills(): { restored: string[] } {
  const state = readState();
  const restored: string[] = [];
  if (!state) return { restored };

  for (const base of state.parked) {
    const from = path.join(parkedDir(), base);
    const to = path.join(userSkillsDir(), base);
    if (fs.existsSync(from) && !fs.existsSync(to)) {
      fs.renameSync(from, to);
      restored.push(base);
    }
  }
  clearState();
  return { restored };
}

export interface ApplyResult {
  score: ScoreResult;
  parked: string[];
}

/**
 * Score the full skill set against `query`, then park suppressed *user*
 * skills. Any previous `apply` is restored first so scoring always sees the
 * complete library. Project skills are never parked — they are intentional.
 */
export function applySkills(
  cwd: string,
  query: string,
  options: ScoreOptions = {},
): ApplyResult {
  // Start from a clean slate so we score every skill, not a stale subset.
  if (readState()) restoreSkills();

  const skills = discoverSkills(cwd, { resolveReferences: true });
  const score = scoreSkills(skills, query, options);

  fs.mkdirSync(parkedDir(), { recursive: true });
  const parked: string[] = [];
  for (const sc of score.suppressed) {
    if (sc.skill.source !== "user") continue; // never park project skills
    const base = path.basename(sc.skill.dir);
    const from = sc.skill.dir;
    const to = path.join(parkedDir(), base);
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
  recordScore(score, "apply", "cli");
  return { score, parked };
}
