/** The scoring engine: ranks skills against a task and picks a subset. */
import { Skill, ScoreOptions, ScoreResult } from "./types";
/**
 * Score every skill against `query` and decide which to activate.
 * Pure and deterministic — no I/O, no network, no paid API calls.
 */
export declare function scoreSkills(skills: Skill[], query: string, options?: ScoreOptions): ScoreResult;
