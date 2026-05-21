"use strict";
/** A small, dependency-free BM25 ranking function. */
Object.defineProperty(exports, "__esModule", { value: true });
exports.Bm25 = void 0;
exports.tokenize = tokenize;
const STOPWORDS = new Set([
    "the", "a", "an", "and", "or", "but", "if", "of", "to", "in", "on", "for",
    "with", "as", "by", "at", "is", "are", "be", "this", "that", "it", "from",
    "you", "your", "i", "we", "they", "he", "she", "do", "does", "can", "will",
    "should", "would", "use", "using", "used", "when", "what", "how", "why",
]);
/** Lowercase, split on non-alphanumerics, drop stopwords and 1-char tokens. */
function tokenize(text) {
    const raw = text.toLowerCase().match(/[a-z0-9]+/g) ?? [];
    return raw.filter((t) => t.length > 1 && !STOPWORDS.has(t));
}
class Bm25 {
    constructor(docs) {
        this.k1 = 1.5;
        this.b = 0.75;
        this.docMap = new Map();
        this.df = new Map();
        this.docLen = new Map();
        this.n = docs.length;
        let total = 0;
        for (const d of docs) {
            this.docMap.set(d.id, d.tokens);
            this.docLen.set(d.id, d.tokens.length);
            total += d.tokens.length;
            for (const t of new Set(d.tokens)) {
                this.df.set(t, (this.df.get(t) ?? 0) + 1);
            }
        }
        this.avgdl = this.n > 0 ? total / this.n : 0;
    }
    /** BM25 IDF, +1 smoothed so it is never negative for common terms. */
    idf(term) {
        const df = this.df.get(term) ?? 0;
        return Math.log(1 + (this.n - df + 0.5) / (df + 0.5));
    }
    /** Score a document against a tokenized query. Higher is more relevant. */
    score(docId, queryTokens) {
        const tokens = this.docMap.get(docId);
        if (!tokens)
            return 0;
        const dl = this.docLen.get(docId) ?? 0;
        const tf = new Map();
        for (const t of tokens)
            tf.set(t, (tf.get(t) ?? 0) + 1);
        let score = 0;
        for (const q of new Set(queryTokens)) {
            const f = tf.get(q) ?? 0;
            if (f === 0)
                continue;
            const denom = f + this.k1 * (1 - this.b + this.b * (dl / (this.avgdl || 1)));
            score += this.idf(q) * ((f * (this.k1 + 1)) / denom);
        }
        return score;
    }
}
exports.Bm25 = Bm25;
