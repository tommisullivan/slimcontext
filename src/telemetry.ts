/** Append-only JSONL telemetry ledger. Greppable, no native dependencies. */

import * as fs from "fs";
import * as path from "path";
import { eventsFile, slimHome } from "./config";
import { ScoreResult, TelemetryEvent, TelemetryMode } from "./types";

/** Append one event to the ledger. */
export function logEvent(event: TelemetryEvent): void {
  fs.mkdirSync(slimHome(), { recursive: true });
  fs.appendFileSync(eventsFile(), `${JSON.stringify(event)}\n`, "utf8");
}

/** Build and log a telemetry event from a score result. */
export function recordScore(
  result: ScoreResult,
  mode: TelemetryMode,
  agent: string,
): TelemetryEvent {
  const event: TelemetryEvent = {
    ts: new Date().toISOString(),
    query: result.query.slice(0, 280),
    agent,
    skillsAvailable: result.scored.length,
    skillsActivated: result.activated.length,
    tokensFull: result.tokensFull,
    tokensSlim: result.tokensSlim,
    saved: result.saved,
    savedPct: result.savedPct,
    mode,
  };
  logEvent(event);
  return event;
}

/** Read every recorded event. Tolerates partial/corrupt lines. */
export function readEvents(): TelemetryEvent[] {
  const file = eventsFile();
  if (!fs.existsSync(file)) return [];
  const out: TelemetryEvent[] = [];
  for (const line of fs.readFileSync(file, "utf8").split("\n")) {
    if (!line.trim()) continue;
    try {
      out.push(JSON.parse(line) as TelemetryEvent);
    } catch {
      // skip a corrupt line rather than fail the whole read
    }
  }
  return out;
}

/** Delete the ledger (used by `slimcontext stats --reset` and tests). */
export function clearEvents(): void {
  const file = eventsFile();
  if (fs.existsSync(file)) fs.rmSync(file);
}

export function eventsLocation(): string {
  return path.normalize(eventsFile());
}
