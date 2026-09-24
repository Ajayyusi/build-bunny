import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { createRateLimiter } from "@/lib/rate-limit";
import { requireApiPermission } from "@/modules/auth/server/api-guard";
import { ConflictError, NotFoundError } from "@/modules/auth/server/guard";
import { MAX_DRAFT_BYTES, saveWorkspaceDraftCore } from "@/modules/learning/server/play";

/**
 * POST /api/levels/[levelId]/draft — the "leaving the page" draft flush.
 *
 * The players autosave through a server action, debounced two seconds after
 * the last edit. A child who closes the tab, switches app or loses the
 * screen inside that window would lose their last edits, because a server
 * action cannot be sent with `keepalive` from pagehide. This route can: it
 * takes the same payload, applies the same authorisation (progress row +
 * entitlement, via requireApiPermission and saveWorkspaceDraftCore) and
 * writes the same column.
 */

const bodySchema = z.object({ workspaceJson: z.unknown() }).strict();

/** Generous: one flush per navigation, never a hot loop. */
const limiter = createRateLimiter({ limit: 60, windowMs: 60_000 });

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ levelId: string }> },
) {
  const { levelId } = await params;
  const gate = await requireApiPermission("attempts:submit");
  if (gate instanceof NextResponse) return gate;
  const ctx = gate;
  if (!limiter.allow(ctx.userId)) {
    return NextResponse.json({ error: "RATE_LIMITED" }, { status: 429 });
  }
  // Refuse oversized bodies before reading them (the core checks again).
  const declared = Number(request.headers.get("content-length") ?? "0");
  if (declared > MAX_DRAFT_BYTES + 1_000) {
    return NextResponse.json({ error: "TOO_LARGE" }, { status: 413 });
  }
  let raw: unknown;
  try {
    const text = await request.text();
    if (text.length > MAX_DRAFT_BYTES + 1_000) {
      return NextResponse.json({ error: "TOO_LARGE" }, { status: 413 });
    }
    raw = JSON.parse(text);
  } catch {
    return NextResponse.json({ error: "VALIDATION" }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ error: "VALIDATION" }, { status: 400 });
  try {
    const { savedAt } = await saveWorkspaceDraftCore(ctx, {
      levelId,
      workspaceJson: parsed.data.workspaceJson ?? null,
    });
    return NextResponse.json({ ok: true, savedAt });
  } catch (error) {
    if (error instanceof NotFoundError) {
      return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
    }
    if (error instanceof ConflictError) {
      return NextResponse.json({ error: "TOO_LARGE" }, { status: 413 });
    }
    console.error("[draft] flush failed:", error);
    return NextResponse.json({ error: "INTERNAL" }, { status: 500 });
  }
}
