/**
 * Rough token estimate.
 *
 * The chars/4 heuristic is the industry-standard quick approximation for mixed
 * English text and code. slimcontext labels every token figure as an estimate
 * ("≈") in user-facing output — it is for relative comparison (full vs slim),
 * not billing.
 */
export declare function estimateTokens(text: string): number;
