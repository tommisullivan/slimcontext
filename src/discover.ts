/** Discovery of installed skills from the Claude Code skill directories. */

import * as fs from "fs";
import * as path from "path";
import { parse } from "yaml";
import { Skill, SkillSource } from "./types";
import { projectSkillsDir, userSkillsDir } from "./config";
import { loadManifest } from "./manifest";
import { estimateTokens } from "./tokens";
import { referencedTokens } from "./references";

export interface DiscoverOptions {
  /**
   * Follow each skill's `@path` / markdown file references and count their
   * tokens too. Adds filesystem reads — off by default so the hook stays fast.
   */
  resolveReferences?: boolean;
}

/** Split a markdown file into YAML frontmatter data and the body. */
export function parseFrontmatter(content: string): {
  data: Record<string, unknown>;
  body: string;
} {
  if (content.startsWith("---")) {
    const close = content.indexOf("\n---", 3);
    if (close !== -1) {
      const fm = content.slice(3, close).trim();
      let body = content.slice(close + 4);
      body = body.replace(/^[^\n]*\n/, ""); // drop the rest of the closing line
      try {
        const data = parse(fm);
        return {
          data: (data && typeof data === "object" ? data : {}) as Record<
            string,
            unknown
          >,
          body,
        };
      } catch {
        return { data: {}, body: content };
      }
    }
  }
  return { data: {}, body: content };
}

/** Locate the SKILL.md inside a skill directory (case-insensitive). */
function findSkillFile(skillDir: string): string | null {
  let entries: string[];
  try {
    entries = fs.readdirSync(skillDir);
  } catch {
    return null;
  }
  const match = entries.find((e) => e.toLowerCase() === "skill.md");
  return match ? path.join(skillDir, match) : null;
}

function readSkillsFrom(
  dir: string,
  source: SkillSource,
  opts: DiscoverOptions,
): Skill[] {
  if (!fs.existsSync(dir)) return [];
  const out: Skill[] = [];
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return [];
  }
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const skillDir = path.join(dir, entry.name);
    const file = findSkillFile(skillDir);
    if (!file) continue;
    let content: string;
    try {
      content = fs.readFileSync(file, "utf8");
    } catch {
      continue;
    }
    const { data } = parseFrontmatter(content);
    const name = String(data.name ?? entry.name).trim() || entry.name;
    const description = String(data.description ?? "").trim();
    out.push({
      name,
      dir: skillDir,
      file,
      description,
      body: content,
      source,
      manifest: loadManifest(skillDir),
      tokensDescription: estimateTokens(`${name} ${description}`),
      tokensBody: estimateTokens(content),
      tokensReferenced: opts.resolveReferences
        ? referencedTokens(skillDir, content)
        : 0,
    });
  }
  return out;
}

/**
 * Discover every skill visible to an agent running in `cwd`.
 * User skills first, then project skills; project shadows user on name clash.
 */
export function discoverSkills(
  cwd: string = process.cwd(),
  opts: DiscoverOptions = {},
): Skill[] {
  const user = readSkillsFrom(userSkillsDir(), "user", opts);
  const project = readSkillsFrom(projectSkillsDir(cwd), "project", opts);
  const byName = new Map<string, Skill>();
  for (const s of user) byName.set(s.name, s);
  for (const s of project) byName.set(s.name, s);
  return [...byName.values()];
}
