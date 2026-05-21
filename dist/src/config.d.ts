/** Path resolution. Every path is overridable via env vars so tests stay hermetic. */
/** slimcontext's own state directory (~/.slimcontext by default). */
export declare function slimHome(): string;
/** Where suppressed skills are moved by `apply`. */
export declare function parkedDir(): string;
/** Append-only telemetry ledger (JSONL — greppable, no native deps). */
export declare function eventsFile(): string;
/** Tracks what `apply` parked so `restore` is reliable. */
export declare function stateFile(): string;
/** The user-level Claude Code skills directory. */
export declare function userSkillsDir(): string;
/** The project-level Claude Code skills directory. */
export declare function projectSkillsDir(cwd: string): string;
/** Claude Code settings file that `init` writes the hook into. */
export declare function claudeSettingsFile(): string;
/** Claude Code custom-commands directory (`/slimcontext` lives here). */
export declare function claudeCommandsDir(): string;
export declare const DEFAULT_TOP_K = 8;
/** Current slimcontext version. Bump on release. */
export declare const VERSION = "0.1.3";
/** GitHub repo slimcontext updates from. */
export declare const GITHUB_REPO = "tommisullivan/slimcontext";
/** Cached result of the daily "is there a newer version?" check. */
export declare function updateCacheFile(): string;
