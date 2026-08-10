import type { z } from "zod";
import type {
  WorldFixture,
  blockCodingPayload,
  conceptCardsPayload,
} from "@/modules/curriculum/schemas";

/**
 * World 1 — Bunny Meadow (seed levels 1–5, curriculum-content.md §5).
 * Copy is the EN ship copy from the design doc, conformed to the adjudicated
 * engine contract: auto-collect carrots, fatal bumps, bb_* block ids,
 * ".#CGW" grid legend, camelCase check ids. Every student-facing field
 * (title, story, objective, instructions, explanation, all 4 hint tiers)
 * carries real Arabic (m5-contracts §1, content/i18n-glossary.md governs
 * terminology) — teacherNotes stays English-only (staff-facing).
 */

type BlockCodingDraft = z.input<typeof blockCodingPayload>;
type ConceptCardsDraft = z.input<typeof conceptCardsPayload>;

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
        ar: "البرنامج قائمة من التعليمات. الأرنب الآلي ينفّذ بالضبط ما تقوله لبناتك — لا أكثر ولا أقل.",
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
            ar: "استيقظ الأرنب الآلي للتوّ في مرج الأرنب، ورأى جُحرًا يبعد قفزة واحدة فقط. حان وقت أول قفزة في هذه المغامرة.",
          },
          objective: {
            en: "Assemble and run a one-instruction program: connect a block under When Start and press Run.",
            ar: "ركّب برنامجًا من تعليمة واحدة وشغّله: صِل لبنة تحت لبنة «عند البدء» ثم اضغط تشغيل.",
          },
          instructions: {
            en: "Drag a Move Forward block under When Start so they click together, then press Run to hop Robo Bunny into the burrow.",
            ar: "اسحب لبنة «تقدّم للأمام» وضعها تحت لبنة «عند البدء» حتى تلتصقا، ثم اضغط تشغيل ليقفز الأرنب الآلي إلى الجُحر.",
          },
          explanation: {
            en: "You just wrote a program! A program is a set of instructions for a computer. Your program had one instruction: Move Forward — and Robo Bunny followed it exactly. Computers never guess and never get bored. They just do what the instructions say. Next up: what happens when you give MORE than one instruction?",
            ar: "لقد كتبت للتو برنامجًا! البرنامج مجموعة من التعليمات لجهاز الحاسوب. برنامجك كان يحتوي على تعليمة واحدة فقط: «تقدّم للأمام» — ونفّذها الأرنب الآلي كما هي بالضبط. أجهزة الحاسوب لا تخمّن أبدًا ولا تشعر بالملل، فهي تنفّذ ما تقوله التعليمات فقط. في المرة القادمة: ماذا يحدث حين تعطيه أكثر من تعليمة واحدة؟",
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
                ar: "الأرنب الآلي لا يتحرك إلا عندما تأمره لبنة بذلك. أي لبنة تبدو أنها تجعل الأرنب يتحرك؟",
              },
            },
            {
              tier: 2,
              text: {
                en: "Drag one Move Forward block from the toolbox into your workspace.",
                ar: "اسحب لبنة واحدة من «تقدّم للأمام» من صندوق الأدوات إلى مساحة العمل.",
              },
            },
            {
              tier: 3,
              text: {
                en: "Blocks only run when they're snapped underneath When Start. Is your Move Forward block connected?",
                ar: "اللبنات لا تعمل إلا إذا كانت موصولة تحت لبنة «عند البدء». هل لبنة «تقدّم للأمام» متصلة فعلًا؟",
              },
            },
            {
              tier: 4,
              text: {
                en: "Drag Move Forward under When Start so they click together, then press Run. One hop is all it takes.",
                ar: "اسحب «تقدّم للأمام» تحت «عند البدء» حتى تلتصقا، ثم اضغط تشغيل. قفزة واحدة تكفي.",
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
            ar: "ابتعد الجُحر قليلًا داخل المرج. قفزة واحدة لم تعد كافية — يحتاج الأرنب الآلي إلى خطة من أكثر من خطوة.",
          },
          objective: {
            en: "Sequence multiple instructions and observe ordered, top-to-bottom execution.",
            ar: "رتّب عدة تعليمات في تسلسل، ولاحظ كيف تُنفَّذ بالترتيب من الأعلى إلى الأسفل.",
          },
          instructions: {
            en: "Stack the blocks you need under When Start to reach the burrow. Blocks run in order, from top to bottom.",
            ar: "ضع اللبنات التي تحتاجها فوق بعضها تحت «عند البدء» للوصول إلى الجُحر. اللبنات تعمل بالترتيب، من الأعلى إلى الأسفل.",
          },
          explanation: {
            en: "Programs run in order — the top block first, then the next, like a recipe. Your two Move Forward blocks made two hops, one after another. This idea is called a sequence, and it's how every program in the world works, from games to rockets. Order matters: a recipe that says 'eat, then cook' wouldn't go well.",
            ar: "البرامج تعمل بالترتيب — اللبنة العلوية أولًا، ثم التي تليها، تمامًا كالوصفة. لبنتا «تقدّم للأمام» صنعتا قفزتين، واحدة تلو الأخرى. تُسمّى هذه الفكرة تسلسلًا، وهكذا يعمل كل برنامج في العالم، من الألعاب إلى الصواريخ. الترتيب مهم: وصفة تقول «كُل، ثم اطبخ» لن تنجح أبدًا.",
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
                ar: "كم قفزة يحتاجها الأرنب الآلي للوصول إلى الجُحر؟ عُدّ المربعات.",
              },
            },
            {
              tier: 2,
              text: {
                en: "You can use more than one Move Forward block. They run one after another, top to bottom.",
                ar: "يمكنك استخدام أكثر من لبنة «تقدّم للأمام». فهي تعمل واحدة بعد الأخرى، من الأعلى إلى الأسفل.",
              },
            },
            {
              tier: 3,
              text: {
                en: "Two tiles means two Move Forward blocks, snapped in a column under When Start.",
                ar: "مربعان يعنيان لبنتَي «تقدّم للأمام»، موصولتين فوق بعضهما تحت «عند البدء».",
              },
            },
            {
              tier: 4,
              text: {
                en: "Stack Move Forward, Move Forward under When Start — the top one runs first, then the next.",
                ar: "ضع «تقدّم للأمام» ثم «تقدّم للأمام» تحت «عند البدء» — العليا تعمل أولًا، ثم التي تليها.",
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
            ar: "يلتفّ درب المرج التفافًا حادًا حول شجيرة توت. الأرنب الآلي يستطيع القفز، وله حيلة جديدة: الاستدارة في مكانه.",
          },
          objective: {
            en: "Combine moves and turns to navigate a bend, understanding that a turn is an instruction that moves nothing.",
            ar: "اجمع بين القفز والاستدارة لعبور الانعطاف، مع فهم أن الاستدارة تعليمة لا تُحرّك الأرنب من مكانه.",
          },
          instructions: {
            en: "Use Move Forward and the new turn blocks to steer Robo Bunny around the bend and into the burrow.",
            ar: "استخدم لبنة «تقدّم للأمام» ولبنتَي الاستدارة الجديدتين لتوجيه الأرنب الآلي حول الانعطاف وصولًا إلى الجُحر.",
          },
          explanation: {
            en: "Turns are instructions too — they just change which way Robo Bunny is facing. Left and right are from the bunny's point of view, not yours. That's why programmers sometimes tilt their head at the screen (really!). Move changes where you are; Turn changes where you're headed. Together they can take you anywhere.",
            ar: "الاستدارة تعليمة أيضًا — لكنها لا تغيّر إلا الاتجاه الذي يواجهه الأرنب الآلي. اليمين واليسار هما من وجهة نظر الأرنب، لا من وجهة نظرك أنت. لهذا يميل بعض المبرمجين برؤوسهم أمام الشاشة أحيانًا (حقًا!). «تقدّم للأمام» يغيّر مكانك؛ «الاستدارة» تغيّر الاتجاه الذي تتّجه إليه. ومعًا يمكنهما أن يأخذاك إلى أي مكان.",
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
                ar: "الاستدارة والتقدّم أمران مختلفان. الاستدارة تُدير الأرنب الآلي في مكانه — ولا تجعله يقفز إلى أي مكان.",
              },
            },
            {
              tier: 2,
              text: {
                en: "Hop to the corner first. Then which way should Robo Bunny face — left or right from where it's looking?",
                ar: "اقفز إلى الزاوية أولًا. بعدها، إلى أي اتجاه يجب أن يتّجه الأرنب الآلي — يسارًا أم يمينًا بالنسبة إليه هو؟",
              },
            },
            {
              tier: 3,
              text: {
                en: "After two Move Forwards, Robo Bunny faces the meadow edge. One Turn Left points it at the burrow.",
                ar: "بعد لبنتَي «تقدّم للأمام»، يواجه الأرنب الآلي طرف المرج. استدارة واحدة يسارًا توجّهه نحو الجُحر.",
              },
            },
            {
              tier: 4,
              text: {
                en: "The pattern is: Move, Move, Turn Left, Move, Move. Watch the bunny's ears — they show which way it's facing.",
                ar: "النمط هو: تقدّم، تقدّم، استدر يسارًا، تقدّم، تقدّم. راقب أذنَي الأرنب — فهما تدلّان على الاتجاه الذي يواجهه.",
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
        ar: "عندما تجد نفسك تفعل الشيء نفسه مرارًا وتكرارًا... توجد لبنة لذلك.",
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
            ar: "حان موسم الجزر! نمت ثلاث جزرات على طول الدرب المؤدي إلى الجُحر — والمستكشف الجيد لا يترك جزرة خلفه أبدًا.",
          },
          objective: {
            en: "Plan a route satisfying two success conditions (collection + destination) and read PARTIAL feedback to fix a route.",
            ar: "خطّط مسارًا يحقق شرطَي نجاح معًا (جمع الجزر والوصول إلى الجُحر)، وتعلّم قراءة التغذية الراجعة «جزئي» لتصحيح المسار.",
          },
          instructions: {
            en: "Plan a route that collects all three carrots AND ends in the burrow. Carrots are picked up automatically when you hop onto their tile.",
            ar: "خطّط مسارًا يجمع الجزرات الثلاث كلها وينتهي في الجُحر أيضًا. تُلتقط الجزرة تلقائيًا عندما تقفز إلى مربّعها.",
          },
          explanation: {
            en: "Robo Bunny collected carrots just by hopping over them — but the level only counted as done because you finished ALL the jobs: every carrot AND the burrow. Real programs often have a checklist like this. When you missed a carrot, the meadow told you what was missing, not how to fix it — that's what debugging feels like, and you just did it.",
            ar: "جمع الأرنب الآلي الجزر بمجرد القفز فوقها — لكن المستوى لم يُحتسب مكتملًا إلا بعد إنجاز كل المهام: كل جزرة والجُحر أيضًا. كثير من البرامج الحقيقية تملك قائمة مهام كهذه. وعندما فاتتك جزرة، أخبرك المرج بما ينقصك، لا بكيفية إصلاحه — وهذا بالضبط شعور تصحيح الأخطاء، وقد فعلته للتو.",
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
                ar: "هذا المستوى له مهمتان: التقاط كل جزرة والوصول إلى الجُحر أيضًا. تتبّع الدرب بإصبعك أولًا.",
              },
            },
            {
              tier: 2,
              text: {
                en: "Robo Bunny picks up a carrot just by hopping onto its tile. Which route touches all three?",
                ar: "يلتقط الأرنب الآلي الجزرة بمجرد القفز إلى مربّعها. أي مسار يمرّ على الجزرات الثلاث كلها؟",
              },
            },
            {
              tier: 3,
              text: {
                en: "Hop straight along the bottom row first — that collects two carrots — then turn toward the burrow.",
                ar: "اقفز مباشرة على طول الصف السفلي أولًا — فهذا يجمع جزرتين — ثم استدر نحو الجُحر.",
              },
            },
            {
              tier: 4,
              text: {
                en: "Three Move Forwards along the bottom, then Turn Left, then two more Move Forwards. Carrots on the way up are grabbed automatically.",
                ar: "ثلاث لبنات «تقدّم للأمام» على طول الصف السفلي، ثم استدارة يسارًا، ثم لبنتا «تقدّم للأمام» أخريان. تُلتقط الجزرات في الطريق تلقائيًا.",
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

        // ── Learn step — MEET REPEAT: the loop, taught before it is tested ─
        //
        // The first CONCEPT_CARDS level (docs/build-bunny/LEARN-STEP-SPEC.md).
        // It sits immediately before Repeat After Me, which until now met a
        // Grade 3 student with `repeat` for the FIRST time inside a puzzle:
        // story and objective, but no instruction. This is the worked example
        // that instruction was missing — watch a solved loop run, complete a
        // faded copy of it, then go and use it.
        //
        // No stars by design (defaultMaxStars in curriculum/schemas.ts sends
        // CONCEPT_CARDS to 0): stars are the puzzle reward, and this teaches
        // rather than tests. The small xpReward is what keeps progress
        // moving. It DOES count as a trail node — it unlocks linearly like
        // any other level and counts toward the world's totals, because a
        // student genuinely has to complete it to reach the puzzle after it.
        {
          slug: "learn-repeat",
          order: 2,
          activityType: "CONCEPT_CARDS",
          track: "PROGRAMMING",
          title: { en: "Meet Repeat", ar: "تعرّف على «كرّر»" },
          story: {
            en: "Before the long hop across the meadow, Robo Bunny wants to show you a trick it just learned — a block that you say once, and it does again and again.",
            ar: "قبل القفزة الطويلة عبر المرج، يريد الأرنب الآلي أن يريك حيلة تعلّمها للتوّ: لبنة تقولها مرة واحدة فتنفّذ مرة بعد مرة.",
          },
          objective: {
            en: "Watch a loop run, then complete it — understanding that the blocks inside Repeat are the ones that run again and again.",
            ar: "شاهد حلقة تكرار وهي تعمل ثم أكملها، مع فهم أن اللبنات الموجودة داخل «كرّر» هي التي تعمل مرة بعد مرة.",
          },
          instructions: {
            en: "First watch Robo Bunny hop 3 times using one Repeat block. Then put the missing block back inside the Repeat and press Check.",
            ar: "أولًا شاهد الأرنب الآلي يقفز 3 مرات مستخدمًا لبنة «كرّر» واحدة. ثم أعد اللبنة الناقصة إلى داخل «كرّر» واضغط «تحقّق».",
          },
          explanation: {
            en: "Repeat 3 { Move Forward } means: do the block inside me, 3 times. The number says HOW MANY times; whatever sits inside the Repeat's mouth is WHAT gets repeated. That is a loop. Now try it on your own — the next level hands you only one Move Forward block, so the loop is the only way through.",
            ar: "«كرّر 3 مرات { تقدّم للأمام }» تعني: نفّذ اللبنة الموجودة بداخلي 3 مرات. الرقم يحدّد عدد المرات، وما يوضع داخل فم «كرّر» هو ما يتكرّر. هذه هي حلقة التكرار. جرّبها الآن بنفسك — المستوى التالي يمنحك لبنة «تقدّم للأمام» واحدة فقط، فالحلقة هي الطريق الوحيد.",
          },
          teacherNotes: {
            en: "The worked-example step for loops: students study a solved program, then complete a faded copy of it. It awards no stars on purpose — this is instruction, not assessment, so there is nothing to lose by guessing and no reason to rush it. A confident class can skip the Watch beat with 'My turn'. The number to watch afterwards is the fail rate on Repeat After Me, which this step exists to move.",
          },
          difficulty: "EASY",
          recommendedGradeMin: 3,
          recommendedGradeMax: 7,
          estimatedMinutes: 2,
          xpReward: 15,
          tags: ["loops", "learn"],
          requires: [],
          hints: [
            {
              tier: 1,
              text: {
                en: "Look at the Repeat block's mouth — the space inside it is empty. Something has to go in there.",
                ar: "انظر إلى فم لبنة «كرّر» — المساحة بداخله فارغة. لا بدّ أن يوضع شيء هناك.",
              },
            },
            {
              tier: 2,
              text: {
                en: "Repeat runs whatever is inside it, 3 times. Robo Bunny needs to hop 3 times — so which block makes it hop?",
                ar: "تشغّل «كرّر» ما بداخلها 3 مرات. يحتاج الأرنب الآلي إلى القفز 3 مرات — فأي لبنة تجعله يقفز؟",
              },
            },
            {
              tier: 3,
              text: {
                en: "Turning doesn't move Robo Bunny anywhere — it only changes which way it faces. The block you need is Move Forward.",
                ar: "الاستدارة لا تنقل الأرنب الآلي من مكانه، فهي تغيّر الاتجاه الذي يواجهه فقط. اللبنة التي تحتاجها هي «تقدّم للأمام».",
              },
            },
            {
              tier: 4,
              text: {
                en: "Drag Move Forward from the toolbox into the empty space inside Repeat, so it clicks into the mouth, then press Check.",
                ar: "اسحب «تقدّم للأمام» من صندوق الأدوات إلى الفراغ داخل «كرّر» حتى تلتصق في الفم، ثم اضغط «تحقّق».",
              },
            },
          ],
          payload: {
            conceptSlug: "loops",
            // A short straight run: 3 hops east to the burrow. Deliberately
            // NOT the 4 hops of Repeat After Me — the lesson shows the idea,
            // the puzzle then asks for it with a different number, so a
            // student who only memorised "put 4 in the box" is not rewarded.
            variants: [
              {
                rows: [".....", "...G.", "....."],
                start: { x: 0, y: 1, dir: "E" },
              },
            ],
            autoCollect: true,
            nonFatalBumps: false,
            workedExample: {
              blocks: {
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
                      next: {
                        block: {
                          type: "bb_repeat",
                          id: "loop",
                          fields: { TIMES: 3 },
                          inputs: {
                            DO: { block: { type: "bb_moveForward", id: "hop" } },
                          },
                        },
                      },
                    },
                  ],
                },
              },
              caption: {
                en: "Watch: one Repeat block makes Robo Bunny hop 3 times.",
                ar: "شاهد: لبنة «كرّر» واحدة تجعل الأرنب الآلي يقفز 3 مرات.",
              },
            },
            faded: {
              // The same program with the loop BODY removed — the Repeat and
              // its 3 stay on screen, so what the student has to supply is
              // "what gets repeated", which is the idea being taught. Filling
              // it rebuilds the worked example exactly.
              blocks: {
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
                      next: {
                        block: {
                          type: "bb_repeat",
                          id: "loop",
                          fields: { TIMES: 3 },
                        },
                      },
                    },
                  ],
                },
              },
              // The two turn blocks are real distractors, not padding: from
              // Turn Around onwards, move-versus-turn is the live confusion
              // in this world.
              toolbox: [
                { type: "bb_moveForward", limit: 1 },
                { type: "bb_turnLeft", limit: 1 },
                { type: "bb_turnRight", limit: 1 },
              ],
              missingBlockType: "bb_moveForward",
              caption: {
                en: "Your turn: the Repeat is here, but its mouth is empty. Which block belongs inside, so Robo Bunny hops 3 times?",
                ar: "دورك الآن: «كرّر» موجودة، لكن فمها فارغ. أي لبنة يجب أن توضع بداخلها ليقفز الأرنب الآلي 3 مرات؟",
              },
            },
          } satisfies ConceptCardsDraft,
        },

        // ── Level 5 — REPEAT AFTER ME: the Repeat block ───────────────────
        {
          slug: "repeat-after-me",
          order: 3,
          activityType: "BLOCK_CODING",
          track: "PROGRAMMING",
          title: { en: "Repeat After Me", ar: "كرّر بعدي" },
          story: {
            en: 'A long, straight stretch of meadow — hop, hop, hop, hop. Robo Bunny sighs: "Do I really have to be told the same thing four times?"',
            ar: "امتداد طويل ومستقيم من المرج — قفزة، قفزة، قفزة، قفزة. يتنهّد الأرنب الآلي: «هل عليّ حقًا أن أُطلب مني الشيء نفسه أربع مرات؟»",
          },
          objective: {
            en: "Use Repeat to express four identical actions with one Move block, and articulate why the loop version is better.",
            ar: "استخدم لبنة «كرّر» للتعبير عن أربع حركات متطابقة بلبنة «تقدّم» واحدة، واشرح لماذا نسخة الحلقة أفضل.",
          },
          instructions: {
            en: "The toolbox only gives you ONE Move Forward block — that's the puzzle. Use the Repeat block to reach the burrow in four hops.",
            ar: "صندوق الأدوات يمنحك لبنة «تقدّم للأمام» واحدة فقط — وهذا هو اللغز. استخدم لبنة «كرّر» للوصول إلى الجُحر بأربع قفزات.",
          },
          explanation: {
            en: "Repeat 4 { Move Forward } does exactly the same thing as four Move Forward blocks — but you only had to say it once. That's a loop, and it's one of the most powerful ideas in all of programming. Need 100 hops? Change one number. A programmer's rule of thumb: if you're repeating yourself, there's probably a loop hiding in your plan.",
            ar: "«كرّر 4 { تقدّم للأمام }» تفعل تمامًا ما تفعله أربع لبنات «تقدّم للأمام» — لكنك قلتها مرة واحدة فقط. هذه هي الحلقة، وهي واحدة من أقوى الأفكار في البرمجة كلها. تحتاج 100 قفزة؟ غيّر رقمًا واحدًا فقط. قاعدة كل مبرمج: إذا وجدت نفسك تكرّر الشيء نفسه، فربما تختبئ حلقة في خطتك.",
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
                ar: "أربع قفزات، لكن لبنة «تقدّم» واحدة فقط في صندوق الأدوات. هل توجد لبنة تستطيع تشغيل لبنة أخرى أكثر من مرة؟",
              },
            },
            {
              tier: 2,
              text: {
                en: "The Repeat block is a container — blocks placed inside it run again and again. Try dropping Move Forward inside Repeat.",
                ar: "لبنة «كرّر» وعاء — أي لبنات تضعها بداخلها تعمل مرة بعد مرة. جرّب وضع «تقدّم للأمام» داخل «كرّر».",
              },
            },
            {
              tier: 3,
              text: {
                en: "Set the Repeat number to how many hops the burrow needs. Count the tiles: it's 4.",
                ar: "اضبط رقم «كرّر» على عدد القفزات التي يحتاجها الوصول إلى الجُحر. عُدّ المربعات: العدد 4.",
              },
            },
            {
              tier: 4,
              text: {
                en: "Drag Repeat under When Start, set its number to 4, and snap Move Forward inside its mouth. One block, four hops.",
                ar: "اسحب «كرّر» تحت «عند البدء»، واضبط رقمها على 4، وضع «تقدّم للأمام» بداخلها. لبنة واحدة، وأربع قفزات.",
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
