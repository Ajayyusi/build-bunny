import type { z } from "zod";
import type {
  WorldFixture,
  blockCodingPayload,
  codePredictionPayload,
} from "@/modules/curriculum/schemas";

/**
 * World 2 — Logic Forest (seed levels 6–10, curriculum-content.md §5, plus
 * the m4 CODE_PREDICTION level "loop-detective" appended as
 * forest-decisions/4, after the capstone). Levels 8–10 are multi-variant (2
 * maps each): ONE program must pass ALL variants, which is what makes If /
 * Repeat-Until honest instead of memorizable. Rock/tree tiles are both "#"
 * (fatal bump with located feedback); condition-controlled loops use the
 * adjudicated bb_repeatUntilGoal block, so levels 9–10 teach "loop until the
 * burrow" rather than the doc's original repeat-until-blocked phrasing.
 * Every student-facing field carries real Arabic (m5-contracts §1,
 * content/i18n-glossary.md governs terminology); teacherNotes stays
 * English-only (staff-facing).
 */

type BlockCodingDraft = z.input<typeof blockCodingPayload>;
type CodePredictionDraft = z.input<typeof codePredictionPayload>;

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

export const logicForest: WorldFixture = {
  slug: "logic-forest",
  name: { en: "Logic Forest", ar: "غابة المنطق" },
  tagline: {
    en: "The forest is tricky. Your brain is trickier.",
    ar: "الغابة ماكرة، لكن عقلك أمكر.",
  },
  theme: "forest",
  horizon: false,
  modules: [
    {
      slug: "trails-and-obstacles",
      order: 1,
      name: { en: "Trails & Obstacles", ar: "الدروب والعوائق" },
      description: {
        en: "Loops can hold more than one block. And the forest has rocks — plan your trail.",
        ar: "يمكن للحلقة أن تحتوي أكثر من لبنة واحدة. والغابة فيها صخور — خطّط دربك جيدًا.",
      },
      levels: [
        // ── Level 6 — LOOP TRAIL: multi-block loop bodies ─────────────────
        {
          slug: "loop-trail",
          order: 1,
          activityType: "BLOCK_CODING",
          track: "PROGRAMMING",
          title: { en: "Loop Trail", ar: "درب الحلقات" },
          story: {
            en: "Welcome to Logic Forest, where the trails play tricks. This one runs in a perfect square around an old oak stump — and squares are very, very repetitive.",
            ar: "أهلًا بك في غابة المنطق، حيث تخدعك الدروب. هذا الدرب يدور في مربّع كامل حول جذع بلوط قديم — والمربعات مليئة بالتكرار.",
          },
          objective: {
            en: "Identify a repeating movement pattern (move-move-turn) and encode it as a multi-block loop body.",
            ar: "تعرّف على نمط حركة متكرر (تقدّم-تقدّم-استدارة)، وحوّله إلى جسم حلقة يضمّ أكثر من لبنة.",
          },
          instructions: {
            en: "The trail runs in a square back to the home stump. Find the repeating pattern, pack it into one Repeat block, and collect every carrot on the way around.",
            ar: "يدور الدرب في مربّع ويعود إلى الجذع نفسه. اكتشف النمط المتكرر، وضعه داخل لبنة «كرّر» واحدة، والتقط كل جزرة في طريقك.",
          },
          explanation: {
            en: "Your loop had three blocks inside, and the whole group repeated four times. Loops don't just repeat one action — they repeat a pattern. Spotting the pattern ('two hops and a turn… again!') is the real skill; the Repeat block is just how you tell the computer about it. Programmers call each time around the loop an iteration — you just ran four of them.",
            ar: "حلقتك ضمّت ثلاث لبنات بداخلها، وتكررت المجموعة كلها أربع مرات. الحلقات لا تكرّر حركة واحدة فقط — بل تكرّر نمطًا كاملًا. اكتشاف النمط («قفزتان واستدارة... ومرة أخرى!») هو المهارة الحقيقية؛ ولبنة «كرّر» هي فقط طريقتك لإخبار الحاسوب بذلك. يسمّي المبرمجون كل دورة حول الحلقة «تكرارة» — وقد نفّذت للتو أربع تكرارات.",
          },
          teacherNotes: {
            en: "Students who unroll all 12 blocks still pass — celebrate, then point at the 3-star criterion and ask what repeats. Never frame the unrolled version as wrong; frame the loop as stronger. Challenge extension: solve it turning LEFT instead — where must Robo Bunny face at the start? (One extra turn before the loop is allowed.)",
          },
          difficulty: "EASY",
          recommendedGradeMin: 4,
          recommendedGradeMax: 7,
          estimatedMinutes: 8,
          xpReward: 40,
          tags: ["loops"],
          requires: [],
          hints: [
            {
              tier: 1,
              text: {
                en: "Walk the square trail with your eyes. Do you notice yourself thinking the same little dance over and over?",
                ar: "تتبّع الدرب المربّع بعينيك. هل تلاحظ أنك تفكّر في الرقصة الصغيرة نفسها مرة بعد أخرى؟",
              },
            },
            {
              tier: 2,
              text: {
                en: "Each side of the square is: hop, hop, turn. A Repeat block's mouth can hold ALL THREE of those blocks.",
                ar: "كل ضلع من ضلوع المربّع هو: قفزة، قفزة، استدارة. يمكن للبنة «كرّر» أن تحتضن اللبنات الثلاث معًا.",
              },
            },
            {
              tier: 3,
              text: {
                en: "Put Move, Move, Turn Right inside one Repeat. How many sides does a square have? That's your Repeat number.",
                ar: "ضع «تقدّم، تقدّم، استدر يمينًا» داخل «كرّر» واحدة. كم ضلعًا للمربّع؟ هذا هو رقم «كرّر» الذي تحتاجه.",
              },
            },
            {
              tier: 4,
              text: {
                en: "Repeat 4 { Move Forward, Move Forward, Turn Right } — two hops and a right turn, four times, brings Robo Bunny all the way around and home.",
                ar: "«كرّر 4 { تقدّم للأمام، تقدّم للأمام، استدر يمينًا }» — قفزتان واستدارة يمينًا، أربع مرات، تُعيد الأرنب الآلي إلى جذعه سالمًا.",
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
            // The burrow is the starting tile — the "home stump hollow" the
            // square trail loops back to. The oak stump blocks the center.
            variants: [
              {
                rows: ["G.C", ".#.", "C.C"],
                start: { x: 0, y: 0, dir: "E" },
              },
            ],
            autoCollect: true,
            nonFatalBumps: false,
            checks: [
              { id: "reachedGoal", severity: "core" },
              { id: "collectedAll", severity: "secondary", params: { item: "carrot" } },
              { id: "maxBlocks", severity: "quality", params: { count: 4 } },
            ],
            starCriteria: { threeStarMaxBlocks: 4 },
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
                          DO: {
                            block: {
                              type: "bb_moveForward",
                              id: "m1",
                              next: {
                                block: {
                                  type: "bb_moveForward",
                                  id: "m2",
                                  next: {
                                    block: { type: "bb_turnRight", id: "t1" },
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

        // ── Level 7 — AVOID THE ROCK: obstacles & located runtime failure ─
        {
          slug: "avoid-the-rock",
          order: 2,
          activityType: "BLOCK_CODING",
          track: "PROGRAMMING",
          title: { en: "Avoid the Rock", ar: "تجنّب الصخرة" },
          story: {
            en: "A rockslide dumped two boulders right across the forest trail. Robo Bunny can't push rocks — but rocks can't stop a bunny with a better route.",
            ar: "أسقط انهيار صخري صخرتين كبيرتين وسط درب الغابة. الأرنب الآلي لا يستطيع دفع الصخور — لكن الصخور لا توقف أرنبًا يعرف طريقًا أفضل.",
          },
          objective: {
            en: "Plan a collision-free route around blocking obstacles and interpret a located runtime failure message ('bumped at step N') to fix a program.",
            ar: "خطّط مسارًا آمنًا يتجنّب العوائق، وتعلّم قراءة رسالة فشل محددة الموقع («اصطدام عند الخطوة رقم كذا») لإصلاح البرنامج.",
          },
          instructions: {
            en: "Two boulders block the trail, and bumping one ends the run — the message tells you exactly which step went wrong. Plan a detour to the burrow, and keep an eye out for a hidden loop in your route.",
            ar: "صخرتان تسدّان الدرب، والاصطدام بإحداهما ينهي التشغيل فورًا — والرسالة تخبرك بالضبط أي خطوة أخطأت. خطّط طريقًا بديلًا إلى الجُحر، وانتبه لوجود حلقة مخفية في مسارك.",
          },
          explanation: {
            en: "That crash wasn't a mistake by Robo Bunny — it did exactly what the program said. When a program fails, the computer isn't being mean; it's giving you a clue. 'Bumped a rock at step 3' tells you exactly where to look. Programmers read error messages like detectives read fingerprints. Also: did you spot the hidden loop in the detour? Four hops east = Repeat 4.",
            ar: "ذلك الاصطدام لم يكن خطأ من الأرنب الآلي — بل نفّذ بالضبط ما قاله له البرنامج. عندما يفشل البرنامج، فإن الحاسوب لا يتعمّد إزعاجك، بل يعطيك دليلًا. رسالة «اصطدام بصخرة عند الخطوة 3» تخبرك بالضبط أين تنظر. يقرأ المبرمجون رسائل الخطأ كما يقرأ المحققون بصمات الأصابع. وهل لاحظت أيضًا الحلقة المخفية في الطريق البديل؟ أربع قفزات شرقًا تساوي «كرّر 4».",
          },
          teacherNotes: {
            en: "Let students crash on purpose once — seeing the step-numbered failure teaches more than avoiding it. The step counter in the sim maps 1:1 to executed blocks. Challenge extension: find a different route to the burrow that also takes exactly 6 blocks — there's more than one way around a rock.",
          },
          difficulty: "MEDIUM",
          recommendedGradeMin: 4,
          recommendedGradeMax: 7,
          estimatedMinutes: 8,
          xpReward: 45,
          tags: ["loops", "debugging"],
          requires: [],
          hints: [
            {
              tier: 1,
              text: {
                en: "Robo Bunny stops the moment it bumps a rock. Look at the grid — where does the clear path go?",
                ar: "يتوقف الأرنب الآلي فور اصطدامه بصخرة. انظر إلى الخريطة — إلى أين يمتد المسار الخالي؟",
              },
            },
            {
              tier: 2,
              text: {
                en: "You can't go through the rocks, so go around: one hop forward, then drop down a row before continuing.",
                ar: "لا يمكنك المرور عبر الصخور، فدُر حولها: قفزة واحدة للأمام، ثم انزل صفًا واحدًا قبل أن تتابع.",
              },
            },
            {
              tier: 3,
              text: {
                en: "Move, then Turn Right, Move, then Turn Left gets you past the boulders facing the right way. Count the hops that remain.",
                ar: "«تقدّم، استدر يمينًا، تقدّم، استدر يسارًا» تنقلك إلى ما بعد الصخرتين وأنت متّجه بالاتجاه الصحيح. عُدّ القفزات المتبقية.",
              },
            },
            {
              tier: 4,
              text: {
                en: "Move, Turn Right, Move, Turn Left, then four more hops east — and four-of-the-same sounds like a job for Repeat.",
                ar: "تقدّم، استدر يمينًا، تقدّم، استدر يسارًا، ثم أربع قفزات أخرى شرقًا — وأربع حركات متطابقة؟ هذه مهمة تناسب «كرّر».",
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
                rows: ["..#...", "..#...", ".....G", "......"],
                start: { x: 0, y: 1, dir: "E" },
              },
            ],
            autoCollect: true,
            nonFatalBumps: false,
            checks: [
              { id: "reachedGoal", severity: "core" },
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
                            type: "bb_turnRight",
                            id: "t1",
                            next: {
                              block: {
                                type: "bb_moveForward",
                                id: "m2",
                                next: {
                                  block: {
                                    type: "bb_turnLeft",
                                    id: "t2",
                                    next: {
                                      block: {
                                        type: "bb_repeat",
                                        id: "r1",
                                        fields: { TIMES: 4 },
                                        inputs: {
                                          DO: {
                                            block: {
                                              type: "bb_moveForward",
                                              id: "m3",
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
      ],
    },
    {
      slug: "forest-decisions",
      order: 2,
      name: { en: "Forest Decisions", ar: "قرارات الغابة" },
      description: {
        en: "The best programs can handle surprises. Time to teach Robo Bunny to check before hopping.",
        ar: "أفضل البرامج تستطيع التعامل مع المفاجآت. حان وقت تعليم الأرنب الآلي أن يتحقق قبل أن يقفز.",
      },
      levels: [
        // ── Level 8 — CHOOSE THE PATH: If + sensor, first multi-variant ───
        {
          slug: "choose-the-path",
          order: 1,
          activityType: "BLOCK_CODING",
          track: "PROGRAMMING",
          title: { en: "Choose the Path", ar: "اختر الطريق" },
          story: {
            en: "Deep in the forest, the trail splits at two burrow doors — and last night's rockslide blocked one of them. Nobody knows which. Robo Bunny will have to check.",
            ar: "في عمق الغابة، ينقسم الدرب إلى بابَي جُحر — وقد سدّ انهيار صخري الليلة الماضية أحدهما. لا أحد يعرف أيهما. سيتعيّن على الأرنب الآلي أن يتحقق بنفسه.",
          },
          objective: {
            en: "Write one program that succeeds on two different maps by using 'If path ahead is blocked' to choose a direction at a junction.",
            ar: "اكتب برنامجًا واحدًا ينجح على خريطتين مختلفتين باستخدام «إذا الطريق أمامي مسدود» لاختيار الاتجاه عند مفترق الطرق.",
          },
          instructions: {
            en: "The rockslide blocked a different door on each map. Use the If block with the path-ahead sensor to check before choosing — and write ONE program that reaches a burrow on BOTH maps. Run both before you finish.",
            ar: "سدّ الانهيار الصخري بابًا مختلفًا في كل خريطة. استخدم لبنة «إذا» مع مستشعر الطريق أمامي للتحقق قبل الاختيار — واكتب برنامجًا واحدًا فقط يصل إلى الجُحر في الخريطتين معًا. شغّل الخريطتين قبل أن تنهي.",
          },
          explanation: {
            en: "You wrote your first program that makes a decision. The If block asked a question — is the path blocked? — and Robo Bunny acted differently depending on the answer. That's why your ONE program beat BOTH maps. This is huge: real software faces different situations every time it runs (different players, different weather, different rockslides), and If is how it copes. Checking before acting — that's not just good programming, it's good hiking.",
            ar: "كتبت للتو أول برنامج لك يتّخذ قرارًا. لبنة «إذا» طرحت سؤالًا — هل الطريق مسدود؟ — وتصرّف الأرنب الآلي بشكل مختلف حسب الإجابة. لهذا نجح برنامجك الواحد في الخريطتين معًا. هذا أمر كبير: البرامج الحقيقية تواجه مواقف مختلفة في كل مرة تعمل فيها (لاعبون مختلفون، طقس مختلف، انهيارات صخرية مختلفة)، ولبنة «إذا» هي طريقتها للتعامل مع ذلك. التحقق قبل التصرّف ليس فقط برمجة جيدة — بل هو أيضًا تنزّه ذكي في الغابة.",
          },
          teacherNotes: {
            en: "The two variant chips above the sim are the teaching device — insist students run both before submitting. Common bug: turning left before reaching the junction. The step-through playback shows the sensor check as a thought bubble ('blocked? YES'). Challenge extension: rebuild the solution checking the SOUTH door first instead — same block count?",
          },
          difficulty: "MEDIUM",
          recommendedGradeMin: 4,
          recommendedGradeMax: 7,
          estimatedMinutes: 10,
          xpReward: 50,
          tags: ["conditionals", "sensors"],
          requires: [],
          hints: [
            {
              tier: 1,
              text: {
                en: "The rock is in a different place on each map — so a fixed list of hops can't work every time. What if the program could ask a question?",
                ar: "الصخرة في مكان مختلف في كل خريطة — فقائمة قفزات ثابتة لن تنجح في كل مرة. ماذا لو استطاع البرنامج أن يطرح سؤالًا؟",
              },
            },
            {
              tier: 2,
              text: {
                en: "The If block runs its inside blocks only when its question is true. Hop to the junction, face one door, and ask: is the path blocked?",
                ar: "لبنة «إذا» تُشغّل اللبنات بداخلها فقط عندما تكون إجابة سؤالها صحيحة. اقفز إلى المفترق، واجه أحد البابين، واسأل: هل الطريق مسدود؟",
              },
            },
            {
              tier: 3,
              text: {
                en: "Face NORTH at the junction (Move, Move, Turn Left). If blocked, Robo Bunny needs to face south instead — two right turns spin it around.",
                ar: "واجه الشمال عند المفترق (تقدّم، تقدّم، استدر يسارًا). إذا كان الطريق مسدودًا، على الأرنب الآلي أن يواجه الجنوب بدلًا من ذلك — استدارتان يمينًا تديرانه بالكامل.",
              },
            },
            {
              tier: 4,
              text: {
                en: "Move, Move, Turn Left, If blocked { Turn Right, Turn Right }, Move, Move. If the north door is clear the If does nothing; if it's blocked, the bunny turns around. Then two hops finish it — whichever way it's facing.",
                ar: "تقدّم، تقدّم، استدر يسارًا، إذا كان مسدودًا { استدر يمينًا، استدر يمينًا }، تقدّم، تقدّم. إذا كان الباب الشمالي مفتوحًا فلن تفعل «إذا» شيئًا؛ وإذا كان مسدودًا يستدير الأرنب بالكامل. ثم تُنهي قفزتان المهمة، أيًا كان الاتجاه الذي يواجهه.",
              },
            },
          ],
          payload: {
            toolbox: [
              { type: "bb_moveForward" },
              { type: "bb_turnLeft" },
              { type: "bb_turnRight" },
              { type: "bb_if" },
              { type: "bb_pathAhead" },
            ],
            // Variant A: rock blocks the north door; variant B: the south.
            // Success = end on either burrow — no Else needed, the "clear"
            // case simply falls through (If/Else debuts in Robot Lab).
            variants: [
              {
                rows: ["##G##", "#####", "...##", "##.##", "##G##"],
                start: { x: 0, y: 2, dir: "E" },
              },
              {
                rows: ["##G##", "##.##", "...##", "#####", "##G##"],
                start: { x: 0, y: 2, dir: "E" },
              },
            ],
            autoCollect: true,
            nonFatalBumps: false,
            checks: [
              { id: "reachedGoal", severity: "core" },
              { id: "usedBlock", severity: "secondary", params: { block: "bb_if" } },
              // Doc labels the optimal 7 but its own listing is 8 statement
              // blocks (M,M,TL,If,TR,TR,M,M); budget follows the real count.
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
                                    type: "bb_if",
                                    id: "if1",
                                    inputs: {
                                      CONDITION: {
                                        block: { type: "bb_pathAhead", id: "s1" },
                                      },
                                      DO: {
                                        block: {
                                          type: "bb_turnRight",
                                          id: "t2",
                                          next: {
                                            block: {
                                              type: "bb_turnRight",
                                              id: "t3",
                                            },
                                          },
                                        },
                                      },
                                    },
                                    next: {
                                      block: {
                                        type: "bb_moveForward",
                                        id: "m3",
                                        next: {
                                          block: {
                                            type: "bb_moveForward",
                                            id: "m4",
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

        // ── Level 9 — HIDDEN CARROT: Repeat Until Goal ────────────────────
        {
          slug: "hidden-carrot",
          order: 2,
          activityType: "BLOCK_CODING",
          track: "PROGRAMMING",
          title: { en: "Hidden Carrot", ar: "الجزرة المخفية" },
          story: {
            en: "Somewhere down this foggy trail, a legendary golden carrot is buried right at the old burrow door. How far? The fog isn't telling.",
            ar: "في مكان ما على هذا الدرب الضبابي، مدفونة جزرة ذهبية أسطورية عند باب الجُحر القديم. كم يبعد؟ الضباب لا يبوح بالسر.",
          },
          objective: {
            en: "Use a condition-controlled loop (Repeat Until I Reach the Goal) to traverse a corridor of unknown length.",
            ar: "استخدم حلقة مضبوطة بشرط («كرّر حتى أصل إلى الهدف») لعبور ممر مجهول الطول.",
          },
          instructions: {
            en: "The trail is a different length on each map, so a counted Repeat can't win both. Use Repeat Until I Reach the Goal to hop exactly as far as needed — and grab the carrot on the way. Your program must pass BOTH maps.",
            ar: "طول الدرب يختلف في كل خريطة، فلبنة «كرّر» بعدد ثابت لن تنجح في الاثنتين معًا. استخدم «كرّر حتى أصل إلى الهدف» للقفز بالمسافة اللازمة بالضبط — والتقط الجزرة في طريقك. يجب أن ينجح برنامجك في الخريطتين معًا.",
          },
          explanation: {
            en: "Your two-block program just solved a trail of ANY length. Repeat is for when you know the count; Repeat Until I Reach the Goal is for when you know the stopping condition instead. That tiny program is the smartest one you've written: it doesn't contain the answer — it contains a way to FIND the answer. That's the difference between memorizing and thinking, and computers can do both.",
            ar: "برنامجك المكوّن من لبنتين حلّ دربًا بأي طول. «كرّر» تستخدم حين تعرف العدد؛ و«كرّر حتى أصل إلى الهدف» تُستخدم حين تعرف شرط التوقف بدلًا من العدد. هذا البرنامج الصغير هو أذكى ما كتبت حتى الآن: فهو لا يحمل الإجابة — بل يحمل طريقة لإيجاد الإجابة. هذا هو الفرق بين الحفظ والتفكير، والحاسوب يستطيع فعل الاثنين معًا.",
          },
          teacherNotes: {
            en: "Contrast Repeat 4 vs Repeat Until on the board. The decoy Repeat block in the toolbox will catch students who pattern-match from Repeat After Me — variant B corrects them. Challenge extension: predict what plain Repeat 4 does on EACH map before running it, then discuss why one number can't fit two trails.",
          },
          difficulty: "MEDIUM",
          recommendedGradeMin: 4,
          recommendedGradeMax: 7,
          estimatedMinutes: 8,
          xpReward: 50,
          tags: ["loops", "sensors"],
          requires: [],
          hints: [
            {
              tier: 1,
              text: {
                en: "The trail is a different length on each map — so Repeat 4 can't be right. When should the hopping STOP?",
                ar: "طول الدرب يختلف في كل خريطة — فـ«كرّر 4» لن تكون صحيحة أبدًا. متى يجب أن يتوقف القفز؟",
              },
            },
            {
              tier: 2,
              text: {
                en: "Repeat Until I Reach the Goal keeps going until its question becomes true. What is Robo Bunny's question on this trail?",
                ar: "«كرّر حتى أصل إلى الهدف» تستمر حتى تصبح إجابة سؤالها صحيحة. ما سؤال الأرنب الآلي على هذا الدرب؟",
              },
            },
            {
              tier: 3,
              text: {
                en: "You don't know how many hops — but you DO know where to stop: the burrow. Put Move Forward inside Repeat Until I Reach the Goal.",
                ar: "أنت لا تعرف عدد القفزات — لكنك تعرف أين تتوقف: عند الجُحر. ضع «تقدّم للأمام» داخل «كرّر حتى أصل إلى الهدف».",
              },
            },
            {
              tier: 4,
              text: {
                en: "Repeat Until I Reach the Goal { Move Forward } — two blocks. Robo Bunny hops until it lands on the burrow, grabbing the carrot on the way. Run BOTH maps.",
                ar: "«كرّر حتى أصل إلى الهدف { تقدّم للأمام }» — لبنتان فقط. يقفز الأرنب الآلي حتى يصل إلى الجُحر، ويلتقط الجزرة في طريقه. شغّل الخريطتين معًا.",
              },
            },
          ],
          payload: {
            // bb_repeat is present as a decoy — choosing the right loop is
            // part of the lesson. The hedge behind each burrow is scenery
            // from the doc's fog-trail scene.
            toolbox: [
              { type: "bb_moveForward" },
              { type: "bb_repeatUntilGoal" },
              { type: "bb_repeat" },
            ],
            variants: [
              {
                rows: ["########", "..C.G###", "########"],
                start: { x: 0, y: 1, dir: "E" },
              },
              {
                rows: ["########", "...C..G#", "########"],
                start: { x: 0, y: 1, dir: "E" },
              },
            ],
            autoCollect: true,
            nonFatalBumps: false,
            checks: [
              { id: "reachedGoal", severity: "core" },
              { id: "collectedAll", severity: "secondary", params: { item: "carrot" } },
              {
                id: "usedBlock",
                severity: "secondary",
                params: { block: "bb_repeatUntilGoal" },
              },
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

        // ── Level 10 — FOREST CHALLENGE: capstone, decision inside a loop ─
        {
          slug: "forest-challenge",
          order: 3,
          activityType: "BLOCK_CODING",
          track: "PROGRAMMING",
          title: { en: "Forest Challenge", ar: "تحدي الغابة" },
          story: {
            en: 'The heart of Logic Forest is a spiral thicket, and at its center: the Great Golden Burrow. The old trail signs say only this — "Hop toward the burrow. When you can\'t — turn. Trust the pattern."',
            ar: "قلب غابة المنطق دَغَل حلزوني، وفي مركزه: الجُحر الذهبي العظيم. لافتات الدرب القديمة تقول فقط: «اقفز نحو الجُحر. وإن لم تستطع — استدر. ثق بالنمط».",
          },
          objective: {
            en: "Combine a goal-controlled loop, an If sensor check, movement and turning to solve a spiral maze, demonstrating that small general programs beat long specific ones.",
            ar: "اجمع بين حلقة مضبوطة بالهدف، وفحص «إذا» بالمستشعر، والتقدّم والاستدارة لحلّ متاهة حلزونية — لتُثبت أن البرامج الصغيرة العامة أفضل من البرامج الطويلة المحدَّدة.",
          },
          instructions: {
            en: "Reach the Great Golden Burrow at the heart of the spiral and collect every carrot — with ONE program that solves BOTH mazes. Remember the trail signs: hop toward the burrow; when you can't, turn.",
            ar: "صِل إلى الجُحر الذهبي العظيم في قلب الحلزون والتقط كل جزرة — ببرنامج واحد يحلّ المتاهتين معًا. تذكّر لافتات الدرب: اقفز نحو الجُحر؛ وإن لم تستطع، استدر.",
          },
          explanation: {
            en: "Look at what you built: a decision INSIDE a loop. The loop keeps going until the Golden Burrow; each time around, the If checks the path and takes the corner when it must. Four blocks solved a maze of twenty hops — and the SAME four blocks solved a completely different maze. That's the deepest secret in this forest: great programmers don't write longer programs for bigger problems — they find the pattern and let the loops do the work.",
            ar: "انظر إلى ما بنيته: قرار بداخل حلقة. الحلقة تستمر حتى الجُحر الذهبي؛ وفي كل دورة، تتحقق «إذا» من الطريق وتنعطف عند الحاجة. أربع لبنات حلّت متاهة من عشرين قفزة — والأربع لبنات نفسها حلّت متاهة مختلفة تمامًا. هذا هو أعمق سرّ في هذه الغابة: المبرمجون المتميزون لا يكتبون برامج أطول للمشكلات الأكبر — بل يكتشفون النمط ويتركون الحلقات تقوم بالعمل.",
          },
          teacherNotes: {
            en: "This is the level to project on the big screen in demos. Students who unroll it: pass them, then run their ~20 blocks and the 4-block version side by side — the class will gasp; that gasp is the lesson. Expected help hotspot: leaving out the If (Robo Bunny bumps the wall at the first corner — the located failure message is a great debugging moment).",
          },
          difficulty: "MEDIUM",
          recommendedGradeMin: 5,
          recommendedGradeMax: 7,
          estimatedMinutes: 15,
          xpReward: 80,
          tags: ["loops", "conditionals", "sensors"],
          requires: [],
          hints: [
            {
              tier: 1,
              text: {
                en: "Read the trail signs again: keep hopping toward the burrow, and when you can't — turn. You have a block for each part of that sentence.",
                ar: "اقرأ لافتات الدرب مرة أخرى: واصل القفز نحو الجُحر، وإن لم تستطع — استدر. لديك لبنة لكل جزء من هذه الجملة.",
              },
            },
            {
              tier: 2,
              text: {
                en: "One big loop can run until Robo Bunny reaches the goal. Each time around it should do one small dance: check the path, maybe turn, then hop.",
                ar: "حلقة كبيرة واحدة تستطيع العمل حتى يصل الأرنب الآلي إلى الهدف. وفي كل دورة عليها أن تؤدي رقصة صغيرة: تتحقق من الطريق، ربما تستدير، ثم تقفز.",
              },
            },
            {
              tier: 3,
              text: {
                en: "Inside Repeat Until I Reach the Goal, put an If path ahead is blocked { Turn Right }, then a Move Forward. Blocked? Turn first. Then hop.",
                ar: "داخل «كرّر حتى أصل إلى الهدف»، ضع «إذا الطريق أمامي مسدود { استدر يمينًا }»، ثم «تقدّم للأمام». مسدود؟ استدر أولًا. ثم اقفز.",
              },
            },
            {
              tier: 4,
              text: {
                en: "Repeat Until I Reach the Goal { If path ahead is blocked { Turn Right }, Move Forward } — the If takes every corner, the Move eats every corridor, and the loop keeps the dance going all the way to the Golden Burrow.",
                ar: "«كرّر حتى أصل إلى الهدف { إذا الطريق أمامي مسدود { استدر يمينًا }، تقدّم للأمام }» — «إذا» تنعطف عند كل زاوية، و«تقدّم» يعبر كل ممر، والحلقة تُبقي الرقصة مستمرة حتى الجُحر الذهبي.",
              },
            },
          ],
          payload: {
            toolbox: [
              { type: "bb_moveForward" },
              { type: "bb_turnLeft" },
              { type: "bb_turnRight" },
              { type: "bb_repeat" },
              { type: "bb_repeatUntilGoal" },
              { type: "bb_if" },
              { type: "bb_pathAhead" },
            ],
            // Variant A: 7×5 spiral (4 carrots). Variant B: 6×6 spiral one
            // ring tighter (3 carrots). Every straight run is wall-terminated,
            // so the same sensor-driven program solves both.
            variants: [
              {
                rows: ["......C", "######.", ".C..G#.", ".#####.", ".C....C"],
                start: { x: 0, y: 0, dir: "E" },
              },
              {
                rows: [".....C", "#####.", ".C.G#.", ".####.", ".####.", ".C...."],
                start: { x: 0, y: 0, dir: "E" },
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
                        type: "bb_repeatUntilGoal",
                        id: "r1",
                        inputs: {
                          DO: {
                            block: {
                              type: "bb_if",
                              id: "if1",
                              inputs: {
                                CONDITION: {
                                  block: { type: "bb_pathAhead", id: "s1" },
                                },
                DO: {
                                  block: { type: "bb_turnRight", id: "t1" },
                                },
                              },
                              next: {
                                block: { type: "bb_moveForward", id: "m1" },
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

        // ── LOOP DETECTIVE — CODE_PREDICTION, closes out Logic Forest ─────
        // Deliberately placed AFTER the capstone, not mid-module: it doesn't
        // touch a grid, and appending it here means every existing level's
        // moduleId/order (and therefore its position in program order) is
        // completely undisturbed — the m4 registrar's insertion note ("mind
        // @@unique([moduleId, order]) — renumber siblings carefully") is
        // satisfied by NOT needing to renumber any sibling at all.
        {
          slug: "loop-detective",
          order: 4,
          activityType: "CODE_PREDICTION",
          track: "PROGRAMMING",
          title: { en: "Loop Detective", ar: "محقق الحلقات" },
          story: {
            en: "The Golden Burrow is won, the spiral is solved — but one last note is pinned beside the trailhead home, in Robo Bunny's own handwriting. Not a map this time: a page torn from the programming notebook. Before the gate to Robot Lab opens, the forest wants to know: can you read a loop as well as you can write one?",
            ar: "فاز الأرنب الآلي بالجُحر الذهبي، وحُلّت المتاهة الحلزونية — لكن هناك ملاحظة أخيرة مثبَّتة عند بداية الدرب، بخط يد الأرنب الآلي نفسه. ليست خريطة هذه المرة، بل صفحة ممزّقة من دفتر البرمجة. قبل أن تُفتح بوابة مختبر الروبوتات، تريد الغابة أن تعرف: هل تستطيع قراءة الحلقة كما تستطيع كتابتها؟",
          },
          objective: {
            en: "Read a short program built around a Repeat loop and predict its total effect — specifically how many times a repeated action actually runs.",
            ar: "اقرأ برنامجًا قصيرًا مبنيًا على حلقة «كرّر»، وتوقّع أثره الكلي — وتحديدًا كم مرة تُنفَّذ الحركة المتكررة فعليًا.",
          },
          instructions: {
            en: "Read the program below. It uses a loop, just like every trail you've solved in this forest. Work out what it actually does, then pick the option that matches.",
            ar: "اقرأ البرنامج أدناه. يستخدم حلقة، تمامًا كل درب حللته في هذه الغابة. حدّد ما يفعله البرنامج فعليًا، ثم اختر الإجابة المطابقة.",
          },
          explanation: {
            en: "A loop doesn't repeat ONE action — it repeats its WHOLE body, every statement inside it, every single time around. This program's loop ran 3 times, and each time around it hopped forward twice before turning. So the forward hops didn't just add up to 3 — they added up to 3 groups of 2. Programmers call this 'reading code': predicting what a program does before ever running it. It's the same skill as writing a loop, just aimed the other way, and it's exactly how you'll spot bugs later without a single test run. Worlds 1 and 2: complete. Robot Lab is waiting.",
            ar: "الحلقة لا تكرّر حركة واحدة — بل تكرّر جسمها كاملًا، كل تعليمة بداخلها، في كل دورة. حلقة هذا البرنامج عملت 3 مرات، وفي كل دورة قفز الأرنب مرتين للأمام قبل أن يستدير. فالقفزات الأمامية لم تُجمَع كـ3 فقط — بل جُمعت كـ3 مجموعات من قفزتين. يسمّي المبرمجون هذا «قراءة الشيفرة»: توقّع ما سيفعله البرنامج قبل تشغيله. إنها المهارة نفسها التي تستخدمها عند كتابة الحلقة، لكن باتجاه معاكس، وهي بالضبط كيف ستكتشف الأخطاء لاحقًا دون تشغيل ولو تجربة واحدة. العالمان 1 و2: اكتملا. مختبر الروبوتات ينتظرك.",
          },
          teacherNotes: {
            en: "The classic trap is counting loop ITERATIONS (3) instead of total statement executions (6) — if a student answers 3, ask them to physically act out one full lap of the loop and count their own hops, then do it three times. This level never runs on a grid; it's pure code reading, placed as the forest's closing checkpoint so the mental model ('a loop repeats a PATTERN, not a step') gets tested once more before Robot Lab raises the stakes. Challenge extension: ask students to write the equivalent program with plain Move/Turn blocks (no loop) and count the blocks — 9 total (6 moves + 3 turns) versus this program's 4 lines.",
          },
          difficulty: "EASY",
          recommendedGradeMin: 4,
          recommendedGradeMax: 7,
          estimatedMinutes: 4,
          xpReward: 35,
          tags: ["loops", "reading-code"],
          requires: [],
          hints: [
            {
              tier: 1,
              text: {
                en: "This loop's body isn't just one line — look carefully at everything between its curly braces { }.",
                ar: "جسم هذه الحلقة ليس سطرًا واحدًا — انظر بعناية إلى كل ما بين قوسيها { }.",
              },
            },
            {
              tier: 2,
              text: {
                en: "The loop header says `i < 3`, so the whole body runs 3 times. But how many `moveForward();` lines are INSIDE the body?",
                ar: "رأس الحلقة يقول `i < 3`، فالجسم كله يعمل 3 مرات. لكن كم سطر `moveForward();` موجود بداخل الجسم؟",
              },
            },
            {
              tier: 3,
              text: {
                en: "Two `moveForward();` calls sit inside the loop body. Each lap around the loop runs both of them — so one lap is 2 hops, not 1.",
                ar: "يوجد استدعاءان لـ`moveForward();` داخل جسم الحلقة. كل دورة حول الحلقة تُنفّذهما معًا — فالدورة الواحدة تعني قفزتين، لا قفزة واحدة.",
              },
            },
            {
              tier: 4,
              text: {
                en: "Two moveForward() calls happen inside the loop, and the loop runs 3 times (i < 3). Two hops, three times over — work out 2 × 3 to find the total hops.",
                ar: "يحدث استدعاءان لـ`moveForward()` داخل الحلقة، والحلقة تعمل 3 مرات (i < 3). قفزتان، ثلاث مرات — احسب 2 × 3 لتجد إجمالي القفزات.",
              },
            },
          ],
          payload: {
            code:
              "for (var i = 0; i < 3; i++) {\n" +
              "  moveForward();\n" +
              "  moveForward();\n" +
              "  turnRight();\n" +
              "}\n",
            prompt: {
              en: "How many times does this program call moveForward() in total?",
              ar: "كم مرة يستدعي هذا البرنامج الدالة moveForward() في المجموع؟",
            },
            options: [
              { id: "two", text: { en: "2 times", ar: "مرتين" } },
              { id: "three", text: { en: "3 times", ar: "3 مرات" } },
              { id: "six", text: { en: "6 times", ar: "6 مرات" } },
              { id: "nine", text: { en: "9 times", ar: "9 مرات" } },
            ],
            correctOptionId: "six",
            wrongFeedback: {
              en: "Count again: the loop's body has TWO moveForward() calls, and the whole body repeats 3 times — not just one hop per lap.",
              ar: "أعد العدّ: جسم الحلقة يحتوي على استدعاءين لـ moveForward()، والجسم كله يتكرر 3 مرات — وليس قفزة واحدة في كل دورة.",
            },
          } satisfies CodePredictionDraft,
        },
      ],
    },
  ],
};
