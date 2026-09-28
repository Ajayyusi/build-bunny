import type { ActivityGradeResult } from "@/modules/activities/types";
import type { markItemsConfig } from "@/modules/curriculum/schemas";
import type { z } from "zod";

import { invalidAnswerResult } from "../shared";
import { markItemsAnswerSchema, type StudentMarkItemsConfig } from "./types";

export type MarkItemsConfig = z.infer<typeof markItemsConfig>;

/** Every item a child can mark (items without an answer are plain text). */
export function markableItems(config: MarkItemsConfig) {
  return config.groups.flatMap((group) => group.items.filter((item) => item.answer !== undefined));
}

/** The mark a child's answer gives an item: theirs, or the widget's default. */
export function markOf(config: Pick<MarkItemsConfig, "defaultMark">, marks: Readonly<Record<string, string>>, itemId: string) {
  return marks[itemId] ?? config.defaultMark ?? null;
}

/**
 * "Mark the items" grading (generative-AI fact check, privacy strike-out,
 * clear instructions): PASS when every markable item carries its right
 * mark. Feedback says how many are right, never which — the next-step hint
 * (which costs the top star) is where a child can be shown one.
 */
export function gradeMarkItems(config: MarkItemsConfig, submission: unknown): ActivityGradeResult {
  const parsed = markItemsAnswerSchema.safeParse(submission);
  if (!parsed.success) return invalidAnswerResult();
  const items = markableItems(config);
  const correct = items.filter((item) => markOf(config, parsed.data.marks, item.id) === item.answer).length;
  const total = items.length;
  const pass = correct === total;
  return {
    verdict: pass ? "PASS" : "FAIL",
    qualityPassed: pass,
    primaryFeedback: pass ? null : { code: "marksWrong", data: { correct, total } },
    generatedCode: "",
    blockCount: null,
    summary: { correct, total },
  };
}

/** Drops each item's answer: the marks a child chooses from stay visible. */
export function stripMarkItemsConfig(config: MarkItemsConfig): StudentMarkItemsConfig {
  return {
    ...config,
    groups: config.groups.map((group) => ({
      ...group,
      items: group.items.map(({ answer, ...item }) => ({ ...item, markable: answer !== undefined })),
    })),
  };
}
