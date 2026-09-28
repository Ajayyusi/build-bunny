import type { ExploreConcept } from "@/modules/explore/catalog";

/**
 * AI concept mastery for teachers (handoff: the dashboard reports example
 * quality, testing, bias, uncertainty and oversight; mastery, attempts,
 * misconceptions and grade band; understanding apart from completion;
 * privacy-conscious aggregation). Pure: the reader loads the rows, this
 * decides. Class totals only.
 */

export const AI_CONCEPTS = ["exampleQuality", "testing", "bias", "uncertainty", "oversight"] as const;
export type AiConcept = (typeof AI_CONCEPTS)[number];

/** The levels that teach each concept (a level can teach more than one). */
export const AI_CONCEPT_LEVELS: Readonly<Record<AiConcept, readonly string[]>> = {
  exampleQuality: ["train-a-sorter", "berry-sorter", "draw-the-line", "the-berry-that-lied", "three-examples-only", "desert-flowers"],
  testing: ["rule-or-examples", "keep-some-back", "bias-detective", "which-mistake-is-worse"],
  bias: ["bias-detective", "mirage-pattern", "seed-sorter"],
  uncertainty: ["fortune-teller", "see-like-a-computer", "is-that-real"],
  oversight: ["who-decides", "which-mistake-is-worse", "is-that-real"],
};

/**
 * Secure: finished at least two of the concept's levels (all of them when it
 * has fewer), averaging two stars or more, and — where any of its levels
 * asks the one-tap check — answered one correctly. Working on it: finished
 * at least one. The rule is shown to teachers as written here.
 */
export const SECURE_MIN_LEVELS = 2;
export const SECURE_MIN_AVG_STARS = 2;

export type Mastery = "notStarted" | "working" | "secure";

export interface ClassAiConcept {
  concept: AiConcept;
  /** How many of its levels this class's programme has. */
  levels: number;
  notStarted: number;
  working: number;
  secure: number;
  /** Graded checks on its levels, and retries (AI_RETRY events). */
  attempts: number;
  retries: number;
  /** The most common wrong first answer to its quick checks, if any. */
  misconception: { checkConcept: ExploreConcept; choice: string; count: number } | null;
  /** Secure, by grade band: grades 3–4 and 5–7 (grades outside count as older/younger by edge). */
  byBand: { younger: { secure: number; students: number }; older: { secure: number; students: number } };
}

export interface ConceptInput {
  /** Programme levels by slug. */
  levelIdBySlug: ReadonlyMap<string, string>;
  students: readonly { id: string; grade: number }[];
  completed: readonly { studentId: string; levelId: string; stars: number }[];
  checks: readonly { studentId: string; levelId: string; firstChoice: string; firstCorrect: boolean; correct: boolean }[];
  /** Levels that ask a quick check, and which check. */
  checkConceptOf: ReadonlyMap<string, ExploreConcept>;
  attemptsByLevel: ReadonlyMap<string, number>;
  retriesByLevel: ReadonlyMap<string, number>;
}

export function masteryOf(
  levelIds: readonly string[],
  done: ReadonlyMap<string, number>,
  explainedLevels: ReadonlySet<string>,
  checkLevels: readonly string[],
): Mastery {
  const finished = levelIds.filter((id) => done.has(id));
  if (finished.length === 0) return "notStarted";
  const need = Math.min(SECURE_MIN_LEVELS, levelIds.length);
  const avg = finished.reduce((sum, id) => sum + (done.get(id) ?? 0), 0) / finished.length;
  const explained = checkLevels.length === 0 || checkLevels.some((id) => explainedLevels.has(id));
  return finished.length >= need && avg >= SECURE_MIN_AVG_STARS && explained ? "secure" : "working";
}

export function summariseAiConcepts(input: ConceptInput): ClassAiConcept[] {
  const doneByStudent = new Map<string, Map<string, number>>();
  for (const row of input.completed) {
    const map = doneByStudent.get(row.studentId) ?? new Map<string, number>();
    map.set(row.levelId, row.stars);
    doneByStudent.set(row.studentId, map);
  }
  const explainedByStudent = new Map<string, Set<string>>();
  for (const row of input.checks) {
    if (!row.correct) continue;
    const set = explainedByStudent.get(row.studentId) ?? new Set<string>();
    set.add(row.levelId);
    explainedByStudent.set(row.studentId, set);
  }

  return AI_CONCEPTS.map((concept): ClassAiConcept => {
    const levelIds = AI_CONCEPT_LEVELS[concept].flatMap((slug) => input.levelIdBySlug.get(slug) ?? []);
    const checkLevels = levelIds.filter((id) => input.checkConceptOf.has(id));
    const counts = { notStarted: 0, working: 0, secure: 0 };
    const byBand = { younger: { secure: 0, students: 0 }, older: { secure: 0, students: 0 } };
    for (const student of input.students) {
      const mastery =
        levelIds.length === 0
          ? "notStarted"
          : masteryOf(levelIds, doneByStudent.get(student.id) ?? new Map(), explainedByStudent.get(student.id) ?? new Set(), checkLevels);
      counts[mastery] += 1;
      const band = student.grade <= 4 ? byBand.younger : byBand.older;
      band.students += 1;
      if (mastery === "secure") band.secure += 1;
    }
    // Most common wrong first answer across its checks.
    const wrong = new Map<string, { checkConcept: ExploreConcept; choice: string; count: number }>();
    for (const row of input.checks) {
      if (row.firstCorrect || !checkLevels.includes(row.levelId)) continue;
      const checkConcept = input.checkConceptOf.get(row.levelId)!;
      const key = `${checkConcept}:${row.firstChoice}`;
      const entry = wrong.get(key) ?? { checkConcept, choice: row.firstChoice, count: 0 };
      entry.count += 1;
      wrong.set(key, entry);
    }
    const misconception = [...wrong.values()].sort((a, b) => b.count - a.count)[0] ?? null;
    return {
      concept,
      levels: levelIds.length,
      ...counts,
      attempts: levelIds.reduce((n, id) => n + (input.attemptsByLevel.get(id) ?? 0), 0),
      retries: levelIds.reduce((n, id) => n + (input.retriesByLevel.get(id) ?? 0), 0),
      misconception,
      byBand,
    };
  });
}
