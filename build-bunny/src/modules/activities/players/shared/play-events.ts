/**
 * In-level analytics, fire and forget (see learning/server/play-events.ts):
 * the player never waits for it, and a failure (offline, a closed tab)
 * changes nothing a child sees. Only small codes are sent.
 */
export type PlayEvent =
  | { kind: "start" }
  | { kind: "test"; what: "revealGuesses" | "testRule" | "computerTurn" | "lockPrediction" | "choice" }
  | { kind: "retry"; what: "moveLineAgain" | "tryAnotherPrediction" | "moreSquares" | "retryRound" | "tryAnother" };

/** Starts already sent from this page (a double mount sends one). */
const startedAt = new Map<string, number>();

export function sendPlayEvent(levelId: string | undefined, event: PlayEvent): void {
  if (!levelId || typeof fetch === "undefined") return;
  if (event.kind === "start") {
    const last = startedAt.get(levelId) ?? 0;
    if (Date.now() - last < 5_000) return;
    startedAt.set(levelId, Date.now());
  }
  try {
    void fetch(`/api/levels/${levelId}/events`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(event),
      keepalive: true,
    }).catch(() => {});
  } catch {
    // Analytics never breaks play.
  }
}
