import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { generateRequestId, logger, setRequestContext, withRequestContext } from "@/lib/logger";
import { createRateLimiter } from "@/lib/rate-limit";
import { hasPermission } from "@/modules/auth/permissions";
import { getSessionContext } from "@/modules/auth/server/session";
import { getPublishedLevelSnapshot } from "@/modules/curriculum/server/queries";
import { submitAttempt, type AttemptInput } from "@/modules/grading/server/submit";

/**
 * POST /api/levels/[levelId]/attempts — the only write path for gameplay
 * results (m3/m4 contract). The client's optimistic run is UI sugar;
 * whatever this endpoint returns is the authority on verdict/stars/XP/
 * unlocks. All heavy lifting lives in modules/grading/server/submit.ts.
 *
 * The body is a discriminated union on the level's activityType (m4 task 4):
 * grid types (BLOCK_CODING/DEBUGGING) send the raw workspace; CODE_PREDICTION
 * sends `{ answer: { optionId } }`; SEQUENCING sends `{ answer: { order } }`;
 * CONCEPT_CARDS sends `{ answer: { blockType } }`. .strict() on every branch
 * means a body shaped for one type is rejected — not silently accepted —
 * when sent against a level of another type.
 */

const gridBodySchema = z
  .object({
    attemptRunId: z.string().uuid(),
    workspaceJson: z.unknown(),
    clientVerdict: z.enum(["PASS", "PARTIAL", "FAIL"]).optional(),
    durationMs: z.number().int().nonnegative().optional(),
  })
  .strict();

const codePredictionBodySchema = z
  .object({
    attemptRunId: z.string().uuid(),
    answer: z.object({ optionId: z.string().min(1) }).strict(),
  })
  .strict();

const sequencingBodySchema = z
  .object({
    attemptRunId: z.string().uuid(),
    answer: z.object({ order: z.array(z.string().min(1)).min(1) }).strict(),
  })
  .strict();

const conceptCardsBodySchema = z
  .object({
    attemptRunId: z.string().uuid(),
    answer: z.object({ blockType: z.string().min(1) }).strict(),
  })
  .strict();

const GRID_ACTIVITY_TYPES = new Set(["BLOCK_CODING", "DEBUGGING"]);

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

      let input: AttemptInput;
      if (activityType === "CODE_PREDICTION") {
        const parsed = codePredictionBodySchema.safeParse(raw);
        if (!parsed.success) return validationError(parsed.error.flatten().fieldErrors);
        input = parsed.data;
      } else if (activityType === "SEQUENCING") {
        const parsed = sequencingBodySchema.safeParse(raw);
        if (!parsed.success) return validationError(parsed.error.flatten().fieldErrors);
        input = parsed.data;
      } else if (activityType === "CONCEPT_CARDS") {
        const parsed = conceptCardsBodySchema.safeParse(raw);
        if (!parsed.success) return validationError(parsed.error.flatten().fieldErrors);
        input = parsed.data;
      } else if (!activityType || GRID_ACTIVITY_TYPES.has(activityType)) {
        const parsed = gridBodySchema.safeParse(raw);
        if (!parsed.success) return validationError(parsed.error.flatten().fieldErrors);
        input = { ...parsed.data, workspaceJson: parsed.data.workspaceJson ?? null };
      } else {
        // A registered ActivityType with no V1 engine yet (e.g. QUIZ) — no
        // body shape is valid.
        return validationError();
      }

      try {
        const outcome = await submitAttempt(ctx, levelId, input);
        return NextResponse.json(outcome.body, { status: outcome.status });
      } catch (err) {
        console.error("[attempts] submit failed:", err);
        return NextResponse.json({ error: "INTERNAL" }, { status: 500 });
      }
    }
  });
}
