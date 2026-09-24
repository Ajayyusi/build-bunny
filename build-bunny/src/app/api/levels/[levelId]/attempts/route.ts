import { NextResponse, type NextRequest } from "next/server";

import { generateRequestId, logger, setRequestContext, withRequestContext } from "@/lib/logger";
import { createRateLimiter } from "@/lib/rate-limit";
import { hasPermission } from "@/modules/auth/permissions";
import { getSessionContext } from "@/modules/auth/server/session";
import { getPublishedLevelSnapshot } from "@/modules/curriculum/server/queries";
import { parseAttemptBody } from "@/modules/grading/server/attempt-body";
import { submitAttempt, type AttemptInput } from "@/modules/grading/server/submit";

/**
 * POST /api/levels/[levelId]/attempts — the only write path for gameplay
 * results (m3/m4 contract). The client's optimistic run is UI sugar;
 * whatever this endpoint returns is the authority on verdict/stars/XP/
 * unlocks. All heavy lifting lives in modules/grading/server/submit.ts; the
 * accepted body shapes, per level type, in modules/grading/server/attempt-body.ts.
 */

/** 30 submissions per minute per student (anti-hammering, not a quota). */
const limiter = createRateLimiter({ limit: 30, windowMs: 60_000 });

function validationError(issues?: Record<string, string[] | undefined>) {
  return NextResponse.json(
    { error: "VALIDATION", ...(issues ? { issues } : {}) },
    { status: 400 },
  );
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ levelId: string }> },
) {
  const startedAt = Date.now();
  const requestId = request.headers.get("x-request-id") ?? generateRequestId();
  const { levelId } = await params;
  const path = `/api/levels/${levelId}/attempts`;

  return withRequestContext({ requestId }, async () => {
    const response = await handle();
    // One line per submission (plan §M5 task 5) — the attempts endpoint is
    // the highest-traffic mutation in the app, so this is also the log line
    // load-check.ts's numbers are cross-checked against.
    logger.info("attempts.submit", {
      requestId,
      path,
      status: response.status,
      durationMs: Date.now() - startedAt,
    });
    return response;

    async function handle(): Promise<NextResponse> {
      const ctx = await getSessionContext();
      if (!ctx) {
        return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
      }
      setRequestContext({ userId: ctx.userId, schoolId: ctx.schoolId });
      // A run queued on a shared tablet names the child who made it. Sent
      // under someone else's session (another child, or a teacher, signed in meanwhile),
      // checked BEFORE the role check — it is refused with a status the device keeps the run for, rather
      // than being credited to the wrong child.
      const claimed = request.headers.get("x-bb-player");
      if (claimed && claimed !== ctx.userId) {
        return NextResponse.json({ error: "PLAYER_MISMATCH" }, { status: 412 });
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
        return validationError();
      }

      // Published snapshot decides which body shape this level accepts. An
      // unknown/locked/unpublished level has no shape to validate against —
      // submitAttempt rejects it with LOCKED regardless of body content, so
      // the lenient grid-shaped parse below just keeps this branch from
      // crashing.
      const published = await getPublishedLevelSnapshot(levelId);
      const activityType = published?.snapshot.activityType;

      const parsed = parseAttemptBody(activityType, raw);
      if (!parsed.ok) return validationError(parsed.issues);
      const input: AttemptInput = parsed.input;

      try {
        let outcome;
        try {
          outcome = await submitAttempt(ctx, levelId, input);
        } catch (err) {
          // The same run sent twice at once (an "online" retry racing the
          // original): the second insert hits the unique attemptRunId. Run
          // again — it now finds the stored attempt and returns its result.
          if ((err as { code?: string } | null)?.code !== "P2002") throw err;
          outcome = await submitAttempt(ctx, levelId, input);
        }
        return NextResponse.json(outcome.body, { status: outcome.status });
      } catch (err) {
        console.error("[attempts] submit failed:", err);
        return NextResponse.json({ error: "INTERNAL" }, { status: 500 });
      }
    }
  });
}
