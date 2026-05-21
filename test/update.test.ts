/** Tests for update detection (pure / local — no network). */

import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "fs";
import { isNewer, readUpdateCache, cacheIsStale, updateStatus } from "../src/update";
import { updateCacheFile, VERSION } from "../src/config";
import { isolate } from "./helpers";

test("isNewer compares semver-style versions", () => {
  assert.equal(isNewer("0.2.0", "0.1.0"), true);
  assert.equal(isNewer("0.1.1", "0.1.0"), true);
  assert.equal(isNewer("1.0.0", "0.9.9"), true);
  assert.equal(isNewer("0.1.0", "0.1.0"), false);
  assert.equal(isNewer("0.1.0", "0.2.0"), false);
});

test("readUpdateCache returns null when no cache exists", () => {
  isolate();
  assert.equal(readUpdateCache(), null);
});

test("cacheIsStale: true with no cache, false for a fresh one", () => {
  isolate();
  assert.equal(cacheIsStale(), true);
  fs.writeFileSync(
    updateCacheFile(),
    JSON.stringify({ checkedAt: new Date().toISOString(), latest: "0.1.0" }),
  );
  assert.equal(cacheIsStale(), false);
});

test("cacheIsStale: true for a check older than 24h", () => {
  isolate();
  const old = new Date(Date.now() - 30 * 60 * 60 * 1000).toISOString();
  fs.writeFileSync(
    updateCacheFile(),
    JSON.stringify({ checkedAt: old, latest: "0.1.0" }),
  );
  assert.equal(cacheIsStale(), true);
});

test("updateStatus reports an available update from the cache", () => {
  isolate();
  fs.writeFileSync(
    updateCacheFile(),
    JSON.stringify({ checkedAt: new Date().toISOString(), latest: "9.9.9" }),
  );
  const s = updateStatus();
  assert.equal(s.updateAvailable, true);
  assert.equal(s.latest, "9.9.9");
  assert.equal(s.current, VERSION);
});

test("updateStatus reports no update when the cache matches current", () => {
  isolate();
  fs.writeFileSync(
    updateCacheFile(),
    JSON.stringify({ checkedAt: new Date().toISOString(), latest: VERSION }),
  );
  assert.equal(updateStatus().updateAvailable, false);
});
