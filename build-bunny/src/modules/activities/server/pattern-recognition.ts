import "server-only";

import { z } from "zod";

import { assign, runLloyd, tightness } from "@/modules/ai/grouping";
import { patternRecognitionPayload } from "@/modules/curriculum/schemas";
import type { LevelSnapshot } from "@/modules/curriculum/server/publish";

import type { ActivityGradeResult } from "../types";

/**
 * PATTERN_RECOGNITION engine — "the Grouping Machine".
 *
 * The student's answer is flag positions (plus optional exclusions); the
 * grade is whether the resulting piles are tight enough. On training levels
 * the submitted markers are only a SEED — the grader replays the same
 * deterministic Lloyd loop the player animated, and scores where the
 * machine STOPPED, which is the whole lesson of let-it-run.
 *
 * The tightness computation lives in @/modules/ai/grouping, shared with the
 * player, so the meter on screen and the verdict can never disagree.
 */

/**
 * THE wire shape for a PATTERN_RECOGNITION submission — one schema, imported
 * by the attempts route, the grader and the tests, for the same reason the
 * classification answer is: this shape once existed as four copies and
 * adding a field to three of them shipped a silent 400.
 *
 * Marker coordinates are snapped to a 0.01 grid at the schema boundary.
 * That is what makes replaying the training loop reproducible enough to
 * gate on: two floats that print the same are the same.
 */
export const patternRecognitionAnswerSchema = z
  .object({
    markers: z
      .array(
        z
          .object({
            size: z.number().min(0).max(1).multipleOf(0.01),
            color: z.number().min(0).max(1).multipleOf(0.01),
          })
          .strict(),
      )
      .min(1)
      .max(6),
    excluded: z.array(z.string().min(1)).max(2).default([]),
  })
  .strict();
export type PatternRecognitionAnswer = z.infer<typeof patternRecognitionAnswerSchema>;

function invalid(reason: string): ActivityGradeResult {
  return {
    verdict: "ERROR",
    qualityPassed: false,
    primaryFeedback: { code: "runtimeError", data: { reason } },
    generatedCode: "",
    blockCount: null,
    summary: {},
  };
}

function refuse(code: string, data: Record<string, unknown>): ActivityGradeResult {
  return {
    verdict: "FAIL",
    qualityPassed: false,
    primaryFeedback: { code, data },
    generatedCode: "",
    blockCount: null,
    summary: {},
  };
}

export function gradePatternRecognition(
  snapshot: LevelSnapshot,
  answer: PatternRecognitionAnswer,
): ActivityGradeResult {
  const parsed = patternRecognitionPayload.safeParse(snapshot.payload);
  if (!parsed.success) return invalid("invalidPayload");
  const payload = parsed.data;

  if (
    answer.markers.length < payload.markers.min ||
    answer.markers.length > payload.markers.max
  ) {
    return refuse("wrongMarkerCount", {
      min: payload.markers.min,
      max: payload.markers.max,
      got: answer.markers.length,
    });
  }

  // Only specimens that exist may be excluded, and only within budget. A
  // crafted request cannot delete the inconvenient half of the data.
  const byId = new Set(payload.specimens.map((s) => s.id));
  const excluded = [...new Set(answer.excluded)].filter((id) => byId.has(id));
  if (excluded.length > payload.maxExclusions) {
    return refuse("tooManyExclusions", {
      max: payload.maxExclusions,
      got: excluded.length,
    });
  }
  const excludedSet = new Set(excluded);
  const kept = payload.specimens.filter((s) => !excludedSet.has(s.id));

  // Training levels: the submission is a seed, the score is the fixed point.
  const markers = payload.training
    ? runLloyd(kept, answer.markers, payload.training.iterations)
    : [...answer.markers];

  // Every flag must own at least one specimen — this is what blocks the
  // degenerate "pile all the flags on the densest clump" answer, and on
  // training levels it is checked AFTER the loop, where it belongs: a seed
  // flag nothing joins is exactly the stranded-flag lesson.
  const owned = new Array<number>(markers.length).fill(0);
  for (const s of kept) owned[assign(s, markers)]! += 1;
  const empty = owned.filter((n) => n === 0).length;
  if (empty > 0) {
    return refuse("emptyMarker", { empty });
  }

  const score = tightness(kept, markers);
  const passed = score >= payload.objective.minTightness;
  // The 3rd star is the flag budget. how-many-kinds is built on this: four
  // flags score HIGHER than three and still cost a star, which is the only
  // way a child ever meets "the machine's own number always goes up".
  const budget = payload.starCriteria.threeStarMaxBlocks;
  const withinBudget = budget === undefined || answer.markers.length <= budget;

  return {
    verdict: passed ? "PASS" : "FAIL",
    qualityPassed: passed && withinBudget,
    // The reveal is EARNED: the hidden kinds ride on the PASS feedback and
    // nowhere else, so the child sees what the piles were only after
    // separating them unaided.
    primaryFeedback: passed
      ? payload.groundTruth.hiddenKinds
        ? {
            code: "kindsRevealed",
            data: {
              kinds: payload.groundTruth.hiddenKinds,
              names: payload.groundTruth.kindNames ?? [],
            },
          }
        : null
      : {
          code: "pilesNotTight",
          // Rounded for display; the raw score also rides in the summary.
          data: {
            score: Math.round(Math.max(0, score) * 100),
            need: Math.round(payload.objective.minTightness * 100),
          },
        },
    generatedCode: "",
    // blockCount = markers used, so threeStarMaxBlocks rewards finding the
    // RIGHT number of groups (how-many-kinds) with the shared star machinery.
    blockCount: answer.markers.length,
    summary: {
      score,
      markers: markers.map((m) => ({
        size: Number(m.size.toFixed(4)),
        color: Number(m.color.toFixed(4)),
      })),
      excluded,
    },
  };
}
