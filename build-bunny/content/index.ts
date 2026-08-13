import type { ProgramFixture, WorldFixture } from "@/modules/curriculum/schemas";
import { programs } from "./programs";
import { aiIsland } from "./worlds/ai-island";
import { bunnyMeadow } from "./worlds/bunny-meadow";
import { dataDesert } from "./worlds/data-desert";
import { horizonWorlds } from "./worlds/horizons";
import { logicForest } from "./worlds/logic-forest";
import { mlLab } from "./worlds/ml-lab";
import { robotLab } from "./worlds/robot-lab";

/**
 * Structurally identical to ImportBundle in
 * src/modules/curriculum/server/import.ts (M2 task 14) — kept local so the
 * content package has no dependency on the import service.
 */
export interface ContentBundle {
  programs: ProgramFixture[];
  worlds: WorldFixture[];
}

/** Everything the import service needs: Worlds 1–6 + the horizon roadmap. */
export const bundle: ContentBundle = {
  programs,
  worlds: [bunnyMeadow, logicForest, robotLab, aiIsland, dataDesert, mlLab, ...horizonWorlds],
};
