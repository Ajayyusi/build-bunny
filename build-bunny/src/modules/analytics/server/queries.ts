import "server-only";

import {
  getAttemptReplay,
  getClassMatrix,
  getStudentDetail,
  getTeacherOverview,
} from "./teacher";

/**
 * Teacher-analytics tenant-scoped queries (hard rule 1). The implementations
 * live in ./teacher.ts (m4 pinned interface); this file re-exports them and
 * registers them so the tenant-isolation rig — which globs every
 * modules/x/server/queries.ts — pulls them under test automatically.
 * giveFeedbackCore is a mutation, not a read, so it is deliberately NOT
 * re-exported here (same convention as learning/server/queries.ts).
 */
export { getAttemptReplay, getClassMatrix, getStudentDetail, getTeacherOverview };

/** Registry walked by the tenant-isolation test suite. */
export const tenantScopedQueries = {
  getClassMatrix,
  getTeacherOverview,
  getStudentDetail,
  getAttemptReplay,
} as const;
