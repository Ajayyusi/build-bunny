import { db } from "@/lib/db";
import type { LearningEventType, Prisma } from "@prisma/client";

/**
 * Append-only learning-event stream (plan §0.1-14). Powers teacher/school
 * analytics later; only a subset is dashboarded in V1. Payloads stay minimal —
 * NEVER workspace content, code, or student free text.
 */
export interface LearningEventInput {
  type: LearningEventType;
  schoolId: string;
  studentUserId: string;
  classId?: string | null;
  levelId?: string | null;
  worldId?: string | null;
  /** Small scalar facts only (e.g. { stars: 2, attempt: 3 }). */
  meta?: Prisma.InputJsonValue;
}

export async function recordLearningEvent(event: LearningEventInput): Promise<void> {
  try {
    await db.learningEvent.create({
      data: {
        type: event.type,
        schoolId: event.schoolId,
        studentUserId: event.studentUserId,
        classId: event.classId ?? null,
        levelId: event.levelId ?? null,
        worldId: event.worldId ?? null,
        meta: event.meta,
      },
    });
  } catch (err) {
    console.error("[events] failed to record", event.type, err);
  }
}
