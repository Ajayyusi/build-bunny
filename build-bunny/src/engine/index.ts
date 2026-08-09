/**
 * src/engine — the pure deterministic grid world. Barrel export; consumers
 * (interpreter host, grading, publish gates, canvas playback) import from
 * "@/engine" only.
 */
export * from "./types";
export * from "./grid";
export * from "./simulation";
export * from "./checks";
