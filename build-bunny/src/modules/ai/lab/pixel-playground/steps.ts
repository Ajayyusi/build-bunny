/**
 * The resolutions one mystery round steps through, blockiest first: every
 * resolution the level offers up to the round's own (its clearest). A round
 * authored at 16 with resolutions [64, 32, 16, 8] goes 8 → 16; one authored
 * at 8 has a single step. Client-safe: the player and the server check both
 * use it, so "is this the last step?" can't disagree between them.
 */
export function roundSteps(resolutions: readonly number[], roundResolution: number): number[] {
  const steps = [...new Set(resolutions.filter((r) => r <= roundResolution))].sort((a, b) => a - b);
  return steps.length > 0 ? steps : [roundResolution];
}
