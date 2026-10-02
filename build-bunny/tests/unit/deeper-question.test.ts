import { describe, expect, it } from "vitest";

import { DEEPER } from "@/modules/activities/players/deeper-questions";
import { TIGHT_GUESSES } from "@/modules/ai/tight-guess";

import en from "../../messages/en.json";
import ar from "../../messages/ar.json";

const at = (messages: unknown, path: string) =>
  path.split(".").reduce<unknown>((node, key) => (node as Record<string, unknown> | undefined)?.[key], messages);

describe("grade modes outside the Teach levels", () => {
  it("every deeper question (grades 5 to 7) has its question, options and a reply to each, in both languages", () => {
    for (const messages of [en, ar]) {
      for (const [id, spec] of Object.entries(DEEPER)) {
        expect(at(messages, `student.play.aiMode.deeper.${id}.question`), id).toBeTypeOf("string");
        expect(spec.options as readonly string[]).toContain(spec.best);
        for (const option of spec.options) {
          expect(at(messages, `student.play.aiMode.deeper.${id}.options.${option}`), `${id}.${option}`).toBeTypeOf("string");
          expect(at(messages, `student.play.aiMode.deeper.${id}.replies.${option}`), `${id}.${option}`).toBeTypeOf("string");
        }
      }
    }
  });

  it("every friendly younger line (grades 3 to 4) exists in both languages", () => {
    for (const messages of [en, ar]) {
      for (const key of ["trend", "boundary", "group"]) {
        expect(at(messages, `student.play.aiMode.younger.${key}`), key).toBeTypeOf("string");
      }
    }
  });

  it("the grouping prediction has its question and every guess, in both languages", () => {
    for (const messages of [en, ar]) {
      for (const key of ["question", "questionRun", "placeFirst", "matched", "surprised", ...TIGHT_GUESSES]) {
        expect(at(messages, `student.play.group.predict.${key}`), key).toBeTypeOf("string");
      }
    }
  });
});
