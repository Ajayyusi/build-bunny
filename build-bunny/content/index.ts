import type { ProgramFixture, WorldFixture } from "@/modules/curriculum/schemas";
import { programs } from "./programs";
import { bunnyMeadow } from "./worlds/bunny-meadow";
import { horizonWorlds } from "./worlds/horizons";
import { logicForest } from "./worlds/logic-forest";

/**
 * Structurally identical to ImportBundle in
 * src/modules/curriculum/server/import.ts (M2 task 14) — kept local so the
 * content package has no dependency on the import service.
 */
export interface ContentBundle {
  programs: ProgramFixture[];
  worlds: WorldFixture[];
}

/** Everything the import service needs to materialize Worlds 1–2 + horizons. */
export const bundle: ContentBundle = {
  programs,
  worlds: [bunnyMeadow, logicForest, ...horizonWorlds],
};
