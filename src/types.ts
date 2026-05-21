/** Core types shared across slimcontext. */

export type SkillSource = "user" | "project";

export interface SkillTriggers {
  keywords: string[];
  globs: string[];
  extensions: string[];
}

export interface SkillManifest {
  alwaysLoad: boolean;
  triggers: SkillTriggers;
  dependsOn: string[];
}

export interface Skill {
  /** Skill name from SKILL.md frontmatter, falling back to directory name. */
  name: string;
  /** Absolute path to the skill directory. */
  dir: string;
  /** Absolute path to the SKILL.md file. */
  file: string;
  /** Description from SKILL.md frontmatter. */
  description: string;
  /** Full SKILL.md content. */
  body: string;
  source: SkillSource;
  manifest: SkillManifest | null;
  /** Estimated tokens for name + description (the startup index cost). */
  tokensDescription: number;
  /** Estimated tokens for the full SKILL.md (the activation cost). */
  tokensBody: number;
}

export interface ScoredSkill {
  skill: Skill;
  /** Final normalized score, 0..1. */
  score: number;
  /** Normalized BM25 component, 0..1. */
  bm25: number;
  /** Manifest trigger boost, 0..1. */
  triggerBoost: number;
  alwaysLoad: boolean;
  reasons: string[];
  activated: boolean;
}

export interface ScoreOptions {
  /** Maximum skills to activate (excluding dependency expansion). Default 8. */
  topK?: number;
  /** Skills scoring at or below this are never activated unless alwaysLoad. Default 0. */
  minScore?: number;
}

export interface ScoreResult {
  query: string;
  /** Every discovered skill, ranked high to low. */
  scored: ScoredSkill[];
  activated: ScoredSkill[];
  suppressed: ScoredSkill[];
  /** Estimated tokens if every skill body were loaded. */
  tokensFull: number;
  /** Estimated tokens for activated skill bodies only. */
  tokensSlim: number;
  saved: number;
  savedPct: number;
}

export type TelemetryMode = "score" | "apply" | "hook";

export interface TelemetryEvent {
  ts: string;
  query: string;
  agent: string;
  skillsAvailable: number;
  skillsActivated: number;
  tokensFull: number;
  tokensSlim: number;
  saved: number;
  savedPct: number;
  mode: TelemetryMode;
}

export interface SlimState {
  appliedAt: string;
  query: string;
  /** Skill directory basenames currently parked. */
  parked: string[];
}
