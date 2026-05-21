/** Update checking and self-update from GitHub. */
export interface UpdateCache {
    checkedAt: string;
    latest: string;
}
/** True if version `a` is strictly newer than version `b` (x.y.z). */
export declare function isNewer(a: string, b: string): boolean;
export declare function readUpdateCache(): UpdateCache | null;
/** Whether the cached check is missing or older than 24h. */
export declare function cacheIsStale(): boolean;
/** Fetch the latest version from the repo's package.json. Null on any failure. */
export declare function fetchLatestVersion(): Promise<string | null>;
/** Refresh the on-disk update cache. Silent on failure. */
export declare function refreshUpdateCache(): Promise<void>;
export interface UpdateStatus {
    current: string;
    latest: string | null;
    updateAvailable: boolean;
}
/** Read the cached update status (no network). */
export declare function updateStatus(): UpdateStatus;
/** Reinstall slimcontext globally from GitHub. */
export declare function runUpdate(): {
    ok: boolean;
    output: string;
};
