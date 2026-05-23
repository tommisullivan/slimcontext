/** A small, dependency-free BM25 ranking function. */

const STOPWORDS = new Set([
  "the", "a", "an", "and", "or", "but", "if", "of", "to", "in", "on", "for",
  "with", "as", "by", "at", "is", "are", "be", "this", "that", "it", "from",
  "you", "your", "i", "we", "they", "he", "she", "do", "does", "can", "will",
  "should", "would", "use", "using", "used", "when", "what", "how", "why",
]);

/** Split camelCase, kebab-case and snake_case into lowercase parts. */
function splitCompound(token: string): string[] {
  const parts = token
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .split(/[-_]+|\s+/)
    .map((p) => p.toLowerCase())
    .filter(Boolean);
  return parts.length > 1 ? parts : [token.toLowerCase()];
}

/** Very light stemming — strip a few common English suffixes. */
function stem(token: string): string {
  const suffixes = ["ing", "tion", "ment", "ness", "ies", "ied", "ed", "es", "ly", "s"];
  for (const s of suffixes) {
    if (token.length > s.length + 3 && token.endsWith(s)) {
      const base = token.slice(0, -s.length);
      return s === "ies" ? `${base}y` : base;
    }
  }
  return token;
}

/**
 * Tokenise text for BM25.
 * Splits compound identifiers (camelCase/kebab/snake), drops stopwords + 1-char
 * tokens, and emits both the surface form and a light stem so plural/tense
 * variants ("migration"/"migrate", "validation"/"validate") collide.
 */
export function tokenize(text: string): string[] {
  const raw = text.match(/[A-Za-z0-9]+/g) ?? [];
  const tokens = new Set<string>();
  for (const rawTok of raw) {
    for (const part of splitCompound(rawTok)) {
      if (part.length < 2 || STOPWORDS.has(part)) continue;
      tokens.add(part);
      const stemmed = stem(part);
      if (stemmed !== part && stemmed.length >= 2) tokens.add(stemmed);
    }
  }
  return [...tokens];
}

/** Small built-in dev-tech synonym table. Cheap step toward semantic scoring. */
const SYNONYMS: Record<string, string[]> = {
  auth: ["login", "authentication", "authorization", "signin"],
  login: ["auth", "signin", "authentication"],
  test: ["spec", "testing", "tdd"],
  spec: ["test", "testing"],
  k8s: ["kubernetes"],
  kubernetes: ["k8s"],
  docker: ["container", "containerization"],
  js: ["javascript"],
  javascript: ["js"],
  ts: ["typescript"],
  typescript: ["ts"],
  db: ["database", "sql"],
  database: ["db", "sql"],
  sql: ["database", "query", "migration"],
  api: ["endpoint", "rest", "graphql"],
  deploy: ["ship", "release", "publish"],
  build: ["compile", "bundle"],
  ui: ["interface", "frontend", "component"],
  frontend: ["ui", "client"],
  backend: ["server", "api"],
  form: ["input", "validation"],
  validation: ["validate", "form"],
  react: ["jsx", "component", "frontend"],
  migrate: ["migration", "schema"],
  migration: ["migrate", "schema", "sql"],
  debug: ["debugger", "troubleshoot", "bug"],
  doc: ["documentation", "docs"],
  docs: ["doc", "documentation"],
  documentation: ["doc", "docs"],
  pr: ["pull-request", "review"],
  mcp: ["model-context-protocol", "tool"],
};

/** Expand a query token list with built-in synonyms. */
export function expandQuery(queryTokens: string[]): string[] {
  const out = new Set(queryTokens);
  for (const t of queryTokens) {
    const syn = SYNONYMS[t];
    if (syn) for (const s of syn) out.add(s);
  }
  return [...out];
}

export interface Bm25Doc {
  id: string;
  tokens: string[];
}

export class Bm25 {
  private readonly k1 = 1.5;
  private readonly b = 0.75;
  private readonly docMap = new Map<string, string[]>();
  private readonly df = new Map<string, number>();
  private readonly docLen = new Map<string, number>();
  private readonly avgdl: number;
  private readonly n: number;

  constructor(docs: Bm25Doc[]) {
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
  private idf(term: string): number {
    const df = this.df.get(term) ?? 0;
    return Math.log(1 + (this.n - df + 0.5) / (df + 0.5));
  }

  /** Score a document against a tokenized query. Higher is more relevant. */
  score(docId: string, queryTokens: string[]): number {
    const tokens = this.docMap.get(docId);
    if (!tokens) return 0;
    const dl = this.docLen.get(docId) ?? 0;
    const tf = new Map<string, number>();
    for (const t of tokens) tf.set(t, (tf.get(t) ?? 0) + 1);

    let score = 0;
    for (const q of new Set(queryTokens)) {
      const f = tf.get(q) ?? 0;
      if (f === 0) continue;
      const denom =
        f + this.k1 * (1 - this.b + this.b * (dl / (this.avgdl || 1)));
      score += this.idf(q) * ((f * (this.k1 + 1)) / denom);
    }
    return score;
  }
}
