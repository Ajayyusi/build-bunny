import type { z } from "zod";
import type { ModuleFixture, blockCodingPayload } from "@/modules/curriculum/schemas";
import { forestMore } from "./more-practice";

/**
 * Logic Forest, module 3 — Forest Practice: two short levels that reuse the
 * forest's own blocks (If + the path sensor, Repeat-until) on new maps, for
 * a child who wants another go before Robot Lab. Both are multi-variant so
 * the decision block is really needed — the same honesty rule as the main
 * forest levels.
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
const blocked = (id: string): Node => ({ type: "bb_pathAhead", id });
const ifBlocked = (id: string, body: Node): Node => ({
  type: "bb_if",
  id,
  inputs: { CONDITION: { block: blocked(`${id}-s`) }, DO: { block: body } },
});
const untilGoal = (id: string, body: Node): Node => ({
  type: "bb_repeatUntilGoal",
  id,
  inputs: { DO: { block: body } },
});

export const forestPractice: ModuleFixture = {
  slug: "forest-practice",
  order: 3,
  name: { en: "Forest Practice", ar: "تدريب الغابة" },
  description: {
    en: "Two more trails for the sensor and the until-loop.",
    ar: "دربان إضافيان للمستشعر وحلقة «حتى».",
  },
  levels: [
    // ── ROCK OR CLEAR ────────────────────────────────────────────────────
    {
      slug: "rock-or-clear",
      order: 1,
      activityType: "BLOCK_CODING",
      track: "PROGRAMMING",
      title: { en: "Rock or Clear?", ar: "صخرة أم طريق مفتوح؟" },
      story: {
        en: "Oona the Owl has two maps of the same trail. On one, a rock has rolled onto the path; on the other, it hasn't. Robo Bunny gets ONE program for both — so it has to look before it hops.",
        ar: "لدى أونا البومة خريطتان للدرب نفسه. في إحداهما تدحرجت صخرة على الطريق؛ وفي الأخرى لم تتدحرج. للأرنب الآلي برنامج واحد لكلتيهما — فعليه أن ينظر قبل أن يقفز.",
      },
      objective: {
        en: "Write one program that handles two maps by testing the path sensor and running a detour only when it is needed.",
        ar: "كتابة برنامج واحد يتعامل مع خريطتين باختبار مستشعر الطريق وتنفيذ الالتفاف عند الحاجة فقط.",
      },
      mission: {
        en: "One program, two maps: go around the rock only if it's there.",
        ar: "برنامج واحد وخريطتان: التفّ حول الصخرة فقط إن كانت موجودة.",
      },
      instructions: {
        en: "Use If with 'path ahead is blocked'. Inside it, put the detour: turn right, hop, turn left. After the If, one hop reaches the burrow on both maps.",
        ar: "استخدم «إذا» مع «الطريق أمامي مسدود». ضع بداخلها الالتفاف: استدر يمينًا، اقفز، استدر يسارًا. بعد «إذا»، قفزة واحدة تصل إلى الجحر في الخريطتين.",
      },
      explanation: {
        en: "The If ran the detour on the map with the rock and skipped it on the clear map — the same blocks, two different runs. That's what a decision is: the program looks at the world and picks. Notice the last hop is OUTSIDE the If, because it's needed both times.",
        ar: "نفّذت «إذا» الالتفاف في الخريطة التي فيها الصخرة وتخطّته في الخريطة المفتوحة — اللبنات نفسها وتشغيلان مختلفان. هذا هو القرار: ينظر البرنامج إلى العالم ويختار. لاحظ أن القفزة الأخيرة خارج «إذا»، لأنها مطلوبة في الحالتين.",
      },
      teacherNotes: {
        en: "Two variants graded together: a program that hard-codes the detour fails the clear map (it hops down and misses the burrow); one that never turns bumps the rock. Ask which blocks belong inside the If and which outside.",
        ar: "تُقيَّم الخريطتان معًا: البرنامج الذي يثبّت الالتفاف دائمًا يفشل في الخريطة المفتوحة (يقفز إلى الأسفل ويفوّت الجحر)؛ والبرنامج الذي لا يستدير أبدًا يصطدم بالصخرة. اسأل أي اللبنات مكانها داخل «إذا» وأيها خارجها.",
      },
      difficulty: "MEDIUM",
      recommendedGradeMin: 4,
      recommendedGradeMax: 6,
      estimatedMinutes: 5,
      xpReward: 35,
      tags: ["logic", "sequencing"],
      requires: [],
      hints: [
        { tier: 1, text: { en: "The same program runs on both maps. Which blocks are only needed when the rock is there?", ar: "البرنامج نفسه يعمل في الخريطتين. أي اللبنات مطلوبة فقط عندما تكون الصخرة موجودة؟" } },
        { tier: 2, text: { en: "Put the detour (turn right, hop, turn left) inside the If. The final hop goes after the If.", ar: "ضع الالتفاف (استدر يمينًا، اقفز، استدر يسارًا) داخل «إذا». والقفزة الأخيرة بعد «إذا»." } },
        { tier: 3, text: { en: "Snap 'path ahead is blocked' into the If's question slot, or the If never runs its blocks.", ar: "ثبّت «الطريق أمامي مسدود» في فتحة السؤال في «إذا»، وإلا فلن تعمل لبناتها أبدًا." } },
        { tier: 4, text: { en: "If blocked: Turn Right, Move Forward, Turn Left. Then Move Forward. Five blocks.", ar: "إذا مسدود: استدر يمينًا، تقدّم للأمام، استدر يسارًا. ثم تقدّم للأمام. خمس لبنات." } },
      ],
      payload: {
        toolbox: [
          { type: "bb_moveForward" },
          { type: "bb_turnLeft" },
          { type: "bb_turnRight" },
          { type: "bb_if" },
          { type: "bb_pathAhead" },
        ],
        variants: [
          { rows: [".#..", ".G.."], start: { x: 0, y: 0, dir: "E" } },
          { rows: [".G..", "...."], start: { x: 0, y: 0, dir: "E" } },
        ],
        autoCollect: true,
        nonFatalBumps: false,
        checks: [
          { id: "reachedGoal", severity: "core" },
          { id: "usedBlock", severity: "secondary", params: { block: "bb_if" } },
        ],
        starCriteria: { threeStarMaxBlocks: 5 },
        startWorkspace,
        solution: hat(chain(ifBlocked("if1", chain(right("t1"), move("m1"), left("t2"))), move("m2"))),
      } satisfies BlockCodingDraft,
    },

    // ── UNTIL THE BURROW ─────────────────────────────────────────────────
    {
      slug: "until-the-burrow",
      order: 2,
      activityType: "BLOCK_CODING",
      track: "PROGRAMMING",
      title: { en: "Until the Burrow", ar: "حتى الجحر" },
      story: {
        en: "Two straight trails, one short and one long, and nobody will tell Robo Bunny which it's on. Counting won't work — but 'keep hopping until you're home' works on both.",
        ar: "دربان مستقيمان، أحدهما قصير والآخر طويل، ولن يخبر أحد الأرنب الآلي على أيهما هو. العدّ لن ينفع — لكن «واصل القفز حتى تصل إلى البيت» ينفع في الدربين.",
      },
      objective: {
        en: "Use a condition-controlled loop where the number of iterations is unknown in advance.",
        ar: "استخدام حلقة يتحكم فيها شرط عندما يكون عدد التكرارات غير معروف مسبقًا.",
      },
      mission: {
        en: "Hop until you reach the burrow — on the short trail AND the long one.",
        ar: "اقفز حتى تصل إلى الجحر — في الدرب القصير والطويل معًا.",
      },
      instructions: {
        en: "A Repeat with a number only fits one trail. 'Repeat until I reach the goal' with one hop inside fits both. Two blocks is the three-star line.",
        ar: "«كرّر» برقم تناسب دربًا واحدًا فقط. «كرّر حتى أصل إلى الهدف» وبداخلها قفزة واحدة تناسب الدربين. لبنتان هما حدّ النجوم الثلاث.",
      },
      explanation: {
        en: "A counted loop needs to know the number. An until-loop doesn't — it checks 'am I there yet?' before every hop and stops the moment the answer is yes. When you don't know how many, ask 'until what?' instead.",
        ar: "الحلقة المعدودة تحتاج إلى معرفة الرقم. أما حلقة «حتى» فلا — تسأل «هل وصلت؟» قبل كل قفزة وتتوقف لحظة تصبح الإجابة نعم. عندما لا تعرف كم مرة، اسأل «حتى ماذا؟» بدلًا من ذلك.",
      },
      teacherNotes: {
        en: "Repeat 5 passes the long trail and overshoots the short one (a located bump off the map). The until-loop with a single hop passes both with 3 stars. Discussion: what would happen if the burrow were unreachable? (The energy budget stops the loop — see Loop Detective.)",
        ar: "«كرّر 5» تنجح في الدرب الطويل وتتجاوز الدرب القصير (اصطدام محدَّد الموضع خارج الخريطة). حلقة «حتى» مع قفزة واحدة تنجح في الدربين بـ 3 نجوم. للنقاش: ماذا سيحدث لو تعذّر الوصول إلى الجحر؟ (ميزانية الطاقة توقف الحلقة — انظر مستوى «محقق الحلقات».)",
      },
      difficulty: "MEDIUM",
      recommendedGradeMin: 4,
      recommendedGradeMax: 6,
      estimatedMinutes: 4,
      xpReward: 35,
      tags: ["loops", "logic"],
      requires: [],
      hints: [
        { tier: 1, text: { en: "The two trails have different lengths. A number in a Repeat can only be right for one of them.", ar: "للدربين طولان مختلفان. الرقم في «كرّر» لا يصلح إلا لأحدهما." } },
        { tier: 2, text: { en: "Which loop block doesn't need a number?", ar: "أي لبنة تكرار لا تحتاج إلى رقم؟" } },
        { tier: 3, text: { en: "Repeat until I reach the goal — with a single Move Forward inside.", ar: "«كرّر حتى أصل إلى الهدف» — وبداخلها «تقدّم للأمام» واحدة." } },
        { tier: 4, text: { en: "Two blocks: Repeat until I reach the goal, Move Forward inside it. Run — watch both trails.", ar: "لبنتان: «كرّر حتى أصل إلى الهدف»، وبداخلها «تقدّم للأمام». شغّل — وراقب الدربين." } },
      ],
      payload: {
        toolbox: [{ type: "bb_moveForward" }, { type: "bb_repeat" }, { type: "bb_repeatUntilGoal" }],
        variants: [
          { rows: ["..G", "..."], start: { x: 0, y: 0, dir: "E" } },
          { rows: [".....G", "......"], start: { x: 0, y: 0, dir: "E" } },
        ],
        autoCollect: true,
        nonFatalBumps: false,
        checks: [
          { id: "reachedGoal", severity: "core" },
          { id: "usedBlock", severity: "secondary", params: { block: "bb_repeatUntilGoal" } },
        ],
        starCriteria: { threeStarMaxBlocks: 2 },
        startWorkspace,
        solution: hat(untilGoal("u1", move("m1"))),
      } satisfies BlockCodingDraft,
    },
    ...forestMore,
  ],
};
