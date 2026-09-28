import { NextResponse, type NextRequest } from "next/server";

import { createRateLimiter } from "@/lib/rate-limit";
import { checkPixelRoundCore, pixelRoundCheckSchema } from "@/modules/ai/lab/pixel-playground/check";
import { requireApiPermission } from "@/modules/auth/server/api-guard";
import { NotFoundError } from "@/modules/auth/server/guard";

/**
 * POST /api/levels/[levelId]/pixel-round — See Like a Computer's "Check my
 * guess" for one mystery round. The round's answer never reaches the
 * browser, so the per-round reveal comes from here (see
 * checkPixelRoundCore). Same permission as submitting an attempt.
 */

/** A few checks per round, three rounds, a handful of retries. */
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
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: "VALIDATION" }, { status: 400 });
  }
  const parsed = pixelRoundCheckSchema.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ error: "VALIDATION" }, { status: 400 });
  try {
    return NextResponse.json(await checkPixelRoundCore(ctx, levelId, parsed.data));
  } catch (error) {
    if (error instanceof NotFoundError) {
      return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
    }
    console.error("[pixel-round] check failed:", error);
    return NextResponse.json({ error: "INTERNAL" }, { status: 500 });
  }
}
