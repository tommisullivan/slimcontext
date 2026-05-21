/** Aggregation of the telemetry ledger for the `stats` dashboard. */
import { TelemetryEvent } from "./types";
export interface StatsSummary {
    events: number;
    totalSaved: number;
    totalFull: number;
    avgSavedPct: number;
    bestSavedPct: number;
    firstTs: string | null;
    lastTs: string | null;
    byMode: Record<string, number>;
}
/** Aggregate a list of events (defaults to the on-disk ledger). */
export declare function summarize(events?: TelemetryEvent[]): StatsSummary;
