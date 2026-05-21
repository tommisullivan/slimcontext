"use strict";
/** Update checking and self-update from GitHub. */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.isNewer = isNewer;
exports.readUpdateCache = readUpdateCache;
exports.cacheIsStale = cacheIsStale;
exports.fetchLatestVersion = fetchLatestVersion;
exports.refreshUpdateCache = refreshUpdateCache;
exports.updateStatus = updateStatus;
exports.runUpdate = runUpdate;
const fs = __importStar(require("fs"));
const child_process_1 = require("child_process");
const config_1 = require("./config");
/** True if version `a` is strictly newer than version `b` (x.y.z). */
function isNewer(a, b) {
    const pa = a.split(".").map((n) => Number.parseInt(n, 10) || 0);
    const pb = b.split(".").map((n) => Number.parseInt(n, 10) || 0);
    for (let i = 0; i < 3; i++) {
        if ((pa[i] ?? 0) > (pb[i] ?? 0))
            return true;
        if ((pa[i] ?? 0) < (pb[i] ?? 0))
            return false;
    }
    return false;
}
function readUpdateCache() {
    try {
        return JSON.parse(fs.readFileSync((0, config_1.updateCacheFile)(), "utf8"));
    }
    catch {
        return null;
    }
}
/** Whether the cached check is missing or older than 24h. */
function cacheIsStale() {
    const cache = readUpdateCache();
    if (!cache)
        return true;
    const age = Date.now() - new Date(cache.checkedAt).getTime();
    return !Number.isFinite(age) || age > 24 * 60 * 60 * 1000;
}
/** Fetch the latest version from the repo's package.json. Null on any failure. */
async function fetchLatestVersion() {
    const url = `https://raw.githubusercontent.com/${config_1.GITHUB_REPO}/main/package.json`;
    try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 4000);
        const res = await fetch(url, { signal: controller.signal });
        clearTimeout(timer);
        if (!res.ok)
            return null;
        const pkg = (await res.json());
        return typeof pkg.version === "string" ? pkg.version : null;
    }
    catch {
        return null;
    }
}
/** Refresh the on-disk update cache. Silent on failure. */
async function refreshUpdateCache() {
    const latest = await fetchLatestVersion();
    if (!latest)
        return;
    fs.mkdirSync((0, config_1.slimHome)(), { recursive: true });
    fs.writeFileSync((0, config_1.updateCacheFile)(), JSON.stringify({ checkedAt: new Date().toISOString(), latest }));
}
/** Read the cached update status (no network). */
function updateStatus() {
    const latest = readUpdateCache()?.latest ?? null;
    return {
        current: config_1.VERSION,
        latest,
        updateAvailable: latest !== null && isNewer(latest, config_1.VERSION),
    };
}
/** Reinstall slimcontext globally from GitHub. */
function runUpdate() {
    try {
        const out = (0, child_process_1.execFileSync)("npm", ["install", "-g", `github:${config_1.GITHUB_REPO}`], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
        return { ok: true, output: out.trim() };
    }
    catch (err) {
        const e = err;
        return { ok: false, output: (e.stderr || e.message || "update failed").trim() };
    }
}
