import { resolveText } from "@/modules/curriculum/schemas";

import type { ClassMatrix } from "./server/teacher";

/**
 * The projector view's data (m4 deliverable 7, extended for brief §6), built
 * from the class matrix in ONE place so the page's first paint and the
 * 20-second poll can never disagree.
 *
 * The live challenge: the teacher picks one level for the lesson and the
 * board shows how many of the class have finished it — a count, never a
 * ranking or a list of who has not.
 */

export interface LiveStudent {
  userId: string;
  displayName: string;
  currentLevelTitle: string | null;
  completed: boolean;
}

export interface LiveChallenge {
  levelId: string;
  title: string;
  finished: number;
  total: number;
}

export interface LiveSnapshot {
  className: string;
  grade: number;
  completionPct: number;
  activeThisWeek: number;
  studentCount: number;
  students: LiveStudent[];
  /** Every level in map order, for the challenge picker. */
  levels: { id: string; title: string }[];
  challenge: LiveChallenge | null;
}

export function buildLiveSnapshot(
  matrix: ClassMatrix,
  locale: string,
  challengeLevelId: string | null,
): LiveSnapshot {
  const students = matrix.students.map((student) => {
    let currentLevelTitle: string | null = null;
    let completed = matrix.levels.length > 0;
    for (const level of matrix.levels) {
      const status = student.cells[level.id]?.status ?? "LOCKED";
      if (status !== "COMPLETED") completed = false;
      if ((status === "IN_PROGRESS" || status === "UNLOCKED") && currentLevelTitle === null) {
        currentLevelTitle = resolveText(level.title, locale);
      }
    }
    return { userId: student.userId, displayName: student.displayName, currentLevelTitle, completed };
  });

  const challengeLevel = challengeLevelId
    ? (matrix.levels.find((level) => level.id === challengeLevelId) ?? null)
    : null;
  const challenge: LiveChallenge | null = challengeLevel
    ? {
        levelId: challengeLevel.id,
        title: resolveText(challengeLevel.title, locale),
        finished: matrix.students.filter(
          (student) => student.cells[challengeLevel.id]?.status === "COMPLETED",
        ).length,
        total: matrix.students.length,
      }
    : null;

  return {
    className: matrix.className,
    grade: matrix.grade,
    completionPct: matrix.summary.completionPct,
    activeThisWeek: matrix.summary.activeThisWeek,
    studentCount: matrix.summary.studentCount,
    students,
    levels: matrix.levels.map((level) => ({ id: level.id, title: resolveText(level.title, locale) })),
    challenge,
  };
}
