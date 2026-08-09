import { setRequestLocale } from "next-intl/server";

import { redirect } from "@/i18n/navigation";
import { requireRole } from "@/modules/auth/server/session";
import {
  blockCodingPayload,
  debuggingPayload,
  resolveText,
} from "@/modules/curriculum/schemas";
import {
  computeAdventureState,
  type AdventureState,
} from "@/modules/learning/server/adventure";
import {
  markLevelStarted,
  revealHint,
  saveWorkspaceDraft,
} from "@/modules/learning/server/actions";
import { getPlayableLevel } from "@/modules/learning/server/queries";
import { isFeatureEnabled } from "@/modules/shared/features";
import { getMyStudentSnapshot } from "@/modules/students/server/queries";

import { PlayerShell } from "./_components/PlayerShell";
import type { PlayerLevelVM, PlayerPayload } from "./_components/types";

interface Props {
  params: Promise<{ locale: string; levelId: string }>;
}

/** V1 activity types the grid-world player can actually run. */
const PLAYABLE_TYPES = new Set(["BLOCK_CODING", "DEBUGGING"]);

/**
 * Walk the trail in map order to find the level's world theme and its
 * successor (for the "Next level" action). The adventure state is already
 * scoped to this student's program and progress.
 */
function locateOnTrail(
  state: AdventureState,
  levelId: string,
): { theme: string; next: { id: string; locked: boolean } | null } {
  const flat: { id: string; state: string; theme: string }[] = [];
  for (const world of state.worlds) {
    if (world.horizon) continue;
    for (const moduleNode of world.modules) {
      for (const level of moduleNode.levels) {
        flat.push({ id: level.id, state: level.state, theme: world.theme });
      }
    }
  }
  const index = flat.findIndex((entry) => entry.id === levelId);
  if (index === -1) return { theme: "", next: null };
  const next = flat[index + 1];
  return {
    theme: flat[index]!.theme,
    next: next ? { id: next.id, locked: next.state === "LOCKED" } : null,
  };
}

export default async function PlayLevelPage({ params }: Props) {
  const { locale, levelId } = await params;
  setRequestLocale(locale);
  const ctx = await requireRole("STUDENT");

  // Same gate as the map: no adventure flag, no player.
  const snapshot = await getMyStudentSnapshot(ctx);
  if (!isFeatureEnabled(snapshot?.school.features, "adventure")) {
    redirect({ href: "/home", locale });
  }

  const [playable, adventure] = await Promise.all([
    getPlayableLevel(ctx, levelId),
    computeAdventureState(ctx),
  ]);
  // Locked / unpublished / foreign levels never load a player; V1 plays
  // grid-world activities only.
  if (!playable || !PLAYABLE_TYPES.has(playable.activityType)) {
    redirect({ href: "/adventure", locale });
    return null;
  }

  // First open flips UNLOCKED → IN_PROGRESS and records LEVEL_STARTED (once).
  await markLevelStarted({ levelId });

  // Re-parse the (student-stripped) payload so schema defaults are applied,
  // then rebuild it field-by-field: answer-bearing keys cannot leak to the
  // client even if an upstream strip regresses.
  let resetWorkspace: unknown;
  let parsed: ReturnType<typeof blockCodingPayload.parse>;
  if (playable.activityType === "DEBUGGING") {
    const debug = debuggingPayload.parse(playable.payload);
    parsed = debug;
    // DEBUGGING preloads the broken program as the workspace to repair.
    resetWorkspace =
      playable.startWorkspace ?? debug.brokenWorkspace ?? debug.startWorkspace ?? null;
  } else {
    parsed = blockCodingPayload.parse(playable.payload);
    resetWorkspace = playable.startWorkspace ?? parsed.startWorkspace ?? null;
  }
  const payload: PlayerPayload = {
    toolbox: parsed.toolbox,
    variants: parsed.variants,
    autoCollect: parsed.autoCollect,
    nonFatalBumps: parsed.nonFatalBumps,
    budgets: parsed.budgets,
    checks: parsed.checks,
    starCriteria: parsed.starCriteria,
  };

  const { theme, next } = locateOnTrail(adventure, levelId);

  const vm: PlayerLevelVM = {
    levelId: playable.id,
    activityType: playable.activityType,
    title: resolveText(playable.title, locale),
    story: resolveText(playable.story, locale),
    objective: resolveText(playable.objective, locale),
    instructions: resolveText(playable.instructions, locale),
    explanation: resolveText(playable.explanation, locale),
    difficulty: playable.difficulty,
    estimatedMinutes: playable.estimatedMinutes,
    maxStars: playable.maxStars,
    starsBest: playable.starsBest,
    hintsUsedTiers: playable.hintsUsedTiers,
    worldTheme: theme,
    nextLevel: next,
    payload,
    initialWorkspace: playable.draftWorkspace ?? resetWorkspace,
    resetWorkspace,
  };

  return (
    <PlayerShell
      vm={vm}
      revealHintAction={revealHint}
      saveDraftAction={saveWorkspaceDraft}
    />
  );
}
