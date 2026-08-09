import "server-only";

import { computeAdventureState, getLevelIntro } from "./adventure";
import { getPlayableLevel } from "./play";

/**
 * Learning-domain tenant-scoped queries (hard rule 1). The implementations
 * live in ./adventure.ts and ./play.ts (pinned cross-agent interfaces); this
 * file re-exports them and registers them so the tenant-isolation rig — which
 * globs every modules/x/server/queries.ts — pulls them under test
 * automatically. recomputeUnlocks and the player mutation cores take no
 * SessionContext-scoped read role and are deliberately NOT re-exported here.
 */
export { computeAdventureState, getLevelIntro, getPlayableLevel };

/** Registry walked by the tenant-isolation test suite. */
export const tenantScopedQueries = {
  computeAdventureState,
  getLevelIntro,
  getPlayableLevel,
} as const;
