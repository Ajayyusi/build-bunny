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
 * reason a resend cannot fix. Kept for another try: 401 (the session
 * expired; the child signs in again), 412 (sent under another child's
 * session), 429 and 5xx.
 */
function settled(status: number): boolean {
  if (status >= 200 && status < 300) return true;
  return status >= 400 && status < 500 && status !== 401 && status !== 412 && status !== 429;
}

/** Remove one run, re-reading storage so runs queued meanwhile survive. */
function removeRun(runId: string): void {
  const outbox = read();
  if (!(runId in outbox)) return;
  delete outbox[runId];
  write(outbox);
}

/**
 * Runs with a request on the wire right now. A second send of the same run
 * (the success card's retry racing the reconnect resend) shares the first
 * request's answer instead of sending again: two copies at once made the
 * server answer the later one with a conservative "already stored" reply
 * (no XP shown), which could overwrite the real result on screen.
 */
const inFlight = new Map<string, Promise<Response>>();
/** A hung request must not block every later resend. */
const SEND_TIMEOUT_MS = 20_000;

function send(url: string, init: RequestInit, playerKey: string): Promise<Response> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), SEND_TIMEOUT_MS);
  const headers = new Headers(init.headers);
  headers.set("X-BB-Player", playerKey);
  return fetch(url, { ...init, headers, signal: controller.signal }).finally(() =>
    window.clearTimeout(timer),
  );
}

/** Drop-in for `fetch` on the attempts endpoint: queue, send, settle. */
export async function postAttempt(
  playerKey: string,
  url: string,
  init: RequestInit & { body: string },
): Promise<Response> {
  const runId = runIdOf(init.body);
  if (!runId) return send(url, init, playerKey);
  const pending = inFlight.get(runId);
  if (pending) return (await pending).clone();
  const outbox = read();
  outbox[runId] = { playerKey, url, body: init.body, queuedAt: Date.now() };
  write(outbox);
  return (await track(runId, send(url, init, playerKey))).clone();
}

/** Register a send for this run; settle the outbox entry when it answers. */
function track(runId: string, request: Promise<Response>): Promise<Response> {
  const settledRequest = request
    .then((response) => {
      if (settled(response.status)) removeRun(runId);
      return response;
    })
    .finally(() => inFlight.delete(runId));
  inFlight.set(runId, settledRequest);
  return settledRequest;
}

let flushing = false;

/** Resend this child's queued runs. Returns how many the server settled. */
export async function flushOutbox(playerKey: string): Promise<number> {
  if (flushing) return 0;
  flushing = true;
  let sent = 0;
  try {
    const now = Date.now();
    // A snapshot to iterate; every change below re-reads storage, so a run
    // queued while this loop waits on the network is never overwritten.
    for (const [runId, entry] of Object.entries(read())) {
      if (now - entry.queuedAt > MAX_AGE_MS) {
        removeRun(runId);
        continue;
      }
      if (entry.playerKey !== playerKey || inFlight.has(runId)) continue;
      try {
        const response = await track(
          runId,
          send(
            entry.url,
            { method: "POST", headers: { "Content-Type": "application/json" }, body: entry.body },
            playerKey,
          ),
        );
        if (settled(response.status)) sent += 1;
      } catch {
        break; // still offline (or timed out) — try again on the next "online"
      }
    }
  } finally {
    flushing = false;
  }
  return sent;
}

/**
 * The run id for a submission: the SAME id as the previous one when that
 * save failed and the answer has not changed. Tapping Check again while
 * offline then resends one run (the server de-duplicates it) instead of
 * queuing a new attempt per tap.
 */
export function runIdFor(
  previous: { id: string; saveFailed: boolean; answer: unknown } | null,
  answer: unknown,
): string {
  if (previous?.saveFailed && JSON.stringify(previous.answer) === JSON.stringify(answer)) return previous.id;
  return crypto.randomUUID();
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
