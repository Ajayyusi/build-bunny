/**
 * AI Lab pure math barrel (phase G, agent A). Every function here is
 * deterministic and DOM-free — imported by BOTH the client widgets and the
 * server grader (registry.ts / <widget>/grade.ts) so the arithmetic a child
 * watches update live is exactly the arithmetic the server recomputes.
 */
export * from "./types";
export * from "./sideOfLine";
export * from "./classify";
export * from "./leastSquares";
export * from "./sumSquaredError";
export * from "./centroidRule";
export * from "./convolve3x3";
export * from "./greyscale";
export * from "./downsample";
