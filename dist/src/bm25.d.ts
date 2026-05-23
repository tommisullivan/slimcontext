/** A small, dependency-free BM25 ranking function. */
/**
 * Tokenise text for BM25.
 * Splits compound identifiers (camelCase/kebab/snake), drops stopwords + 1-char
 * tokens, and emits both the surface form and a light stem so plural/tense
 * variants ("migration"/"migrate", "validation"/"validate") collide.
 */
export declare function tokenize(text: string): string[];
/** Expand a query token list with built-in synonyms. */
export declare function expandQuery(queryTokens: string[]): string[];
export interface Bm25Doc {
    id: string;
    tokens: string[];
}
export declare class Bm25 {
    private readonly k1;
    private readonly b;
    private readonly docMap;
    private readonly df;
    private readonly docLen;
    private readonly avgdl;
    private readonly n;
    constructor(docs: Bm25Doc[]);
    /** BM25 IDF, +1 smoothed so it is never negative for common terms. */
    private idf;
    /** Score a document against a tokenized query. Higher is more relevant. */
    score(docId: string, queryTokens: string[]): number;
}
