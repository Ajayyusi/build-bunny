"use client";

import type { ActionResult } from "@/modules/auth/server/guard";

/**
 * Call a server action so that it resolves instead of rejecting.
 *
 * Client handlers across the app are written as `try { ... } finally {
 * setLoading(false) }` with no catch. That reads fine for a DOMAIN failure —
 * the action returns `{ ok: false }` and the handler shows the message. But a
 * TRANSPORT failure rejects: dropped wifi in a classroom, a server restart
 * mid-deploy, a tab woken from sleep. The spinner stopped, no error appeared,
 * and the operator was left believing the change had saved when it had not.
 *
 * Wrapping the call converts that into the ordinary failure shape every one
 * of those handlers already knows how to display, which is a far smaller
 * change than restructuring thirty handlers — and one that cannot be
 * half-applied, because a wrapped call simply never throws.
 */
export async function runAction<T>(
  call: () => Promise<ActionResult<T>>,
): Promise<ActionResult<T>> {
  try {
    return await call();
  } catch (err) {
    // Next.js redirect()/notFound() work by throwing; rethrow so navigation
    // still happens rather than being reported as a network error.
    if (isFrameworkControlFlow(err)) throw err;
    console.error("[action] transport failure:", err);
    return { ok: false, error: "INTERNAL" };
  }
}

function isFrameworkControlFlow(err: unknown): boolean {
  const digest = (err as { digest?: unknown })?.digest;
  return typeof digest === "string" && /^(NEXT_REDIRECT|NEXT_NOT_FOUND)/.test(digest);
}
