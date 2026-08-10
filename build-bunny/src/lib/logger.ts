import { randomUUID } from "node:crypto";
import { AsyncLocalStorage } from "node:async_hooks";

/**
 * Structured request logging (plan §M5 task 5). One JSON line per event —
 * grep/ship-friendly, no dependency, no transport: stdout/stderr only, which
 * is what every container log collector (and `docker logs`/PM2/journald)
 * already captures. Deliberately silent under vitest so test output stays
 * readable (VITEST is set by the test runner itself, not something app code
 * has to opt into).
 *
 * Request-scoped fields (requestId/userId/schoolId) travel via
 * AsyncLocalStorage rather than being threaded through every function
 * signature: the attempts route and the withAuth guard each open one context
 * per call, and @/lib/audit reads getRequestId() as its default so AuditLog
 * rows pick up the same id with no change to the ~20 existing audit() call
 * sites scattered across the server actions.
 */

export type LogLevel = "info" | "warn" | "error";

export interface RequestContext {
  requestId: string;
  userId?: string | null;
  schoolId?: string | null;
}

export interface LogFields {
  requestId?: string;
  userId?: string | null;
  schoolId?: string | null;
  durationMs?: number;
  path?: string;
  status?: number;
  [key: string]: unknown;
}

const storage = new AsyncLocalStorage<RequestContext>();

const QUIET = process.env.VITEST === "true" || process.env.NODE_ENV === "test";

/** Short, URL-safe, no dashes needed for grep — a UUID is fine either way. */
export function generateRequestId(): string {
  return randomUUID();
}

/** The active request context, if any (reads land outside a request too — CLI scripts, cron). */
export function getRequestContext(): RequestContext | undefined {
  return storage.getStore();
}

export function getRequestId(): string | undefined {
  return storage.getStore()?.requestId;
}

/**
 * Opens a request-scoped context for the duration of `fn`. The context
 * object is mutated in place by later `setRequestContext` calls (e.g. once a
 * route resolves the session and learns userId/schoolId), so anything that
 * reads getRequestId()/getRequestContext() later in the same call tree — most
 * importantly @/lib/audit — sees the up-to-date values.
 */
export function withRequestContext<T>(
  fields: RequestContext,
  fn: () => Promise<T>,
): Promise<T> {
  return storage.run({ ...fields }, fn);
}

/** Patch the active context (no-op outside one) — used once more is known. */
export function setRequestContext(
  patch: Partial<Omit<RequestContext, "requestId">>,
): void {
  const store = storage.getStore();
  if (store) Object.assign(store, patch);
}

function write(level: LogLevel, message: string, fields: LogFields = {}): void {
  if (QUIET) return;
  const store = storage.getStore();
  const line = {
    level,
    message,
    timestamp: new Date().toISOString(),
    ...fields,
    requestId: fields.requestId ?? store?.requestId,
    userId: fields.userId ?? store?.userId ?? null,
    schoolId: fields.schoolId ?? store?.schoolId ?? null,
  };
  const out = level === "error" ? console.error : level === "warn" ? console.warn : console.log;
  out(JSON.stringify(line));
}

export const logger = {
  info: (message: string, fields?: LogFields) => write("info", message, fields),
  warn: (message: string, fields?: LogFields) => write("warn", message, fields),
  error: (message: string, fields?: LogFields) => write("error", message, fields),
};
