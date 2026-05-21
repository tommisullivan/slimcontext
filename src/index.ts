/** Public API for slimcontext. */

export * from "./types";
export { discoverSkills, parseFrontmatter } from "./discover";
export { scoreSkills } from "./score";
export { Bm25, tokenize } from "./bm25";
export { estimateTokens } from "./tokens";
export { summarize } from "./stats";
export type { StatsSummary } from "./stats";
export {
  readEvents,
  logEvent,
  recordScore,
  clearEvents,
} from "./telemetry";
export { applySkills, restoreSkills, readState } from "./apply";
export type { ApplyResult } from "./apply";
export { runHook } from "./hook";
export type { HookInput, HookResult } from "./hook";
export { installHook, uninstallHook, isHookInstalled } from "./install";
export {
  installCommand,
  uninstallCommand,
  isCommandInstalled,
  commandPath,
  menuCommandPath,
  updateCommandPath,
} from "./command";
export { loadManifest, normalizeManifest } from "./manifest";
export {
  isNewer,
  readUpdateCache,
  cacheIsStale,
  fetchLatestVersion,
  refreshUpdateCache,
  updateStatus,
  runUpdate,
} from "./update";
export type { UpdateCache, UpdateStatus } from "./update";
