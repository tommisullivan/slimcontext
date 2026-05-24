/** MCP slimming: discover, score, apply/restore round-trip. */

import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "fs";
import {
  applyMcp,
  discoverMcpServers,
  parkedMcpCount,
  PARKED_KEY,
  restoreMcp,
  scoreMcpServers,
} from "../src/mcp";
import { isolate, writeMcpFixture } from "./helpers";

const SERVERS = {
  vault: {
    command: "node",
    args: ["/Users/x/vault/server.js"],
    description: "personal knowledge vault search and read",
  },
  cloudflare: {
    command: "npx",
    args: ["-y", "@cloudflare/mcp-server"],
    description: "cloudflare DNS workers and KV management",
  },
  gmail: {
    command: "npx",
    args: ["-y", "@gmail/mcp"],
    description: "send and read gmail messages",
  },
  drive: {
    command: "npx",
    args: ["-y", "@gdrive/mcp"],
    description: "google drive file access",
  },
};

test("discoverMcpServers reads active + parked entries from .mcp.json", () => {
  const ctx = isolate();
  writeMcpFixture(ctx.mcp, SERVERS);
  const servers = discoverMcpServers();
  assert.equal(servers.length, 4);
  assert.deepEqual(servers.map((s) => s.name).sort(), [
    "cloudflare",
    "drive",
    "gmail",
    "vault",
  ]);
});

test("discoverMcpServers returns empty when no .mcp.json exists", () => {
  isolate(); // no file written
  assert.deepEqual(discoverMcpServers(), []);
});

test("scoreMcpServers picks the relevant server by name + description", () => {
  const ctx = isolate();
  writeMcpFixture(ctx.mcp, SERVERS);
  const servers = discoverMcpServers();
  const result = scoreMcpServers(servers, "update a cloudflare DNS record", {
    topK: 1,
  });
  assert.equal(result.activated.length, 1);
  assert.equal(result.activated[0].server.name, "cloudflare");
  assert.equal(result.suppressed.length, 3);
});

test("applyMcp parks suppressed servers in the same file under the parked key", () => {
  const ctx = isolate();
  writeMcpFixture(ctx.mcp, SERVERS);
  const result = applyMcp("update cloudflare DNS", { topK: 1 });
  assert.equal(result.parked.length, 3);
  assert.equal(result.fileMissing, false);

  const data = JSON.parse(fs.readFileSync(ctx.mcp, "utf8"));
  assert.deepEqual(Object.keys(data.mcpServers), ["cloudflare"]);
  assert.deepEqual(Object.keys(data[PARKED_KEY]).sort(), [
    "drive",
    "gmail",
    "vault",
  ]);
  // configs survive intact across the move
  assert.equal(data[PARKED_KEY].drive.command, "npx");
  assert.equal(parkedMcpCount(), 3);
});

test("restoreMcp moves every parked server back into mcpServers", () => {
  const ctx = isolate();
  writeMcpFixture(ctx.mcp, SERVERS);
  applyMcp("update cloudflare DNS", { topK: 1 });

  const { restored } = restoreMcp();
  assert.equal(restored.length, 3);
  const data = JSON.parse(fs.readFileSync(ctx.mcp, "utf8"));
  assert.deepEqual(Object.keys(data.mcpServers).sort(), [
    "cloudflare",
    "drive",
    "gmail",
    "vault",
  ]);
  assert.deepEqual(data[PARKED_KEY], {});
  assert.equal(parkedMcpCount(), 0);
});

test("applyMcp restores previous staging before re-applying", () => {
  const ctx = isolate();
  writeMcpFixture(ctx.mcp, SERVERS);
  applyMcp("update cloudflare DNS", { topK: 1 });
  // second call with a different task must see the full set, not a stale subset
  const second = applyMcp("read my gmail inbox", { topK: 1 });
  assert.equal(second.score.scored.length, 4);
  assert.equal(second.score.activated[0].server.name, "gmail");
  assert.equal(second.restoredFirst.length, 3, "old staging was restored first");
});

test("applyMcp on a missing .mcp.json is a no-op", () => {
  isolate();
  const result = applyMcp("anything", { topK: 1 });
  assert.equal(result.fileMissing, true);
  assert.equal(result.parked.length, 0);
});

test("applyMcp preserves unrelated keys in .mcp.json", () => {
  const ctx = isolate();
  const data = {
    mcpServers: SERVERS,
    someOtherKey: { foo: "bar" },
    version: 1,
  };
  fs.mkdirSync(require("path").dirname(ctx.mcp), { recursive: true });
  fs.writeFileSync(ctx.mcp, JSON.stringify(data, null, 2));
  applyMcp("update cloudflare DNS", { topK: 1 });

  const after = JSON.parse(fs.readFileSync(ctx.mcp, "utf8"));
  assert.deepEqual(after.someOtherKey, { foo: "bar" });
  assert.equal(after.version, 1);
});

test("applyMcp handles malformed .mcp.json by treating it as empty", () => {
  const ctx = isolate();
  fs.mkdirSync(require("path").dirname(ctx.mcp), { recursive: true });
  fs.writeFileSync(ctx.mcp, "{ not json");
  const result = applyMcp("anything", { topK: 1 });
  // file exists, so fileMissing=false, but discovery returns []
  assert.equal(result.fileMissing, false);
  assert.equal(result.parked.length, 0);
  assert.equal(result.score.scored.length, 0);
});
