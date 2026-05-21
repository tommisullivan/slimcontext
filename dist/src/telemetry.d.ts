/** Append-only JSONL telemetry ledger. Greppable, no native dependencies. */
import { ScoreResult, TelemetryEvent, TelemetryMode } from "./types";
/** Append one event to the ledger. */
export declare function logEvent(event: TelemetryEvent): void;
/** Build and log a telemetry event from a score result. */
export declare function recordScore(result: ScoreResult, mode: TelemetryMode, agent: string): TelemetryEvent;
/** Read every recorded event. Tolerates partial/corrupt lines. */
export declare function readEvents(): TelemetryEvent[];
/** Delete the ledger (used by `slimcontext stats --reset` and tests). */
export declare function clearEvents(): void;
export declare function eventsLocation(): string;
