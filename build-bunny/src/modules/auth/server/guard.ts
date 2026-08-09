import "server-only";

import { z } from "zod";

import type { Permission } from "@/modules/auth/permissions";
import {
  AuthError,
  requirePermission,
  type SessionContext,
} from "@/modules/auth/server/session";

/**
 * The uniform server-action wrapper (plan §1.2): permission check → Zod parse
 * → tenant-scoped handler. Handlers receive the SessionContext and must scope
 * every query by ctx.schoolId through the data layer. Errors become a
 * discriminated ActionResult — nothing throws across the wire.
 */
export type ActionResult<T> =
  | { ok: true; data: T }
  | {
      ok: false;
      error: "UNAUTHENTICATED" | "FORBIDDEN" | "VALIDATION" | "NOT_FOUND" | "CONFLICT" | "INTERNAL";
      message?: string;
      fieldErrors?: Record<string, string[]>;
    };

export class NotFoundError extends Error {}
export class ConflictError extends Error {}

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
        return { ok: false, error: err.code };
      }
      return { ok: false, error: "INTERNAL" };
    }

    const parsed = schema.safeParse(rawInput);
    if (!parsed.success) {
      return {
        ok: false,
        error: "VALIDATION",
        fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
      };
    }

    try {
      const data = await handler(ctx, parsed.data);
      return { ok: true, data };
    } catch (err) {
      if (err instanceof NotFoundError) {
        return { ok: false, error: "NOT_FOUND", message: err.message };
      }
      if (err instanceof ConflictError) {
        return { ok: false, error: "CONFLICT", message: err.message };
      }
      console.error("[action] unhandled error:", err);
      return { ok: false, error: "INTERNAL" };
    }
  };
}
