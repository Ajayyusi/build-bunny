import type { z } from "zod";
import type {
  WorldFixture,
  blockCodingPayload,
  codePredictionPayload,
  debuggingPayload,
  sequencingPayload,
} from "@/modules/curriculum/schemas";
import { cityWorkshop } from "./more-city-and-fair";
import { countersAndTricks } from "./code-city-counters";

/**
 * World 7 — Code City: where blocks turn into real code (STORY.md §7).
 *
 * The world's idea is READING code: every block the child has used has
 * been JavaScript underneath (the Code tab shows it), and a program can be
 * understood — and fixed — before it runs. So the levels are weighted
 * toward CODE_PREDICTION and DEBUGGING, with grid deliveries that ask the
 * child to check the Code view, and a closing SEQUENCING routine.
 *
 * Deliveries in the city are carrot crates for the market: the engine's
 * collectable is the same carrot the meadow taught, drawn the same way, so
 * nothing here depends on a glyph the engine does not have.
 */

type BlockCodingDraft = z.input<typeof blockCodingPayload>;
type CodePredictionDraft = z.input<typeof codePredictionPayload>;
type DebuggingDraft = z.input<typeof debuggingPayload>;
type SequencingDraft = z.input<typeof sequencingPayload>;

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

export const codeCity: WorldFixture = {
  slug: "code-city",
  name: { en: "Code City", ar: "مدينة الشيفرة" },
  tagline: {
    en: "Where blocks turn into real code.",
    ar: "حيث تتحول اللبنات إلى شيفرة حقيقية.",
  },
  theme: "city",
  horizon: false,
  story: {
    beats: [
      {
        pose: "pointing",
        text: {
          en: "Welcome to Code City! Mayor Mo runs everything by the clock, and the delivery bots read their orders as real code.",
          ar: "أهلًا بك في مدينة الشيفرة! العمدة مو يدير كل شيء بالساعة، وروبوتات التوصيل تقرأ أوامرها شيفرة حقيقية.",
        },
      },
      {
        pose: "thinking",
        text: {
          en: "Every block I've ever used was code underneath. If I can read it, I can spot what a program will do before it runs — and fix the ones that go wrong.",
          ar: "كل لبنة استخدمتها يومًا كانت شيفرة في داخلها. إن استطعت قراءتها، فسأعرف ما سيفعله البرنامج قبل تشغيله — وسأصلح ما يتعطّل منها.",
        },
      },
      {
        pose: "excited",
        text: {
          en: "Read first, then run. Let's keep the city moving!",
          ar: "اقرأ أولًا، ثم شغّل. لنُبقِ المدينة متحرّكة!",
        },
      },
    ],
  },
  character: {
    name: { en: "Mayor Mo", ar: "العمدة مو" },
    role: { en: "A pigeon who runs the city by the clock", ar: "حمامة تدير المدينة بالساعة" },
    glyph: "🐦",
  },
  power: {
    name: { en: "Code-Reading Power", ar: "قوة قراءة الشيفرة" },
    idea: {
      en: "Blocks are code — and code can be read before it runs.",
      ar: "اللبنات شيفرة — والشيفرة تُقرأ قبل أن تُشغَّل.",
    },
    glyph: "📖",
  },
  modules: [
    {
      slug: "signs-and-signals",
      order: 1,
      name: { en: "Signs and Signals", ar: "اللافتات والإشارات" },
      description: {
        en: "Read what a program will do before it runs.",
        ar: "اقرأ ما سيفعله البرنامج قبل تشغيله.",
      },
      levels: [
        // ── READ THE SIGN — CODE_PREDICTION ──────────────────────────────
        {
          slug: "read-the-sign",
          order: 1,
          activityType: "CODE_PREDICTION",
          track: "PROGRAMMING",
          title: { en: "Read the Sign", ar: "اقرأ اللافتة" },
          story: {
            en: "A delivery bot waits at the depot with its orders pinned to its chest — not blocks this time, but the code underneath them. Mayor Mo taps his watch: 'Tell me where it ends up before it moves. That's how we do things here.'",
            ar: "روبوت توصيل ينتظر عند المستودع وأوامره مثبّتة على صدره — ليست لبنات هذه المرة، بل الشيفرة التي تحتها. ينقر العمدة مو على ساعته: «أخبرني أين سينتهي قبل أن يتحرك. هكذا نفعل الأشياء هنا.»",
          },
          objective: {
            en: "Trace a straight-line program of moves and one turn, tracking both the bot's heading and its distance travelled.",
            ar: "تتبّع برنامجًا خطيًا من حركات واستدارة واحدة، مع متابعة اتجاه الروبوت والمسافة التي قطعها.",
          },
          mission: {
            en: "Read the bot's code and work out where it ends up.",
            ar: "اقرأ شيفرة الروبوت واكتشف أين سينتهي.",
          },
          instructions: {
            en: "The bot starts facing East (→). Read the program line by line. Count every moveForward(), and remember that a turn changes where the bot faces without moving it.",
            ar: "يبدأ الروبوت متجهًا شرقًا (→). اقرأ البرنامج سطرًا سطرًا. عُدّ كل moveForward()، وتذكّر أن الاستدارة تغيّر اتجاه الروبوت دون أن تحرّكه.",
          },
          explanation: {
            en: "You just read code the way a programmer does: one line at a time, keeping track of two things — which way the bot faces and how far it has gone. Three moveForward() lines are three tiles; the turnRight() in between changed East into South but added no distance. Every block you have ever dragged looks like this underneath. Press the Code tab in any level to see it.",
            ar: "لقد قرأت الشيفرة كما يقرؤها المبرمج: سطرًا واحدًا في كل مرة، مع متابعة أمرين — الاتجاه الذي يواجهه الروبوت والمسافة التي قطعها. ثلاثة أسطر moveForward() تعني ثلاثة مربعات؛ أما turnRight() في المنتصف فحوّلت الشرق إلى جنوب دون أن تضيف أي مسافة. كل لبنة سحبتها يومًا تبدو هكذا في الداخل. اضغط تبويب «الكود» في أي مستوى لتراها.",
          },
          teacherNotes: {
            en: "First code-reading level with no grid. The common slip is treating turnRight() as a move (answering 4 tiles) or forgetting the heading change (answering East). Have students act it out on the floor: two steps, quarter turn to the right, one step.",
            ar: "أول مستوى لقراءة الشيفرة بلا شبكة. الخطأ الشائع هو اعتبار turnRight() حركة (فتكون الإجابة 4 مربعات) أو نسيان تغيّر الاتجاه (فتكون الإجابة الشرق). اطلب من الطلاب تمثيلها على الأرض: خطوتان، ثم ربع دورة إلى اليمين، ثم خطوة واحدة.",
          },
          difficulty: "EASY",
          recommendedGradeMin: 4,
          recommendedGradeMax: 7,
          estimatedMinutes: 4,
          xpReward: 30,
          tags: ["reading-code", "sequencing"],
          requires: [],
          hints: [
            {
              tier: 1,
              text: {
                en: "Read the four lines from top to bottom. Which lines move the bot, and which one only turns it?",
                ar: "اقرأ الأسطر الأربعة من الأعلى إلى الأسفل. أي الأسطر تحرّك الروبوت، وأيها يستديره فقط؟",
              },
            },
            {
              tier: 2,
              text: {
                en: "moveForward() appears three times. That is three tiles in total, no matter which way the bot faces.",
                ar: "تظهر moveForward() ثلاث مرات. أي ثلاثة مربعات في المجموع، أيًّا كان اتجاه الروبوت.",
              },
            },
            {
              tier: 3,
              text: {
                en: "The bot starts facing East. turnRight() turns it a quarter turn clockwise — from East to South.",
                ar: "يبدأ الروبوت متجهًا شرقًا. turnRight() تديره ربع دورة باتجاه عقارب الساعة — من الشرق إلى الجنوب.",
              },
            },
            {
              tier: 4,
              text: {
                en: "Two moves East, a right turn to face South, one move South: facing South, three tiles moved.",
                ar: "حركتان شرقًا، استدارة يمينًا ليواجه الجنوب، حركة واحدة جنوبًا: يواجه الجنوب، وتحرّك ثلاثة مربعات.",
              },
            },
          ],
          payload: {
            code: "moveForward();\nmoveForward();\nturnRight();\nmoveForward();\n",
            language: "javascript",
            prompt: {
              en: "The bot starts facing East (→). After this program runs, which way is it facing, and how many tiles has it moved in total?",
              ar: "يبدأ الروبوت متجهًا شرقًا (→). بعد تشغيل هذا البرنامج، أي اتجاه يواجه، وكم مربعًا تحرّك في المجموع؟",
            },
            options: [
              { id: "south3", text: { en: "Facing South, 3 tiles", ar: "يواجه الجنوب، 3 مربعات" } },
              { id: "east3", text: { en: "Facing East, 3 tiles", ar: "يواجه الشرق، 3 مربعات" } },
              { id: "south2", text: { en: "Facing South, 2 tiles", ar: "يواجه الجنوب، مربعان" } },
              { id: "north3", text: { en: "Facing North, 3 tiles", ar: "يواجه الشمال، 3 مربعات" } },
            ],
            correctOptionId: "south3",
            wrongFeedback: {
              en: "Count every moveForward() — there are three — and remember turnRight() only turns the bot; it never moves it.",
              ar: "عُدّ كل moveForward() — هناك ثلاثة — وتذكّر أن turnRight() تدير الروبوت فقط؛ ولا تحرّكه أبدًا.",
            },
          } satisfies CodePredictionDraft,
        },

        // ── MARKET RUN — BLOCK_CODING with the Code tab in mind ───────────
        {
          slug: "market-run",
          order: 2,
          activityType: "BLOCK_CODING",
          track: "PROGRAMMING",
          title: { en: "Market Run", ar: "رحلة السوق" },
          story: {
            en: "The market on Second Street is waiting for its carrot crates. A wall of parked bots blocks the straight road, so the delivery has to go around. Mayor Mo wants the route AND the code it turns into.",
            ar: "السوق في الشارع الثاني ينتظر صناديق الجزر. صفٌّ من الروبوتات المتوقفة يسدّ الطريق المستقيم، فلا بد أن يلتفّ التوصيل حوله. يريد العمدة مو المسار والشيفرة التي يتحول إليها.",
          },
          objective: {
            en: "Plan a route around an obstacle wall, then open the Code view and relate each block to the line of JavaScript it generated.",
            ar: "خطّط مسارًا حول جدار عائق، ثم افتح عرض الكود واربط كل لبنة بسطر الجافاسكريبت الذي ولّدته.",
          },
          mission: {
            en: "Deliver to the market around the parked bots — then peek at your program as code.",
            ar: "وصّل إلى السوق حول الروبوتات المتوقفة — ثم ألقِ نظرة على برنامجك كشيفرة.",
          },
          instructions: {
            en: "Hop along the top road, turn at the corner and come down to the market. When it works, press the Code tab: every block you used is there as a line of code.",
            ar: "اقفز على الطريق العلوي، واستدر عند الزاوية، وانزل إلى السوق. عندما ينجح الأمر، اضغط تبويب «الكود»: كل لبنة استخدمتها موجودة هناك سطرًا من الشيفرة.",
          },
          explanation: {
            en: "Did you look at the Code tab? Your blocks and that code are the same program written two ways. moveForward(); is one hop, turnRight(); is one turn, and if you used Repeat, it became a for loop with the count inside its brackets. Programmers read and write the text version every day; you have been writing it all along, one block at a time.",
            ar: "هل نظرت إلى تبويب «الكود»؟ لبناتك وتلك الشيفرة هما البرنامج نفسه مكتوبًا بطريقتين. moveForward(); قفزة واحدة، وturnRight(); استدارة واحدة، وإن استخدمت «كرّر» فقد تحوّلت إلى حلقة for بالعدد داخل قوسيها. المبرمجون يقرؤون النسخة النصية ويكتبونها كل يوم؛ وأنت تكتبها منذ البداية، لبنة تلو الأخرى.",
          },
          teacherNotes: {
            en: "The route is easy on purpose (three hops, a turn, two hops); the lesson is the Code tab. Ask students to predict the code BEFORE opening the tab, then compare. Students who use Repeat see a for loop — a good moment to connect to Loop Detective.",
            ar: "المسار سهل عن قصد (ثلاث قفزات، ثم استدارة، ثم قفزتان)؛ أما الدرس فهو تبويب «الكود». اطلب من الطلاب توقّع الشيفرة قبل فتح التبويب، ثم المقارنة. الطلاب الذين يستخدمون «كرّر» يرون حلقة for — وهي لحظة مناسبة للربط بمستوى «محقق الحلقات».",
          },
          difficulty: "EASY",
          recommendedGradeMin: 4,
          recommendedGradeMax: 7,
          estimatedMinutes: 5,
          xpReward: 30,
          tags: ["sequencing", "reading-code"],
          requires: [],
          hints: [
            {
              tier: 1,
              text: {
                en: "The parked bots block the middle row. Which road is open — the top one or the bottom one?",
                ar: "الروبوتات المتوقفة تسدّ الصف الأوسط. أي طريق مفتوح — العلوي أم السفلي؟",
              },
            },
            {
              tier: 2,
              text: {
                en: "Hop along the top road all the way to the corner above the market before you turn.",
                ar: "اقفز على الطريق العلوي حتى الزاوية التي فوق السوق قبل أن تستدير.",
              },
            },
            {
              tier: 3,
              text: {
                en: "At the corner the bot faces East. A Turn Right makes it face South, straight down toward the market.",
                ar: "عند الزاوية يواجه الروبوت الشرق. الاستدارة يمينًا تجعله يواجه الجنوب، نزولًا مباشرة نحو السوق.",
              },
            },
            {
              tier: 4,
              text: {
                en: "Move Forward three times, Turn Right, Move Forward twice. Then open the Code tab and count the lines.",
                ar: "تقدّم للأمام ثلاث مرات، استدر يمينًا، ثم تقدّم للأمام مرتين. بعدها افتح تبويب «الكود» وعُدّ الأسطر.",
              },
            },
          ],
          payload: {
            toolbox: [
              { type: "bb_moveForward" },
              { type: "bb_turnRight" },
              { type: "bb_turnLeft" },
              { type: "bb_repeat" },
            ],
            variants: [
              {
                rows: ["....", "###.", "...G"],
                start: { x: 0, y: 0, dir: "E" },
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
                            type: "bb_moveForward",
                            id: "m2",
                            next: {
                              block: {
                                type: "bb_moveForward",
                                id: "m3",
                                next: {
                                  block: {
                                    type: "bb_turnRight",
                                    id: "t1",
                                    next: {
                                      block: {
                                        type: "bb_moveForward",
                                        id: "m4",
                                        next: {
                                          block: { type: "bb_moveForward", id: "m5" },
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

        // ── LOOP SIGNS — CODE_PREDICTION ──────────────────────────────────
        {
          slug: "loop-signs",
          order: 3,
          activityType: "CODE_PREDICTION",
          track: "PROGRAMMING",
          title: { en: "Loop Signs", ar: "لافتات الحلقات" },
          story: {
            en: "The long avenue has one sign for the whole road: a loop. Bots that read it wrong end up in the fountain. Mayor Mo would rather you read it right.",
            ar: "الشارع الطويل له لافتة واحدة للطريق كله: حلقة. الروبوتات التي تقرؤها خطأ تنتهي في النافورة. يفضّل العمدة مو أن تقرأها أنت بشكل صحيح.",
          },
          objective: {
            en: "Read a for loop with a single-statement body followed by more statements, and total the movement inside and outside the loop.",
            ar: "اقرأ حلقة for بجسم من تعليمة واحدة تليها تعليمات أخرى، واجمع الحركة داخل الحلقة وخارجها.",
          },
          mission: {
            en: "Work out how far the bot goes before the turn — and in total.",
            ar: "احسب كم يقطع الروبوت قبل الاستدارة — وفي المجموع.",
          },
          instructions: {
            en: "The loop header says how many times its body runs. Add up the hops inside the loop first, then read what comes after it.",
            ar: "رأس الحلقة يقول كم مرة يعمل جسمها. اجمع القفزات داخل الحلقة أولًا، ثم اقرأ ما يأتي بعدها.",
          },
          explanation: {
            en: "for (var i = 0; i < 4; i++) runs its body four times, so four hops happen before the loop ends. Then the program keeps going: a turn, and one more hop. Reading a loop means two questions — what is inside, and how many times — and then remembering that the program continues after the closing bracket.",
            ar: "for (var i = 0; i < 4; i++) تشغّل جسمها أربع مرات، فتحدث أربع قفزات قبل انتهاء الحلقة. ثم يواصل البرنامج: استدارة، وقفزة واحدة أخرى. قراءة الحلقة تعني سؤالين — ما بداخلها، وكم مرة — ثم تذكّر أن البرنامج يستمر بعد القوس الختامي.",
          },
          teacherNotes: {
            en: "Builds on Loop Detective (Logic Forest). The new element is code AFTER the loop: students who answer '4 in total' stopped reading at the closing bracket. Pair with Read the Sign for a two-level 'read before you run' routine.",
            ar: "يبني على «محقق الحلقات» (غابة المنطق). العنصر الجديد هو الشيفرة التي تأتي بعد الحلقة: الطلاب الذين يجيبون «4 في المجموع» توقفوا عن القراءة عند القوس الختامي. اقرنه بمستوى «اقرأ اللافتة» لتكوين روتين من مستويين عنوانه «اقرأ قبل أن تشغّل».",
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
                en: "How many times does the loop run? Look at the number in the header: i < 4.",
                ar: "كم مرة تعمل الحلقة؟ انظر إلى الرقم في الرأس: i < 4.",
              },
            },
            {
              tier: 2,
              text: {
                en: "There is exactly one moveForward() inside the loop. Four times around means four hops.",
                ar: "هناك moveForward() واحدة بالضبط داخل الحلقة. أربع دورات تعني أربع قفزات.",
              },
            },
            {
              tier: 3,
              text: {
                en: "The program does not stop at the closing bracket. What are the two lines after it?",
                ar: "لا يتوقف البرنامج عند القوس الختامي. ما هما السطران بعده؟",
              },
            },
            {
              tier: 4,
              text: {
                en: "Four hops in the loop, then a left turn, then one more hop: 4 before the turn, 5 in total.",
                ar: "أربع قفزات في الحلقة، ثم استدارة يسارًا، ثم قفزة أخرى: 4 قبل الاستدارة، و5 في المجموع.",
              },
            },
          ],
          payload: {
            code: "for (var i = 0; i < 4; i++) {\n  moveForward();\n}\nturnLeft();\nmoveForward();\n",
            language: "javascript",
            prompt: {
              en: "How many tiles does the bot travel before it turns, and how many tiles in total?",
              ar: "كم مربعًا يقطع الروبوت قبل أن يستدير، وكم مربعًا في المجموع؟",
            },
            options: [
              { id: "b4t5", text: { en: "4 before the turn, 5 in total", ar: "4 قبل الاستدارة، 5 في المجموع" } },
              { id: "b1t2", text: { en: "1 before the turn, 2 in total", ar: "1 قبل الاستدارة، 2 في المجموع" } },
              { id: "b4t4", text: { en: "4 before the turn, 4 in total", ar: "4 قبل الاستدارة، 4 في المجموع" } },
              { id: "b5t6", text: { en: "5 before the turn, 6 in total", ar: "5 قبل الاستدارة، 6 في المجموع" } },
            ],
            correctOptionId: "b4t5",
            wrongFeedback: {
              en: "The loop body runs 4 times — that is 4 hops. Then the program continues: a turn and ONE more hop.",
              ar: "جسم الحلقة يعمل 4 مرات — أي 4 قفزات. ثم يواصل البرنامج: استدارة وقفزة واحدة أخرى.",
            },
          } satisfies CodePredictionDraft,
        },

        // ── CROSSING CHECK — CODE_PREDICTION with a sensor ────────────────
        {
          slug: "crossing-check",
          order: 4,
          activityType: "CODE_PREDICTION",
          track: "PROGRAMMING",
          title: { en: "Crossing Check", ar: "فحص المعبر" },
          story: {
            en: "At the big crossing a crate has fallen off a lorry. The bots there carry a sensor and a rule with an if in it. Mayor Mo: 'Don't guess. Read the rule, then tell me what the bot will do.'",
            ar: "عند المعبر الكبير سقط صندوق من شاحنة. الروبوتات هناك تحمل مستشعرًا وقاعدة فيها «إذا». العمدة مو: «لا تخمّن. اقرأ القاعدة، ثم أخبرني ماذا سيفعل الروبوت.»",
          },
          objective: {
            en: "Read an if statement whose condition is a negated sensor call, decide whether its body runs in the given situation, and continue past it.",
            ar: "اقرأ جملة «إذا» شرطها استدعاء مستشعر منفيّ، وقرّر هل يعمل جسمها في الحالة المعطاة، ثم تابع ما بعدها.",
          },
          mission: {
            en: "A crate is in the way. Read the if and say what the bot does next.",
            ar: "صندوق في الطريق. اقرأ «إذا» وقل ماذا يفعل الروبوت بعد ذلك.",
          },
          instructions: {
            en: "pathAhead() answers 'is the way ahead clear?'. The ! in front of it flips the answer, so if (!pathAhead()) means 'if the way is blocked'. Decide whether the body runs, then read the line after the if.",
            ar: "pathAhead() تجيب عن «هل الطريق أمامي مفتوح؟». علامة ! قبلها تقلب الإجابة، فـif (!pathAhead()) تعني «إذا كان الطريق مسدودًا». قرّر هل يعمل الجسم، ثم اقرأ السطر الذي يلي «إذا».",
          },
          explanation: {
            en: "The crate makes pathAhead() false, so !pathAhead() is true and the body runs: the bot turns left. Then the line after the if runs whatever happened — one hop, now along the clear road. An if only decides whether its own body runs; everything below it runs as normal. That is exactly the 'path ahead is blocked' block from Logic Forest, seen as code.",
            ar: "الصندوق يجعل pathAhead() خاطئة، فتصبح !pathAhead() صحيحة ويعمل الجسم: يستدير الروبوت يسارًا. ثم يعمل السطر الذي يلي «إذا» مهما حدث — قفزة واحدة، الآن على الطريق المفتوح. جملة «إذا» تقرّر فقط هل يعمل جسمها؛ وكل ما تحتها يعمل كالمعتاد. هذه بالضبط لبنة «الطريق أمامي مسدود» من غابة المنطق، مرئية كشيفرة.",
          },
          teacherNotes: {
            en: "Two common misreadings: ignoring the ! (so the turn 'doesn't happen'), and thinking the program stops after an if (missing the final hop). The code shown is the exact text the Code tab produces for the 'path ahead is blocked' block, so students can verify it themselves in Choose the Path.",
            ar: "قراءتان خاطئتان شائعتان: تجاهل علامة ! (فتبدو الاستدارة كأنها «لا تحدث»)، والظن بأن البرنامج يتوقف بعد «إذا» (فتُفقد القفزة الأخيرة). الشيفرة المعروضة هي النص نفسه تمامًا الذي يُنتجه تبويب «الكود» للبنة «الطريق أمامي مسدود»، لذا يستطيع الطلاب التحقق منها بأنفسهم في مستوى «اختر الطريق».",
          },
          difficulty: "MEDIUM",
          recommendedGradeMin: 5,
          recommendedGradeMax: 7,
          estimatedMinutes: 5,
          xpReward: 45,
          tags: ["logic", "reading-code"],
          requires: [],
          hints: [
            {
              tier: 1,
              text: {
                en: "Start with the sensor: is the way ahead clear after the first hop? The story says a crate is there.",
                ar: "ابدأ بالمستشعر: هل الطريق مفتوح بعد القفزة الأولى؟ تقول القصة إن هناك صندوقًا.",
              },
            },
            {
              tier: 2,
              text: {
                en: "The ! flips the answer. Blocked means pathAhead() is false, so !pathAhead() is true.",
                ar: "علامة ! تقلب الإجابة. مسدود يعني أن pathAhead() خاطئة، إذًا !pathAhead() صحيحة.",
              },
            },
            {
              tier: 3,
              text: {
                en: "A true condition runs the body: turnLeft(). Now keep reading — there is a line after the closing bracket.",
                ar: "الشرط الصحيح يشغّل الجسم: turnLeft(). الآن تابع القراءة — هناك سطر بعد القوس الختامي.",
              },
            },
            {
              tier: 4,
              text: {
                en: "Hop, find the crate, turn left because the way is blocked, then hop once more along the open road.",
                ar: "اقفز، واجد الصندوق، واستدر يسارًا لأن الطريق مسدود، ثم اقفز مرة أخرى على الطريق المفتوح.",
              },
            },
          ],
          payload: {
            code: "moveForward();\nif (!pathAhead()) {\n  turnLeft();\n}\nmoveForward();\n",
            language: "javascript",
            prompt: {
              en: "After the first hop, a crate blocks the tile in front of the bot. What does the bot do next?",
              ar: "بعد القفزة الأولى، يسدّ صندوق المربع الذي أمام الروبوت. ماذا يفعل الروبوت بعد ذلك؟",
            },
            options: [
              { id: "turn-hop", text: { en: "Turns left, then hops one tile", ar: "يستدير يسارًا، ثم يقفز مربعًا واحدًا" } },
              { id: "bump", text: { en: "Hops into the crate and stops", ar: "يقفز في الصندوق ويتوقف" } },
              { id: "turn-stop", text: { en: "Turns left and stops there", ar: "يستدير يسارًا ويتوقف هناك" } },
              { id: "hop-turn", text: { en: "Hops one tile, then turns left", ar: "يقفز مربعًا واحدًا، ثم يستدير يسارًا" } },
            ],
            correctOptionId: "turn-hop",
            wrongFeedback: {
              en: "if (!pathAhead()) means 'if the way is NOT clear'. The crate makes that true, so the turn happens — and the moveForward() after the if runs whatever happened.",
              ar: "if (!pathAhead()) تعني «إذا كان الطريق غير مفتوح». الصندوق يجعل ذلك صحيحًا، فتحدث الاستدارة — وتعمل moveForward() التي بعد «إذا» مهما حدث.",
            },
          } satisfies CodePredictionDraft,
        },
      ],
    },
    {
      slug: "bug-bounty",
      order: 2,
      name: { en: "Bug Bounty", ar: "مكافأة الأخطاء" },
      description: {
        en: "Find the mistake by reading, then prove it by running.",
        ar: "اعثر على الخطأ بالقراءة، ثم أثبته بالتشغيل.",
      },
      levels: [
        // ── WRONG-WAY BOT — DEBUGGING, one bug ────────────────────────────
        {
          slug: "wrong-way-bot",
          order: 1,
          activityType: "DEBUGGING",
          track: "PROGRAMMING",
          title: { en: "Wrong-Way Bot", ar: "الروبوت المعاكس" },
          story: {
            en: "A bot keeps leaving Second Street the wrong way and disappearing off the map. Its program is already loaded. One line is wrong. Mayor Mo has put up a reward: find it by reading first.",
            ar: "روبوت يواصل مغادرة الشارع الثاني في الاتجاه الخاطئ ويختفي عن الخريطة. برنامجه محمَّل بالفعل. سطر واحد خاطئ. وضع العمدة مو مكافأة: اعثر عليه بالقراءة أولًا.",
          },
          objective: {
            en: "Locate a single wrong-turn bug by tracing the program against the map, confirm it with a run and the located failure message, and fix it.",
            ar: "حدّد خطأ استدارة واحدًا بتتبّع البرنامج على الخريطة، وأكّده بالتشغيل ورسالة الفشل المحدّدة، ثم أصلحه.",
          },
          mission: {
            en: "One turn is wrong. Find it, fix it, and reach the market.",
            ar: "استدارة واحدة خاطئة. اعثر عليها، وأصلحها، وصِل إلى السوق.",
          },
          instructions: {
            en: "Before you press Run, read the blocks and follow them on the map with your finger. Which turn sends the bot off the top of the map? Fix that one block, then run to check.",
            ar: "قبل أن تضغط تشغيل، اقرأ اللبنات وتتبّعها على الخريطة بإصبعك. أي استدارة ترسل الروبوت خارج أعلى الخريطة؟ أصلح تلك اللبنة الواحدة، ثم شغّل لتتحقّق.",
          },
          explanation: {
            en: "You found the bug by reading, then proved it by running — the order Code City is built on. After two hops East the bot needed to face South, but the program said Turn Left, which faces North and walks off the map. One word changed the whole journey. When a program goes wrong, the mistake is usually one small line; reading finds it faster than guessing.",
            ar: "وجدت الخطأ بالقراءة، ثم أثبتّه بالتشغيل — الترتيب الذي بُنيت عليه مدينة الشيفرة. بعد قفزتين شرقًا كان على الروبوت أن يواجه الجنوب، لكن البرنامج قال «استدر يسارًا»، فواجه الشمال وخرج من الخريطة. كلمة واحدة غيّرت الرحلة كلها. عندما يتعطّل برنامج، يكون الخطأ غالبًا سطرًا صغيرًا واحدًا؛ والقراءة تجده أسرع من التخمين.",
          },
          teacherNotes: {
            en: "Single-bug warm-up before the three-bug finale. Encourage 'finger tracing' on the board before Run; the failure message names the exact step (bumped at step 4), which students can match to the fourth block.",
            ar: "تمهيد بخطأ واحد قبل الختام ذي الأخطاء الثلاثة. شجّع «التتبّع بالإصبع» على السبورة قبل التشغيل؛ فرسالة الفشل تسمّي الخطوة بعينها (اصطدم عند الخطوة 4)، ويستطيع الطلاب مطابقتها مع اللبنة الرابعة.",
          },
          difficulty: "EASY",
          recommendedGradeMin: 4,
          recommendedGradeMax: 7,
          estimatedMinutes: 5,
          xpReward: 35,
          tags: ["debugging", "sequencing"],
          requires: [],
          hints: [
            {
              tier: 1,
              text: {
                en: "Trace the program on the map: hop, hop, turn, hop. Where does the turn point the bot?",
                ar: "تتبّع البرنامج على الخريطة: قفزة، قفزة، استدارة، قفزة. إلى أين توجّه الاستدارة الروبوت؟",
              },
            },
            {
              tier: 2,
              text: {
                en: "The market is BELOW the bot's road. From facing East, which turn faces South — left or right?",
                ar: "السوق تحت طريق الروبوت. من مواجهة الشرق، أي استدارة تواجه الجنوب — يسار أم يمين؟",
              },
            },
            {
              tier: 3,
              text: {
                en: "Turn Left from East faces North — that is why the bot walks off the top. Swap it for Turn Right.",
                ar: "الاستدارة يسارًا من الشرق تواجه الشمال — لذلك يخرج الروبوت من الأعلى. استبدلها بـ«استدر يمينًا».",
              },
            },
            {
              tier: 4,
              text: {
                en: "Delete the Turn Left and put a Turn Right in its place. Move, move, turn right, move.",
                ar: "احذف «استدر يسارًا» وضع «استدر يمينًا» مكانها. تقدّم، تقدّم، استدر يمينًا، تقدّم.",
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
                rows: ["...", "..G"],
                start: { x: 0, y: 0, dir: "E" },
              },
            ],
            autoCollect: true,
            nonFatalBumps: false,
            checks: [
              { id: "reachedGoal", severity: "core" },
              { id: "maxBlocks", severity: "quality", params: { count: 4 } },
            ],
            starCriteria: { threeStarMaxBlocks: 4 },
            // The bug: Turn Left (faces North, off the map) instead of Turn Right.
            brokenWorkspace: {
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
                                next: { block: { type: "bb_moveForward", id: "m3" } },
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
                                type: "bb_turnRight",
                                id: "t1",
                                next: { block: { type: "bb_moveForward", id: "m3" } },
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
          } satisfies DebuggingDraft,
        },

        // ── ONE TOO MANY — DEBUGGING, a loop-count bug ────────────────────
        {
          slug: "one-too-many",
          order: 2,
          activityType: "DEBUGGING",
          track: "PROGRAMMING",
          title: { en: "One Too Many", ar: "واحدة زيادة" },
          story: {
            en: "The avenue bot uses a loop to reach the depot — and every night it overshoots into the bollard at the end. Nothing is wrong with its hops. Something is wrong with a number.",
            ar: "روبوت الشارع يستخدم حلقة ليصل إلى المستودع — وكل ليلة يتجاوزه ويصطدم بالعمود في النهاية. لا شيء خاطئ في قفزاته. الخطأ في رقم.",
          },
          objective: {
            en: "Diagnose an off-by-one loop count by comparing the loop's number to the distance on the map, and correct the count rather than the body.",
            ar: "شخّص خطأ عدّ الحلقة بمقارنة رقم الحلقة بالمسافة على الخريطة، وصحّح العدد لا الجسم.",
          },
          mission: {
            en: "The loop's number is wrong. Count the tiles and fix it.",
            ar: "رقم الحلقة خاطئ. عُدّ المربعات وأصلحه.",
          },
          instructions: {
            en: "Count the tiles between the bot and the depot. Compare that with the number in the Repeat block. Change the number — you don't need any new blocks.",
            ar: "عُدّ المربعات بين الروبوت والمستودع. قارن ذلك بالرقم في لبنة «كرّر». غيّر الرقم — لا تحتاج إلى أي لبنات جديدة.",
          },
          explanation: {
            en: "The bug was a number, not a block: Repeat 5 hopped one tile too far into the bollard, while the depot was exactly 4 tiles away. Programmers call this an off-by-one error, and it is one of the most common bugs in the world. The fix is the smallest possible edit — reading the map and the loop together showed you which number to change.",
            ar: "كان الخطأ رقمًا لا لبنة: «كرّر 5» قفزت مربعًا زائدًا إلى العمود، بينما المستودع يبعد 4 مربعات بالضبط. يسمّي المبرمجون هذا خطأ الواحد الزائد، وهو من أكثر الأخطاء شيوعًا في العالم. الإصلاح أصغر تعديل ممكن — قراءة الخريطة والحلقة معًا أظهرت لك أي رقم تغيّره.",
          },
          teacherNotes: {
            en: "Students often 'fix' this by deleting the loop and adding four Move blocks — it passes but drops to fewer stars (block limit 2). Steer them to edit the number: the point is that a loop's count is part of the program's meaning.",
            ar: "كثيرًا ما «يصلح» الطلاب هذا بحذف الحلقة وإضافة أربع لبنات «تقدّم للأمام» — فينجح الحل لكنه ينال نجومًا أقل (حدّ اللبنات 2). وجّههم إلى تعديل الرقم: المقصود أن عدد مرات تكرار الحلقة جزء من معنى البرنامج.",
          },
          difficulty: "MEDIUM",
          recommendedGradeMin: 4,
          recommendedGradeMax: 7,
          estimatedMinutes: 5,
          xpReward: 40,
          tags: ["debugging", "loops"],
          requires: [],
          hints: [
            {
              tier: 1,
              text: {
                en: "The bot bumps at the very end. Is it hopping too few times, or too many?",
                ar: "يصطدم الروبوت في النهاية تمامًا. هل يقفز مرات أقل من اللازم أم أكثر؟",
              },
            },
            {
              tier: 2,
              text: {
                en: "Count the tiles from the bot to the depot. Now look at the number inside the Repeat block.",
                ar: "عُدّ المربعات من الروبوت إلى المستودع. الآن انظر إلى الرقم داخل لبنة «كرّر».",
              },
            },
            {
              tier: 3,
              text: {
                en: "The depot is 4 tiles away, but the loop says 5. That fifth hop is the bump.",
                ar: "المستودع يبعد 4 مربعات، لكن الحلقة تقول 5. تلك القفزة الخامسة هي الاصطدام.",
              },
            },
            {
              tier: 4,
              text: {
                en: "Tap the number in the Repeat block and change 5 to 4. Then run.",
                ar: "اضغط على الرقم في لبنة «كرّر» وغيّر 5 إلى 4. ثم شغّل.",
              },
            },
          ],
          payload: {
            toolbox: [{ type: "bb_moveForward" }, { type: "bb_repeat" }],
            variants: [
              {
                // One-lane avenue with a wall alongside; the bollard (#)
                // sits one tile past the depot.
                rows: ["....G#", "######"],
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
            // The bug: Repeat 5 — one hop too many, straight into the bollard.
            brokenWorkspace: {
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
                        id: "r1",
                        fields: { TIMES: 5 },
                        inputs: { DO: { block: { type: "bb_moveForward", id: "m1" } } },
                      },
                    },
                  },
                ],
              },
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
                      },
                    },
                  },
                ],
              },
            },
          } satisfies DebuggingDraft,
        },

        // ── CITY BUG BOUNTY — DEBUGGING, three bugs, the finale ───────────
        {
          slug: "city-bug-bounty",
          order: 3,
          activityType: "DEBUGGING",
          track: "PROGRAMMING",
          title: { en: "City Bug Bounty", ar: "مكافأة أخطاء المدينة" },
          story: {
            en: "The big one. The market's last delivery has a crate to pick up on the way, a corner to turn, a wall to skirt — and a program with THREE mistakes in it. Mayor Mo has the key to the city ready for whoever reads it right.",
            ar: "المهمة الكبرى. توصيلة السوق الأخيرة فيها صندوق يُلتقط في الطريق، وزاوية تُقطع، وجدار يُتجاوز — وبرنامج فيه ثلاثة أخطاء. أعدّ العمدة مو مفتاح المدينة لمن يقرؤه بشكل صحيح.",
          },
          objective: {
            en: "Repair a program with three independent bugs (wrong turn, wrong loop count, missing collect) by iterating: read, run, use the located failure, fix one bug, repeat.",
            ar: "أصلح برنامجًا فيه ثلاثة أخطاء مستقلة (استدارة خاطئة، عدد حلقة خاطئ، لبنة التقاط ناقصة) بالتكرار: اقرأ، شغّل، استخدم الفشل المحدَّد، أصلح خطأً واحدًا، وكرّر.",
          },
          mission: {
            en: "Three bugs hide in this program. Fix them all and deliver the crate to the market.",
            ar: "ثلاثة أخطاء تختبئ في هذا البرنامج. أصلحها كلها ووصّل الصندوق إلى السوق.",
          },
          instructions: {
            en: "Run the broken program first and read where it fails. Fix that one thing, run again, read again. In this city the bot must use Collect to pick the crate up — hopping over it is not enough.",
            ar: "شغّل البرنامج المعطّل أولًا واقرأ أين يفشل. أصلح ذلك الشيء الواحد، وشغّل مجددًا، واقرأ مجددًا. في هذه المدينة يجب أن يستخدم الروبوت «التقط» ليحمل الصندوق — القفز فوقه لا يكفي.",
          },
          explanation: {
            en: "Three bugs, fixed one at a time: a Turn Left that should have been Turn Right (the bot walked off the top), a Repeat 3 that should have been Repeat 2 (one hop too many, off the bottom), and a missing Collect (the crate was hopped over, never picked up). Nobody finds three bugs at once. You ran, read the message, fixed one, and ran again — the loop every programmer uses. That is the Code-Reading Power: read first, then run, then read again.",
            ar: "ثلاثة أخطاء، أُصلحت واحدًا تلو الآخر: «استدر يسارًا» كان يجب أن تكون «استدر يمينًا» (خرج الروبوت من الأعلى)، و«كرّر 3» كان يجب أن تكون «كرّر 2» (قفزة زائدة، خارج الأسفل)، ولبنة «التقط» ناقصة (قُفز فوق الصندوق ولم يُحمل). لا أحد يجد ثلاثة أخطاء دفعة واحدة. شغّلت، وقرأت الرسالة، وأصلحت واحدًا، وشغّلت مجددًا — الحلقة التي يستخدمها كل مبرمج. هذه هي قوة قراءة الشيفرة: اقرأ أولًا، ثم شغّل، ثم اقرأ مجددًا.",
          },
          teacherNotes: {
            en: "Finale of Code City. The bugs surface in order: the wrong turn crashes at step 4; after that fix, the loop count crashes off the bottom; after that, the run reaches the market but is PARTIAL because the crate was never collected (autoCollect is off here, as in Robot Lab). Students who get PARTIAL and stop have found two of three — the 'For more stars' note points at the third.",
            ar: "ختام مدينة الشيفرة. تظهر الأخطاء بالترتيب: الاستدارة الخاطئة تسبّب اصطدامًا عند الخطوة 4؛ وبعد إصلاحها يسبّب عدد الحلقة الخروج من أسفل الخريطة؛ وبعد ذلك يصل التشغيل إلى السوق لكن النتيجة PARTIAL (جزئية) لأن الصندوق لم يُلتقط قط (autoCollect معطّل هنا، كما في مختبر الروبوتات). الطلاب الذين يحصلون على PARTIAL ويتوقفون قد وجدوا خطأين من ثلاثة — وملاحظة «لمزيد من النجوم» تشير إلى الثالث.",
          },
          difficulty: "HARD",
          recommendedGradeMin: 5,
          recommendedGradeMax: 7,
          estimatedMinutes: 8,
          xpReward: 70,
          tags: ["debugging", "loops", "sequencing"],
          requires: [],
          hints: [
            {
              tier: 1,
              text: {
                en: "Run it as it is and read the message: which step goes wrong first? Fix only that, then run again.",
                ar: "شغّله كما هو واقرأ الرسالة: أي خطوة تفشل أولًا؟ أصلح ذلك فقط، ثم شغّل مجددًا.",
              },
            },
            {
              tier: 2,
              text: {
                en: "The first crash is a turn: after two hops East the bot must face South, so the turn must be Turn Right.",
                ar: "أول اصطدام استدارة: بعد قفزتين شرقًا يجب أن يواجه الروبوت الجنوب، فالاستدارة يجب أن تكون «استدر يمينًا».",
              },
            },
            {
              tier: 3,
              text: {
                en: "Next: the loop hops one too many. Count the tiles going down — the Repeat should say 2, not 3.",
                ar: "التالي: الحلقة تقفز مرة زائدة. عُدّ المربعات نزولًا — يجب أن تقول «كرّر» 2 لا 3.",
              },
            },
            {
              tier: 4,
              text: {
                en: "Last: the crate on the second tile is never picked up. Put a Collect block right after the first Move Forward.",
                ar: "أخيرًا: الصندوق في المربع الثاني لا يُلتقط أبدًا. ضع لبنة «التقط» مباشرة بعد أول «تقدّم للأمام».",
              },
            },
          ],
          payload: {
            toolbox: [
              { type: "bb_moveForward" },
              { type: "bb_turnLeft" },
              { type: "bb_turnRight" },
              { type: "bb_collect" },
              { type: "bb_repeat" },
            ],
            variants: [
              {
                rows: [".C..", "##..", "...G"],
                start: { x: 0, y: 0, dir: "E" },
              },
            ],
            autoCollect: false,
            nonFatalBumps: false,
            checks: [
              { id: "reachedGoal", severity: "core" },
              { id: "collectedAll", severity: "secondary" },
              { id: "maxBlocks", severity: "quality", params: { count: 8 } },
            ],
            starCriteria: { threeStarMaxBlocks: 8 },
            // Bugs: no Collect after the first hop; Turn Left instead of Turn
            // Right (off the top at step 4); Repeat 3 instead of 2 (off the
            // bottom once the turn is fixed).
            brokenWorkspace: {
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
                                    type: "bb_repeat",
                                    id: "r1",
                                    fields: { TIMES: 3 },
                                    inputs: { DO: { block: { type: "bb_moveForward", id: "m3" } } },
                                    next: {
                                      block: {
                                        type: "bb_turnLeft",
                                        id: "t2",
                                        next: { block: { type: "bb_moveForward", id: "m4" } },
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
                            type: "bb_collect",
                            id: "c1",
                            next: {
                              block: {
                                type: "bb_moveForward",
                                id: "m2",
                                next: {
                                  block: {
                                    type: "bb_turnRight",
                                    id: "t1",
                                    next: {
                                      block: {
                                        type: "bb_repeat",
                                        id: "r1",
                                        fields: { TIMES: 2 },
                                        inputs: {
                                          DO: { block: { type: "bb_moveForward", id: "m3" } },
                                        },
                                        next: {
                                          block: {
                                            type: "bb_turnLeft",
                                            id: "t2",
                                            next: { block: { type: "bb_moveForward", id: "m4" } },
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
          } satisfies DebuggingDraft,
        },

        // ── DELIVERY ROUTINE — SEQUENCING, the closing checkpoint ─────────
        {
          slug: "delivery-routine",
          order: 4,
          activityType: "SEQUENCING",
          track: "PROGRAMMING",
          title: { en: "Delivery Routine", ar: "روتين التوصيل" },
          story: {
            en: "With the key to the city in its paw, Robo Bunny is asked to write the depot's delivery routine on the wall for every new bot. The steps are known. Only their order is missing.",
            ar: "بمفتاح المدينة في كفّه، يُطلب من الأرنب الآلي أن يكتب روتين التوصيل على جدار المستودع لكل روبوت جديد. الخطوات معروفة. ترتيبها فقط هو الناقص.",
          },
          objective: {
            en: "Order the six steps of a delivery so that each step depends only on steps before it — an algorithm as a dependency chain.",
            ar: "رتّب خطوات التوصيل الست بحيث لا تعتمد كل خطوة إلا على ما قبلها — الخوارزمية كسلسلة اعتماد.",
          },
          mission: {
            en: "Put the depot's six delivery steps in the right order.",
            ar: "رتّب خطوات التوصيل الست للمستودع بالترتيب الصحيح.",
          },
          instructions: {
            en: "Drag the steps into order, or use the up/down buttons. Ask of each step: what must already be true before this can happen?",
            ar: "اسحب الخطوات لترتيبها، أو استخدم أزرار الأعلى/الأسفل. اسأل عن كل خطوة: ما الذي يجب أن يكون قد حدث قبلها؟",
          },
          explanation: {
            en: "A routine is an algorithm: steps in an order that works every time. The bot cannot load a parcel before it is switched on, cannot cross before it has checked the sensor, and cannot hand over a parcel it never loaded. You ordered the steps by what each one needs — the same thinking that put a Collect after a Move, and a sensor check before a turn. Code City is complete: the Code-Reading Power is yours.",
            ar: "الروتين خوارزمية: خطوات بترتيب ينجح كل مرة. لا يستطيع الروبوت تحميل طرد قبل تشغيله، ولا العبور قبل فحص المستشعر، ولا تسليم طرد لم يحمله. رتّبت الخطوات بحسب ما تحتاجه كل واحدة — التفكير نفسه الذي وضع «التقط» بعد «تقدّم»، وفحص المستشعر قبل الاستدارة. اكتملت مدينة الشيفرة: قوة قراءة الشيفرة صارت لك.",
          },
          teacherNotes: {
            en: "Every step depends strictly on the previous one, so there is exactly one correct order and no reasonable alternative — deliberately unambiguous. Extension: ask students to write a seventh step and argue where it must go.",
            ar: "كل خطوة تعتمد اعتمادًا صارمًا على الخطوة السابقة، لذا يوجد ترتيب صحيح واحد فقط ولا بديل معقول — وهذا الوضوح مقصود. للتوسّع: اطلب من الطلاب كتابة خطوة سابعة وتقديم الحجة على الموضع الذي يجب أن توضع فيه.",
          },
          difficulty: "EASY",
          recommendedGradeMin: 4,
          recommendedGradeMax: 7,
          estimatedMinutes: 4,
          xpReward: 35,
          tags: ["sequencing", "algorithms"],
          requires: [],
          hints: [
            {
              tier: 1,
              text: {
                en: "Which step can happen with nothing done before it? That is step one.",
                ar: "أي خطوة يمكن أن تحدث دون أن يسبقها شيء؟ تلك هي الخطوة الأولى.",
              },
            },
            {
              tier: 2,
              text: {
                en: "The bot must be switched on before it can carry anything, and it must carry the parcel before it can drive anywhere useful.",
                ar: "يجب تشغيل الروبوت قبل أن يحمل أي شيء، ويجب أن يحمل الطرد قبل أن يقود إلى أي مكان مفيد.",
              },
            },
            {
              tier: 3,
              text: {
                en: "At the crossing: check the sensor first, cross only when the way is clear — the same order as Sensor Check in Robot Lab.",
                ar: "عند المعبر: افحص المستشعر أولًا، واعبر فقط عندما يكون الطريق مفتوحًا — الترتيب نفسه كما في «فحص المستشعر» في مختبر الروبوتات.",
              },
            },
            {
              tier: 4,
              text: {
                en: "Switch on, load the parcel, drive to the crossing, check the sensor, cross when clear, hand over the parcel.",
                ar: "شغّل، حمّل الطرد، قُد إلى المعبر، افحص المستشعر، اعبر عندما يكون الطريق مفتوحًا، سلّم الطرد.",
              },
            },
          ],
          payload: {
            prompt: {
              en: "The depot's delivery routine, for every new bot — put the six steps in the order that works.",
              ar: "روتين التوصيل في المستودع، لكل روبوت جديد — رتّب الخطوات الست بالترتيب الذي ينجح.",
            },
            items: [
              { id: "on", text: { en: "Switch the bot on.", ar: "شغّل الروبوت." } },
              { id: "load", text: { en: "Load the parcel onto the bot.", ar: "حمّل الطرد على الروبوت." } },
              { id: "drive", text: { en: "Drive to the crossing.", ar: "قُد إلى المعبر." } },
              { id: "sense", text: { en: "Check the sensor for traffic.", ar: "افحص المستشعر بحثًا عن حركة المرور." } },
              { id: "cross", text: { en: "Cross when the way is clear.", ar: "اعبر عندما يكون الطريق مفتوحًا." } },
              { id: "deliver", text: { en: "Hand over the parcel at the market.", ar: "سلّم الطرد عند السوق." } },
            ],
            correctOrder: ["on", "load", "drive", "sense", "cross", "deliver"],
          } satisfies SequencingDraft,
        },
      ],
    },
    countersAndTricks,
    cityWorkshop,
  ],
};
