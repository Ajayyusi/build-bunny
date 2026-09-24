"use client";

import { useEffect } from "react";

/**
 * The attempt outbox (brief §7: weak classroom Wi-Fi). Every graded run is
 * written to this device BEFORE it is sent, and removed only once the server
 * has answered. A run whose request never arrived — dropped Wi-Fi, a tablet
 * put to sleep mid-request, a tab closed on the success screen — stays
 * queued and is sent again the next time a player opens or the connection
 * comes back.
 *
 * Resending is safe because every run carries its own attemptRunId, which
 * the server de-duplicates (a replay returns the stored result and awards
 * nothing twice). Entries are tied to the child who made them: on a shared
 * classroom tablet, one child's queued run is never sent under another
 * child's session — it waits until its owner signs in again.
 */

const KEY = "bb:outbox:v1";
/** Older than this, a run no longer describes a lesson anyone remembers. */
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

interface OutboxEntry {
  playerKey: string;
  url: string;
  body: string;
  queuedAt: number;
}

type Outbox = Record<string, OutboxEntry>;

function read(): Outbox {
  try {
    const raw = window.localStorage.getItem(KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : {};
    return parsed && typeof parsed === "object" ? (parsed as Outbox) : {};
  } catch {
    return {};
  }
}

function write(outbox: Outbox): void {
  try {
    if (Object.keys(outbox).length === 0) window.localStorage.removeItem(KEY);
    else window.localStorage.setItem(KEY, JSON.stringify(outbox));
  } catch {
    // Storage full or blocked: the in-page retry still works.
  }
}

function runIdOf(body: string): string | null {
  try {
    const id = (JSON.parse(body) as { attemptRunId?: unknown }).attemptRunId;
    return typeof id === "string" ? id : null;
  } catch {
    return null;
  }
}

/**
 * The server answered, so the run is settled — accepted, or refused for a
 * reason a resend cannot fix (4xx). 429 and 5xx are worth another try.
 */
function settled(status: number): boolean {
  return (status >= 200 && status < 300) || (status >= 400 && status < 500 && status !== 429);
}

/** Drop-in for `fetch` on the attempts endpoint: queue, send, settle. */
export async function postAttempt(
  playerKey: string,
  url: string,
  init: RequestInit & { body: string },
): Promise<Response> {
  const runId = runIdOf(init.body);
  if (runId) {
    const outbox = read();
    outbox[runId] = { playerKey, url, body: init.body, queuedAt: Date.now() };
    write(outbox);
  }
  const response = await fetch(url, init);
  if (runId && settled(response.status)) {
    const outbox = read();
    delete outbox[runId];
    write(outbox);
  }
  return response;
}

let flushing = false;

/** Resend this child's queued runs. Returns how many the server settled. */
export async function flushOutbox(playerKey: string): Promise<number> {
  if (flushing) return 0;
  flushing = true;
  let sent = 0;
  try {
    const outbox = read();
    const now = Date.now();
    for (const [runId, entry] of Object.entries(outbox)) {
      if (now - entry.queuedAt > MAX_AGE_MS) {
        delete outbox[runId];
        continue;
      }
      if (entry.playerKey !== playerKey) continue;
      try {
        const response = await fetch(entry.url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: entry.body,
        });
        if (settled(response.status)) {
          delete outbox[runId];
          sent += 1;
        }
      } catch {
        break; // still offline — try again on the next "online"
      }
    }
    write(outbox);
  } finally {
    flushing = false;
  }
  return sent;
}

/** How many runs this child still has waiting on this device. */
export function pendingCount(playerKey: string): number {
  return Object.values(read()).filter((entry) => entry.playerKey === playerKey).length;
}

/** Flush on mount and whenever the browser says the connection is back. */
export function useAttemptOutbox(playerKey: string): void {
  useEffect(() => {
    const flush = () => void flushOutbox(playerKey);
    flush();
    window.addEventListener("online", flush);
    return () => window.removeEventListener("online", flush);
  }, [playerKey]);
}
