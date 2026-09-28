import { NextResponse, type NextRequest } from "next/server";

import { createRateLimiter } from "@/lib/rate-limit";
import { requireApiPermission } from "@/modules/auth/server/api-guard";
import { NotFoundError } from "@/modules/auth/server/guard";
import { playEventSchema, recordPlayEventCore } from "@/modules/learning/server/play-events";

/**
 * POST /api/levels/[levelId]/events — in-level analytics from the player
 * (a session start, an AI test that isn't a graded run, a retry). Fire and
 * forget: the player never waits on it and a failure changes nothing.
 */

const limiter = createRateLimiter({ limit: 120, windowMs: 60_000 });

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ levelId: string }> },
) {
  const { levelId } = await params;
  const gate = await requireApiPermission("attempts:submit");
  if (gate instanceof NextResponse) return gate;
  if (!limiter.allow(gate.userId)) return NextResponse.json({ error: "RATE_LIMITED" }, { status: 429 });
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: "VALIDATION" }, { status: 400 });
  }
  const parsed = playEventSchema.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ error: "VALIDATION" }, { status: 400 });
  try {
    return NextResponse.json(await recordPlayEventCore(gate, levelId, parsed.data));
  } catch (error) {
    if (error instanceof NotFoundError) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
    console.error("[play-events] failed:", error);
    return NextResponse.json({ error: "INTERNAL" }, { status: 500 });
  }
}
