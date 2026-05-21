/** Tests for skill file-reference resolution. */

import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "fs";
import * as path from "path";
import { extractReferences, referencedTokens } from "../src/references";
import { discoverSkills } from "../src/discover";
import { makeSkillsDir, isolate, tmp } from "./helpers";

test("extractReferences finds @-paths and markdown file links", () => {
  const content =
    "See @$HOME/.claude/workflows/explore.md and [guide](./references/guide.md).\n" +
    "Ignore https://example.com/page.md and plain prose.";
  const refs = extractReferences(content);
  assert.ok(refs.some((r) => r.endsWith("explore.md")));
  assert.ok(refs.some((r) => r.endsWith("references/guide.md")));
  assert.ok(!refs.some((r) => r.startsWith("https")), "external URLs ignored");
});

test("referencedTokens sums the files a skill points at, transitively", () => {
  const dir = tmp("refskill");
  // a.md references b.md; b.md references c.md
  fs.writeFileSync(path.join(dir, "c.md"), "c".repeat(400)); // ~100 tok
  fs.writeFileSync(path.join(dir, "b.md"), "see [c](./c.md)\n" + "b".repeat(400));
  const skillBody = "# Skill\n\nfollow @./b.md for the workflow.";
  const total = referencedTokens(dir, skillBody);
  assert.ok(total > 150, `expected transitive total, got ${total}`);
});

test("referencedTokens ignores missing references without throwing", () => {
  const dir = tmp("refmissing");
  assert.equal(referencedTokens(dir, "see @./does-not-exist.md"), 0);
});

test("discoverSkills counts referenced tokens only when asked", () => {
  const skillsDir = makeSkillsDir([
    { name: "with-ref", description: "a skill", body: "# x\n\nload @./extra.md here" },
  ]);
  fs.writeFileSync(path.join(skillsDir, "with-ref", "extra.md"), "e".repeat(800));
  isolate(skillsDir);

  const lean = discoverSkills(process.cwd());
  assert.equal(lean[0].tokensReferenced, 0, "off by default (fast path for the hook)");

  const full = discoverSkills(process.cwd(), { resolveReferences: true });
  assert.ok(full[0].tokensReferenced > 100, "referenced file counted when requested");
});
