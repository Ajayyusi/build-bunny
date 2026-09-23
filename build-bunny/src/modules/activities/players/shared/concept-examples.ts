import type { GridVariantSpec } from "@/engine";

/**
 * "Show a similar example": a smaller puzzle that uses the same idea as the
 * level the child is stuck on, with a solution they can WATCH run — never
 * the level's own answer. Picked by the level's concept tags; the first
 * matching tag wins, so a level tagged ["loops", "sequencing"] shows the
 * loop example.
 *
 * Each example is deliberately tiny (one or two ideas, a 1–2 row grid) and
 * is played through the real engine (runPlayback), so what the child sees
 * is exactly what the same blocks would do in their puzzle.
 */

export interface ConceptExample {
  /** Concept tags this example demonstrates, most specific first. */
  tags: string[];
  variant: GridVariantSpec;
  autoCollect: boolean;
  /** A complete workspace: the hat plus the demonstration program. */
  solution: unknown;
  /** One line under the animation, in the caller's language. */
  caption: { en: string; ar: string };
}

const hat = (next: unknown) => ({
  blocks: {
    languageVersion: 0,
    blocks: [{ type: "bb_whenStart", id: "start", x: 24, y: 24, next: { block: next } }],
  },
});

export const CONCEPT_EXAMPLES: ConceptExample[] = [
  {
    tags: ["loops", "reading-code"],
    variant: { rows: ["...G", "####"], start: { x: 0, y: 0, dir: "E" } },
    autoCollect: true,
    solution: hat({
      type: "bb_repeat",
      id: "r",
      fields: { TIMES: 3 },
      inputs: { DO: { block: { type: "bb_moveForward", id: "m" } } },
    }),
    caption: {
      en: "One Repeat 3 with a single hop inside does the same as three hops in a row.",
      ar: "لبنة «كرّر 3» واحدة بقفزة واحدة بداخلها تفعل ما تفعله ثلاث قفزات متتالية.",
    },
  },
  {
    tags: ["logic"],
    // Rock ahead, goal straight below: the If turns South, the hop lands on G.
    variant: { rows: [".#", "G."], start: { x: 0, y: 0, dir: "E" } },
    autoCollect: true,
    solution: hat({
      type: "bb_if",
      id: "i",
      inputs: {
        CONDITION: { block: { type: "bb_pathAhead", id: "s" } },
        DO: { block: { type: "bb_turnRight", id: "t" } },
      },
      next: { block: { type: "bb_moveForward", id: "m" } },
    }),
    caption: {
      en: "The sensor sees the rock ahead, so the If turns Robo Bunny — then the hop goes the clear way.",
      ar: "يرى المستشعر الصخرة أمامه، فتُدير لبنة «إذا» الأرنب الآلي — ثم تذهب القفزة في الطريق المفتوح.",
    },
  },
  {
    tags: ["debugging"],
    variant: { rows: ["..", ".G"], start: { x: 0, y: 0, dir: "E" } },
    autoCollect: true,
    solution: hat({
      type: "bb_moveForward",
      id: "m1",
      next: {
        block: {
          type: "bb_turnRight",
          id: "t",
          next: { block: { type: "bb_moveForward", id: "m2" } },
        },
      },
    }),
    caption: {
      en: "Hop, turn RIGHT (South), hop. A Turn Left here would face North and fall off the map — the classic wrong-turn bug.",
      ar: "قفزة، استدارة يمينًا (جنوبًا)، قفزة. «استدر يسارًا» هنا يواجه الشمال ويسقط خارج الخريطة — خطأ الاستدارة الكلاسيكي.",
    },
  },
  {
    tags: ["sequencing", "creative", "algorithms"],
    variant: { rows: ["..G", "###"], start: { x: 0, y: 0, dir: "E" } },
    autoCollect: true,
    solution: hat({
      type: "bb_moveForward",
      id: "m1",
      next: { block: { type: "bb_moveForward", id: "m2" } },
    }),
    caption: {
      en: "Blocks run from the top, one after another: two hops, two tiles.",
      ar: "تعمل اللبنات من الأعلى، واحدة تلو الأخرى: قفزتان، مربعان.",
    },
  },
];

/**
 * The example for a level's tags, or null when no concept matches. Levels
 * list their main concept first, so the level's tag order decides — a
 * ["logic", "reading-code"] level gets the If example, not the loop one.
 */
export function exampleForTags(tags: readonly string[]): ConceptExample | null {
  for (const tag of tags) {
    const hit = CONCEPT_EXAMPLES.find((example) => example.tags.includes(tag));
    if (hit) return hit;
  }
  return null;
}
