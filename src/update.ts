/** Update checking and self-update from GitHub. */

import * as fs from "fs";
import { execFileSync } from "child_process";
import { GITHUB_REPO, VERSION, slimHome, updateCacheFile } from "./config";

export interface UpdateCache {
  checkedAt: string;
  latest: string;
}

/** True if version `a` is strictly newer than version `b` (x.y.z). */
export function isNewer(a: string, b: string): boolean {
  const pa = a.split(".").map((n) => Number.parseInt(n, 10) || 0);
  const pb = b.split(".").map((n) => Number.parseInt(n, 10) || 0);
  for (let i = 0; i < 3; i++) {
    if ((pa[i] ?? 0) > (pb[i] ?? 0)) return true;
    if ((pa[i] ?? 0) < (pb[i] ?? 0)) return false;
  }
  return false;
}

export function readUpdateCache(): UpdateCache | null {
  try {
    return JSON.parse(
      fs.readFileSync(updateCacheFile(), "utf8"),
    ) as UpdateCache;
  } catch {
    return null;
  }
}

/** Whether the cached check is missing or older than 24h. */
export function cacheIsStale(): boolean {
  const cache = readUpdateCache();
  if (!cache) return true;
  const age = Date.now() - new Date(cache.checkedAt).getTime();
  return !Number.isFinite(age) || age > 24 * 60 * 60 * 1000;
}

/** Fetch the latest version from the repo's package.json. Null on any failure. */
export async function fetchLatestVersion(): Promise<string | null> {
  const url = `https://raw.githubusercontent.com/${GITHUB_REPO}/main/package.json`;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4000);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) return null;
    const pkg = (await res.json()) as { version?: string };
    return typeof pkg.version === "string" ? pkg.version : null;
  } catch {
    return null;
  }
}

/** Refresh the on-disk update cache. Silent on failure. */
export async function refreshUpdateCache(): Promise<void> {
  const latest = await fetchLatestVersion();
  if (!latest) return;
  fs.mkdirSync(slimHome(), { recursive: true });
  fs.writeFileSync(
    updateCacheFile(),
    JSON.stringify({ checkedAt: new Date().toISOString(), latest }),
  );
}

export interface UpdateStatus {
  current: string;
  latest: string | null;
  updateAvailable: boolean;
}

/** Read the cached update status (no network). */
export function updateStatus(): UpdateStatus {
  const latest = readUpdateCache()?.latest ?? null;
  return {
    current: VERSION,
    latest,
    updateAvailable: latest !== null && isNewer(latest, VERSION),
  };
}

/** Reinstall slimcontext globally from GitHub. */
export function runUpdate(): { ok: boolean; output: string } {
  try {
    const out = execFileSync(
      "npm",
      ["install", "-g", `github:${GITHUB_REPO}`],
      { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
    );
    return { ok: true, output: out.trim() };
  } catch (err) {
    const e = err as { stderr?: string; message?: string };
    return { ok: false, output: (e.stderr || e.message || "update failed").trim() };
  }
}
