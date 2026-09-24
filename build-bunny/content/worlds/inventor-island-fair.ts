import type { z } from "zod";
import type { ModuleFixture, creativeProjectPayload } from "@/modules/curriculum/schemas";

/**
 * Inventor Island, module 2 — The Fair: build-your-own mazes
 * (CREATIVE_PROJECT, kind MAZE). The child designs the map, then programs
 * Robo Bunny through it. Each level's `sample` is the author's own design
 * and solution: the publish gates prove the toolbox can beat a design that
 * meets the level's rules, with three stars. Children never see it.
 */

type MazeDraft = z.input<typeof creativeProjectPayload>;

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

export const theFair: ModuleFixture = {
  slug: "the-fair",
  order: 2,
  name: { en: "The Fair", ar: "المعرض" },
  description: {
    en: "Design your own maze, then program Robo Bunny through it.",
    ar: "صمّم متاهتك بنفسك، ثم برمج الأرنب الآلي ليعبرها.",
  },
  levels: [
    // ── MY FIRST MAZE ────────────────────────────────────────────────────
    {
      slug: "my-first-maze",
      order: 1,
      activityType: "CREATIVE_PROJECT",
      track: "PROGRAMMING",
      title: { en: "My First Maze", ar: "متاهتي الأولى" },
      story: {
        en: "The Fair has an empty stall with your name on it. Grandma Clover drops off a box of rocks: 'Every inventor at the Fair shows a maze of their own. Build one, then prove Robo Bunny can get through it.'",
        ar: "في المعرض كشك فارغ يحمل اسمك. تضع الجدّة كلوفر صندوقًا من الصخور: «كل مخترع في المعرض يعرض متاهة من صنعه. ابنِ واحدة، ثم أثبت أن الأرنب الآلي يستطيع عبورها.»",
      },
      objective: {
        en: "Design a small grid maze that satisfies given constraints, then write a program that solves it — recognising that a puzzle's author must also be able to solve it.",
        ar: "صمّم متاهة شبكية صغيرة تحقق شروطًا معطاة، ثم اكتب برنامجًا يحلها — مدركًا أن مؤلف اللغز يجب أن يكون قادرًا على حله أيضًا.",
      },
      mission: {
        en: "Build a maze with at least two rocks, then program Robo Bunny to the burrow.",
        ar: "ابنِ متاهة فيها صخرتان على الأقل، ثم برمج الأرنب الآلي ليصل إلى الجحر.",
      },
      instructions: {
        en: "First, design: tap Rock, then tap the map to place rocks — at least two. Move the burrow or Robo Bunny if you like. When the checklist is all ticks, press Build my program and code the route through your own maze.",
        ar: "أولًا التصميم: انقر «صخرة» ثم انقر على الخريطة لوضع الصخور — صخرتان على الأقل. انقل الجحر أو الأرنب الآلي إن أحببت. عندما تكتمل قائمة الفحص، اضغط «ابنِ برنامجي» وبرمج الطريق عبر متاهتك.",
      },
      explanation: {
        en: "You just did both halves of a game maker's job: you designed the puzzle AND proved it can be solved. That second half matters — a maze nobody can finish is not a puzzle, it's a wall. The checklist checked that Robo Bunny could reach the burrow before you built a single block, the same way this game checks every level before a child sees it.",
        ar: "لقد أنجزت للتو نصفي عمل صانع الألعاب: صمّمت اللغز وأثبتّ أنه قابل للحل. النصف الثاني مهم — فالمتاهة التي لا يستطيع أحد إنهاءها ليست لغزًا بل جدار. قائمة الفحص تأكدت من أن الأرنب الآلي يستطيع الوصول إلى الجحر قبل أن تبني لبنة واحدة، تمامًا كما تفحص هذه اللعبة كل مستوى قبل أن يراه طفل.",
      },
      teacherNotes: {
        en: "The first creative level. The designer refuses unwinnable mazes (walled-off burrow) with a checklist rather than an error, so there is no stuck state. Ask students to trade mazes on paper and solve each other's; the three-star budget (6 blocks) rewards a loop for a long straight run.",
      },
      difficulty: "MEDIUM",
      recommendedGradeMin: 4,
      recommendedGradeMax: 7,
      estimatedMinutes: 8,
      xpReward: 45,
      tags: ["creative", "sequencing", "loops"],
      requires: [],
      hints: [
        {
          tier: 1,
          text: {
            en: "Design first, program second. Put your rocks somewhere that makes Robo Bunny turn at least once.",
            ar: "صمّم أولًا وبرمج ثانيًا. ضع صخورك في مكان يجعل الأرنب الآلي يستدير مرة واحدة على الأقل.",
          },
        },
        {
          tier: 2,
          text: {
            en: "In the checklist, a tick means done and a dot means still to do. The map must let Robo Bunny reach the burrow without stepping on a rock.",
            ar: "في قائمة الفحص، علامة الصح تعني تم والنقطة تعني ما زال مطلوبًا. يجب أن تسمح الخريطة للأرنب الآلي بالوصول إلى الجحر دون أن يدوس على صخرة.",
          },
        },
        {
          tier: 3,
          text: {
            en: "When you build, trace the route with your finger first: how many hops, then which turn, then how many hops. A Repeat block can say 'hop' several times at once.",
            ar: "عند البناء، تتبّع الطريق بإصبعك أولًا: كم قفزة، ثم أي استدارة، ثم كم قفزة. لبنة «كرّر» تقول «اقفز» عدة مرات دفعة واحدة.",
          },
        },
        {
          tier: 4,
          text: {
            en: "A simple maze: a rock next to Robo Bunny so it must go down first, then along the bottom row. Turn Right, Repeat (hops down), Turn Left, Repeat (hops along) — six blocks.",
            ar: "متاهة بسيطة: صخرة بجانب الأرنب الآلي ليضطر إلى النزول أولًا، ثم على طول الصف السفلي. استدر يمينًا، كرّر (قفزات للأسفل)، استدر يسارًا، كرّر (قفزات للأمام) — ست لبنات.",
          },
        },
      ],
      payload: {
        kind: "MAZE",
        board: { width: 5, height: 4 },
        palette: ["#"],
        mustInclude: { obstacles: 2, carrots: 0 },
        toolbox: [
          { type: "bb_moveForward" },
          { type: "bb_turnLeft" },
          { type: "bb_turnRight" },
          { type: "bb_repeat" },
        ],
        starCriteria: { threeStarMaxBlocks: 6 },
        startWorkspace,
        sample: {
          design: { rows: [".#...", "..#..", ".....", "....G"], start: { x: 0, y: 0, dir: "E" } },
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
                          type: "bb_repeat",
                          id: "r1",
                          fields: { TIMES: 3 },
                          inputs: { DO: { block: { type: "bb_moveForward", id: "m1" } } },
                          next: {
                            block: {
                              type: "bb_turnLeft",
                              id: "t2",
                              next: {
                                block: {
                                  type: "bb_repeat",
                                  id: "r2",
                                  fields: { TIMES: 4 },
                                  inputs: { DO: { block: { type: "bb_moveForward", id: "m2" } } },
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
        },
      } satisfies MazeDraft,
    },

    // ── CARROT MAZE ──────────────────────────────────────────────────────
    {
      slug: "carrot-maze",
      order: 2,
      activityType: "CREATIVE_PROJECT",
      track: "PROGRAMMING",
      title: { en: "Carrot Maze", ar: "متاهة الجزر" },
      story: {
        en: "Oona the Owl judges the Fair's mazes, and she has a rule: 'A good maze gives you a reason to wander.' She hands you water tiles and two carrots. Put them where the shortest path would rather not go.",
        ar: "أونا البومة تحكّم متاهات المعرض، ولها قاعدة: «المتاهة الجيدة تعطيك سببًا للتجوال.» تناولك مربعات ماء وجزرتين. ضعها حيث لا يودّ أقصر الطرق أن يمرّ.",
      },
      objective: {
        en: "Design a maze with mandatory collectables and multiple hazard types, then write a program that collects everything and reaches the goal — planning a route through several sub-goals.",
        ar: "صمّم متاهة تحتوي على عناصر إلزامية للجمع وأكثر من نوع من الأخطار، ثم اكتب برنامجًا يجمع كل شيء ويصل إلى الهدف — مخطّطًا مسارًا عبر عدة أهداف فرعية.",
      },
      mission: {
        en: "Design a maze with three obstacles and two carrots — then collect both on the way to the burrow.",
        ar: "صمّم متاهة فيها ثلاثة عوائق وجزرتان — ثم التقط الجزرتين في طريقك إلى الجحر.",
      },
      instructions: {
        en: "Rocks and water both block the way (water is fatal too!). Place at least three, and two carrots. The checklist makes sure every carrot can be reached. Then build a program that picks up both carrots before the burrow — carrots collect when Robo Bunny hops onto them.",
        ar: "الصخور والماء كلاهما يسدّ الطريق (والماء مميت أيضًا!). ضع ثلاثة على الأقل، وجزرتين. تتأكد قائمة الفحص من إمكانية الوصول إلى كل جزرة. ثم ابنِ برنامجًا يلتقط الجزرتين قبل الجحر — تُلتقط الجزرة عندما يقفز الأرنب الآلي عليها.",
      },
      explanation: {
        en: "A route with stops in it is a plan with sub-goals: carrot one, carrot two, then the burrow. Programmers break big journeys into legs like that all the time. If your program reached the burrow but missed a carrot, that's a partial win — the map was fine, the plan skipped a leg. Move the carrots onto the path, or change the path to visit them.",
        ar: "الطريق الذي فيه محطات هو خطة بأهداف فرعية: الجزرة الأولى، الجزرة الثانية، ثم الجحر. يقسّم المبرمجون الرحلات الكبيرة إلى مراحل هكذا طوال الوقت. إن وصل برنامجك إلى الجحر لكنه فاته جزرة فهذا فوز جزئي — الخريطة سليمة، لكن الخطة تخطّت مرحلة. انقل الجزر إلى المسار، أو غيّر المسار ليمرّ بها.",
      },
      teacherNotes: {
        en: "Reaching the burrow without both carrots is PARTIAL (1 star), which is the teaching moment: the program worked, the plan was incomplete. Water is fatal like rocks; the checklist treats both as obstacles. Seven-block budget rewards two Repeats.",
      },
      difficulty: "MEDIUM",
      recommendedGradeMin: 4,
      recommendedGradeMax: 7,
      estimatedMinutes: 10,
      xpReward: 50,
      tags: ["creative", "loops", "sequencing"],
      requires: [],
      hints: [
        {
          tier: 1,
          text: {
            en: "Place the carrots ON the route you plan to take, so collecting them costs no extra blocks.",
            ar: "ضع الجزر على الطريق الذي تنوي سلوكه، حتى لا يكلّفك التقاطها لبنات إضافية.",
          },
        },
        {
          tier: 2,
          text: {
            en: "Try a route with one turn: straight down one side, turn, straight along the bottom. Put one carrot on each straight part.",
            ar: "جرّب طريقًا باستدارة واحدة: نزولًا مستقيمًا على جانب، استدارة، ثم مستقيمًا على طول الأسفل. ضع جزرة على كل جزء مستقيم.",
          },
        },
        {
          tier: 3,
          text: {
            en: "Two Repeat blocks — one for the hops down, one for the hops along — with a turn in between. Count the tiles for each Repeat.",
            ar: "لبنتا «كرّر» — واحدة لقفزات النزول وأخرى لقفزات التقدم — وبينهما استدارة. عُدّ المربعات لكل «كرّر».",
          },
        },
        {
          tier: 4,
          text: {
            en: "Point Robo Bunny down at the start. Repeat 4: Move Forward. Turn Left. Repeat 5: Move Forward. Put a carrot on the left column and one on the bottom row, and the burrow in the bottom-right corner.",
            ar: "وجّه الأرنب الآلي للأسفل في البداية. كرّر 4: تقدّم للأمام. استدر يسارًا. كرّر 5: تقدّم للأمام. ضع جزرة في العمود الأيسر وأخرى في الصف السفلي، والجحر في الزاوية السفلية اليمنى.",
          },
        },
      ],
      payload: {
        kind: "MAZE",
        board: { width: 6, height: 5 },
        palette: ["#", "W", "C"],
        mustInclude: { obstacles: 3, carrots: 2 },
        toolbox: [
          { type: "bb_moveForward" },
          { type: "bb_turnLeft" },
          { type: "bb_turnRight" },
          { type: "bb_repeat" },
        ],
        starCriteria: { threeStarMaxBlocks: 7 },
        startWorkspace,
        sample: {
          design: {
            rows: [".#....", ".#.#..", "C..#..", ".W.#..", "....CG"],
            start: { x: 0, y: 0, dir: "S" },
          },
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
                      inputs: { DO: { block: { type: "bb_moveForward", id: "m1" } } },
                      next: {
                        block: {
                          type: "bb_turnLeft",
                          id: "t1",
                          next: {
                            block: {
                              type: "bb_repeat",
                              id: "r2",
                              fields: { TIMES: 5 },
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
        },
      } satisfies MazeDraft,
    },

    // ── THE FAIR MAZE ────────────────────────────────────────────────────
    {
      slug: "the-fair-maze",
      order: 3,
      activityType: "CREATIVE_PROJECT",
      track: "PROGRAMMING",
      title: { en: "The Fair Maze", ar: "متاهة المعرض" },
      story: {
        en: "Judging day. Every friend is at your stall — Pip with his notebook, Coco squawking, Fenn sniffing the carrots, Nova timing it, Mayor Mo tapping his watch. Your biggest maze yet, and Robo Bunny has one new trick to help.",
        ar: "يوم التحكيم. كل الأصدقاء عند كشكك — بيب بدفتره، وكوكو يصيح، وفِنّ يشمّ الجزر، ونوفا تحسب الوقت، والعمدة مو ينقر على ساعته. أكبر متاهة لك حتى الآن، ومع الأرنب الآلي حيلة جديدة واحدة للمساعدة.",
      },
      objective: {
        en: "Design a large maze with a repeating structure and solve it with a user-defined procedure ('my trick') called from a loop — applying abstraction to the child's own problem.",
        ar: "صمّم متاهة كبيرة ذات بنية متكررة وحلّها بإجراء يعرّفه المستخدم («حيلتي») يُستدعى من داخل حلقة — مطبّقًا التجريد على مسألة الطفل نفسه.",
      },
      mission: {
        en: "Build a big maze: four obstacles, three carrots. Then teach Robo Bunny a trick to get through.",
        ar: "ابنِ متاهة كبيرة: أربعة عوائق وثلاث جزرات. ثم علّم الأرنب الآلي حيلة يعبر بها.",
      },
      instructions: {
        en: "A staircase maze is a good idea: hop, turn, hop, turn, over and over. Design one, then teach the repeating part as 'my trick' and call it from a Repeat. Ten blocks is the three-star line — a trick makes that easy.",
        ar: "متاهة على شكل درج فكرة جيدة: اقفز، استدر، اقفز، استدر، مرارًا. صمّمها، ثم علّم الجزء المتكرر بوصفه «حيلتي» واستدعِه من «كرّر». عشر لبنات هي حدّ النجوم الثلاث — والحيلة تجعل ذلك سهلًا.",
      },
      explanation: {
        en: "You used every Power at once: a sequence inside a trick, the trick inside a loop, and a maze of your own to run it on. 'My trick' is what programmers call a function — a name for a bunch of steps, so you can say the name instead of the steps. The whole Fair could hear the crowd. The Invention Power was already yours; today you showed it.",
        ar: "استخدمت كل القوى دفعة واحدة: تسلسل داخل حيلة، والحيلة داخل حلقة، ومتاهة من صنعك لتشغيلها. «حيلتي» هي ما يسميه المبرمجون دالّة — اسم لمجموعة خطوات، فتقول الاسم بدلًا من الخطوات. سمع المعرض كله الجمهور. كانت قوة الاختراع لك من قبل؛ واليوم أظهرتها.",
      },
      teacherNotes: {
        en: "Capstone. 'my trick' (bb_defineTrick, limit 1) is a top-level block like 'when start'; its body runs only where 'do my trick' is placed. A staircase design + trick(hop, turn right, hop, turn left) + Repeat 5 + one hop is 8 blocks. Students who solve it without the trick can still pass with 2 stars if over ten blocks — ask what repeats.",
      },
      difficulty: "HARD",
      recommendedGradeMin: 5,
      recommendedGradeMax: 7,
      estimatedMinutes: 12,
      xpReward: 60,
      tags: ["creative", "functions", "loops"],
      requires: [],
      hints: [
        {
          tier: 1,
          text: {
            en: "Design a maze whose path repeats a shape — like stairs going down and right. Repeating shapes are what tricks are for.",
            ar: "صمّم متاهة يكرر مسارها شكلًا — كدرج ينزل نحو اليمين. الأشكال المتكررة هي ما صُنعت الحيل من أجله.",
          },
        },
        {
          tier: 2,
          text: {
            en: "'My trick' is a separate block, not attached under 'when start'. Put the repeating steps inside it, then place 'do my trick' under 'when start'.",
            ar: "«حيلتي» لبنة منفصلة، لا تُثبَّت تحت «عند البدء». ضع الخطوات المتكررة بداخلها، ثم ضع «نفّذ حيلتي» تحت «عند البدء».",
          },
        },
        {
          tier: 3,
          text: {
            en: "One stair step is: hop, turn right, hop, turn left. Teach that as the trick, then Repeat: do my trick — once per step.",
            ar: "درجة واحدة من الدرج هي: اقفز، استدر يمينًا، اقفز، استدر يسارًا. علّم ذلك بوصفه الحيلة، ثم كرّر: نفّذ حيلتي — مرة لكل درجة.",
          },
        },
        {
          tier: 4,
          text: {
            en: "Staircase from the top-left to the bottom-right: five steps then one last hop. My trick: Move, Turn Right, Move, Turn Left. Program: Repeat 5 (do my trick), Move Forward. Put the carrots on the stairs and the burrow at the end.",
            ar: "درج من الزاوية العلوية اليسرى إلى السفلية اليمنى: خمس درجات ثم قفزة أخيرة. حيلتي: تقدّم، استدر يمينًا، تقدّم، استدر يسارًا. البرنامج: كرّر 5 (نفّذ حيلتي)، تقدّم للأمام. ضع الجزر على الدرج والجحر في النهاية.",
          },
        },
      ],
      payload: {
        kind: "MAZE",
        board: { width: 7, height: 6 },
        palette: ["#", "W", "C"],
        mustInclude: { obstacles: 4, carrots: 3 },
        toolbox: [
          { type: "bb_moveForward" },
          { type: "bb_turnLeft" },
          { type: "bb_turnRight" },
          { type: "bb_repeat" },
          { type: "bb_defineTrick", limit: 1 },
          { type: "bb_doTrick" },
        ],
        starCriteria: { threeStarMaxBlocks: 10 },
        startWorkspace,
        sample: {
          design: {
            rows: ["..#....", "#C.#...", ".#..#..", "..#C.#.", "...#..#", "....#CG"],
            start: { x: 0, y: 0, dir: "E" },
          },
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
                      fields: { TIMES: 5 },
                      inputs: { DO: { block: { type: "bb_doTrick", id: "d1" } } },
                      next: { block: { type: "bb_moveForward", id: "m9" } },
                    },
                  },
                },
                {
                  type: "bb_defineTrick",
                  id: "def1",
                  x: 320,
                  y: 24,
                  inputs: {
                    DO: {
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
                                next: { block: { type: "bb_turnLeft", id: "t2" } },
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
        },
      } satisfies MazeDraft,
    },
  ],
};
