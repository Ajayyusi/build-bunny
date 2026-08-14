import "server-only";

import { z } from "zod";

import { aiWalkthroughSchema, localizedText } from "@/modules/curriculum/schemas";

/**
 * Answer-free student-view schemas for the grafted AI Lab activity types
 * (phase G), following the precedent set by aiClassificationStudentPayload /
 * patternRecognitionStudentPayload in curriculum/schemas.ts: the play page
 * re-parses the (already stripped) payload against these before anything is
 * handed to a client component. The objects are .strict(), so if the
 * stripping in stripStudentPayload ever regresses and an answer key (a
 * choice's `safe` flag) is still present, the parse THROWS — the level fails
 * loudly server-side instead of shipping an answer key to a child's browser.
 * Defense in depth, not the primary mechanism.
 */

export const aiEthicsStudentPayload = z
  .object({
    prompt: localizedText,
    scenes: z.array(
      z
        .object({
          id: z.string(),
          text: localizedText,
          art: z.string().optional(),
          choices: z.array(
            z
              .object({
                id: z.string(),
                text: localizedText,
                outcome: localizedText,
                next: z.string().optional(),
              })
              .strict(),
          ),
        })
        .strict(),
    ),
    takeaways: z.array(localizedText),
  })
  .strict();

/**
 * AI_SIM's widget config differs per widget and is already stripped by the
 * widget's own stripConfig (pixel rounds lose their imageId, etc.), so the
 * envelope is validated here and the widget object passes through opaque —
 * each widget player owns and re-validates its config shape.
 */
export const aiSimStudentPayload = z.object({
  widget: z.object({ widgetId: z.string() }).passthrough(),
  intro: localizedText,
  // Mirrored deliberately: this schema strips unknown keys, so a field that
  // is authored but not listed here reaches the child as undefined and the
  // walkthrough silently never opens.
  walkthrough: aiWalkthroughSchema.optional(),
  honesty: z.object({
    kind: z.enum(["REAL", "SIMULATED"]),
    note: localizedText,
  }),
});
