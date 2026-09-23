import type { z } from "zod";
import type {
  ModuleFixture,
  blockCodingPayload,
  conceptCardsPayload,
  debuggingPayload,
} from "@/modules/curriculum/schemas";

/**
 * Code City, module 3 — Counters and Tricks: variables and functions.
 *
 * Two new ideas, each with a Learn step first: "the counter" (one number
 * Robo Bunny remembers — set it, add to it, say it) and "my trick" (a named
 * bunch of blocks, taught once and done anywhere). The counter is graded by
 * the variableEquals check — the program's final value, read back from the
 * interpreter — and by what Robo Bunny says; tricks by the route they draw.
 */

type BlockCodingDraft = z.input<typeof blockCodingPayload>;
type ConceptCardsDraft = z.input<typeof conceptCardsPayload>;
type DebuggingDraft = z.input<typeof debuggingPayload>;

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

const hat = (next: unknown, extraTops: unknown[] = []) => ({
  blocks: {
    languageVersion: 0,
    blocks: [
      { type: "bb_whenStart", id: "start", x: 24, y: 24, deletable: false, movable: false, next: { block: next } },
      ...extraTops,
    ],
  },
});

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

const move = (id: string): Node => ({ type: "bb_moveForward", id });
const add = (id: string, delta = 1): Node => ({ type: "bb_changeCounter", id, fields: { DELTA: delta } });
const set = (id: string, value: number): Node => ({ type: "bb_setCounter", id, fields: { VALUE: value } });
const sayCounter = (id: string): Node => ({ type: "bb_sayCounter", id });
const repeat = (id: string, times: number, body: Node): Node => ({
  type: "bb_repeat",
  id,
  fields: { TIMES: times },
  inputs: { DO: { block: body } },
});
const doTrick = (id: string): Node => ({ type: "bb_doTrick", id });
const trick = (id: string, body: Node): Node => ({
  type: "bb_defineTrick",
  id,
  x: 320,
  y: 24,
  inputs: { DO: { block: body } },
});

export const countersAndTricks: ModuleFixture = {
  slug: "counters-and-tricks",
  order: 3,
  name: { en: "Counters and Tricks", ar: "العدّادات والحيل" },
  description: {
    en: "A number Robo Bunny remembers, and a trick it can do anywhere.",
    ar: "رقم يتذكّره الأرنب الآلي، وحيلة يمكنه تنفيذها في أي مكان.",
  },
  levels: [
    // ── LEARN: THE COUNTER ───────────────────────────────────────────────
    {
      slug: "learn-counter",
      order: 1,
      activityType: "CONCEPT_CARDS",
      track: "PROGRAMMING",
      title: { en: "Meet the Counter", ar: "تعرّف على العدّاد" },
      story: {
        en: "Mayor Mo wants every delivery bot to report how far it went. Robo Bunny has one pocket for remembering a number — the counter. Watch it count its own hops.",
        ar: "يريد العمدة مو من كل روبوت توصيل أن يبلّغ عن المسافة التي قطعها. للأرنب الآلي جيب واحد لتذكّر رقم — العدّاد. شاهده يعدّ قفزاته.",
      },
      objective: {
        en: "Introduce a variable: watch a program initialise a counter, increment it inside a loop and output it, then complete the increment.",
        ar: "تقديم المتغيّر: مشاهدة برنامج يهيّئ عدّادًا ويزيده داخل حلقة ثم يُخرجه، ثم إكمال خطوة الزيادة.",
      },
      mission: {
        en: "Watch Robo Bunny count its hops, then put the counting block back.",
        ar: "شاهد الأرنب الآلي يعدّ قفزاته، ثم أعد لبنة العدّ إلى مكانها.",
      },
      instructions: {
        en: "Watch first: the counter starts at 0, and every hop adds 1. Then it's your turn — the same program is missing the block that adds 1. Put it back inside the loop, after the hop.",
        ar: "شاهد أولًا: يبدأ العدّاد من 0، وكل قفزة تضيف 1. ثم يأتي دورك — البرنامج نفسه تنقصه اللبنة التي تضيف 1. أعدها داخل الحلقة، بعد القفزة.",
      },
      explanation: {
        en: "The counter is a variable: a named place to keep a number. 'Set counter to 0' puts a number in; 'add 1 to counter' changes what's there; 'say the counter' reads it out. Because the add is INSIDE the loop, it happens once per hop — so the counter ends up equal to the number of hops.",
        ar: "العدّاد متغيّر: مكان باسم لحفظ رقم. «اجعل العدّاد 0» يضع رقمًا فيه؛ و«أضف 1 إلى العدّاد» يغيّر ما فيه؛ و«قل قيمة العدّاد» يقرأه. ولأن الإضافة داخل الحلقة، فهي تحدث مرة مع كل قفزة — فينتهي العدّاد مساويًا لعدد القفزات.",
      },
      teacherNotes: {
        en: "Learn step for variables (no stars, XP only). Key idea to voice: the counter is one box that holds one number; 'add' changes the number in the box. Common misconception: putting 'say the counter' inside the loop (it then says 1, 2, 3 — a nice thing to try on purpose in Count the Hops).",
        ar: "خطوة تعلّم للمتغيّرات (بلا نجوم، نقاط XP فقط). الفكرة الأساسية التي ينبغي قولها صراحةً: العدّاد صندوق واحد يحمل رقمًا واحدًا؛ و«أضف» تغيّر الرقم الذي في الصندوق. تصوّر خاطئ شائع: وضع «قل قيمة العدّاد» داخل الحلقة (فيقول حينها 1، 2، 3 — وهي تجربة لطيفة تستحق أن تُجرَّب عمدًا في مستوى «عُدّ القفزات»).",
      },
      difficulty: "EASY",
      recommendedGradeMin: 5,
      recommendedGradeMax: 7,
      estimatedMinutes: 4,
      xpReward: 25,
      tags: ["variables"],
      requires: [],
      hints: [
        { tier: 1, text: { en: "The counter should grow by 1 on every hop. Which block grows the counter?", ar: "يجب أن يكبر العدّاد بمقدار 1 مع كل قفزة. أي لبنة تكبّر العدّاد؟" } },
        { tier: 2, text: { en: "Look at the toolbox: one block SETS the counter, one ADDS to it, one SAYS it. The gap needs the one that adds.", ar: "انظر إلى صندوق الأدوات: لبنة تضبط العدّاد، ولبنة تضيف إليه، ولبنة تقوله. الفراغ يحتاج إلى التي تضيف." } },
        { tier: 3, text: { en: "The gap is inside the loop, right after the hop — so the add happens once per hop.", ar: "الفراغ داخل الحلقة، بعد القفزة مباشرة — لتحدث الإضافة مرة مع كل قفزة." } },
        { tier: 4, text: { en: "Add the 'add 1 to counter' block under 'move forward', inside the Repeat, then press Check.", ar: "أضف لبنة «أضف 1 إلى العدّاد» تحت «تقدّم للأمام»، داخل «كرّر»، ثم اضغط «تحقّق»." } },
      ],
      payload: {
        conceptSlug: "variables",
        variants: [{ rows: ["...G", "...."], start: { x: 0, y: 0, dir: "E" } }],
        autoCollect: true,
        nonFatalBumps: false,
        workedExample: {
          blocks: hat(chain(set("s", 0), repeat("loop", 3, chain(move("hop"), add("count"))), sayCounter("say"))),
          caption: {
            en: "Watch: the counter starts at 0. Each hop adds 1. At the end Robo Bunny says 3.",
            ar: "شاهد: يبدأ العدّاد من 0. كل قفزة تضيف 1. في النهاية يقول الأرنب الآلي 3.",
          },
        },
        faded: {
          blocks: hat(chain(set("s", 0), repeat("loop", 3, move("hop")), sayCounter("say"))),
          toolbox: [
            { type: "bb_changeCounter", limit: 1 },
            { type: "bb_setCounter", limit: 1 },
            { type: "bb_sayCounter", limit: 1 },
          ],
          missingBlockType: "bb_changeCounter",
          caption: {
            en: "Your turn: the hop is inside the loop, but nothing counts it. Which block goes after the hop, so the counter grows by 1 each time?",
            ar: "دورك الآن: القفزة داخل الحلقة، لكن لا شيء يعدّها. أي لبنة توضع بعد القفزة ليكبر العدّاد بمقدار 1 كل مرة؟",
          },
        },
      } satisfies ConceptCardsDraft,
    },

    // ── COUNT THE HOPS ───────────────────────────────────────────────────
    {
      slug: "count-the-hops",
      order: 2,
      activityType: "BLOCK_CODING",
      track: "PROGRAMMING",
      title: { en: "Count the Hops", ar: "عُدّ القفزات" },
      story: {
        en: "First job on Counter Street: hop to the depot and tell Mayor Mo exactly how many hops it took. He checks. He always checks.",
        ar: "أول مهمة في شارع العدّاد: اقفز إلى المستودع وأخبر العمدة مو بعدد القفزات بالضبط. إنه يتحقق. دائمًا يتحقق.",
      },
      objective: {
        en: "Use a variable as an accumulator: increment a counter inside a loop and output its final value after the loop ends.",
        ar: "استخدام المتغيّر بوصفه مُراكمًا: زيادة عدّاد داخل حلقة وإخراج قيمته النهائية بعد انتهاء الحلقة.",
      },
      mission: {
        en: "Hop to the depot, counting every hop — then say the counter once at the end.",
        ar: "اقفز إلى المستودع وعُدّ كل قفزة — ثم قل قيمة العدّاد مرة واحدة في النهاية.",
      },
      instructions: {
        en: "Four hops to the depot. Add 1 to the counter for each one, then say the counter AFTER the loop — not inside it, or Robo Bunny will chatter all the way there.",
        ar: "أربع قفزات إلى المستودع. أضف 1 إلى العدّاد مع كل قفزة، ثم قل قيمة العدّاد بعد الحلقة — لا داخلها، وإلا سيثرثر الأرنب الآلي طوال الطريق.",
      },
      explanation: {
        en: "A counter that grows inside a loop is called an accumulator — it adds up as the loop runs. Saying it once after the loop reports the total; saying it inside would report 1, 2, 3, 4. Where a block sits (inside or after the loop) changes what the program does, not just how it looks.",
        ar: "العدّاد الذي يكبر داخل الحلقة يسمى مُراكمًا — يجمع مع كل دورة. قوله مرة بعد الحلقة يبلّغ عن المجموع؛ أما قوله داخلها فيبلّغ 1 و2 و3 و4. مكان اللبنة (داخل الحلقة أم بعدها) يغيّر ما يفعله البرنامج، لا شكله فقط.",
      },
      teacherNotes: {
        en: "Graded on the counter's final value (variableEquals 4) and on what is said (expectedOutput ['4'], secondary). A 'say' inside the loop gives PARTIAL with the feedback naming the words said — a good class discussion. There is no Set block here: the counter starts at 0, so the only way to reach 4 is to count (Add is a core check).",
        ar: "يُقيَّم بحسب القيمة النهائية للعدّاد (variableEquals 4) وبحسب ما يُقال (expectedOutput ['4']، ثانوي). وضع «قل» داخل الحلقة يعطي نتيجة PARTIAL مع ملاحظة تذكر الكلمات التي قيلت — وهذا موضوع جيد لنقاش صفّي. لا توجد هنا لبنة «اجعل العدّاد»: يبدأ العدّاد من 0، فالطريقة الوحيدة للوصول إلى 4 هي العدّ (لبنة «أضف» فحص أساسي).",
      },
      difficulty: "EASY",
      recommendedGradeMin: 5,
      recommendedGradeMax: 7,
      estimatedMinutes: 5,
      xpReward: 30,
      tags: ["variables", "loops"],
      requires: [],
      hints: [
        { tier: 1, text: { en: "A Repeat for the hops, with 'add 1 to counter' inside it, next to the hop.", ar: "لبنة «كرّر» للقفزات، وبداخلها «أضف 1 إلى العدّاد» بجانب القفزة." } },
        { tier: 2, text: { en: "Count the tiles to the depot: that's how many times the loop should repeat.", ar: "عُدّ المربعات حتى المستودع: هذا هو عدد مرات تكرار الحلقة." } },
        { tier: 3, text: { en: "'Say the counter' goes AFTER the Repeat — snap it under the loop's bottom edge, not inside its mouth.", ar: "«قل قيمة العدّاد» توضع بعد «كرّر» — ثبّتها تحت حافة الحلقة السفلية، لا داخل فمها." } },
        { tier: 4, text: { en: "Repeat 4: Move Forward, Add 1 to counter. Then Say the counter. Robo Bunny should say 4.", ar: "كرّر 4: تقدّم للأمام، أضف 1 إلى العدّاد. ثم قل قيمة العدّاد. يجب أن يقول الأرنب الآلي 4." } },
      ],
      payload: {
        toolbox: [
          { type: "bb_moveForward" },
          { type: "bb_repeat" },
          { type: "bb_changeCounter" },
          { type: "bb_sayCounter" },
        ],
        variants: [{ rows: ["....G", "....."], start: { x: 0, y: 0, dir: "E" } }],
        autoCollect: true,
        nonFatalBumps: false,
        checks: [
          { id: "reachedGoal", severity: "core" },
          { id: "variableEquals", severity: "core", params: { name: "counter", value: 4 } },
          { id: "usedBlock", severity: "core", params: { block: "bb_changeCounter" } },
          { id: "expectedOutput", severity: "secondary", params: { expected: ["4"] } },
        ],
        starCriteria: { threeStarMaxBlocks: 5 },
        startWorkspace,
        solution: hat(chain(repeat("loop", 4, chain(move("hop"), add("count"))), sayCounter("say"))),
      } satisfies BlockCodingDraft,
    },

    // ── OFF BY ONE (DEBUGGING) ───────────────────────────────────────────
    {
      slug: "off-by-one",
      order: 3,
      activityType: "DEBUGGING",
      track: "PROGRAMMING",
      title: { en: "Off by One", ar: "خطأ بواحد" },
      story: {
        en: "A delivery bot keeps reporting five hops for a four-hop street. Mayor Mo is not amused. The program is right here — something in it is wrong by exactly one.",
        ar: "روبوت توصيل يبلّغ باستمرار عن خمس قفزات في شارع من أربع قفزات. العمدة مو ليس مسرورًا. البرنامج هنا — شيء فيه خاطئ بمقدار واحد بالضبط.",
      },
      objective: {
        en: "Find and fix an off-by-one error caused by a wrong initial value, by tracing the variable's value through the loop.",
        ar: "إيجاد خطأ «الزيادة بواحد» الناتج عن قيمة ابتدائية خاطئة وإصلاحه، بتتبّع قيمة المتغيّر عبر الحلقة.",
      },
      mission: {
        en: "The bot says 5 for a 4-hop street. Fix the counting so it says 4.",
        ar: "يقول الروبوت 5 في شارع من 4 قفزات. أصلح العدّ ليقول 4.",
      },
      instructions: {
        en: "Run it first and listen. Then trace: what is the counter BEFORE the first hop? Write the number after each block. The bug is a single number.",
        ar: "شغّله أولًا واستمع. ثم تتبّع: كم قيمة العدّاد قبل القفزة الأولى؟ اكتب الرقم بعد كل لبنة. الخلل رقم واحد.",
      },
      explanation: {
        en: "The counter started at 1, so four adds made 5. Starting one too high (or one too low) is the most famous bug in programming — the off-by-one. The cure is the trace you just did: follow the variable's value block by block instead of guessing.",
        ar: "بدأ العدّاد من 1، فصنعت أربع إضافات 5. البدء بزيادة واحد (أو نقص واحد) هو أشهر خلل في البرمجة — خطأ «الزيادة بواحد». علاجه هو التتبّع الذي فعلته للتو: تابع قيمة المتغيّر لبنة لبنة بدل التخمين.",
      },
      teacherNotes: {
        en: "The broken program is fully working except 'set counter to 1'. Students may instead change the loop to 3 (then the bot stops short — reachedGoal fails, a located FAIL) or remove one 'add' — both give feedback that points back to the trace.",
        ar: "البرنامج المعطّل يعمل بالكامل باستثناء «اجعل العدّاد 1». قد يغيّر الطلاب بدلًا من ذلك الحلقة إلى 3 (فيتوقف الروبوت قبل الهدف — يفشل reachedGoal، وهي نتيجة FAIL محدَّدة الموضع) أو يحذفون إحدى لبنات «أضف» — وكلا الأمرين يعطي ملاحظات تعيد الطالب إلى التتبّع.",
      },
      difficulty: "MEDIUM",
      recommendedGradeMin: 5,
      recommendedGradeMax: 7,
      estimatedMinutes: 5,
      xpReward: 35,
      tags: ["debugging", "variables"],
      requires: [],
      hints: [
        { tier: 1, text: { en: "Listen to what Robo Bunny says, then count the hops on the map. The difference is the clue.", ar: "استمع إلى ما يقوله الأرنب الآلي، ثم عُدّ القفزات على الخريطة. الفرق هو الدليل." } },
        { tier: 2, text: { en: "Each hop adds 1. Four hops add 4. So what must the counter be BEFORE the loop for the answer to be 4?", ar: "كل قفزة تضيف 1. أربع قفزات تضيف 4. إذًا كم يجب أن يكون العدّاد قبل الحلقة ليكون الجواب 4؟" } },
        { tier: 3, text: { en: "Look at the very first block under 'when start'. The counter should start from nothing.", ar: "انظر إلى أول لبنة تحت «عند البدء». يجب أن يبدأ العدّاد من لا شيء." } },
        { tier: 4, text: { en: "Change 'set counter to 1' into 'set counter to 0'. Nothing else needs to change.", ar: "غيّر «اجعل العدّاد 1» إلى «اجعل العدّاد 0». لا شيء آخر يحتاج إلى تغيير." } },
      ],
      payload: {
        toolbox: [
          { type: "bb_moveForward" },
          { type: "bb_repeat" },
          { type: "bb_setCounter", limit: 1 },
          { type: "bb_changeCounter" },
          { type: "bb_sayCounter" },
        ],
        variants: [{ rows: ["....G", "....."], start: { x: 0, y: 0, dir: "E" } }],
        autoCollect: true,
        nonFatalBumps: false,
        checks: [
          { id: "reachedGoal", severity: "core" },
          { id: "variableEquals", severity: "core", params: { name: "counter", value: 4 } },
          { id: "usedBlock", severity: "core", params: { block: "bb_changeCounter" } },
          { id: "expectedOutput", severity: "secondary", params: { expected: ["4"] } },
        ],
        starCriteria: { threeStarMaxBlocks: 5 },
        brokenWorkspace: hat(chain(set("s", 1), repeat("loop", 4, chain(move("hop"), add("count"))), sayCounter("say"))),
        solution: hat(chain(set("s", 0), repeat("loop", 4, chain(move("hop"), add("count"))), sayCounter("say"))),
      } satisfies DebuggingDraft,
    },

    // ── CARROT COUNT ─────────────────────────────────────────────────────
    {
      slug: "carrot-count",
      order: 4,
      activityType: "BLOCK_CODING",
      track: "PROGRAMMING",
      title: { en: "Carrot Count", ar: "عدّ الجزر" },
      story: {
        en: "Crates of carrots are dropped along Counter Street. The market wants to know how many arrived — so count each crate as you pick it up, not each hop.",
        ar: "صناديق الجزر موضوعة على طول شارع العدّاد. يريد السوق أن يعرف كم صندوقًا وصل — فعُدّ كل صندوق عند التقاطه، لا كل قفزة.",
      },
      objective: {
        en: "Increment a variable only at chosen moments (on collection), separating 'what happened' from 'how many steps ran'.",
        ar: "زيادة المتغيّر في لحظات مختارة فقط (عند الالتقاط)، للتفريق بين «ما حدث» و«كم خطوة نُفّذت».",
      },
      mission: {
        en: "Pick up both crates, count them as you go, and say 2 at the depot.",
        ar: "التقط الصندوقين، وعُدّهما في طريقك، وقل 2 عند المستودع.",
      },
      instructions: {
        en: "The crates are on the second and fourth tiles. Add 1 to the counter right after the hop that lands on a crate — and nowhere else. Say the counter at the end.",
        ar: "الصندوقان على المربعين الثاني والرابع. أضف 1 إلى العدّاد بعد القفزة التي تهبط على صندوق مباشرة — ولا في أي مكان آخر. قل قيمة العدّاد في النهاية.",
      },
      explanation: {
        en: "This time the counter counts events, not steps: it only grows when something happens (a crate is picked up). The pattern hop-count-hop repeats twice, so a Repeat 2 around it keeps the program short — spot the repeat, and the counter still lands on 2.",
        ar: "هذه المرة يعدّ العدّاد الأحداث لا الخطوات: لا يكبر إلا عندما يحدث شيء (التقاط صندوق). نمط «اقفز، عُدّ، اقفز» يتكرر مرتين، فلبنة «كرّر 2» حوله تُبقي البرنامج قصيرًا — اكتشف التكرار، ويبقى العدّاد عند 2.",
      },
      teacherNotes: {
        en: "Three-star budget (6) needs the Repeat 2 { hop, add, hop } + hop + say pattern. Counting every hop instead gives counter 5 → variableEquals fails with 'the counter ended on 5, but it should be 2'. Carrots collect on entry (autoCollect), so no Collect block is needed.",
        ar: "ميزانية النجوم الثلاث (6) تتطلب النمط: «كرّر 2» { قفزة، أضف، قفزة } + قفزة + «قل». أما عدّ كل قفزة فيجعل العدّاد 5، فيفشل variableEquals برسالة «انتهى العدّاد عند 5، لكن يجب أن يكون 2». يُلتقط الجزر عند الدخول إلى مربعه (autoCollect)، لذا لا حاجة إلى لبنة «التقط».",
      },
      difficulty: "MEDIUM",
      recommendedGradeMin: 5,
      recommendedGradeMax: 7,
      estimatedMinutes: 6,
      xpReward: 40,
      tags: ["variables", "loops", "sequencing"],
      requires: [],
      hints: [
        { tier: 1, text: { en: "Only add to the counter when Robo Bunny lands on a crate. Which hops land on crates?", ar: "أضف إلى العدّاد فقط عندما يهبط الأرنب الآلي على صندوق. أي القفزات تهبط على صناديق؟" } },
        { tier: 2, text: { en: "Hop, add 1, hop — then the same again — then one more hop to the depot.", ar: "اقفز، أضف 1، اقفز — ثم الشيء نفسه مرة أخرى — ثم قفزة أخيرة إلى المستودع." } },
        { tier: 3, text: { en: "The pattern 'hop, add 1, hop' happens twice. Put it inside a Repeat 2 to save blocks.", ar: "النمط «اقفز، أضف 1، اقفز» يحدث مرتين. ضعه داخل «كرّر 2» لتوفير اللبنات." } },
        { tier: 4, text: { en: "Repeat 2: Move Forward, Add 1 to counter, Move Forward. Then Move Forward, then Say the counter.", ar: "كرّر 2: تقدّم للأمام، أضف 1 إلى العدّاد، تقدّم للأمام. ثم تقدّم للأمام، ثم قل قيمة العدّاد." } },
      ],
      payload: {
        toolbox: [
          { type: "bb_moveForward" },
          { type: "bb_repeat" },
          { type: "bb_changeCounter" },
          { type: "bb_sayCounter" },
        ],
        variants: [{ rows: [".C.C.G", "......"], start: { x: 0, y: 0, dir: "E" } }],
        autoCollect: true,
        nonFatalBumps: false,
        checks: [
          { id: "reachedGoal", severity: "core" },
          { id: "variableEquals", severity: "core", params: { name: "counter", value: 2 } },
          { id: "usedBlock", severity: "core", params: { block: "bb_changeCounter" } },
          { id: "collectedAll", severity: "secondary" },
          { id: "expectedOutput", severity: "secondary", params: { expected: ["2"] } },
        ],
        starCriteria: { threeStarMaxBlocks: 6 },
        startWorkspace,
        solution: hat(chain(repeat("loop", 2, chain(move("h1"), add("count"), move("h2"))), move("h3"), sayCounter("say"))),
      } satisfies BlockCodingDraft,
    },

    // ── LEARN: MY TRICK ──────────────────────────────────────────────────
    {
      slug: "learn-trick",
      order: 5,
      activityType: "CONCEPT_CARDS",
      track: "PROGRAMMING",
      title: { en: "Meet My Trick", ar: "تعرّف على «حيلتي»" },
      story: {
        en: "Every delivery in Code City turns the same corner the same way. Robo Bunny is tired of building it block by block — so it learns the corner ONCE, as a trick, and does the trick wherever it needs it.",
        ar: "كل توصيل في مدينة الشيفرة يدور حول الزاوية نفسها بالطريقة نفسها. سئم الأرنب الآلي من بنائها لبنة لبنة — فتعلّم الزاوية مرة واحدة بوصفها حيلة، وينفّذها حيثما يحتاج.",
      },
      objective: {
        en: "Introduce a procedure: watch a program define a named block sequence once and call it twice, then complete the second call.",
        ar: "تقديم الإجراء: مشاهدة برنامج يعرّف تسلسل لبنات باسم مرة واحدة ويستدعيه مرتين، ثم إكمال الاستدعاء الثاني.",
      },
      mission: {
        en: "Watch one trick draw an L, then put 'do my trick' back inside the loop.",
        ar: "شاهد حيلة واحدة ترسم شكل L، ثم أعد «نفّذ حيلتي» إلى داخل الحلقة.",
      },
      instructions: {
        en: "Watch: 'my trick' holds hop, hop, turn right. It doesn't run by itself — 'do my trick' runs it, and a Repeat 2 does that twice for an L to the depot. Then it's your turn: the loop's mouth is empty.",
        ar: "شاهد: «حيلتي» تحمل: اقفز، اقفز، استدر يمينًا. لا تعمل وحدها — «نفّذ حيلتي» تشغّلها، و«كرّر 2» تفعل ذلك مرتين لرسم شكل L حتى المستودع. ثم دورك: فم الحلقة فارغ.",
      },
      explanation: {
        en: "'My trick' is a function: a name for a list of blocks. Teaching it does nothing on its own; each 'do my trick' runs the whole list. Two calls, one definition — change the trick, and every call changes with it. Programmers call this 'don't repeat yourself'.",
        ar: "«حيلتي» دالّة: اسم لقائمة من اللبنات. تعليمها لا يفعل شيئًا وحده؛ كل «نفّذ حيلتي» تشغّل القائمة كلها. استدعاءان وتعريف واحد — غيّر الحيلة فيتغيّر معها كل استدعاء. يسمّي المبرمجون هذا «لا تكرّر نفسك».",
      },
      teacherNotes: {
        en: "Learn step for functions (no stars). 'my trick' is a separate top-level block, like 'when start' — it has no notch to snap under anything. The gap is the Repeat's mouth and the answer is 'do my trick'; the distractors are the blocks the trick contains, to surface the misconception that calling a trick means copying its blocks.",
        ar: "خطوة تعلّم للدوال (بلا نجوم). «حيلتي» لبنة مستقلة في المستوى الأعلى، مثل «عند البدء» — ليس فيها نتوء لتثبيتها تحت أي لبنة. الفراغ هو فم «كرّر» والإجابة هي «نفّذ حيلتي»؛ أما الخيارات المشتِّتة فهي اللبنات التي تحتويها الحيلة، لإظهار التصوّر الخاطئ بأن استدعاء الحيلة يعني نسخ لبناتها.",
      },
      difficulty: "EASY",
      recommendedGradeMin: 5,
      recommendedGradeMax: 7,
      estimatedMinutes: 4,
      xpReward: 25,
      tags: ["functions"],
      requires: [],
      hints: [
        { tier: 1, text: { en: "The trick is already taught. The loop needs to DO it — twice.", ar: "الحيلة معلَّمة بالفعل. تحتاج الحلقة إلى تنفيذها — مرتين." } },
        { tier: 2, text: { en: "'Do my trick' runs the whole trick — you don't need to copy its blocks into the loop.", ar: "«نفّذ حيلتي» تشغّل الحيلة كلها — لا تحتاج إلى نسخ لبناتها داخل الحلقة." } },
        { tier: 3, text: { en: "Only one block belongs in the loop's mouth: the one that does the trick.", ar: "لبنة واحدة فقط تنتمي إلى فم الحلقة: التي تنفّذ الحيلة." } },
        { tier: 4, text: { en: "Put 'do my trick' inside the Repeat 2, then press Check.", ar: "ضع «نفّذ حيلتي» داخل «كرّر 2»، ثم اضغط «تحقّق»." } },
      ],
      payload: {
        conceptSlug: "functions",
        variants: [{ rows: ["...", "...", "..G"], start: { x: 0, y: 0, dir: "E" } }],
        autoCollect: true,
        nonFatalBumps: false,
        workedExample: {
          blocks: hat(repeat("loop", 2, doTrick("d")), [trick("def", chain(move("m1"), move("m2"), { type: "bb_turnRight", id: "t" }))]),
          caption: {
            en: "Watch: the trick is hop, hop, turn right. A Repeat 2 does the trick twice — an L to the depot.",
            ar: "شاهد: الحيلة هي اقفز، اقفز، استدر يمينًا. «كرّر 2» تنفّذ الحيلة مرتين — شكل L حتى المستودع.",
          },
        },
        faded: {
          // The Repeat stays with an empty mouth: what the student supplies is
          // "do the trick" — not the trick's own blocks, which are the distractors.
          blocks: hat({ type: "bb_repeat", id: "loop", fields: { TIMES: 2 } }, [trick("def", chain(move("m1"), move("m2"), { type: "bb_turnRight", id: "t" }))]),
          toolbox: [
            { type: "bb_doTrick", limit: 1 },
            { type: "bb_moveForward", limit: 1 },
            { type: "bb_turnRight", limit: 1 },
          ],
          missingBlockType: "bb_doTrick",
          caption: {
            en: "Your turn: the Repeat 2 is there, but its mouth is empty. Which ONE block goes inside so the whole trick runs twice?",
            ar: "دورك الآن: «كرّر 2» موجودة، لكن فمها فارغ. أي لبنة واحدة توضع بداخلها لتعمل الحيلة كلها مرتين؟",
          },
        },
      } satisfies ConceptCardsDraft,
    },

    // ── TRICK OR LOOP ────────────────────────────────────────────────────
    {
      slug: "trick-or-loop",
      order: 6,
      activityType: "BLOCK_CODING",
      track: "PROGRAMMING",
      title: { en: "Trick or Loop", ar: "حيلة أم حلقة" },
      story: {
        en: "Stair Street goes down in steps: right, down, right, down. Twelve blocks by hand — or one trick and one loop. Professor Pip is timing you.",
        ar: "شارع الدرج ينزل درجات: يمين، أسفل، يمين، أسفل. اثنتا عشرة لبنة يدويًا — أو حيلة واحدة وحلقة واحدة. البروفيسور بيب يحسب لك الوقت.",
      },
      objective: {
        en: "Combine abstraction and iteration: define a procedure for a repeating movement pattern and call it from a loop.",
        ar: "الجمع بين التجريد والتكرار: تعريف إجراء لنمط حركة متكرر واستدعاؤه من داخل حلقة.",
      },
      mission: {
        en: "Teach Robo Bunny one stair step as a trick, then loop the trick down to the depot.",
        ar: "علّم الأرنب الآلي درجة واحدة من الدرج بوصفها حيلة، ثم كرّر الحيلة نزولًا إلى المستودع.",
      },
      instructions: {
        en: "One step of the stairs is: hop, turn right, hop, turn left. Put those four blocks inside 'my trick', then a Repeat 3 with 'do my trick' inside. Seven blocks earns three stars.",
        ar: "درجة واحدة من الدرج هي: اقفز، استدر يمينًا، اقفز، استدر يسارًا. ضع هذه اللبنات الأربع داخل «حيلتي»، ثم «كرّر 3» وبداخلها «نفّذ حيلتي». سبع لبنات تكسب ثلاث نجوم.",
      },
      explanation: {
        en: "A trick inside a loop: the loop says HOW MANY times, the trick says WHAT one step is. Change the stairs to five steps and only the loop's number changes; change the shape of a step and only the trick changes. Splitting a program into named parts is what makes big programs possible.",
        ar: "حيلة داخل حلقة: الحلقة تقول كم مرة، والحيلة تقول ما هي الدرجة الواحدة. غيّر الدرج إلى خمس درجات فلا يتغير إلا رقم الحلقة؛ وغيّر شكل الدرجة فلا تتغير إلا الحيلة. تقسيم البرنامج إلى أجزاء باسم هو ما يجعل البرامج الكبيرة ممكنة.",
      },
      teacherNotes: {
        en: "Solvable with twelve plain blocks, but that is PARTIAL (1 star); the trick earns 3 stars within the seven-block budget. usedTrick is secondary: a program that reaches the depot without calling a taught trick is PARTIAL with the feedback 'This level needs the do my trick block', and an empty trick does not count. Rocks make the staircase the only route.",
        ar: "يمكن حلّه باثنتي عشرة لبنة عادية، لكن النتيجة PARTIAL (نجمة واحدة)؛ أما الحيلة فتنال 3 نجوم ضمن ميزانية السبع لبنات. فحص usedTrick ثانوي: البرنامج الذي يصل إلى المستودع دون استدعاء حيلة مُعلَّمة ينال PARTIAL مع الملاحظة «هذا المستوى يحتاج إلى لبنة نفّذ حيلتي»، والحيلة الفارغة لا تُحتسب. الصخور تجعل الدرج المسار الوحيد.",
      },
      difficulty: "MEDIUM",
      recommendedGradeMin: 5,
      recommendedGradeMax: 7,
      estimatedMinutes: 7,
      xpReward: 45,
      tags: ["functions", "loops"],
      requires: [],
      hints: [
        { tier: 1, text: { en: "Which four blocks make ONE step of the stairs? That's your trick.", ar: "أي أربع لبنات تصنع درجة واحدة من الدرج؟ هذه هي حيلتك." } },
        { tier: 2, text: { en: "'My trick' is its own block on the canvas — it doesn't snap under 'when start'. Build the step inside it.", ar: "«حيلتي» لبنة مستقلة على اللوحة — لا تثبَّت تحت «عند البدء». ابنِ الدرجة بداخلها." } },
        { tier: 3, text: { en: "Under 'when start': a Repeat with 'do my trick' inside. Count the stair steps for the Repeat number.", ar: "تحت «عند البدء»: «كرّر» وبداخلها «نفّذ حيلتي». عُدّ درجات الدرج لرقم «كرّر»." } },
        { tier: 4, text: { en: "My trick: Move, Turn Right, Move, Turn Left. Program: Repeat 3, do my trick.", ar: "حيلتي: تقدّم، استدر يمينًا، تقدّم، استدر يسارًا. البرنامج: كرّر 3، نفّذ حيلتي." } },
      ],
      payload: {
        toolbox: [
          { type: "bb_moveForward" },
          { type: "bb_turnLeft" },
          { type: "bb_turnRight" },
          { type: "bb_repeat" },
          { type: "bb_defineTrick", limit: 1 },
          { type: "bb_doTrick" },
        ],
        variants: [{ rows: ["..#.", "#..#", ".#..", "..#G"], start: { x: 0, y: 0, dir: "E" } }],
        autoCollect: true,
        nonFatalBumps: false,
        checks: [
          { id: "reachedGoal", severity: "core" },
          { id: "usedTrick", severity: "secondary" },
        ],
        starCriteria: { threeStarMaxBlocks: 7 },
        startWorkspace,
        solution: hat(repeat("loop", 3, doTrick("d")), [
          trick("def", chain(move("m1"), { type: "bb_turnRight", id: "t1" }, move("m2"), { type: "bb_turnLeft", id: "t2" })),
        ]),
      } satisfies BlockCodingDraft,
    },

    // ── CITY PARADE (finale) ─────────────────────────────────────────────
    {
      slug: "city-parade",
      order: 7,
      activityType: "BLOCK_CODING",
      track: "PROGRAMMING",
      title: { en: "City Parade", ar: "موكب المدينة" },
      story: {
        en: "Parade day! Robo Bunny leads the floats around the town square — a crate at every corner — and Mayor Mo wants the corner count announced at the finish. One trick, one loop, one counter.",
        ar: "يوم الموكب! يقود الأرنب الآلي العربات حول ساحة البلدة — صندوق عند كل زاوية — ويريد العمدة مو إعلان عدد الزوايا عند النهاية. حيلة واحدة، وحلقة واحدة، وعدّاد واحد.",
      },
      objective: {
        en: "Capstone: combine a procedure, a loop and an accumulator variable in one program, and report the accumulated value.",
        ar: "مشروع ختامي: الجمع بين إجراء وحلقة ومتغيّر مُراكم في برنامج واحد، والإبلاغ عن القيمة المتراكمة.",
      },
      mission: {
        en: "Lap the square with one trick, count each corner, and say 3 at the finish.",
        ar: "طف حول الساحة بحيلة واحدة، وعُدّ كل زاوية، وقل 3 عند النهاية.",
      },
      instructions: {
        en: "One side of the square is: hop, hop, turn right, add 1 to counter — teach that as your trick. Do it three times, hop once more to the finish, and say the counter.",
        ar: "ضلع واحد من الساحة هو: اقفز، اقفز، استدر يمينًا، أضف 1 إلى العدّاد — علّم ذلك بوصفه حيلتك. نفّذها ثلاث مرات، اقفز مرة أخرى إلى النهاية، وقل قيمة العدّاد.",
      },
      explanation: {
        en: "Everything Code City taught in one program: a trick that names a side of the square, a loop that repeats it, and a counter that grows inside the trick so it ends on 3. When you open the Code tab you'll see a real function, a real for loop and a real variable — the same three ideas every programming language is built from.",
        ar: "كل ما علّمته مدينة الشيفرة في برنامج واحد: حيلة تسمّي ضلع الساحة، وحلقة تكرّرها، وعدّاد يكبر داخل الحيلة لينتهي عند 3. عندما تفتح تبويب «الكود» سترى دالّة حقيقية وحلقة for حقيقية ومتغيّرًا حقيقيًا — الأفكار الثلاث نفسها التي تُبنى منها كل لغة برمجة.",
      },
      teacherNotes: {
        en: "Finale of the module. The counter is incremented INSIDE the trick (once per side), which surprises students who expect the loop to do the counting — either placement gives 3 here; ask them why. Using the trick is a secondary check: a correct route without it is PARTIAL. Carrots on three corners are collected on entry.",
        ar: "ختام الوحدة. يُزاد العدّاد داخل الحيلة (مرة لكل ضلع)، وهذا يفاجئ الطلاب الذين يتوقعون أن تتولى الحلقة العدّ — كلا الموضعين يعطي 3 هنا؛ اسألهم لماذا. استخدام الحيلة فحص ثانوي: المسار الصحيح دونها يُعدّ PARTIAL (جزئيًا). الجزر في الزوايا الثلاث يُلتقط عند الدخول إلى مربعه.",
      },
      difficulty: "HARD",
      recommendedGradeMin: 5,
      recommendedGradeMax: 7,
      estimatedMinutes: 8,
      xpReward: 55,
      tags: ["functions", "variables", "loops"],
      requires: [],
      hints: [
        { tier: 1, text: { en: "Each side of the square is the same four things. Make them your trick.", ar: "كل ضلع من الساحة هو الأشياء الأربعة نفسها. اجعلها حيلتك." } },
        { tier: 2, text: { en: "The counter can grow inside the trick: 'add 1 to counter' as the trick's last block counts one corner per side.", ar: "يمكن للعدّاد أن يكبر داخل الحيلة: «أضف 1 إلى العدّاد» بوصفها آخر لبنة في الحيلة تعدّ زاوية واحدة لكل ضلع." } },
        { tier: 3, text: { en: "Three sides bring Robo Bunny to the last corner, facing the finish. One more hop, then say the counter.", ar: "ثلاثة أضلاع توصل الأرنب الآلي إلى الزاوية الأخيرة، مواجهًا خط النهاية. قفزة أخرى، ثم قل قيمة العدّاد." } },
        { tier: 4, text: { en: "My trick: Move, Move, Turn Right, Add 1 to counter. Program: Repeat 3 (do my trick), Move Forward, Say the counter.", ar: "حيلتي: تقدّم، تقدّم، استدر يمينًا، أضف 1 إلى العدّاد. البرنامج: كرّر 3 (نفّذ حيلتي)، تقدّم للأمام، قل قيمة العدّاد." } },
      ],
      payload: {
        toolbox: [
          { type: "bb_moveForward" },
          { type: "bb_turnLeft" },
          { type: "bb_turnRight" },
          { type: "bb_repeat" },
          { type: "bb_defineTrick", limit: 1 },
          { type: "bb_doTrick" },
          { type: "bb_changeCounter" },
          { type: "bb_sayCounter" },
        ],
        variants: [{ rows: ["..C", "G#.", "C.C"], start: { x: 0, y: 0, dir: "E" } }],
        autoCollect: true,
        nonFatalBumps: false,
        checks: [
          { id: "reachedGoal", severity: "core" },
          { id: "variableEquals", severity: "core", params: { name: "counter", value: 3 } },
          { id: "usedBlock", severity: "core", params: { block: "bb_changeCounter" } },
          { id: "usedTrick", severity: "secondary" },
          { id: "collectedAll", severity: "secondary" },
          { id: "expectedOutput", severity: "secondary", params: { expected: ["3"] } },
        ],
        starCriteria: { threeStarMaxBlocks: 9 },
        startWorkspace,
        solution: hat(chain(repeat("loop", 3, doTrick("d")), move("last"), sayCounter("say")), [
          trick("def", chain(move("m1"), move("m2"), { type: "bb_turnRight", id: "t1" }, add("count"))),
        ]),
      } satisfies BlockCodingDraft,
    },
  ],
};
