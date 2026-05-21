/**
 * Staging: `apply` parks suppressed user skills out of the Claude Code skill
 * directory so a session starts with only the relevant ones; `restore` undoes
 * it. Skills are moved (never deleted), so the operation is fully reversible.
 */
import { ScoreOptions, ScoreResult, SlimState } from "./types";
export declare function readState(): SlimState | null;
/** Move every parked skill back into the user skills directory. */
export declare function restoreSkills(): {
    restored: string[];
};
export interface ApplyResult {
    score: ScoreResult;
    parked: string[];
}
/**
 * Score the full skill set against `query`, then park suppressed *user*
 * skills. Any previous `apply` is restored first so scoring always sees the
 * complete library. Project skills are never parked — they are intentional.
 */
export declare function applySkills(cwd: string, query: string, options?: ScoreOptions): ApplyResult;
