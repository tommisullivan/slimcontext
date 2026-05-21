"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.estimateTokens = estimateTokens;
/**
 * Rough token estimate.
 *
 * The chars/4 heuristic is the industry-standard quick approximation for mixed
 * English text and code. slimcontext labels every token figure as an estimate
 * ("≈") in user-facing output — it is for relative comparison (full vs slim),
 * not billing.
 */
function estimateTokens(text) {
    if (!text)
        return 0;
    return Math.ceil(text.length / 4);
}
