import type { z } from "zod";
import type { ModuleFixture, blockCodingPayload } from "@/modules/curriculum/schemas";

/**
 * Bunny Meadow, module 3 — The Practice Paddock: three tiny levels for the
 * youngest players (ages 7–8), each one or two ideas on a small grid with
 * generous star budgets. They come AFTER the meadow's teaching levels so
 * nothing new is introduced here — a child who wants more meadow before the
 * forest gets more meadow, and a teacher has extra "just hop" practice to
 * assign without repeating a level.
 */

type BlockCodingDraft = z.input<typeof blockCodingPayload>;

const startWorkspace = {
  blocks: {
    languageVersion: 0,
    blocks: [
      { type: "bb_whenStart", id: "start", x: 24, y: 24, deletable: false, movable: false },
    ],
  },
};

type Node = Record<string, unknown>;
const chain = (...blocks: Node[]): Node => {
  let next: Node | undefined;
  for (let i = blocks.length - 1; i >= 0; i -= 1) {
    const block = { ...blocks[i] };
    if (next) block["next"] = { block: next };
    next = block;
  }
  return next!;
};
const hat = (first: Node) => ({
  blocks: {
    languageVersion: 0,
    blocks: [
      { type: "bb_whenStart", id: "start", x: 24, y: 24, deletable: false, movable: false, next: { block: first } },
    ],
  },
});
const move = (id: string): Node => ({ type: "bb_moveForward", id });
const left = (id: string): Node => ({ type: "bb_turnLeft", id });
const right = (id: string): Node => ({ type: "bb_turnRight", id });
const repeat = (id: string, times: number, body: Node): Node => ({
  type: "bb_repeat",
  id,
  fields: { TIMES: times },
  inputs: { DO: { block: body } },
});

export const practicePaddock: ModuleFixture = {
  slug: "practice-paddock",
  order: 3,
  name: { en: "Practice Paddock", ar: "حقل التدريب" },
  description: {
    en: "Little hops for extra practice. No new blocks — just more meadow.",
    ar: "قفزات صغيرة لمزيد من التدريب. لا لبنات جديدة — فقط مزيد من المرج.",
  },
  levels: [
    // ── HOP HOP ──────────────────────────────────────────────────────────
    {
      slug: "hop-hop",
      order: 1,
      activityType: "BLOCK_CODING",
      track: "PROGRAMMING",
      title: { en: "Hop, Hop", ar: "قفزة، قفزة" },
      story: {
        en: "Grandma Clover left two clover leaves on the path and a warm burrow at the end. Two hops and Robo Bunny is home.",
        ar: "تركت الجدّة كلوفر ورقتي برسيم على الطريق وجحرًا دافئًا في النهاية. قفزتان ويكون الأرنب الآلي في بيته.",
      },
      objective: {
        en: "Sequence two identical instructions and observe that each block moves the bunny exactly one tile.",
        ar: "ترتيب تعليمتين متطابقتين وملاحظة أن كل لبنة تحرّك الأرنب مربعًا واحدًا بالضبط.",
      },
      mission: { en: "Two hops to the burrow!", ar: "قفزتان إلى الجحر!" },
      instructions: {
        en: "Count the squares between Robo Bunny and the burrow. Add one Move Forward for each square, then press Run.",
        ar: "عُدّ المربعات بين الأرنب الآلي والجحر. أضف «تقدّم للأمام» واحدة لكل مربع، ثم اضغط «تشغيل».",
      },
      explanation: {
        en: "Each Move Forward is exactly one square — never more, never less. Two squares needed two blocks. Robo Bunny does exactly what the blocks say, in order, and nothing else.",
        ar: "كل «تقدّم للأمام» تساوي مربعًا واحدًا بالضبط — لا أكثر ولا أقل. مربعان احتاجا إلى لبنتين. الأرنب الآلي يفعل ما تقوله اللبنات بالضبط، بالترتيب، ولا شيء غير ذلك.",
      },
      teacherNotes: {
        en: "Practice level for the youngest players (Grade 3 and below). Only Move Forward is offered, so the only possible mistakes are too few or too many hops — both give located feedback. Good as a first assignment for a child who found First Hop and Two Steps hard.",
      },
      difficulty: "EASY",
      recommendedGradeMin: 3,
      recommendedGradeMax: 4,
      estimatedMinutes: 2,
      xpReward: 15,
      tags: ["sequencing"],
      requires: [],
      hints: [
        { tier: 1, text: { en: "How many squares between Robo Bunny and the burrow? Count them with your finger.", ar: "كم مربعًا بين الأرنب الآلي والجحر؟ عُدّها بإصبعك." } },
        { tier: 2, text: { en: "One Move Forward block for each square.", ar: "لبنة «تقدّم للأمام» واحدة لكل مربع." } },
        { tier: 3, text: { en: "Two squares. So two Move Forward blocks, one under the other.", ar: "مربعان. إذًا لبنتا «تقدّم للأمام»، واحدة تحت الأخرى." } },
        { tier: 4, text: { en: "Tap Add block, choose Move Forward, and do it twice. Then Run.", ar: "انقر «أضف لبنة»، واختر «تقدّم للأمام»، وكرّر ذلك مرتين. ثم «تشغيل»." } },
      ],
      payload: {
        toolbox: [{ type: "bb_moveForward" }],
        variants: [{ rows: ["..G", "..."], start: { x: 0, y: 0, dir: "E" } }],
        autoCollect: true,
        nonFatalBumps: false,
        checks: [{ id: "reachedGoal", severity: "core" }],
        starCriteria: { threeStarMaxBlocks: 2 },
        startWorkspace,
        solution: hat(chain(move("m1"), move("m2"))),
      } satisfies BlockCodingDraft,
    },

    // ── THE LEFT TURN ────────────────────────────────────────────────────
    {
      slug: "the-left-turn",
      order: 2,
      activityType: "BLOCK_CODING",
      track: "PROGRAMMING",
      title: { en: "The Left Turn", ar: "الاستدارة إلى اليسار" },
      story: {
        en: "The burrow is not straight ahead this time — it's up the hill. Robo Bunny has to turn first, then hop.",
        ar: "الجحر ليس أمامه مباشرة هذه المرة — بل أعلى التلّ. على الأرنب الآلي أن يستدير أولًا، ثم يقفز.",
      },
      objective: {
        en: "Combine a turn with a move, distinguishing turning on the spot from moving to a new tile.",
        ar: "الجمع بين استدارة وحركة، مع التمييز بين الاستدارة في المكان والانتقال إلى مربع جديد.",
      },
      mission: { en: "Turn left, then hop up to the burrow.", ar: "استدر يسارًا، ثم اقفز صعودًا إلى الجحر." },
      instructions: {
        en: "Robo Bunny is looking right, but the burrow is above it. Turn Left makes it look up. Then hop.",
        ar: "الأرنب الآلي ينظر إلى اليمين، لكن الجحر فوقه. «استدر يسارًا» تجعله ينظر إلى الأعلى. ثم اقفز.",
      },
      explanation: {
        en: "A turn doesn't move Robo Bunny — it only changes where it's looking. That's why you needed two blocks: one to look up, one to hop up. Left and right are from Robo Bunny's point of view, not yours.",
        ar: "الاستدارة لا تحرّك الأرنب الآلي — بل تغيّر فقط الجهة التي ينظر إليها. لذلك احتجت إلى لبنتين: واحدة لينظر إلى الأعلى، وأخرى ليقفز إلى الأعلى. اليسار واليمين من وجهة نظر الأرنب الآلي، لا من وجهة نظرك.",
      },
      teacherNotes: {
        en: "Facing East, a left turn faces North (up the screen). Children who pick Turn Right end up facing South and hop off the map — a located 'bump' explains it. Left/right from the bunny's viewpoint is the whole lesson; have children turn their own bodies.",
      },
      difficulty: "EASY",
      recommendedGradeMin: 3,
      recommendedGradeMax: 4,
      estimatedMinutes: 3,
      xpReward: 15,
      tags: ["sequencing"],
      requires: [],
      hints: [
        { tier: 1, text: { en: "Where is Robo Bunny looking? Where is the burrow? It needs to look at the burrow first.", ar: "إلى أين ينظر الأرنب الآلي؟ وأين الجحر؟ يجب أن ينظر إلى الجحر أولًا." } },
        { tier: 2, text: { en: "Stand like Robo Bunny, looking right. Which way do you turn to look up?", ar: "قف مثل الأرنب الآلي ناظرًا إلى اليمين. إلى أي جهة تستدير لتنظر إلى الأعلى؟" } },
        { tier: 3, text: { en: "Turn Left first, then Move Forward.", ar: "«استدر يسارًا» أولًا، ثم «تقدّم للأمام»." } },
        { tier: 4, text: { en: "Two blocks: Turn Left, Move Forward. Then Run.", ar: "لبنتان: «استدر يسارًا»، «تقدّم للأمام». ثم «تشغيل»." } },
      ],
      payload: {
        toolbox: [{ type: "bb_moveForward" }, { type: "bb_turnLeft" }, { type: "bb_turnRight" }],
        variants: [{ rows: ["G..", "...", "..."], start: { x: 0, y: 1, dir: "E" } }],
        autoCollect: true,
        nonFatalBumps: false,
        checks: [{ id: "reachedGoal", severity: "core" }],
        starCriteria: { threeStarMaxBlocks: 2 },
        startWorkspace,
        solution: hat(chain(left("t1"), move("m1"))),
      } satisfies BlockCodingDraft,
    },

    // ── CLOVER LOOP ──────────────────────────────────────────────────────
    {
      slug: "clover-loop",
      order: 3,
      activityType: "BLOCK_CODING",
      track: "PROGRAMMING",
      title: { en: "Clover Loop", ar: "حلقة البرسيم" },
      story: {
        en: "A long, straight path of clover, and a burrow at the very end. Five hops — or one Repeat that says 'hop' five times.",
        ar: "طريق طويل ومستقيم من البرسيم، وجحر في نهايته. خمس قفزات — أو «كرّر» واحدة تقول «اقفز» خمس مرات.",
      },
      objective: {
        en: "Replace a run of identical instructions with a counted loop and set the count from the map.",
        ar: "استبدال سلسلة تعليمات متطابقة بحلقة معدودة وضبط العدد من الخريطة.",
      },
      mission: { en: "Five hops to the burrow — try one Repeat!", ar: "خمس قفزات إلى الجحر — جرّب «كرّر» واحدة!" },
      instructions: {
        en: "Count the squares to the burrow. Put ONE Move Forward inside a Repeat, and set the number to the count. Two blocks earn three stars.",
        ar: "عُدّ المربعات حتى الجحر. ضع «تقدّم للأمام» واحدة داخل «كرّر»، واضبط الرقم على العدد. لبنتان تكسبان ثلاث نجوم.",
      },
      explanation: {
        en: "Five Move Forwards and a Repeat 5 with one Move Forward inside do exactly the same thing — but the Repeat is shorter, and if the path grows, you only change one number. That's why programmers love loops.",
        ar: "خمس لبنات «تقدّم للأمام» و«كرّر 5» بداخلها «تقدّم للأمام» واحدة تفعلان الشيء نفسه بالضبط — لكن «كرّر» أقصر، وإن طال الطريق فلن تغيّر إلا رقمًا واحدًا. لهذا يحب المبرمجون الحلقات.",
      },
      teacherNotes: {
        en: "Practice for Repeat after the Learn step. Five plain hops pass with 2 stars (over the two-block budget); the loop earns 3. Tap the number in the Repeat block to change it — young children sometimes miss that the 4 can be edited.",
      },
      difficulty: "EASY",
      recommendedGradeMin: 3,
      recommendedGradeMax: 5,
      estimatedMinutes: 3,
      xpReward: 20,
      tags: ["loops"],
      requires: [],
      hints: [
        { tier: 1, text: { en: "Count the squares to the burrow. That number goes in the Repeat.", ar: "عُدّ المربعات حتى الجحر. هذا الرقم يوضع في «كرّر»." } },
        { tier: 2, text: { en: "Tap the number on the Repeat block to change it.", ar: "انقر على الرقم في لبنة «كرّر» لتغييره." } },
        { tier: 3, text: { en: "One Move Forward inside the Repeat is enough — the Repeat does it again and again.", ar: "«تقدّم للأمام» واحدة داخل «كرّر» تكفي — «كرّر» تعيدها مرة بعد مرة." } },
        { tier: 4, text: { en: "Repeat 5 times, with Move Forward inside. Then Run.", ar: "«كرّر 5 مرات»، وبداخلها «تقدّم للأمام». ثم «تشغيل»." } },
      ],
      payload: {
        toolbox: [{ type: "bb_moveForward" }, { type: "bb_repeat" }],
        variants: [{ rows: [".....G", "......"], start: { x: 0, y: 0, dir: "E" } }],
        autoCollect: true,
        nonFatalBumps: false,
        checks: [
          { id: "reachedGoal", severity: "core" },
          { id: "usedBlock", severity: "quality", params: { block: "bb_repeat" } },
        ],
        starCriteria: { threeStarMaxBlocks: 2 },
        startWorkspace,
        solution: hat(repeat("r1", 5, move("m1"))),
      } satisfies BlockCodingDraft,
    },
  ],
};

// Referenced so the helpers stay used even if a level is trimmed later.
void right;
