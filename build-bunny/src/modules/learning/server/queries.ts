import "server-only";

import { computeAdventureState, getLevelIntro } from "./adventure";

/**
 * Learning-domain tenant-scoped queries (hard rule 1). The implementations
 * live in ./adventure.ts (pinned cross-agent interface); this file re-exports
 * them and registers them so the tenant-isolation rig — which globs every
 * modules/x/server/queries.ts — pulls them under test automatically.
 * recomputeUnlocks is a mutation (no SessionContext) and is deliberately
 * NOT re-exported here.
 */
export { computeAdventureState, getLevelIntro };

/** Registry walked by the tenant-isolation test suite. */
export const tenantScopedQueries = {
  computeAdventureState,
  getLevelIntro,
} as const;
