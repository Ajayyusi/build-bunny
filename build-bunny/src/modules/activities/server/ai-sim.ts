import "server-only";

import { z } from "zod";

import { aiSimPayload } from "@/modules/curriculum/schemas";
import type { LevelSnapshot } from "@/modules/curriculum/server/publish";
// ASSUMPTION (phase G, agent A builds this in parallel — see g-contracts.md
// "A · AI_SIM widget engine + three widgets"): a registry at
// src/modules/ai/lab/registry.ts keyed by widgetId, exposing
// { player (client component), grade(config, submission), stripConfig(config) }
// per widget — the same file activities/players/registry.tsx dynamic-imports
// the player half from. grade()/stripConfig() are described as "pure,
// server-safe", so this import carries no "server-only" risk of its own. If
// this module does not exist yet, or its actual shape differs, this file
// (and its one caller, ./registry.ts) are the ONLY things that fail to
// typecheck — deliberately isolated from the rest of the activity engines.
import { getAiSimWidgetEngine } from "@/modules/ai/lab/registry";
import type { ActivityGradeResult } from "../types";

/**
 * AI_SIM engine (phase G): a thin adapter, not a grader. Every widget
 * (boundary-builder, trend-line, pixel-playground) computes its own PASS/
 * PARTIAL/FAIL + quality flag from the child's actual submitted work against
 * the level's fixed dataset — this file only picks the right widget by id,
 * validates the wire shape for that widget (g-contracts pinned answer
 * shapes), and reshapes the widget's result into the registry's common
 * ActivityGradeResult so submit.ts never has to know AI_SIM exists.
 */

const lineSchema = z.object({ slope: z.number(), intercept: z.number() });

const boundaryBuilderAnswerSchema = z.object({
  line: lineSchema,
  sorts: z.record(z.string().min(1), z.string().min(1)).optional(),
});

const trendLineAnswerSchema = z.object({
  line: lineSchema,
  prediction: z.number(),
});

const pixelPlaygroundAnswerSchema = z.object({
  rounds: z.record(z.string().min(1), z.string().min(1)),
});

const ANSWER_SCHEMAS = {
  "boundary-builder": boundaryBuilderAnswerSchema,
  "trend-line": trendLineAnswerSchema,
  "pixel-playground": pixelPlaygroundAnswerSchema,
} as const;

export const aiSimAnswerSchema = z.union([
  boundaryBuilderAnswerSchema,
  trendLineAnswerSchema,
  pixelPlaygroundAnswerSchema,
]);
export type AiSimAnswer = z.infer<typeof aiSimAnswerSchema>;

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

export function gradeAiSim(snapshot: LevelSnapshot, input: unknown): ActivityGradeResult {
  const parsedPayload = aiSimPayload.safeParse(snapshot.payload);
  if (!parsedPayload.success) return invalid("invalidPayload");

  const widgetId = parsedPayload.data.widget.widgetId;
  const answerSchema = ANSWER_SCHEMAS[widgetId];
  const parsedAnswer = answerSchema.safeParse(input);
  if (!parsedAnswer.success) return invalid("invalidAnswer");

  const widget = getAiSimWidgetEngine(widgetId);
  if (!widget) return invalid("widgetNotRegistered");

  // Widgets "mirror the existing PASS/PARTIAL/FAIL vocabulary" (g-contracts):
  // grade() returns the same verdict/qualityPassed shape every other engine
  // does, so computeStars in submit.ts needs no per-widget special case.
  const result = widget.grade(parsedPayload.data.widget, parsedAnswer.data);

  return {
    verdict: result.verdict,
    qualityPassed: result.qualityPassed,
    primaryFeedback:
      result.verdict === "PASS" && result.qualityPassed ? null : result.primaryFeedback,
    generatedCode: "",
    blockCount: null,
    summary: result.summary ?? {},
  };
}
