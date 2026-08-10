"use client";

import dynamic from "next/dynamic";
import type { ComponentType } from "react";

import type { ActivityPlayerProps } from "../types";

/**
 * The activity-engine registry (m4 task 4), client half: keyed by
 * ActivityType, exposing the lazy player component. Every entry is lazy so a
 * CODE_PREDICTION level never pulls in Blockly's bundle and vice versa. This
 * file MUST carry "use client" — next/dynamic's ssr:false (required for the
 * DOM-only Blockly grid player) is only allowed inside a Client Component;
 * the server half (grader + payload stripper) lives in ./server/registry.ts.
 *
 * Registering a future type (QUIZ, PATTERN_RECOGNITION, AI_CLASSIFICATION,
 * REAL_ML, AI_ETHICS — already in the ActivityType enum, no V1 engine) is
 * adding one entry here + one in server/registry.ts.
 */

const GridPlayer = dynamic(
  () => import("./GridPlayer").then((m) => m.GridPlayer),
  { ssr: false },
);
const CodePredictionPlayer = dynamic(
  () => import("./CodePredictionPlayer").then((m) => m.CodePredictionPlayer),
  { ssr: false },
);
const SequencingPlayer = dynamic(
  () => import("./SequencingPlayer").then((m) => m.SequencingPlayer),
  { ssr: false },
);
// ssr:false like GridPlayer — the Learn step drives Blockly for both of its
// beats (LEARN-STEP-SPEC.md).
const LearnPlayer = dynamic(
  () => import("./LearnPlayer").then((m) => m.LearnPlayer),
  { ssr: false },
);

export const ACTIVITY_PLAYERS: Partial<Record<string, ComponentType<ActivityPlayerProps>>> = {
  BLOCK_CODING: GridPlayer,
  DEBUGGING: GridPlayer,
  CODE_PREDICTION: CodePredictionPlayer,
  SEQUENCING: SequencingPlayer,
  CONCEPT_CARDS: LearnPlayer,
};

export function getActivityPlayer(
  activityType: string,
): ComponentType<ActivityPlayerProps> | undefined {
  return ACTIVITY_PLAYERS[activityType];
}
