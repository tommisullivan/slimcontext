/** A small, dependency-free BM25 ranking function. */
/** Lowercase, split on non-alphanumerics, drop stopwords and 1-char tokens. */
export declare function tokenize(text: string): string[];
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
