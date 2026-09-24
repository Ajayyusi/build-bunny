import type { z } from "zod";
import type { ModuleFixture, blockCodingPayload } from "@/modules/curriculum/schemas";

/**
 * Robot Lab, module 3 — Lab Practice: two short levels on the lab's own
 * rules (nothing collects itself here; Collect is a block) — an explicit
 * pick-up, and an If-Else across two maps — for extra practice before the
 * AI worlds.
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
const right = (id: string): Node => ({ type: "bb_turnRight", id });
const collect = (id: string): Node => ({ type: "bb_collect", id });
const ifElseBlocked = (id: string, doBody: Node, elseBody: Node): Node => ({
  type: "bb_ifElse",
  id,
  inputs: {
    CONDITION: { block: { type: "bb_pathAhead", id: `${id}-s` } },
    DO: { block: doBody },
    ELSE: { block: elseBody },
  },
});

export const labPractice: ModuleFixture = {
  slug: "lab-practice",
  order: 3,
  name: { en: "Lab Practice", ar: "تدريب المختبر" },
  description: {
    en: "A pick-up and a two-way decision, on the lab's rules.",
    ar: "التقاط وقرار ذو اتجاهين، وفق قواعد المختبر.",
  },
  levels: [
    // ── PICK IT UP ───────────────────────────────────────────────────────
    {
      slug: "pick-it-up",
      order: 1,
      activityType: "BLOCK_CODING",
      track: "PROGRAMMING",
      title: { en: "Pick It Up", ar: "التقطها" },
      story: {
        en: "Professor Pip dropped a battery cell in the corridor. In the lab nothing gets picked up by accident — Robo Bunny has to be told, on the exact tile.",
        ar: "أسقط البروفيسور بيب خلية بطارية في الممر. في المختبر لا يُلتقط شيء بالصدفة — يجب أن يُقال للأرنب الآلي ذلك، على المربع بالضبط.",
      },
      objective: {
        en: "Issue an explicit collect instruction at the right moment in a sequence, distinguishing walking over an item from picking it up.",
        ar: "إصدار تعليمة التقاط صريحة في اللحظة الصحيحة ضمن تسلسل، مع التمييز بين المرور فوق شيء والتقاطه.",
      },
      mission: { en: "Hop to the cell, pick it up, then carry on to the charger.", ar: "اقفز إلى الخلية، والتقطها، ثم تابع إلى الشاحن." },
      instructions: {
        en: "Walking over the cell isn't enough here. Hop ONTO it, add a Collect block, then hop the rest of the way. Four blocks earns three stars.",
        ar: "المرور فوق الخلية لا يكفي هنا. اقفز عليها، وأضف لبنة «التقط»، ثم اقفز بقية الطريق. أربع لبنات تكسب ثلاث نجوم.",
      },
      explanation: {
        en: "Collect only works while Robo Bunny is standing on the item — one hop early or late and it grabs air. Put it right after the hop that lands on the cell. In the meadow, carrots came to you; in the lab, the robot does exactly what it's told and nothing more.",
        ar: "«التقط» لا تعمل إلا عندما يقف الأرنب الآلي على الشيء — قفزة قبلها أو بعدها فيمسك الهواء. ضعها مباشرة بعد القفزة التي تهبط على الخلية. في المرج كان الجزر يأتي إليك؛ وفي المختبر ينفّذ الروبوت ما يُقال له بالضبط ولا شيء أكثر.",
      },
      teacherNotes: {
        en: "autoCollect is off for the whole of Robot Lab. Reaching the charger without the cell is PARTIAL with 'missed something on the way' feedback; a Collect on the wrong tile is a collectFail event. Budget 4: move, collect, move, move.",
      },
      difficulty: "EASY",
      recommendedGradeMin: 4,
      recommendedGradeMax: 6,
      estimatedMinutes: 3,
      xpReward: 25,
      tags: ["sequencing"],
      requires: [],
      hints: [
        { tier: 1, text: { en: "Which square is the cell on? Robo Bunny must be standing there when it collects.", ar: "على أي مربع الخلية؟ يجب أن يقف الأرنب الآلي هناك عندما يلتقط." } },
        { tier: 2, text: { en: "Hop once, then Collect, then hop the rest of the way.", ar: "اقفز مرة، ثم «التقط»، ثم اقفز بقية الطريق." } },
        { tier: 3, text: { en: "Count: one hop lands on the cell. Two more hops reach the charger.", ar: "عُدّ: قفزة واحدة تهبط على الخلية. قفزتان أخريان تصلان إلى الشاحن." } },
        { tier: 4, text: { en: "Move Forward, Collect, Move Forward, Move Forward.", ar: "تقدّم للأمام، التقط، تقدّم للأمام، تقدّم للأمام." } },
      ],
      payload: {
        toolbox: [{ type: "bb_moveForward" }, { type: "bb_collect" }, { type: "bb_repeat" }],
        variants: [{ rows: [".C.G", "...."], start: { x: 0, y: 0, dir: "E" } }],
        autoCollect: false,
        nonFatalBumps: false,
        checks: [
          { id: "reachedGoal", severity: "core" },
          { id: "collectedAll", severity: "secondary" },
        ],
        starCriteria: { threeStarMaxBlocks: 4 },
        startWorkspace,
        solution: hat(chain(move("m1"), collect("c1"), move("m2"), move("m3"))),
      } satisfies BlockCodingDraft,
    },

    // ── TWO DOORS ────────────────────────────────────────────────────────
    {
      slug: "two-doors",
      order: 2,
      activityType: "BLOCK_CODING",
      track: "PROGRAMMING",
      title: { en: "Two Doors", ar: "بابان" },
      story: {
        en: "The lab door ahead is sometimes locked. When it is, the charger is through the side door instead. Robo Bunny's sensor can tell which — and an If-Else can act on it.",
        ar: "باب المختبر الذي أمامه مقفل أحيانًا. وعندها يكون الشاحن عبر الباب الجانبي بدلًا منه. يستطيع مستشعر الأرنب الآلي معرفة أيهما — ولبنة «إذا-وإلا» تستطيع التصرف بناءً على ذلك.",
      },
      objective: {
        en: "Use a two-branch conditional so exactly one of two routes runs, depending on the sensor, across two maps.",
        ar: "استخدام شرط ذي فرعين بحيث يعمل مسار واحد فقط من مسارين حسب المستشعر، عبر خريطتين.",
      },
      mission: { en: "Blocked? Take the side door. Clear? Go straight. One program.", ar: "مسدود؟ خذ الباب الجانبي. مفتوح؟ تقدّم مباشرة. برنامج واحد." },
      instructions: {
        en: "If-Else has two mouths. In the first (blocked): turn right, hop. In the second (clear): hop. Robo Bunny picks one mouth on each map.",
        ar: "«إذا-وإلا» لها فمان. في الأول (مسدود): استدر يمينًا، اقفز. في الثاني (مفتوح): اقفز. يختار الأرنب الآلي فمًا واحدًا في كل خريطة.",
      },
      explanation: {
        en: "Exactly one mouth runs every time — never both, never neither. That's the difference from a plain If, which can do nothing at all. Two doors, one decision, and the program is ready for either.",
        ar: "فم واحد بالضبط يعمل في كل مرة — لا كلاهما ولا أيّ منهما. هذا هو الفرق عن «إذا» البسيطة التي قد لا تفعل شيئًا إطلاقًا. بابان، وقرار واحد، والبرنامج جاهز لأيهما.",
      },
      teacherNotes: {
        en: "Two variants: rock ahead (side route) and clear (straight). A plain If with the detour and a trailing hop also works here — the usedBlock check nudges toward If-Else (PARTIAL without it). Budget 4: ifElse, turnRight, move, move.",
      },
      difficulty: "MEDIUM",
      recommendedGradeMin: 4,
      recommendedGradeMax: 6,
      estimatedMinutes: 5,
      xpReward: 35,
      tags: ["logic"],
      requires: [],
      hints: [
        { tier: 1, text: { en: "Two maps, one program. What is different about them? The sensor can feel it.", ar: "خريطتان وبرنامج واحد. ما الفرق بينهما؟ يستطيع المستشعر الشعور به." } },
        { tier: 2, text: { en: "If-Else: the top mouth runs when blocked, the bottom mouth when clear.", ar: "«إذا-وإلا»: الفم العلوي يعمل عندما يكون مسدودًا، والفم السفلي عندما يكون مفتوحًا." } },
        { tier: 3, text: { en: "Blocked: turn right, then hop to the side door. Clear: just hop.", ar: "مسدود: استدر يمينًا، ثم اقفز إلى الباب الجانبي. مفتوح: اقفز فقط." } },
        { tier: 4, text: { en: "If blocked: Turn Right, Move Forward. Else: Move Forward. Four blocks.", ar: "إذا مسدود: استدر يمينًا، تقدّم للأمام. وإلا: تقدّم للأمام. أربع لبنات." } },
      ],
      payload: {
        toolbox: [
          { type: "bb_moveForward" },
          { type: "bb_turnLeft" },
          { type: "bb_turnRight" },
          { type: "bb_ifElse" },
          { type: "bb_pathAhead" },
        ],
        variants: [
          { rows: [".#.", "G.."], start: { x: 0, y: 0, dir: "E" } },
          { rows: [".G.", "..."], start: { x: 0, y: 0, dir: "E" } },
        ],
        autoCollect: false,
        nonFatalBumps: false,
        checks: [
          { id: "reachedGoal", severity: "core" },
          { id: "usedBlock", severity: "secondary", params: { block: "bb_ifElse" } },
        ],
        starCriteria: { threeStarMaxBlocks: 4 },
        startWorkspace,
        solution: hat(ifElseBlocked("ie1", chain(right("t1"), move("m1")), move("m2"))),
      } satisfies BlockCodingDraft,
    },
  ],
};
