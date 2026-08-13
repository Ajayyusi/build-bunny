import { setRequestLocale } from "next-intl/server";

import { redirect } from "@/i18n/navigation";
import { ActivityPlayer } from "@/modules/activities/players/ActivityPlayer";
import { getActivityEngine } from "@/modules/activities/server/registry";
import { codePredictionStudentPayload } from "@/modules/activities/server/code-prediction";
import { conceptCardsStudentPayload } from "@/modules/activities/server/concept-cards";
import {
  sequencingStudentPayload,
  shuffleSequencingItems,
} from "@/modules/activities/server/sequencing";
import {
  aiEthicsStudentPayload,
  aiSimStudentPayload,
} from "@/modules/activities/server/student-views";
import type {
  ActivityIntro,
  AiEthicsActivityPayload,
  AiSimActivityPayload,
  CodePredictionActivityPayload,
  GridActivityPayload,
  GroupActivityPayload,
  LearnActivityPayload,
  SequencingActivityPayload,
  TeachActivityPayload,
} from "@/modules/activities/types";
import { requireRole } from "@/modules/auth/server/session";
import {
  aiClassificationStudentPayload,
  blockCodingPayload,
  debuggingPayload,
  patternRecognitionStudentPayload,
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

interface Props {
  params: Promise<{ locale: string; levelId: string }>;
}

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

  // The registry is the single source of truth for "is this playable" (m4
  // task 4) — a level whose activityType has no registered engine (locked,
  // unpublished, foreign, or a future type with no engine yet) never loads.
  // The SERVER half answers this; the matching player is selected inside the
  // client boundary (a server component cannot call into "use client" code).
  const engine = playable ? getActivityEngine(playable.activityType) : undefined;
  if (!playable || !engine) {
    redirect({ href: "/adventure", locale });
    return null;
  }

  // First open flips UNLOCKED → IN_PROGRESS and records LEVEL_STARTED (once).
  await markLevelStarted({ levelId });

  const { theme, next } = locateOnTrail(adventure, levelId);

  const intro: ActivityIntro = {
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
  };

  // Re-parse the (student-stripped) payload per activity type so schema
  // defaults are applied and the client-facing shape is rebuilt field by
  // field: answer-bearing keys cannot leak even if an upstream strip
  // regresses — grid payloads have no required answer field (solution is
  // optional and simply never copied below); CODE_PREDICTION, SEQUENCING and
  // CONCEPT_CARDS use dedicated answer-FREE schemas, so a stripped payload
  // that still carried correctOptionId / correctOrder /
  // faded.missingBlockType would fail this parse loudly instead of shipping
  // it.
  let payload:
    | GridActivityPayload
    | CodePredictionActivityPayload
    | SequencingActivityPayload
    | LearnActivityPayload
    | TeachActivityPayload
    | GroupActivityPayload
    | AiEthicsActivityPayload
    | AiSimActivityPayload;
  if (playable.activityType === "DEBUGGING") {
    const parsed = debuggingPayload.parse(playable.payload);
    const resetWorkspace =
      playable.startWorkspace ?? parsed.brokenWorkspace ?? parsed.startWorkspace ?? null;
    payload = {
      toolbox: parsed.toolbox,
      variants: parsed.variants,
      autoCollect: parsed.autoCollect,
      nonFatalBumps: parsed.nonFatalBumps,
      budgets: parsed.budgets,
      checks: parsed.checks,
      starCriteria: parsed.starCriteria,
      initialWorkspace: playable.draftWorkspace ?? resetWorkspace,
      resetWorkspace,
    } satisfies GridActivityPayload;
  } else if (playable.activityType === "CODE_PREDICTION") {
    const parsed = codePredictionStudentPayload.parse(playable.payload);
    payload = {
      code: parsed.code,
      prompt: parsed.prompt,
      options: parsed.options,
      wrongFeedback: parsed.wrongFeedback ?? null,
    } satisfies CodePredictionActivityPayload;
  } else if (playable.activityType === "SEQUENCING") {
    const parsed = sequencingStudentPayload.parse(playable.payload);
    payload = {
      prompt: parsed.prompt,
      // Deterministic per (level, student): stable across reloads, varies
      // across students.
      items: shuffleSequencingItems(parsed.items, `${playable.id}:${ctx.userId}`),
    } satisfies SequencingActivityPayload;
  } else if (playable.activityType === "AI_CLASSIFICATION") {
    // Parsed, not cast. `rule` (the ground truth) was already removed by
    // stripStudentPayload, and this schema is .strict() WITHOUT it — so a
    // strip regression fails loudly here instead of serialising the answer
    // into the page source. Every other activity type already had a mirror
    // schema; this one was the last `as` cast in the file.
    const raw = aiClassificationStudentPayload.parse(playable.payload);
    payload = {
      conceptSlug: raw.conceptSlug,
      labels: {
        positive: resolveText(raw.labels.positive, locale),
        negative: resolveText(raw.labels.negative, locale),
      },
      pool: raw.pool,
      testSet: raw.testSet,
      minPerLabel: raw.minPerLabel,
      maxExamples: raw.maxExamples,
      // Localized once, on the server. The player receives strings, never
      // LocalizedText, so no client component needs to know about locales.
      theme: raw.theme
        ? {
            glyph: raw.theme.glyph,
            featureNames: {
              size: resolveText(raw.theme.featureNames.size, locale),
              color: resolveText(raw.theme.featureNames.color, locale),
            },
            truthEmoji: raw.theme.truthEmoji,
          }
        : undefined,
      walkthrough: raw.walkthrough?.map((beat) => ({
        title: resolveText(beat.title, locale),
        body: resolveText(beat.body, locale),
      })),
      board: raw.board
        ? {
            show: raw.board.show,
            showBoundary: raw.board.showBoundary,
            axisLabels: {
              x: resolveText(raw.board.axisLabels.x, locale),
              y: resolveText(raw.board.axisLabels.y, locale),
            },
          }
        : undefined,
      holdout: raw.holdout,
      passRule: raw.passRule,
      starCriteria: raw.starCriteria,
    } satisfies TeachActivityPayload;
  } else if (playable.activityType === "PATTERN_RECOGNITION") {
    // Same contract as AI_CLASSIFICATION: parsed against a .strict() mirror
    // with `groundTruth` absent, so a strip regression is a 500, not a leak.
    const raw = patternRecognitionStudentPayload.parse(playable.payload);
    payload = {
      conceptSlug: raw.conceptSlug,
      specimens: raw.specimens,
      markers: raw.markers,
      maxExclusions: raw.maxExclusions,
      objective: raw.objective,
      training: raw.training,
      theme: raw.theme
        ? {
            glyph: raw.theme.glyph,
            featureNames: {
              size: resolveText(raw.theme.featureNames.size, locale),
              color: resolveText(raw.theme.featureNames.color, locale),
            },
            truthEmoji: raw.theme.truthEmoji,
          }
        : undefined,
      walkthrough: raw.walkthrough?.map((beat) => ({
        title: resolveText(beat.title, locale),
        body: resolveText(beat.body, locale),
      })),
      starCriteria: raw.starCriteria,
    } satisfies GroupActivityPayload;
  } else if (playable.activityType === "AI_ETHICS") {
    // Parsed against the .strict() student mirror (student-views.ts): the
    // choices' `safe` flags were removed by stripStudentPayload, and a strip
    // regression fails this parse loudly instead of shipping the answer key.
    const parsed = aiEthicsStudentPayload.parse(playable.payload);
    payload = {
      prompt: parsed.prompt,
      scenes: parsed.scenes,
      takeaways: parsed.takeaways,
    } satisfies AiEthicsActivityPayload;
  } else if (playable.activityType === "AI_SIM") {
    // Envelope re-parse; the widget config passed through opaque because the
    // widget's own stripConfig already removed its answer keys (a pixel
    // round's imageId) and each widget player re-validates its own shape.
    const parsed = aiSimStudentPayload.parse(playable.payload);
    payload = {
      widget: parsed.widget as AiSimActivityPayload["widget"],
      intro: parsed.intro,
      honesty: parsed.honesty,
    } satisfies AiSimActivityPayload;
  } else if (playable.activityType === "CONCEPT_CARDS") {
    const parsed = conceptCardsStudentPayload.parse(playable.payload);
    payload = {
      conceptSlug: parsed.conceptSlug,
      variants: parsed.variants,
      autoCollect: parsed.autoCollect,
      nonFatalBumps: parsed.nonFatalBumps,
      budgets: parsed.budgets,
      workedExample: {
        blocks: parsed.workedExample.blocks,
        caption: parsed.workedExample.caption,
      },
      // faded.missingBlockType is deliberately not copied: the answer stays
      // server-side and the client asks the grader for the verdict.
      faded: {
        blocks: parsed.faded.blocks,
        toolbox: parsed.faded.toolbox,
        caption: parsed.faded.caption,
      },
    } satisfies LearnActivityPayload;
  } else {
    const parsed = blockCodingPayload.parse(playable.payload);
    const resetWorkspace = playable.startWorkspace ?? parsed.startWorkspace ?? null;
    payload = {
      toolbox: parsed.toolbox,
      variants: parsed.variants,
      autoCollect: parsed.autoCollect,
      nonFatalBumps: parsed.nonFatalBumps,
      budgets: parsed.budgets,
      checks: parsed.checks,
      starCriteria: parsed.starCriteria,
      initialWorkspace: playable.draftWorkspace ?? resetWorkspace,
      resetWorkspace,
    } satisfies GridActivityPayload;
  }

  return (
    <ActivityPlayer
      activityType={playable.activityType}
      intro={intro}
      payload={payload}
      revealHintAction={revealHint}
      saveDraftAction={saveWorkspaceDraft}
    />
  );
}
