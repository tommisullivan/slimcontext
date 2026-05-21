"use strict";
/** Aggregation of the telemetry ledger for the `stats` dashboard. */
Object.defineProperty(exports, "__esModule", { value: true });
exports.summarize = summarize;
const telemetry_1 = require("./telemetry");
/** Aggregate a list of events (defaults to the on-disk ledger). */
function summarize(events = (0, telemetry_1.readEvents)()) {
    if (events.length === 0) {
        return {
            events: 0,
            totalSaved: 0,
            totalFull: 0,
            avgSavedPct: 0,
            bestSavedPct: 0,
            firstTs: null,
            lastTs: null,
            byMode: {},
        };
    }
    let totalSaved = 0;
    let totalFull = 0;
    let pctSum = 0;
    let bestSavedPct = 0;
    const byMode = {};
    for (const e of events) {
        totalSaved += e.saved;
        totalFull += e.tokensFull;
        pctSum += e.savedPct;
        if (e.savedPct > bestSavedPct)
            bestSavedPct = e.savedPct;
        byMode[e.mode] = (byMode[e.mode] ?? 0) + 1;
    }
    return {
        events: events.length,
        totalSaved,
        totalFull,
        avgSavedPct: Math.round((pctSum / events.length) * 10) / 10,
        bestSavedPct,
        firstTs: events[0].ts,
        lastTs: events[events.length - 1].ts,
        byMode,
    };
}
