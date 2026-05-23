/** The scoring engine: ranks skills against a task and picks a subset. */

import { Bm25, Bm25Doc, expandQuery, tokenize } from "./bm25";
import { DEFAULT_TOP_K } from "./config";
import {
  Skill,
  ScoredSkill,
  ScoreOptions,
  ScoreResult,
} from "./types";

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Does a glob's literal (non-wildcard) parts appear in the query text? */
function globMentioned(glob: string, queryLower: string): boolean {
  const literals = glob
    .split(/[*?/\\]+/)
    .map((p) => p.replace(/^\./, "").trim())
    .filter((p) => p.length > 2);
  return literals.some((lit) => queryLower.includes(lit.toLowerCase()));
}

/** Manifest-driven boost: keyword, extension, glob, and skill-name signals. */
function triggerBoost(
  skill: Skill,
  query: string,
  queryLower: string,
): { boost: number; reasons: string[] } {
  const reasons: string[] = [];
  let boost = 0;
  const triggers = skill.manifest?.triggers;

  if (triggers) {
    for (const kw of triggers.keywords) {
      if (kw && queryLower.includes(kw.toLowerCase())) {
        boost += 0.5;
        reasons.push(`keyword "${kw}"`);
      }
    }
    for (const ext of triggers.extensions) {
      if (ext && new RegExp(`\\.${escapeRegExp(ext)}\\b`, "i").test(query)) {
        boost += 0.4;
        reasons.push(`extension .${ext}`);
      }
    }
    for (const glob of triggers.globs) {
      if (glob && globMentioned(glob, queryLower)) {
        boost += 0.3;
        reasons.push(`glob ${glob}`);
      }
    }
  }

  // An explicit skill-name mention is the strongest possible signal.
  if (skill.name.length > 2 && queryLower.includes(skill.name.toLowerCase())) {
    boost += 0.6;
    reasons.push("skill name mentioned");
  }

  return { boost: Math.min(1, boost), reasons };
}

/** Pull in skills that activated skills declare a dependency on. */
function expandDependencies(
  scored: ScoredSkill[],
  activated: Set<string>,
): void {
  const byName = new Map(scored.map((s) => [s.skill.name, s]));
  let changed = true;
  while (changed) {
    changed = false;
    for (const sc of scored) {
      if (!sc.activated) continue;
      for (const dep of sc.skill.manifest?.dependsOn ?? []) {
        const target = byName.get(dep);
        if (target && !target.activated) {
          target.activated = true;
          target.reasons.push(`dependency of "${sc.skill.name}"`);
          activated.add(dep);
          changed = true;
        }
      }
    }
  }
}

/**
 * Score every skill against `query` and decide which to activate.
 * Pure and deterministic — no I/O, no network, no paid API calls.
 */
export function scoreSkills(
  skills: Skill[],
  query: string,
  options: ScoreOptions = {},
): ScoreResult {
  const topK = options.topK ?? DEFAULT_TOP_K;
  const minScore = options.minScore ?? 0;
  const queryLower = query.toLowerCase();
  const queryTokens = expandQuery(tokenize(query));

  const docs: Bm25Doc[] = skills.map((s) => ({
    id: s.name,
    tokens: tokenize(`${s.name} ${s.description} ${s.body}`),
  }));
  const bm25 = new Bm25(docs);
  const rawBm25 = skills.map((s) => bm25.score(s.name, queryTokens));
  const maxBm25 = Math.max(0.0001, ...rawBm25);

  const scored: ScoredSkill[] = skills.map((skill, i) => {
    const bm = rawBm25[i] / maxBm25;
    const { boost, reasons } = triggerBoost(skill, query, queryLower);
    const alwaysLoad = skill.manifest?.alwaysLoad ?? false;

    let score = Math.min(1, bm * 0.7 + boost);
    if (alwaysLoad) score = 1;

    const allReasons = [...reasons];
    if (bm > 0.01) allReasons.push(`bm25 relevance ${bm.toFixed(2)}`);
    if (alwaysLoad) allReasons.push("alwaysLoad");

    return {
      skill,
      score,
      bm25: bm,
      triggerBoost: boost,
      alwaysLoad,
      reasons: allReasons,
      activated: false,
    };
  });

  scored.sort((a, b) => b.score - a.score || a.skill.name.localeCompare(b.skill.name));

  const activatedNames = new Set<string>();
  // alwaysLoad skills are activated unconditionally and do not consume topK.
  for (const sc of scored) {
    if (sc.alwaysLoad) {
      sc.activated = true;
      activatedNames.add(sc.skill.name);
    }
  }
  // Fill remaining slots with the highest scorers above minScore.
  let slots = topK;
  for (const sc of scored) {
    if (slots <= 0) break;
    if (sc.activated) continue;
    if (sc.score <= minScore) continue;
    sc.activated = true;
    activatedNames.add(sc.skill.name);
    slots--;
  }
  expandDependencies(scored, activatedNames);

  const activated = scored.filter((s) => s.activated);
  const suppressed = scored.filter((s) => !s.activated);

  // The honest per-turn metric: the skill *index* (name + description) is what
  // Claude Code keeps in context for every installed skill on every turn.
  const tokensFull = skills.reduce((sum, s) => sum + s.tokensDescription, 0);
  const tokensSlim = activated.reduce(
    (sum, s) => sum + s.skill.tokensDescription,
    0,
  );
  const saved = tokensFull - tokensSlim;
  const savedPct =
    tokensFull > 0 ? Math.round((saved / tokensFull) * 1000) / 10 : 0;

  // Secondary: the on-demand body pool — full SKILL.md text, loaded only when a
  // skill is actually used. Parking a skill also removes it from this pool.
  // body pool = SKILL.md + every file the skill transitively references
  const bodyPoolFull = skills.reduce(
    (sum, s) => sum + s.tokensBody + s.tokensReferenced,
    0,
  );
  const bodyPoolSlim = activated.reduce(
    (sum, s) => sum + s.skill.tokensBody + s.skill.tokensReferenced,
    0,
  );

  return {
    query,
    scored,
    activated,
    suppressed,
    tokensFull,
    tokensSlim,
    saved,
    savedPct,
    bodyPoolFull,
    bodyPoolSlim,
  };
}
