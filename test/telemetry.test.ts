/** Tests for the telemetry ledger and the stats aggregator. */

import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "fs";
import { logEvent, readEvents, clearEvents, recordScore } from "../src/telemetry";
import { eventsFile } from "../src/config";
import { summarize } from "../src/stats";
import { scoreSkills } from "../src/score";
import { TelemetryEvent } from "../src/types";
import { fakeSkill, isolate } from "./helpers";

function sampleEvent(over: Partial<TelemetryEvent> = {}): TelemetryEvent {
  return {
    ts: new Date().toISOString(),
    query: "test",
    agent: "test",
    skillsAvailable: 10,
    skillsActivated: 3,
    tokensFull: 1000,
    tokensSlim: 300,
    saved: 700,
    savedPct: 70,
    mode: "apply",
    ...over,
  };
}

test("logEvent then readEvents round-trips an event", () => {
  isolate();
  logEvent(sampleEvent({ query: "first" }));
  logEvent(sampleEvent({ query: "second" }));
  const events = readEvents();
  assert.equal(events.length, 2);
  assert.equal(events[0].query, "first");
  assert.equal(events[1].query, "second");
});

test("readEvents returns empty when no ledger exists", () => {
  isolate();
  assert.deepEqual(readEvents(), []);
});

test("readEvents skips a corrupt line instead of failing", () => {
  isolate();
  logEvent(sampleEvent({ query: "good" }));
  // append a deliberately broken line
  fs.appendFileSync(eventsFile(), "{not valid json\n");
  logEvent(sampleEvent({ query: "good2" }));
  const events = readEvents();
  assert.equal(events.length, 2);
});

test("clearEvents empties the ledger", () => {
  isolate();
  logEvent(sampleEvent());
  assert.equal(readEvents().length, 1);
  clearEvents();
  assert.equal(readEvents().length, 0);
});

test("recordScore writes a telemetry event derived from a score result", () => {
  isolate();
  const skills = [
    fakeSkill("oauth", "oauth login tokens"),
    fakeSkill("css", "flexbox grid layout"),
  ];
  const result = scoreSkills(skills, "oauth login", { topK: 1 });
  const ev = recordScore(result, "hook", "claude-code");
  assert.equal(ev.mode, "hook");
  assert.equal(ev.agent, "claude-code");
  assert.equal(ev.skillsActivated, 1);
  assert.equal(readEvents().length, 1);
});

test("summarize aggregates totals, averages and per-mode counts", () => {
  const s = summarize([
    sampleEvent({ saved: 100, tokensFull: 200, savedPct: 50, mode: "apply" }),
    sampleEvent({ saved: 300, tokensFull: 400, savedPct: 75, mode: "hook" }),
  ]);
  assert.equal(s.events, 2);
  assert.equal(s.totalSaved, 400);
  assert.equal(s.avgSavedPct, 62.5);
  assert.equal(s.bestSavedPct, 75);
  assert.equal(s.byMode.apply, 1);
  assert.equal(s.byMode.hook, 1);
});

test("summarize on no events returns a zeroed summary", () => {
  const s = summarize([]);
  assert.equal(s.events, 0);
  assert.equal(s.totalSaved, 0);
  assert.equal(s.firstTs, null);
});
