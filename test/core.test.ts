/** Unit tests for the scoring engine: tokenize, BM25, scoreSkills. */

import { test } from "node:test";
import assert from "node:assert/strict";
import { Bm25, tokenize } from "../src/bm25";
import { scoreSkills } from "../src/score";
import { estimateTokens } from "../src/tokens";
import { SkillManifest } from "../src/types";
import { fakeSkill } from "./helpers";

const emptyManifest = (over: Partial<SkillManifest> = {}): SkillManifest => ({
  alwaysLoad: false,
  triggers: { keywords: [], globs: [], extensions: [] },
  dependsOn: [],
  ...over,
});

test("tokenize lowercases, splits, drops stopwords and 1-char tokens", () => {
  const t = tokenize("The Quick OAuth2 a I/O");
  assert.ok(t.includes("quick"));
  assert.ok(t.includes("oauth2"));
  assert.ok(!t.includes("the"), "stopword 'the' should be dropped");
  assert.ok(!t.includes("a"), "1-char token 'a' should be dropped");
});

test("estimateTokens uses the chars/4 heuristic", () => {
  assert.equal(estimateTokens(""), 0);
  assert.equal(estimateTokens("abcd"), 1);
  assert.equal(estimateTokens("abcde"), 2);
});

test("BM25 ranks a document containing the query term above one that does not", () => {
  const bm = new Bm25([
    { id: "auth", tokens: tokenize("oauth login authentication tokens sessions") },
    { id: "css", tokens: tokenize("styling layout flexbox grid colors") },
  ]);
  const q = tokenize("oauth authentication");
  assert.ok(bm.score("auth", q) > bm.score("css", q));
  assert.equal(bm.score("css", q), 0, "no shared terms => zero score");
});

test("scoreSkills activates the relevant skill and suppresses the rest", () => {
  const skills = [
    fakeSkill("oauth-helper", "Implement OAuth login and token refresh flows"),
    fakeSkill("css-tips", "Flexbox and grid layout styling advice"),
    fakeSkill("docker-deploy", "Build and ship Docker containers"),
  ];
  const r = scoreSkills(skills, "add oauth login to the app", { topK: 1 });
  assert.equal(r.activated.length, 1);
  assert.equal(r.activated[0].skill.name, "oauth-helper");
  assert.equal(r.suppressed.length, 2);
  assert.ok(r.saved > 0, "should report token savings");
  assert.ok(r.savedPct > 0 && r.savedPct <= 100);
});

test("scoreSkills respects topK", () => {
  const skills = Array.from({ length: 10 }, (_, i) =>
    fakeSkill(`skill-${i}`, `does task number ${i} with shared keyword build`),
  );
  const r = scoreSkills(skills, "build task", { topK: 3 });
  assert.equal(r.activated.length, 3);
});

test("alwaysLoad skills activate regardless of relevance and do not consume topK", () => {
  const skills = [
    fakeSkill("policy", "team rules", "", emptyManifest({ alwaysLoad: true })),
    fakeSkill("oauth-helper", "oauth login token refresh"),
    fakeSkill("css-tips", "flexbox grid"),
  ];
  const r = scoreSkills(skills, "oauth login", { topK: 1 });
  const names = r.activated.map((s) => s.skill.name).sort();
  assert.deepEqual(names, ["oauth-helper", "policy"]);
});

test("manifest keyword trigger boosts an otherwise-weak skill", () => {
  const skills = [
    fakeSkill(
      "deploy-skill",
      "ship the application",
      "",
      emptyManifest({ triggers: { keywords: ["kubernetes"], globs: [], extensions: [] } }),
    ),
    fakeSkill("random", "unrelated content about cooking"),
  ];
  const withKw = scoreSkills(skills, "set up kubernetes", { topK: 1 });
  assert.equal(withKw.activated[0].skill.name, "deploy-skill");
  assert.ok(
    withKw.activated[0].reasons.some((r) => r.includes("kubernetes")),
    "reason should cite the keyword trigger",
  );
});

test("dependency expansion pulls in declared dependencies", () => {
  const skills = [
    fakeSkill(
      "frontend",
      "build react components and ui",
      "",
      emptyManifest({ dependsOn: ["design-tokens"] }),
    ),
    fakeSkill("design-tokens", "color and spacing constants"),
    fakeSkill("backend", "database and api work"),
  ];
  const r = scoreSkills(skills, "build react components", { topK: 1 });
  const names = r.activated.map((s) => s.skill.name).sort();
  assert.ok(names.includes("frontend"));
  assert.ok(names.includes("design-tokens"), "dependency should be activated");
});

test("a query matching nothing activates nothing (minScore default 0)", () => {
  const skills = [
    fakeSkill("oauth-helper", "oauth login tokens"),
    fakeSkill("css-tips", "flexbox grid layout"),
  ];
  const r = scoreSkills(skills, "xyzzy nonsense unrelated", { topK: 5 });
  assert.equal(r.activated.length, 0);
  assert.equal(r.tokensSlim, 0);
});

test("scoreSkills is deterministic", () => {
  const skills = [
    fakeSkill("a", "oauth login tokens"),
    fakeSkill("b", "docker deploy build"),
  ];
  const r1 = scoreSkills(skills, "oauth", { topK: 1 });
  const r2 = scoreSkills(skills, "oauth", { topK: 1 });
  assert.deepEqual(
    r1.scored.map((s) => [s.skill.name, s.score]),
    r2.scored.map((s) => [s.skill.name, s.score]),
  );
});
