import "server-only";

import { z } from "zod";

import type { Permission } from "@/modules/auth/permissions";
import {
  AuthError,
  requirePermission,
  type SessionContext,
} from "@/modules/auth/server/session";
import { generateRequestId, logger, withRequestContext } from "@/lib/logger";
import { SeatLimitError } from "@/modules/schools/server/seats";

/**
 * The uniform server-action wrapper (plan §1.2): permission check → Zod parse
 * → tenant-scoped handler. Handlers receive the SessionContext and must scope
 * every query by ctx.schoolId through the data layer. Errors become a
 * discriminated ActionResult — nothing throws across the wire.
 *
 * Every call opens a request-scoped requestId (plan §M5 task 5) and logs
 * exactly once with the outcome and duration; any audit() call made by the
 * handler (directly or several layers down) picks up the same requestId via
 * @/lib/audit's default, so an AuditLog row and its triggering action share
 * one id without the handler having to pass it explicitly.
 */
export type ActionResult<T> =
  | { ok: true; data: T }
  | {
      ok: false;
      error:
        | "UNAUTHENTICATED"
        | "FORBIDDEN"
        | "VALIDATION"
        | "NOT_FOUND"
        | "CONFLICT"
        | "RATE_LIMITED"
        | "SEAT_LIMIT_REACHED"
        | "INTERNAL";
      message?: string;
      fieldErrors?: Record<string, string[]>;
      /** Populated for SEAT_LIMIT_REACHED so the UI can show current/maximum. */
      seats?: { used: number; limit: number };
    };

export class NotFoundError extends Error {}
export class ConflictError extends Error {}
/** Thrown by a handler that checked a rate limiter itself (m5 §34 hardening:
 * hint reveal, CSV import — attempts submission uses the route-level 429
 * pattern instead since it isn't a withAuth action). */
export class RateLimitedError extends Error {}

export function withAuth<Schema extends z.ZodTypeAny, Result>(
  permission: Permission,
  schema: Schema,
  handler: (ctx: SessionContext, input: z.infer<Schema>) => Promise<Result>,
): (rawInput: unknown) => Promise<ActionResult<Result>> {
  return async (rawInput: unknown) => {
    let ctx: SessionContext;
    try {
      ctx = await requirePermission(permission);
    } catch (err) {
      if (err instanceof AuthError) {
        logger.warn("action.denied", { action: permission, error: err.code });
        return { ok: false, error: err.code };
      }
      logger.error("action.denied", { action: permission, error: "INTERNAL" });
      return { ok: false, error: "INTERNAL" };
    }

    const startedAt = Date.now();
    return withRequestContext(
      { requestId: generateRequestId(), userId: ctx.userId, schoolId: ctx.schoolId },
      async (): Promise<ActionResult<Result>> => {
        const parsed = schema.safeParse(rawInput);
        if (!parsed.success) {
          logger.warn("action.validation_failed", {
            action: permission,
            durationMs: Date.now() - startedAt,
          });
          return {
            ok: false,
            error: "VALIDATION",
            fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
          };
        }

        try {
          const data = await handler(ctx, parsed.data);
          logger.info("action.completed", {
            action: permission,
            durationMs: Date.now() - startedAt,
          });
          return { ok: true, data };
        } catch (err) {
          const durationMs = Date.now() - startedAt;
          if (err instanceof NotFoundError) {
            logger.warn("action.not_found", { action: permission, durationMs });
            return { ok: false, error: "NOT_FOUND", message: err.message };
          }
          if (err instanceof ConflictError) {
            logger.warn("action.conflict", { action: permission, durationMs });
            return { ok: false, error: "CONFLICT", message: err.message };
          }
          if (err instanceof RateLimitedError) {
            logger.warn("action.rate_limited", { action: permission, durationMs });
            return { ok: false, error: "RATE_LIMITED", message: err.message };
          }
          // Its own result code, not CONFLICT: a school admin who has run out
          // of seats needs the numbers and a route to buying more, which a
          // generic conflict message cannot give them.
          if (err instanceof SeatLimitError) {
            logger.warn("action.seat_limit", { action: permission, durationMs });
            return {
              ok: false,
              error: "SEAT_LIMIT_REACHED",
              message: err.message,
              seats: { used: err.used, limit: err.limit },
            };
          }
          console.error("[action] unhandled error:", err);
          logger.error("action.failed", { action: permission, durationMs });
          return { ok: false, error: "INTERNAL" };
        }
      },
    );
  };
}
