import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { createRateLimiter } from "@/lib/rate-limit";
import { hasPermission } from "@/modules/auth/permissions";
import { getSessionContext } from "@/modules/auth/server/session";
import { submitAttempt } from "@/modules/grading/server/submit";

/**
 * POST /api/levels/[levelId]/attempts — the only write path for gameplay
 * results (m3 contract). The client's optimistic run is UI sugar; whatever
 * this endpoint returns is the authority on verdict/stars/XP/unlocks.
 * All heavy lifting lives in modules/grading/server/submit.ts.
 */

const bodySchema = z.object({
  attemptRunId: z.string().uuid(),
  workspaceJson: z.unknown(),
  clientVerdict: z.enum(["PASS", "PARTIAL", "FAIL"]).optional(),
  durationMs: z.number().int().nonnegative().optional(),
});

/** 30 submissions per minute per student (anti-hammering, not a quota). */
const limiter = createRateLimiter({ limit: 30, windowMs: 60_000 });

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ levelId: string }> },
) {
  const ctx = await getSessionContext();
  if (!ctx) {
    return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  }
  if (ctx.role !== "STUDENT" || !hasPermission(ctx.role, "attempts:submit")) {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  if (!limiter.allow(ctx.userId)) {
    return NextResponse.json({ error: "RATE_LIMITED" }, { status: 429 });
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: "VALIDATION" }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "VALIDATION", issues: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const { levelId } = await params;
  try {
    const outcome = await submitAttempt(ctx, levelId, {
      ...parsed.data,
      workspaceJson: parsed.data.workspaceJson ?? null,
    });
    return NextResponse.json(outcome.body, { status: outcome.status });
  } catch (err) {
    console.error("[attempts] submit failed:", err);
    return NextResponse.json({ error: "INTERNAL" }, { status: 500 });
  }
}
