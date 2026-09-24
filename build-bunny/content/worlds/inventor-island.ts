import type { z } from "zod";
import type { WorldFixture, blockCodingPayload } from "@/modules/curriculum/schemas";
import { theFair } from "./inventor-island-fair";

/**
 * World 8 — Inventor Island: no instructions, your ideas lead (STORY.md §8).
 *
 * The island opens with "The Workbench": open-ended grid levels with MANY
 * right answers and generous block budgets, where the three-star line is
 * "find your own shortest" rather than "match ours". Then "The Fair"
 * (inventor-island-fair.ts): build-your-own mazes, the island's creative
 * projects.
 */

type BlockCodingDraft = z.input<typeof blockCodingPayload>;

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

export const inventorIsland: WorldFixture = {
  slug: "inventor-island",
  name: { en: "Inventor Island", ar: "جزيرة المخترعين" },
  tagline: {
    en: "No instructions here. Your ideas lead the way.",
    ar: "لا توجد تعليمات هنا — أفكارك هي الدليل.",
  },
  theme: "workshop",
  horizon: false,
  story: {
    beats: [
      {
        pose: "waving",
        text: {
          en: "Everyone's here for the Inventor's Fair — Grandma Clover, Oona, Pip, Coco, Fenn, Nova and Mayor Mo. And I have all my Powers.",
          ar: "الجميع هنا من أجل معرض المخترعين — الجدّة كلوفر وأونا وبيب وكوكو وفِنّ ونوفا والعمدة مو. ومعي كل قواي.",
        },
      },
      {
        pose: "thinking",
        text: {
          en: "There are no instructions on this island. There's a workbench, every block I know, and an empty map.",
          ar: "لا توجد تعليمات في هذه الجزيرة. هناك طاولة عمل، وكل لبنة أعرفها، وخريطة فارغة.",
        },
      },
      {
        pose: "excited",
        text: {
          en: "So let's invent something. Yours first — then mine.",
          ar: "إذًا لنخترع شيئًا. اختراعك أولًا — ثم اختراعي.",
        },
      },
    ],
  },
  character: {
    name: { en: "All the friends", ar: "كل الأصدقاء" },
    role: { en: "Arriving for the Inventor's Fair", ar: "قادمون إلى معرض المخترعين" },
    glyph: "🎪",
  },
  power: {
    name: { en: "Invention Power", ar: "قوة الاختراع" },
    idea: {
      en: "Every Power at once, on something of your own.",
      ar: "كل القوى معًا، في شيء من صنعك.",
    },
    glyph: "💡",
  },
  modules: [
    {
      slug: "the-workbench",
      order: 1,
      name: { en: "The Workbench", ar: "طاولة العمل" },
      description: {
        en: "Open maps, many right answers. Find yours.",
        ar: "خرائط مفتوحة وإجابات صحيحة كثيرة. اعثر على إجابتك.",
      },
      levels: [
        // ── YOUR OWN ROUTE ────────────────────────────────────────────────
        {
          slug: "your-own-route",
          order: 1,
          activityType: "BLOCK_CODING",
          track: "PROGRAMMING",
          title: { en: "Your Own Route", ar: "مسارك الخاص" },
          story: {
            en: "The workbench map is wide open: no rocks, no water, just a start and a finish. Grandma Clover leans in: 'Any road that gets there is a good road, dear. Pick one and make it yours.'",
            ar: "خريطة طاولة العمل مفتوحة تمامًا: لا صخور، لا ماء، فقط بداية ونهاية. تميل الجدّة كلوفر: «أي طريق يوصل هو طريق جيد يا عزيزي. اختر واحدًا واجعله لك.»",
          },
          objective: {
            en: "Plan any valid route across an open grid, recognising that many programs solve the same problem; three stars reward the shorter ones.",
            ar: "خطّط أي مسار صالح عبر شبكة مفتوحة، مع إدراك أن برامج كثيرة تحلّ المسألة نفسها؛ النجوم الثلاث تكافئ الأقصر.",
          },
          mission: {
            en: "Reach the finish any way you like — there are lots of right answers.",
            ar: "صِل إلى النهاية بأي طريقة تحبها — هناك إجابات صحيحة كثيرة.",
          },
          instructions: {
            en: "Every tile is open. Choose your own path to the finish. Shorter programs earn three stars, so try a Repeat if you spot a straight stretch.",
            ar: "كل المربعات مفتوحة. اختر طريقك إلى النهاية. البرامج الأقصر تكسب ثلاث نجوم، فجرّب «كرّر» إن لاحظت امتدادًا مستقيمًا.",
          },
          explanation: {
            en: "There was no single right answer, and you still found one — that is what inventing feels like. Any route that reaches the finish is correct; a route written with a Repeat is simply shorter to write. Real programmers face open problems like this every day, and the skill is choosing a good way, not the only way.",
            ar: "لم تكن هناك إجابة صحيحة واحدة، ومع ذلك وجدت واحدة — هكذا يبدو الاختراع. أي مسار يصل إلى النهاية صحيح؛ والمسار المكتوب بـ«كرّر» أقصر في الكتابة فحسب. يواجه المبرمجون الحقيقيون مسائل مفتوحة كهذه كل يوم، والمهارة هي اختيار طريقة جيدة، لا الطريقة الوحيدة.",
          },
          teacherNotes: {
            en: "Deliberately open: compare two students' different routes on the projector and ask the class whether both are correct (yes) and which is shorter to WRITE. The 8-block limit for three stars allows a hop-by-hop route with one turn (7 blocks) as well as the loop version (5).",
            ar: "مفتوح عمدًا: اعرض مسارَي طالبين مختلفين على جهاز العرض واسأل الصف هل كلاهما صحيح (نعم) وأيهما أقصر في الكتابة. حدّ 8 لبنات للنجوم الثلاث يسمح بمسار قفزة بقفزة مع استدارة واحدة (7 لبنات) كما يسمح بنسخة الحلقة (5).",
          },
          difficulty: "EASY",
          recommendedGradeMin: 3,
          recommendedGradeMax: 7,
          estimatedMinutes: 5,
          xpReward: 35,
          tags: ["sequencing", "loops", "creative"],
          requires: [],
          hints: [
            {
              tier: 1,
              text: {
                en: "The finish is at the far corner. Which two directions do you need — and does the order matter here?",
                ar: "النهاية في الزاوية البعيدة. أي اتجاهين تحتاج — وهل يهم الترتيب هنا؟",
              },
            },
            {
              tier: 2,
              text: {
                en: "One way: hop along the top row to the end, turn, then hop down. Another way: down first, then along. Both work.",
                ar: "طريقة: اقفز على الصف العلوي حتى النهاية، استدر، ثم اقفز نزولًا. طريقة أخرى: نزولًا أولًا، ثم على الصف. كلاهما ينجح.",
              },
            },
            {
              tier: 3,
              text: {
                en: "Three hops in a row is a job for one Repeat 3 — twice, with a turn in between.",
                ar: "ثلاث قفزات متتالية عمل لـ«كرّر 3» واحدة — مرتين، مع استدارة بينهما.",
              },
            },
            {
              tier: 4,
              text: {
                en: "Repeat 3 { Move Forward }, Turn Right, Repeat 3 { Move Forward }. Five blocks, and there are other five-block answers too.",
                ar: "كرّر 3 { تقدّم للأمام }، استدر يمينًا، كرّر 3 { تقدّم للأمام }. خمس لبنات، وهناك إجابات أخرى من خمس لبنات أيضًا.",
              },
            },
          ],
          payload: {
            toolbox: [
              { type: "bb_moveForward" },
              { type: "bb_turnLeft" },
              { type: "bb_turnRight" },
              { type: "bb_repeat" },
            ],
            variants: [
              {
                rows: ["....", "....", "....", "...G"],
                start: { x: 0, y: 0, dir: "E" },
              },
            ],
            autoCollect: true,
            nonFatalBumps: false,
            checks: [
              { id: "reachedGoal", severity: "core" },
              { id: "maxBlocks", severity: "quality", params: { count: 8 } },
            ],
            starCriteria: { threeStarMaxBlocks: 8 },
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
                        fields: { TIMES: 3 },
                        inputs: { DO: { block: { type: "bb_moveForward", id: "m1" } } },
                        next: {
                          block: {
                            type: "bb_turnRight",
                            id: "t1",
                            next: {
                              block: {
                                type: "bb_repeat",
                                id: "r2",
                                fields: { TIMES: 3 },
                                inputs: { DO: { block: { type: "bb_moveForward", id: "m2" } } },
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

        // ── CARROT GARDEN ─────────────────────────────────────────────────
        {
          slug: "carrot-garden",
          order: 2,
          activityType: "BLOCK_CODING",
          track: "PROGRAMMING",
          title: { en: "Carrot Garden", ar: "حديقة الجزر" },
          story: {
            en: "Fenn planted three carrots in a little garden and forgot where the paths go. 'Collect them in any order you like,' he says. 'I only care that none are left.'",
            ar: "زرع فِنّ ثلاث جزرات في حديقة صغيرة ونسي أين تمرّ الممرات. يقول: «اجمعها بأي ترتيب تحبه. ما يهمّني ألا يبقى أي منها.»",
          },
          objective: {
            en: "Design a collection route visiting three scattered items in a self-chosen order, then finish at the goal — planning a tour rather than a line.",
            ar: "صمّم مسار جمع يزور ثلاثة عناصر متفرقة بترتيب من اختيارك، ثم انتهِ عند الهدف — تخطيط جولة لا خط.",
          },
          mission: {
            en: "Collect all three carrots in any order, then reach the finish.",
            ar: "اجمع الجزرات الثلاث بأي ترتيب، ثم صِل إلى النهاية.",
          },
          instructions: {
            en: "Look at where the carrots are and decide which one to visit first. Every order works if you end at the finish. Carrots are picked up when you hop onto them.",
            ar: "انظر إلى مواقع الجزرات وقرّر أيها تزور أولًا. كل ترتيب ينجح إن انتهيت عند النهاية. تُلتقط الجزرة عندما تقفز فوقها.",
          },
          explanation: {
            en: "You planned a tour, not a line: three stops in an order you chose, and the finish last. Different children pick different orders and they are all correct — the only rule was 'none left behind'. Choosing an order that keeps the turns few is how the same tour becomes a shorter program.",
            ar: "خطّطت جولة لا خطًا: ثلاث محطات بترتيب اخترته، والنهاية أخيرًا. يختار الأطفال ترتيبات مختلفة وكلها صحيحة — القاعدة الوحيدة كانت «لا تترك شيئًا». اختيار ترتيب يقلّل الاستدارات هو ما يجعل الجولة نفسها برنامجًا أقصر.",
          },
          teacherNotes: {
            en: "Three carrots at (1,0), (0,1) and (2,1) on a 3x3 board; the finish is bottom-right. Several tours fit in the 12-block limit. Good projector discussion: which order needs the fewest turns?",
            ar: "ثلاث جزرات عند (1,0) و(0,1) و(2,1) على لوحة 3x3؛ والنهاية في الزاوية السفلية اليمنى. عدة جولات تتسع ضمن حدّ 12 لبنة. نقاش جيد على جهاز العرض: أي ترتيب يحتاج إلى أقل عدد من الاستدارات؟",
          },
          difficulty: "MEDIUM",
          recommendedGradeMin: 3,
          recommendedGradeMax: 7,
          estimatedMinutes: 6,
          xpReward: 45,
          tags: ["sequencing", "creative"],
          requires: [],
          hints: [
            {
              tier: 1,
              text: {
                en: "Which carrot is nearest to you? Start there, then look for the next nearest.",
                ar: "أي جزرة الأقرب إليك؟ ابدأ منها، ثم ابحث عن الأقرب التالية.",
              },
            },
            {
              tier: 2,
              text: {
                en: "One good tour: turn right and go down one for the first carrot, come back up and along the top for the second, then down the right side for the third and the finish.",
                ar: "جولة جيدة: استدر يمينًا وانزل مربعًا للجزرة الأولى، ثم اصعد وامشِ على الصف العلوي للثانية، ثم انزل على الجانب الأيمن للثالثة والنهاية.",
              },
            },
            {
              tier: 3,
              text: {
                en: "A carrot is picked up just by hopping onto its tile — you don't need a Collect block on this island.",
                ar: "تُلتقط الجزرة بمجرد القفز فوق مربعها — لا تحتاج إلى لبنة «التقط» في هذه الجزيرة.",
              },
            },
            {
              tier: 4,
              text: {
                en: "Turn Right, Move, Turn Left, Move, Turn Left, Move, Turn Right, Move, Turn Right, Move, Move.",
                ar: "استدر يمينًا، تقدّم، استدر يسارًا، تقدّم، استدر يسارًا، تقدّم، استدر يمينًا، تقدّم، استدر يمينًا، تقدّم، تقدّم.",
              },
            },
          ],
          payload: {
            toolbox: [
              { type: "bb_moveForward" },
              { type: "bb_turnLeft" },
              { type: "bb_turnRight" },
              { type: "bb_repeat" },
            ],
            variants: [
              {
                rows: [".C.", "C.C", "..G"],
                start: { x: 0, y: 0, dir: "E" },
              },
            ],
            autoCollect: true,
            nonFatalBumps: false,
            checks: [
              { id: "reachedGoal", severity: "core" },
              { id: "collectedAll", severity: "secondary" },
              { id: "maxBlocks", severity: "quality", params: { count: 12 } },
            ],
            starCriteria: { threeStarMaxBlocks: 12 },
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
                        type: "bb_turnRight",
                        id: "t1",
                        next: {
                          block: {
                            type: "bb_moveForward",
                            id: "m1",
                            next: {
                              block: {
                                type: "bb_turnLeft",
                                id: "t2",
                                next: {
                                  block: {
                                    type: "bb_moveForward",
                                    id: "m2",
                                    next: {
                                      block: {
                                        type: "bb_turnLeft",
                                        id: "t3",
                                        next: {
                                          block: {
                                            type: "bb_moveForward",
                                            id: "m3",
                                            next: {
                                              block: {
                                                type: "bb_turnRight",
                                                id: "t4",
                                                next: {
                                                  block: {
                                                    type: "bb_moveForward",
                                                    id: "m4",
                                                    next: {
                                                      block: {
                                                        type: "bb_turnRight",
                                                        id: "t5",
                                                        next: {
                                                          block: {
                                                            type: "bb_moveForward",
                                                            id: "m5",
                                                            next: {
                                                              block: { type: "bb_moveForward", id: "m6" },
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

        // ── SHORTEST YOU CAN ──────────────────────────────────────────────
        {
          slug: "shortest-you-can",
          order: 3,
          activityType: "BLOCK_CODING",
          track: "PROGRAMMING",
          title: { en: "Shortest You Can", ar: "أقصر ما تستطيع" },
          story: {
            en: "A long straight pier runs out to the Fair's boat. Oona the Owl asks the only question she ever asks: 'You could write six hops. Could you write fewer blocks?'",
            ar: "رصيف طويل مستقيم يمتد إلى قارب المعرض. تسأل البومة أونا سؤالها الوحيد: «تستطيع أن تكتب ست قفزات. فهل تستطيع أن تكتب لبنات أقل؟»",
          },
          objective: {
            en: "Find the shortest program (by block count) for a straight corridor, choosing between counted and goal-controlled loops.",
            ar: "اعثر على أقصر برنامج (بعدد اللبنات) لممر مستقيم، مختارًا بين الحلقة المعدودة والحلقة المتوقفة عند الهدف.",
          },
          mission: {
            en: "Reach the boat with the fewest blocks you can.",
            ar: "صِل إلى القارب بأقل عدد ممكن من اللبنات.",
          },
          instructions: {
            en: "Six hops in a row works, but it uses six blocks. Two blocks are enough. Which loop gets you there — and do you even need to count?",
            ar: "ست قفزات متتالية تنجح، لكنها تستخدم ست لبنات. لبنتان تكفيان. أي حلقة توصلك — وهل تحتاج أصلًا إلى العدّ؟",
          },
          explanation: {
            en: "Two blocks: a loop, and one hop inside it. Repeat 6 works; Repeat Until I Reach the Goal works too and never needs the number — it would still work if the pier were ten tiles long. When two programs both succeed, the shorter and more general one is usually the better invention.",
            ar: "لبنتان: حلقة، وقفزة واحدة داخلها. «كرّر 6» تنجح؛ و«كرّر حتى أصل إلى الهدف» تنجح أيضًا ولا تحتاج إلى الرقم أبدًا — وستظل تعمل لو كان الرصيف عشرة مربعات. عندما ينجح برنامجان معًا، يكون الأقصر والأعمّ عادةً الاختراع الأفضل.",
          },
          teacherNotes: {
            en: "Both loops earn three stars (limit 2 blocks). Ask: which program would still work if the pier were longer? That contrast — counted vs. condition-controlled — is the Logic Forest idea revisited as a design choice.",
            ar: "كلتا الحلقتين تكسبان ثلاث نجوم (الحد لبنتان). اسأل: أي برنامج سيظل يعمل لو كان الرصيف أطول؟ هذه المقارنة — الحلقة المعدودة مقابل الحلقة المضبوطة بشرط — هي فكرة غابة المنطق نفسها، تُستعاد هنا بوصفها خيارًا في التصميم.",
          },
          difficulty: "MEDIUM",
          recommendedGradeMin: 4,
          recommendedGradeMax: 7,
          estimatedMinutes: 4,
          xpReward: 40,
          tags: ["loops", "creative"],
          requires: [],
          hints: [
            {
              tier: 1,
              text: {
                en: "Six of the same block in a row is exactly what a loop is for.",
                ar: "ست لبنات متطابقة متتالية هي بالضبط ما صُنعت الحلقة لأجله.",
              },
            },
            {
              tier: 2,
              text: {
                en: "Put ONE Move Forward inside a loop. That is two blocks in total.",
                ar: "ضع «تقدّم للأمام» واحدة داخل حلقة. ذلك لبنتان في المجموع.",
              },
            },
            {
              tier: 3,
              text: {
                en: "Repeat 6 works. So does Repeat Until I Reach the Goal — and it doesn't need you to count the tiles.",
                ar: "«كرّر 6» تنجح. وكذلك «كرّر حتى أصل إلى الهدف» — ولا تحتاج منك عدّ المربعات.",
              },
            },
            {
              tier: 4,
              text: {
                en: "Repeat Until I Reach the Goal { Move Forward }. Two blocks, three stars.",
                ar: "كرّر حتى أصل إلى الهدف { تقدّم للأمام }. لبنتان، ثلاث نجوم.",
              },
            },
          ],
          payload: {
            toolbox: [
              { type: "bb_moveForward" },
              { type: "bb_repeat" },
              { type: "bb_repeatUntilGoal" },
            ],
            variants: [
              {
                // A pier over water: straight to the boat, nowhere to turn.
                rows: ["......G", "WWWWWWW"],
                start: { x: 0, y: 0, dir: "E" },
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
                        type: "bb_repeatUntilGoal",
                        id: "r1",
                        inputs: { DO: { block: { type: "bb_moveForward", id: "m1" } } },
                      },
                    },
                  },
                ],
              },
            },
          } satisfies BlockCodingDraft,
        },

        // ── AROUND THE FOUNTAIN ───────────────────────────────────────────
        {
          slug: "around-the-fountain",
          order: 4,
          activityType: "BLOCK_CODING",
          track: "PROGRAMMING",
          title: { en: "Around the Fountain", ar: "حول النافورة" },
          story: {
            en: "The Fair's fountain sits in the middle of the square, and Mayor Mo has parked his stall against it. There is a long way round and a short way round. Nobody will tell you which is which.",
            ar: "نافورة المعرض تتوسط الساحة، وقد أوقف العمدة مو كشكه بجانبها. هناك طريق طويل حولها وطريق قصير. لن يخبرك أحد أيهما هو الأقصر.",
          },
          objective: {
            en: "Compare two valid routes around an obstacle and choose the shorter, recognising that the first route you see is not always the best.",
            ar: "قارن بين مسارين صالحين حول عائق واختر الأقصر، مدركًا أن أول مسار تراه ليس دائمًا الأفضل.",
          },
          mission: {
            en: "Get around the fountain to the stall — the short way if you can find it.",
            ar: "التفّ حول النافورة إلى الكشك — بالطريق القصير إن وجدته.",
          },
          instructions: {
            en: "Both ways round reach the stall. One takes three blocks; the other takes eleven. Try the one you see first, then ask whether there is a shorter one.",
            ar: "كلا الطريقين حول النافورة يصل إلى الكشك. أحدهما يستغرق ثلاث لبنات؛ والآخر إحدى عشرة. جرّب الذي تراه أولًا، ثم اسأل هل هناك أقصر.",
          },
          explanation: {
            en: "Two right answers, one much shorter: down the left side is three blocks; over the top and back is eleven. Both deliver. An inventor tries the first idea, then asks 'is there a better one?' — that question is the whole difference between a working program and a good one. The Workbench is complete: the Invention Power is yours.",
            ar: "إجابتان صحيحتان، إحداهما أقصر بكثير: نزولًا على الجانب الأيسر ثلاث لبنات؛ ومن فوق والعودة إحدى عشرة. كلتاهما توصل. يجرّب المخترع الفكرة الأولى، ثم يسأل «هل هناك أفضل؟» — هذا السؤال هو الفرق كله بين برنامج يعمل وبرنامج جيد. اكتملت طاولة العمل: قوة الاختراع صارت لك.",
          },
          teacherNotes: {
            en: "Most students go along the top first because the bot faces East. Both routes pass; only the 3-block route earns three stars. Let a student who found the long way present it, THEN ask the class for a shorter one — the comparison is the lesson.",
            ar: "يذهب معظم الطلاب على الصف العلوي أولًا لأن الروبوت يواجه الشرق. كلا المسارين ينجح؛ لكن مسار اللبنات الثلاث وحده يكسب ثلاث نجوم. دع طالبًا وجد الطريق الطويل يعرضه، ثم اسأل الصف عن طريق أقصر — فالمقارنة هي الدرس.",
          },
          difficulty: "MEDIUM",
          recommendedGradeMin: 3,
          recommendedGradeMax: 7,
          estimatedMinutes: 5,
          xpReward: 45,
          tags: ["sequencing", "creative"],
          requires: [],
          hints: [
            {
              tier: 1,
              text: {
                en: "Where is the stall compared with the bot — is it really easier to go along the top first?",
                ar: "أين الكشك بالنسبة إلى الروبوت — هل الذهاب على الصف العلوي أولًا أسهل حقًا؟",
              },
            },
            {
              tier: 2,
              text: {
                en: "The stall is straight below the bot. The left side of the fountain is open all the way down.",
                ar: "الكشك تحت الروبوت مباشرة. الجانب الأيسر من النافورة مفتوح حتى الأسفل.",
              },
            },
            {
              tier: 3,
              text: {
                en: "Turn to face South, then hop twice. That is the short way — three blocks.",
                ar: "استدر لتواجه الجنوب، ثم اقفز مرتين. هذا هو الطريق القصير — ثلاث لبنات.",
              },
            },
            {
              tier: 4,
              text: {
                en: "Turn Right, Move Forward, Move Forward.",
                ar: "استدر يمينًا، تقدّم للأمام، تقدّم للأمام.",
              },
            },
          ],
          payload: {
            toolbox: [
              { type: "bb_moveForward" },
              { type: "bb_turnLeft" },
              { type: "bb_turnRight" },
              { type: "bb_repeat" },
            ],
            variants: [
              {
                rows: ["....", ".##.", "G..."],
                start: { x: 0, y: 0, dir: "E" },
              },
            ],
            autoCollect: true,
            nonFatalBumps: false,
            checks: [
              { id: "reachedGoal", severity: "core" },
              { id: "maxBlocks", severity: "quality", params: { count: 3 } },
            ],
            starCriteria: { threeStarMaxBlocks: 3 },
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
                        type: "bb_turnRight",
                        id: "t1",
                        next: {
                          block: {
                            type: "bb_moveForward",
                            id: "m1",
                            next: { block: { type: "bb_moveForward", id: "m2" } },
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
    theFair,
  ],
};
