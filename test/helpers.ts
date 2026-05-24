/** Shared test fixtures and utilities. */

import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { Skill, SkillManifest } from "../src/types";
import { estimateTokens } from "../src/tokens";

export interface FakeSkillSpec {
  name: string;
  description: string;
  body?: string;
  /** Raw slimcontext.yaml content, if the skill should have a manifest. */
  manifest?: string;
}

/** Create a temp directory; returns its absolute path. */
export function tmp(prefix: string): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), `slimctx-${prefix}-`));
}

/** Build a temp Claude-Code-style skills directory from specs. */
export function makeSkillsDir(specs: FakeSkillSpec[]): string {
  const dir = tmp("skills");
  for (const spec of specs) {
    const skillDir = path.join(dir, spec.name);
    fs.mkdirSync(skillDir, { recursive: true });
    const frontmatter =
      `---\nname: ${spec.name}\n` +
      `description: ${JSON.stringify(spec.description)}\n---\n`;
    fs.writeFileSync(
      path.join(skillDir, "SKILL.md"),
      frontmatter + (spec.body ?? `# ${spec.name}\n\nA skill.\n`),
    );
    if (spec.manifest !== undefined) {
      fs.writeFileSync(
        path.join(skillDir, "slimcontext.yaml"),
        spec.manifest,
      );
    }
  }
  return dir;
}

/** Construct a Skill object directly, for unit-testing the scorer. */
export function fakeSkill(
  name: string,
  description: string,
  body = "",
  manifest: SkillManifest | null = null,
): Skill {
  const full = body || `# ${name}\n\n${description}\n`;
  return {
    name,
    dir: path.join(os.tmpdir(), name),
    file: path.join(os.tmpdir(), name, "SKILL.md"),
    description,
    body: full,
    source: "user",
    manifest,
    tokensDescription: estimateTokens(`${name} ${description}`),
    tokensBody: estimateTokens(full),
    tokensReferenced: 0,
  };
}

/** Point slimcontext's state + skills paths at fresh temp dirs for a test. */
export function isolate(skillsDir?: string): {
  home: string;
  skillsDir: string;
  settings: string;
  commands: string;
  mcp: string;
  cwd: string;
} {
  const home = tmp("home");
  const skills = skillsDir ?? tmp("emptyskills");
  const cwd = tmp("cwd");
  const claudeDir = tmp("claude");
  const settings = path.join(claudeDir, "settings.json");
  const commands = path.join(claudeDir, "commands");
  const mcp = path.join(claudeDir, ".mcp.json");
  process.env.SLIMCONTEXT_HOME = home;
  process.env.SLIMCONTEXT_SKILLS_DIR = skills;
  process.env.SLIMCONTEXT_CLAUDE_SETTINGS = settings;
  process.env.SLIMCONTEXT_CLAUDE_COMMANDS = commands;
  process.env.SLIMCONTEXT_CLAUDE_MCP = mcp;
  return { home, skillsDir: skills, settings, commands, mcp, cwd };
}

/** Write a fake ~/.claude/.mcp.json fixture. */
export function writeMcpFixture(
  mcpFile: string,
  servers: Record<string, Record<string, unknown>>,
): void {
  fs.mkdirSync(path.dirname(mcpFile), { recursive: true });
  fs.writeFileSync(mcpFile, JSON.stringify({ mcpServers: servers }, null, 2), "utf8");
}
