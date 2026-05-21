/**
 * Resolves the files a skill pulls in beyond its own SKILL.md.
 *
 * Skills (GSD's especially) reference workflow / instruction files via Claude
 * Code's `@path` syntax or markdown links. Those load on demand when the skill
 * runs — so they belong in the on-demand body-pool figure.
 */

import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { estimateTokens } from "./tokens";

/** How deep to follow reference chains (a referenced file may reference more). */
const MAX_DEPTH = 3;
/** Skip absurdly large files. */
const MAX_FILE_BYTES = 2_000_000;

const REF_EXTENSIONS = "md|markdown|txt|py|sh|js|ts|cjs|mjs|json|ya?ml|toml";

/** Extract candidate file references from skill/markdown content. */
export function extractReferences(content: string): string[] {
  const refs = new Set<string>();
  // Claude Code `@path` references, e.g. @$HOME/.claude/.../explore.md
  const atRe = new RegExp(
    `@([A-Za-z0-9$~_./\\\\-]+\\.(?:${REF_EXTENSIONS}))`,
    "gi",
  );
  for (const m of content.matchAll(atRe)) refs.add(m[1]);
  // markdown links to local files, e.g. [text](./references/foo.md)
  const mdRe = new RegExp(`\\]\\(([^)]+\\.(?:${REF_EXTENSIONS}))\\)`, "gi");
  for (const m of content.matchAll(mdRe)) {
    const p = m[1].trim();
    if (!/^https?:/i.test(p)) refs.add(p);
  }
  return [...refs];
}

/** Resolve a reference string to an absolute path. */
function resolvePath(ref: string, baseDir: string): string {
  let p = ref.trim().replace(/\\/g, "/");
  if (p.startsWith("$HOME")) p = os.homedir() + p.slice(5);
  else if (p.startsWith("~")) p = os.homedir() + p.slice(1);
  if (path.isAbsolute(p)) return path.normalize(p);
  return path.normalize(path.join(baseDir, p));
}

/**
 * Total estimated tokens of every file a skill transitively references.
 * Deduplicated and depth-limited; never throws.
 */
export function referencedTokens(skillDir: string, content: string): number {
  const visited = new Set<string>();
  let total = 0;

  const walk = (baseDir: string, text: string, depth: number): void => {
    if (depth > MAX_DEPTH) return;
    for (const ref of extractReferences(text)) {
      const resolved = resolvePath(ref, baseDir);
      if (visited.has(resolved)) continue;
      visited.add(resolved);
      let body: string;
      try {
        const stat = fs.statSync(resolved);
        if (!stat.isFile() || stat.size > MAX_FILE_BYTES) continue;
        body = fs.readFileSync(resolved, "utf8");
      } catch {
        continue; // missing / unreadable reference — skip
      }
      total += estimateTokens(body);
      walk(path.dirname(resolved), body, depth + 1);
    }
  };

  walk(skillDir, content, 0);
  return total;
}
