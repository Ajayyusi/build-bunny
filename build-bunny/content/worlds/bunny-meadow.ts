import type { z } from "zod";
import type { WorldFixture, blockCodingPayload } from "@/modules/curriculum/schemas";

/**
 * World 1 — Bunny Meadow (seed levels 1–5, curriculum-content.md §5).
 * Copy is the EN ship copy from the design doc, conformed to the adjudicated
 * engine contract: auto-collect carrots, fatal bumps, bb_* block ids,
 * ".#CGW" grid legend, camelCase check ids. Arabic is provided for short
 * high-visibility strings (titles, names) only — longer fields ship EN-first.
 */

type BlockCodingDraft = z.input<typeof blockCodingPayload>;

// Every level starts from the locked When Start hat block; solutions chain
// off its `next` connection. Block counts in star budgets exclude this hat
// and sensor value blocks (statement blocks only).
const startWorkspace = {
  blocks: {
    languageVersion: 0,
    blocks: [
      {
        type: "bb_whenStart",
        id: "start",
        x: 24,
        y: 24,
        deletable: false,
        movable: false,
      },
    ],
  },
};

export const bunnyMeadow: WorldFixture = {
  slug: "bunny-meadow",
  name: { en: "Bunny Meadow", ar: "مرج الأرنب" },
  tagline: {
    en: "Every explorer starts with a single hop.",
    ar: "كل مستكشف يبدأ بقفزة واحدة.",
  },
  theme: "meadow",
  horizon: false,
  modules: [
    {
      slug: "first-hops",
      order: 1,
      name: { en: "First Hops", ar: "القفزات الأولى" },
      description: {
        en: "A program is a list of instructions. Robo Bunny does exactly what your blocks say — nothing more, nothing less.",
      },
      levels: [
        // ── Level 1 — FIRST HOP: a block is an instruction ────────────────
        {
          slug: "first-hop",
          order: 1,
          activityType: "BLOCK_CODING",
          track: "PROGRAMMING",
          title: { en: "First Hop", ar: "القفزة الأولى" },
          story: {
            en: "Robo Bunny just woke up in Bunny Meadow — and spots a burrow one hop away. Time for the very first hop of the adventure.",
          },
          objective: {
            en: "Assemble and run a one-instruction program: connect a block under When Start and press Run.",
          },
          instructions: {
            en: "Drag a Move Forward block under When Start so they click together, then press Run to hop Robo Bunny into the burrow.",
          },
          explanation: {
            en: "You just wrote a program! A program is a set of instructions for a computer. Your program had one instruction: Move Forward — and Robo Bunny followed it exactly. Computers never guess and never get bored. They just do what the instructions say. Next up: what happens when you give MORE than one instruction?",
          },
          teacherNotes: {
            en: "Watch for students pressing Run with a disconnected block — the #1 friction at minute one. The tier-3 hint targets it.",
          },
          difficulty: "EASY",
          recommendedGradeMin: 3,
          recommendedGradeMax: 7,
          estimatedMinutes: 3,
          xpReward: 20,
          tags: ["sequencing"],
          requires: [],
          hints: [
            {
              tier: 1,
              text: {
                en: "Robo Bunny only moves when a block tells it to. Which block looks like it makes the bunny move?",
              },
            },
            {
              tier: 2,
              text: {
                en: "Drag one Move Forward block from the toolbox into your workspace.",
              },
            },
            {
              tier: 3,
              text: {
                en: "Blocks only run when they're snapped underneath When Start. Is your Move Forward block connected?",
              },
            },
            {
              tier: 4,
              text: {
                en: "Drag Move Forward under When Start so they click together, then press Run. One hop is all it takes.",
              },
            },
          ],
          payload: {
            toolbox: [{ type: "bb_moveForward" }],
            variants: [
              {
                rows: ["...", ".G.", "..."],
                start: { x: 0, y: 1, dir: "E" },
              },
            ],
            autoCollect: true,
            nonFatalBumps: false,
            checks: [
              { id: "reachedGoal", severity: "core" },
              { id: "maxBlocks", severity: "quality", params: { count: 1 } },
            ],
            starCriteria: { threeStarMaxBlocks: 1 },
            startWorkspace,
            solution: {
              blocks: {
                languageVersion: 0,
                blocks: [
                  {
                    type: "bb_whenStart",
                    id: "start",
                    x: 24,
                    y: 24,
                    next: { block: { type: "bb_moveForward", id: "m1" } },
                  },
                ],
              },
            },
          } satisfies BlockCodingDraft,
        },

        // ── Level 2 — TWO STEPS: sequences run in order ───────────────────
        {
          slug: "two-steps",
          order: 2,
          activityType: "BLOCK_CODING",
          track: "PROGRAMMING",
          title: { en: "Two Steps", ar: "خطوتان" },
          story: {
            en: "The burrow moved a little further down the meadow. One hop won't cut it anymore — Robo Bunny needs a plan with more than one step.",
          },
          objective: {
            en: "Sequence multiple instructions and observe ordered, top-to-bottom execution.",
          },
          instructions: {
            en: "Stack the blocks you need under When Start to reach the burrow. Blocks run in order, from top to bottom.",
          },
          explanation: {
            en: "Programs run in order — the top block first, then the next, like a recipe. Your two Move Forward blocks made two hops, one after another. This idea is called a sequence, and it's how every program in the world works, from games to rockets. Order matters: a recipe that says 'eat, then cook' wouldn't go well.",
          },
          teacherNotes: {
            en: "Ask students to predict the number of hops before running — this is the seed of the code-prediction habit.",
          },
          difficulty: "EASY",
          recommendedGradeMin: 3,
          recommendedGradeMax: 7,
          estimatedMinutes: 4,
          xpReward: 20,
          tags: ["sequencing"],
          requires: [],
          hints: [
            {
              tier: 1,
              text: {
                en: "How many hops does Robo Bunny need to reach the burrow? Count the tiles.",
              },
            },
            {
              tier: 2,
              text: {
                en: "You can use more than one Move Forward block. They run one after another, top to bottom.",
              },
            },
            {
              tier: 3,
              text: {
                en: "Two tiles means two Move Forward blocks, snapped in a column under When Start.",
              },
            },
            {
              tier: 4,
              text: {
                en: "Stack Move Forward, Move Forward under When Start — the top one runs first, then the next.",
              },
            },
          ],
          payload: {
            toolbox: [{ type: "bb_moveForward" }],
            variants: [
              {
                rows: ["....", "..G.", "...."],
                start: { x: 0, y: 1, dir: "E" },
              },
            ],
            autoCollect: true,
            nonFatalBumps: false,
            checks: [
              { id: "reachedGoal", severity: "core" },
              { id: "maxBlocks", severity: "quality", params: { count: 2 } },
            ],
            starCriteria: { threeStarMaxBlocks: 2 },
            startWorkspace,
            solution: {
              blocks: {
                languageVersion: 0,
                blocks: [
                  {
                    type: "bb_whenStart",
                    id: "start",
                    x: 24,
                    y: 24,
                    next: {
                      block: {
                        type: "bb_moveForward",
                        id: "m1",
                        next: { block: { type: "bb_moveForward", id: "m2" } },
                      },
                    },
                  },
                ],
              },
            },
          } satisfies BlockCodingDraft,
        },

        // ── Level 3 — TURN AROUND: turning changes direction, not position ─
        {
          slug: "turn-around",
          order: 3,
          activityType: "BLOCK_CODING",
          track: "PROGRAMMING",
          title: { en: "Turn Around", ar: "الاستدارة" },
          story: {
            en: "The meadow path takes a sharp bend around a berry bush. Robo Bunny can hop and — new trick! — spin on the spot.",
          },
          objective: {
            en: "Combine moves and turns to navigate a bend, understanding that a turn is an instruction that moves nothing.",
          },
          instructions: {
            en: "Use Move Forward and the new turn blocks to steer Robo Bunny around the bend and into the burrow.",
          },
          explanation: {
            en: "Turns are instructions too — they just change which way Robo Bunny is facing. Left and right are from the bunny's point of view, not yours. That's why programmers sometimes tilt their head at the screen (really!). Move changes where you are; Turn changes where you're headed. Together they can take you anywhere.",
          },
          teacherNotes: {
            en: "The left/right-from-whose-view confusion is the classic misconception here. Have students physically stand and turn if stuck (unplugged moment). Challenge extension: solve it again using Turn Right three times instead of Turn Left once — which program is shorter?",
          },
          difficulty: "EASY",
          recommendedGradeMin: 3,
          recommendedGradeMax: 7,
          estimatedMinutes: 6,
          xpReward: 25,
          tags: ["sequencing"],
          requires: [],
          hints: [
            {
              tier: 1,
              text: {
                en: "Turning and moving are different. A turn spins Robo Bunny in place — it doesn't hop anywhere.",
              },
            },
            {
              tier: 2,
              text: {
                en: "Hop to the corner first. Then which way should Robo Bunny face — left or right from where it's looking?",
              },
            },
            {
              tier: 3,
              text: {
                en: "After two Move Forwards, Robo Bunny faces the meadow edge. One Turn Left points it at the burrow.",
              },
            },
            {
              tier: 4,
              text: {
                en: "The pattern is: Move, Move, Turn Left, Move, Move. Watch the bunny's ears — they show which way it's facing.",
              },
            },
          ],
          payload: {
            toolbox: [
              { type: "bb_moveForward" },
              { type: "bb_turnLeft" },
              { type: "bb_turnRight" },
            ],
            // Decorative berry bush at (1,2) blocks like any obstacle but sits
            // off the intended path.
            variants: [
              {
                rows: ["....", "..G.", ".#..", "...."],
                start: { x: 0, y: 3, dir: "E" },
              },
            ],
            autoCollect: true,
            nonFatalBumps: false,
            checks: [
              { id: "reachedGoal", severity: "core" },
              { id: "maxBlocks", severity: "quality", params: { count: 5 } },
            ],
            starCriteria: { threeStarMaxBlocks: 5 },
            startWorkspace,
            solution: {
              blocks: {
                languageVersion: 0,
                blocks: [
                  {
                    type: "bb_whenStart",
                    id: "start",
                    x: 24,
                    y: 24,
                    next: {
                      block: {
                        type: "bb_moveForward",
                        id: "m1",
                        next: {
                          block: {
                            type: "bb_moveForward",
                            id: "m2",
                            next: {
                              block: {
                                type: "bb_turnLeft",
                                id: "t1",
                                next: {
                                  block: {
                                    type: "bb_moveForward",
                                    id: "m3",
                                    next: {
                                      block: { type: "bb_moveForward", id: "m4" },
                                    },
                                  },
                                },
                              },
                            },
                          },
                        },
                      },
                    },
                  },
                ],
              },
            },
          } satisfies BlockCodingDraft,
        },
      ],
    },
    {
      slug: "carrots-and-loops",
      order: 2,
      name: { en: "Carrots & Loops", ar: "الجزر والحلقات" },
      description: {
        en: "When you catch yourself doing the same thing again and again… there's a block for that.",
      },
      levels: [
        // ── Level 4 — CARROT COLLECTOR: multi-part goals ──────────────────
        {
          slug: "carrot-collector",
          order: 1,
          activityType: "BLOCK_CODING",
          track: "PROGRAMMING",
          title: { en: "Carrot Collector", ar: "جامع الجزر" },
          story: {
            en: "Carrot season! Three carrots grew along the trail to the burrow — and a good explorer never leaves a carrot behind.",
          },
          objective: {
            en: "Plan a route satisfying two success conditions (collection + destination) and read PARTIAL feedback to fix a route.",
          },
          instructions: {
            en: "Plan a route that collects all three carrots AND ends in the burrow. Carrots are picked up automatically when you hop onto their tile.",
          },
          explanation: {
            en: "Robo Bunny collected carrots just by hopping over them — but the level only counted as done because you finished ALL the jobs: every carrot AND the burrow. Real programs often have a checklist like this. When you missed a carrot, the meadow told you what was missing, not how to fix it — that's what debugging feels like, and you just did it.",
          },
          teacherNotes: {
            en: "First level where PARTIAL results appear (reaching the burrow with missed carrots). Show the class the feedback message — reading grader feedback is a skill. Challenge extension: re-run a winning program and call out which hop collects each carrot before it happens.",
          },
          difficulty: "EASY",
          recommendedGradeMin: 3,
          recommendedGradeMax: 7,
          estimatedMinutes: 7,
          xpReward: 30,
          tags: ["sequencing"],
          requires: [],
          hints: [
            {
              tier: 1,
              text: {
                en: "This level has TWO jobs: grab every carrot AND finish in the burrow. Trace the trail with your finger first.",
              },
            },
            {
              tier: 2,
              text: {
                en: "Robo Bunny picks up a carrot just by hopping onto its tile. Which route touches all three?",
              },
            },
            {
              tier: 3,
              text: {
                en: "Hop straight along the bottom row first — that collects two carrots — then turn toward the burrow.",
              },
            },
            {
              tier: 4,
              text: {
                en: "Three Move Forwards along the bottom, then Turn Left, then two more Move Forwards. Carrots on the way up are grabbed automatically.",
              },
            },
          ],
          payload: {
            toolbox: [
              { type: "bb_moveForward" },
              { type: "bb_turnLeft" },
              { type: "bb_turnRight" },
            ],
            variants: [
              {
                rows: [".....", "...G.", "...C.", ".C.C."],
                start: { x: 0, y: 3, dir: "E" },
              },
            ],
            autoCollect: true,
            nonFatalBumps: false,
            checks: [
              { id: "reachedGoal", severity: "core" },
              { id: "collectedAll", severity: "secondary", params: { item: "carrot" } },
              { id: "maxBlocks", severity: "quality", params: { count: 6 } },
            ],
            starCriteria: { threeStarMaxBlocks: 6 },
            startWorkspace,
            solution: {
              blocks: {
                languageVersion: 0,
                blocks: [
                  {
                    type: "bb_whenStart",
                    id: "start",
                    x: 24,
                    y: 24,
                    next: {
                      block: {
                        type: "bb_moveForward",
                        id: "m1",
                        next: {
                          block: {
                            type: "bb_moveForward",
                            id: "m2",
                            next: {
                              block: {
                                type: "bb_moveForward",
                                id: "m3",
                                next: {
                                  block: {
                                    type: "bb_turnLeft",
                                    id: "t1",
                                    next: {
                                      block: {
                                        type: "bb_moveForward",
                                        id: "m4",
                                        next: {
                                          block: {
                                            type: "bb_moveForward",
                                            id: "m5",
                                          },
                                        },
                                      },
                                    },
                                  },
                                },
                              },
                            },
                          },
                        },
                      },
                    },
                  },
                ],
              },
            },
          } satisfies BlockCodingDraft,
        },

        // ── Level 5 — REPEAT AFTER ME: the Repeat block ───────────────────
        {
          slug: "repeat-after-me",
          order: 2,
          activityType: "BLOCK_CODING",
          track: "PROGRAMMING",
          title: { en: "Repeat After Me", ar: "كرّر بعدي" },
          story: {
            en: 'A long, straight stretch of meadow — hop, hop, hop, hop. Robo Bunny sighs: "Do I really have to be told the same thing four times?"',
          },
          objective: {
            en: "Use Repeat to express four identical actions with one Move block, and articulate why the loop version is better.",
          },
          instructions: {
            en: "The toolbox only gives you ONE Move Forward block — that's the puzzle. Use the Repeat block to reach the burrow in four hops.",
          },
          explanation: {
            en: "Repeat 4 { Move Forward } does exactly the same thing as four Move Forward blocks — but you only had to say it once. That's a loop, and it's one of the most powerful ideas in all of programming. Need 100 hops? Change one number. A programmer's rule of thumb: if you're repeating yourself, there's probably a loop hiding in your plan.",
          },
          teacherNotes: {
            en: "The 'same result, shorter program' comparison is the lesson — after success, the explanation screen shows both versions side by side. Don't rush students past it. Challenge extension: change the Repeat number to 3, predict where Robo Bunny stops, then run it.",
          },
          difficulty: "EASY",
          recommendedGradeMin: 3,
          recommendedGradeMax: 7,
          estimatedMinutes: 8,
          xpReward: 40,
          tags: ["loops"],
          requires: [],
          hints: [
            {
              tier: 1,
              text: {
                en: "Four hops, but only one Move block in the toolbox. Is there a block that can run another block more than once?",
              },
            },
            {
              tier: 2,
              text: {
                en: "The Repeat block is a container — blocks placed inside it run again and again. Try dropping Move Forward inside Repeat.",
              },
            },
            {
              tier: 3,
              text: {
                en: "Set the Repeat number to how many hops the burrow needs. Count the tiles: it's 4.",
              },
            },
            {
              tier: 4,
              text: {
                en: "Drag Repeat under When Start, set its number to 4, and snap Move Forward inside its mouth. One block, four hops.",
              },
            },
          ],
          payload: {
            // Guided toolbox (design doc §9.6): with a single Move available,
            // brute force is structurally impossible and loop discovery is the
            // puzzle itself. The limit is stated in the instructions.
            toolbox: [
              { type: "bb_moveForward", limit: 1 },
              { type: "bb_repeat", limit: 1 },
            ],
            variants: [
              {
                rows: ["......", "....G.", "......"],
                start: { x: 0, y: 1, dir: "E" },
              },
            ],
            autoCollect: true,
            nonFatalBumps: false,
            checks: [
              { id: "reachedGoal", severity: "core" },
              // Belt-and-braces given the toolbox limit; keeps grading honest
              // if limits are later relaxed.
              { id: "usedBlock", severity: "secondary", params: { block: "bb_repeat" } },
              { id: "maxBlocks", severity: "quality", params: { count: 2 } },
            ],
            starCriteria: { threeStarMaxBlocks: 2 },
            startWorkspace,
            solution: {
              blocks: {
                languageVersion: 0,
                blocks: [
                  {
                    type: "bb_whenStart",
                    id: "start",
                    x: 24,
                    y: 24,
                    next: {
                      block: {
                        type: "bb_repeat",
                        id: "r1",
                        fields: { TIMES: 4 },
                        inputs: {
                          DO: { block: { type: "bb_moveForward", id: "m1" } },
                        },
                      },
                    },
                  },
                ],
              },
            },
          } satisfies BlockCodingDraft,
        },
      ],
    },
  ],
};
