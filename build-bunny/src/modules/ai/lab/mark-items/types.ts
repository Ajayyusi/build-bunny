import { z } from "zod";

import type { LocalizedText } from "@/modules/curriculum/schemas";

/** The wire shape: each item's chosen mark. */
export const markItemsAnswerSchema = z.object({
  marks: z.record(z.string().min(1), z.string().min(1)),
});

export interface StudentMarkItem {
  id: string;
  text: LocalizedText;
  options?: { id: string; text: LocalizedText }[];
  /** False for plain text between markable items; the answer never ships. */
  markable: boolean;
}

export interface StudentMarkItemsConfig {
  widgetId: "mark-items";
  layout: "sentences" | "tokens" | "choices";
  source?: { title: LocalizedText; lines: LocalizedText[] };
  marks?: { id: string; text: LocalizedText; icon?: string }[];
  defaultMark?: string;
  predict?: { question: LocalizedText; options: { id: string; text: LocalizedText }[] };
  groups: { id: string; title?: LocalizedText; items: StudentMarkItem[] }[];
  tryNext?: LocalizedText;
}
