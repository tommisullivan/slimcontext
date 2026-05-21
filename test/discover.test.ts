/** Tests for skill discovery, frontmatter parsing and manifest loading. */

import { test } from "node:test";
import assert from "node:assert/strict";
import { discoverSkills, parseFrontmatter } from "../src/discover";
import { normalizeManifest } from "../src/manifest";
import { makeSkillsDir, isolate } from "./helpers";

test("parseFrontmatter splits YAML frontmatter from body", () => {
  const { data, body } = parseFrontmatter(
    '---\nname: foo\ndescription: "a skill"\n---\n# Body\ntext\n',
  );
  assert.equal(data.name, "foo");
  assert.equal(data.description, "a skill");
  assert.ok(body.startsWith("# Body"));
});

test("parseFrontmatter tolerates a file with no frontmatter", () => {
  const { data, body } = parseFrontmatter("# Just markdown\nno frontmatter");
  assert.deepEqual(data, {});
  assert.ok(body.includes("Just markdown"));
});

test("discoverSkills finds skills with SKILL.md and skips non-skill dirs", () => {
  const dir = makeSkillsDir([
    { name: "alpha", description: "first skill" },
    { name: "beta", description: "second skill" },
  ]);
  isolate(dir);
  const skills = discoverSkills(process.cwd());
  const names = skills.map((s) => s.name).sort();
  assert.deepEqual(names, ["alpha", "beta"]);
  for (const s of skills) {
    assert.ok(s.tokensBody > 0);
    assert.equal(s.source, "user");
  }
});

test("discoverSkills returns empty when the skills dir is absent", () => {
  isolate();
  process.env.SLIMCONTEXT_SKILLS_DIR = "/nonexistent/path/slimctx";
  assert.deepEqual(discoverSkills(process.cwd()), []);
});

test("discoverSkills attaches a parsed manifest when present", () => {
  const dir = makeSkillsDir([
    {
      name: "deployer",
      description: "deploy things",
      manifest: "alwaysLoad: true\ntriggers:\n  keywords: [deploy, ship]\n",
    },
  ]);
  isolate(dir);
  const skills = discoverSkills(process.cwd());
  assert.equal(skills.length, 1);
  assert.equal(skills[0].manifest?.alwaysLoad, true);
  assert.deepEqual(skills[0].manifest?.triggers.keywords, ["deploy", "ship"]);
});

test("normalizeManifest coerces messy input into a safe shape", () => {
  const m = normalizeManifest({
    always_load: true,
    triggers: { keywords: "single", extensions: [".ts", "tsx"] },
    depends_on: "other-skill",
  });
  assert.equal(m.alwaysLoad, true);
  assert.deepEqual(m.triggers.keywords, ["single"]);
  assert.deepEqual(m.triggers.extensions, ["ts", "tsx"]);
  assert.deepEqual(m.dependsOn, ["other-skill"]);
});

test("normalizeManifest handles empty/garbage input without throwing", () => {
  const m = normalizeManifest(null);
  assert.equal(m.alwaysLoad, false);
  assert.deepEqual(m.triggers.keywords, []);
  assert.deepEqual(m.dependsOn, []);
});
