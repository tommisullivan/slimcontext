/** Integration tests: apply/restore staging, the hook, and hook install. */

import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "fs";
import * as path from "path";
import { applySkills, restoreSkills, readState } from "../src/apply";
import { runHook } from "../src/hook";
import { installHook, uninstallHook, isHookInstalled } from "../src/install";
import {
  installCommand,
  uninstallCommand,
  isCommandInstalled,
  commandPath,
  updateCommandPath,
} from "../src/command";
import { readEvents } from "../src/telemetry";
import { makeSkillsDir, isolate } from "./helpers";

const SKILLS = [
  { name: "oauth-helper", description: "oauth login and token refresh flows" },
  { name: "css-tips", description: "flexbox and grid layout styling" },
  { name: "docker-deploy", description: "build and ship docker containers" },
  { name: "sql-migrations", description: "safe database schema migrations" },
];

test("applySkills parks irrelevant skills and keeps relevant ones in place", () => {
  const dir = makeSkillsDir(SKILLS);
  const ctx = isolate(dir);
  const { score, parked } = applySkills(ctx.cwd, "add oauth login", { topK: 1 });

  assert.equal(score.activated[0].skill.name, "oauth-helper");
  assert.equal(parked.length, 3);

  // oauth-helper stays in the live skills dir; the rest are parked.
  assert.ok(fs.existsSync(path.join(dir, "oauth-helper")));
  assert.ok(!fs.existsSync(path.join(dir, "css-tips")));
  assert.ok(fs.existsSync(path.join(ctx.home, "parked", "css-tips")));

  // a telemetry event was recorded
  const events = readEvents();
  assert.equal(events.length, 1);
  assert.equal(events[0].mode, "apply");
});

test("restoreSkills puts every parked skill back", () => {
  const dir = makeSkillsDir(SKILLS);
  const ctx = isolate(dir);
  applySkills(ctx.cwd, "add oauth login", { topK: 1 });

  const { restored } = restoreSkills();
  assert.equal(restored.length, 3);
  for (const s of SKILLS) {
    assert.ok(fs.existsSync(path.join(dir, s.name)), `${s.name} restored`);
  }
  assert.equal(readState(), null, "state cleared after restore");
});

test("applySkills restores a previous staging before re-applying", () => {
  const dir = makeSkillsDir(SKILLS);
  const ctx = isolate(dir);
  applySkills(ctx.cwd, "add oauth login", { topK: 1 });
  // second apply with a different task must see the full library again
  const second = applySkills(ctx.cwd, "run database migrations", { topK: 1 });
  assert.equal(second.score.activated[0].skill.name, "sql-migrations");
  assert.equal(second.score.scored.length, 4, "all 4 skills scored, not a stale subset");
});

test("runHook returns a user-visible systemMessage, model context, and logs telemetry", () => {
  const dir = makeSkillsDir(SKILLS);
  const ctx = isolate(dir);
  const { output, logged } = runHook({ prompt: "help me add oauth login", cwd: ctx.cwd });

  assert.equal(logged, true);
  assert.ok(output.length > 0);
  const parsed = JSON.parse(output);
  // model-facing
  assert.equal(parsed.hookSpecificOutput.hookEventName, "UserPromptSubmit");
  assert.ok(parsed.hookSpecificOutput.additionalContext.includes("oauth-helper"));
  // user-facing
  assert.equal(typeof parsed.systemMessage, "string");
  assert.ok(parsed.systemMessage.includes("slimcontext"));
  assert.equal(parsed.suppressOutput, true);
  assert.equal(parsed.continue, true);
  assert.equal(readEvents().length, 1);
  assert.equal(readEvents()[0].mode, "hook");
});

test("runHook on an empty prompt does nothing", () => {
  const dir = makeSkillsDir(SKILLS);
  const ctx = isolate(dir);
  const r = runHook({ prompt: "   ", cwd: ctx.cwd });
  assert.equal(r.output, "");
  assert.equal(r.logged, false);
});

test("runHook never throws and emits nothing when no skills exist", () => {
  const ctx = isolate(); // empty skills dir
  const r = runHook({ prompt: "anything", cwd: ctx.cwd });
  assert.equal(r.output, "");
  assert.equal(r.logged, false);
});

test("installHook adds the hook; isHookInstalled detects it; uninstall removes it", () => {
  isolate();
  assert.equal(isHookInstalled(), false);

  const r = installHook();
  assert.equal(r.alreadyInstalled, false);
  assert.equal(isHookInstalled(), true);

  const settings = JSON.parse(fs.readFileSync(r.settingsPath, "utf8"));
  const cmd = settings.hooks.UserPromptSubmit[0].hooks[0].command;
  assert.equal(cmd, "slimcontext hook");

  // idempotent
  assert.equal(installHook().alreadyInstalled, true);

  assert.equal(uninstallHook().removed, true);
  assert.equal(isHookInstalled(), false);
});

test("installCommand writes a valid /slimcontext command file", () => {
  isolate();
  assert.equal(isCommandInstalled(), false);

  const r = installCommand();
  assert.equal(r.created, true);
  assert.equal(isCommandInstalled(), true);

  const body = fs.readFileSync(commandPath(), "utf8");
  assert.ok(body.startsWith("---"), "has frontmatter");
  assert.ok(body.includes("description:"), "frontmatter has a description");
  assert.ok(body.includes("AskUserQuestion"), "instructs Claude to open a menu");
  assert.ok(body.includes("slimcontext apply"), "wires the slim action");
  assert.ok(body.includes("slimcontext enable"), "wires the enable action");
  assert.ok(body.includes("slimcontext update"), "wires the update action");
  assert.ok(commandPath().endsWith("slimcontext.md"));

  // the /update-slimcontext command is installed alongside
  const updateBody = fs.readFileSync(updateCommandPath(), "utf8");
  assert.ok(updateBody.includes("slimcontext update"));
  assert.ok(updateCommandPath().endsWith("update-slimcontext.md"));
});

test("installCommand is idempotent; uninstallCommand removes the file", () => {
  isolate();
  installCommand();
  const second = installCommand();
  assert.equal(second.created, false, "second install reports not-created");
  assert.equal(isCommandInstalled(), true);

  assert.equal(uninstallCommand().removed, true);
  assert.equal(isCommandInstalled(), false);
  assert.equal(uninstallCommand().removed, false, "removing twice is safe");
});

test("installHook preserves pre-existing settings", () => {
  const ctx = isolate();
  fs.mkdirSync(path.dirname(ctx.settings), { recursive: true });
  fs.writeFileSync(
    ctx.settings,
    JSON.stringify({ theme: "dark", hooks: { SessionStart: [{ hooks: [] }] } }),
  );
  installHook();
  const settings = JSON.parse(fs.readFileSync(ctx.settings, "utf8"));
  assert.equal(settings.theme, "dark", "unrelated settings preserved");
  assert.ok(settings.hooks.SessionStart, "other hooks preserved");
  assert.ok(settings.hooks.UserPromptSubmit, "our hook added");
  assert.ok(fs.existsSync(`${ctx.settings}.slimcontext-backup`), "backup written");
});
