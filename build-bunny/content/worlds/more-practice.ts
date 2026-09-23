import type { z } from "zod";
import type {
  LevelFixture,
  blockCodingPayload,
  debuggingPayload,
  sequencingPayload,
} from "@/modules/curriculum/schemas";

import {
  collect,
  hat,
  hints,
  ifBlocked,
  left,
  move,
  repeat,
  right,
  startWorkspace,
  t,
  untilGoal,
} from "./kit";

/**
 * More practice for the first three worlds (curriculum toward 100 levels):
 * three per world, appended to each world's practice module, using only the
 * blocks that world has already taught. Every one is proven by the publish
 * gates (its solution passes with three stars; every goal and carrot is
 * reachable) and by the playthrough integration test.
 */

type BlockCodingDraft = z.input<typeof blockCodingPayload>;
type DebuggingDraft = z.input<typeof debuggingPayload>;
type SequencingDraft = z.input<typeof sequencingPayload>;

// ── Bunny Meadow — Practice Paddock, levels 4–6 ────────────────────────────

export const meadowMore: LevelFixture[] = [
  {
    slug: "carrot-row",
    order: 4,
    activityType: "BLOCK_CODING",
    track: "PROGRAMMING",
    title: t("Carrot Row", "صفّ الجزر"),
    story: t(
      "Grandma Clover planted a straight row of carrots right up to the burrow. One Repeat can pick them all.",
      "زرعت الجدّة كلوفر صفًّا مستقيمًا من الجزر حتى الجحر. «كرّر» واحدة تستطيع التقاطها كلها.",
    ),
    objective: t(
      "Use a counted loop to travel a straight path, collecting items on the way, and set the count from the map.",
      "استخدام حلقة معدودة لقطع مسار مستقيم وجمع العناصر في الطريق، وضبط العدد من الخريطة.",
    ),
    mission: t("Hop down the carrot row to the burrow with one Repeat.", "اقفز على صفّ الجزر حتى الجحر بلبنة «كرّر» واحدة."),
    instructions: t(
      "Carrots are picked up when Robo Bunny hops onto them. Count the squares to the burrow, put one Move Forward inside a Repeat and set the number.",
      "يُلتقط الجزر عندما يقفز الأرنب الآلي عليه. عُدّ المربعات حتى الجحر، وضع «تقدّم للأمام» واحدة داخل «كرّر» واضبط الرقم.",
    ),
    explanation: t(
      "Hopping over a carrot picks it up, so a straight row needs no extra blocks — just enough hops. Five hops, one loop: the number in the Repeat is the length of the row.",
      "القفز فوق الجزرة يلتقطها، لذلك لا يحتاج الصفّ المستقيم إلى لبنات إضافية — فقط قفزات كافية. خمس قفزات وحلقة واحدة: الرقم في «كرّر» هو طول الصف.",
    ),
    teacherNotes: { en: "Starter practice for Repeat. Five plain hops pass with two stars; the loop earns three.", ar: "تمرين تمهيدي على «كرّر». خمس قفزات عادية تنجح بنجمتين؛ أما الحلقة فتنال ثلاث نجوم." },
    difficulty: "EASY",
    recommendedGradeMin: 3,
    recommendedGradeMax: 4,
    estimatedMinutes: 3,
    xpReward: 20,
    tags: ["loops"],
    requires: [],
    hints: hints(
      ["Count the squares between Robo Bunny and the burrow.", "عُدّ المربعات بين الأرنب الآلي والجحر."],
      ["Carrots are picked up just by hopping onto them.", "يُلتقط الجزر بمجرد القفز عليه."],
      ["One Move Forward inside a Repeat, and change the Repeat's number.", "«تقدّم للأمام» واحدة داخل «كرّر»، وغيّر رقم «كرّر»."],
      ["Repeat 5 times: Move Forward.", "كرّر 5 مرات: تقدّم للأمام."],
    ),
    payload: {
      toolbox: [{ type: "bb_moveForward" }, { type: "bb_repeat" }],
      variants: [{ rows: [".C.C.G", "......"], start: { x: 0, y: 0, dir: "E" } }],
      autoCollect: true,
      nonFatalBumps: false,
      checks: [
        { id: "reachedGoal", severity: "core" },
        { id: "collectedAll", severity: "secondary" },
      ],
      starCriteria: { threeStarMaxBlocks: 2 },
      startWorkspace,
      solution: hat(repeat(5, move())),
    } satisfies BlockCodingDraft,
  },
  {
    slug: "round-the-rock",
    order: 5,
    activityType: "BLOCK_CODING",
    track: "PROGRAMMING",
    title: t("Round the Rock", "حول الصخرة"),
    story: t(
      "A big rock sits between Robo Bunny and the burrow. Down, along, and home.",
      "صخرة كبيرة تقع بين الأرنب الآلي والجحر. إلى الأسفل، ثم على الطول، ثم إلى البيت.",
    ),
    objective: t(
      "Plan a short route with two turns around an obstacle, turning from the bunny's point of view.",
      "تخطيط مسار قصير باستدارتين حول عائق، مع الاستدارة من وجهة نظر الأرنب.",
    ),
    mission: t("Go round the rock to the burrow — down first, then along.", "التفّ حول الصخرة إلى الجحر — إلى الأسفل أولًا، ثم على الطول."),
    instructions: t(
      "Robo Bunny faces right, and the rock is right in front. Turn to face down, hop, turn back to face right, and hop to the burrow.",
      "ينظر الأرنب الآلي إلى اليمين، والصخرة أمامه تمامًا. استدر لتنظر إلى الأسفل، واقفز، ثم استدر لتنظر إلى اليمين مجددًا، واقفز إلى الجحر.",
    ),
    explanation: t(
      "Turn right, then later turn left, and Robo Bunny faces the way it started — two turns that cancel out. Going around something is often exactly that: a turn away and a turn back.",
      "استدر يمينًا، ثم لاحقًا يسارًا، فيعود الأرنب الآلي إلى الاتجاه الذي بدأ به — استدارتان تلغي إحداهما الأخرى. الالتفاف حول شيء هو غالبًا هذا بالضبط: استدارة بعيدًا ثم استدارة للعودة.",
    ),
    teacherNotes: { en: "Five blocks. Children who turn left first hop off the top of the map — a located bump that is worth acting out.", ar: "خمس لبنات. الأطفال الذين يستديرون يسارًا أولًا يقفزون خارج أعلى الخريطة — وهو اصطدام محدد الموقع يستحق تمثيله حركيًا." },
    difficulty: "EASY",
    recommendedGradeMin: 3,
    recommendedGradeMax: 4,
    estimatedMinutes: 4,
    xpReward: 20,
    tags: ["sequencing"],
    requires: [],
    hints: hints(
      ["Which way is 'down' from where Robo Bunny is looking?", "أي جهة هي «الأسفل» من حيث ينظر الأرنب الآلي؟"],
      ["Facing right, a Turn Right makes Robo Bunny face down.", "عندما ينظر إلى اليمين، تجعله «استدر يمينًا» ينظر إلى الأسفل."],
      ["After one hop down, turn left to face right again.", "بعد قفزة واحدة إلى الأسفل، استدر يسارًا لتنظر إلى اليمين مجددًا."],
      ["Turn Right, Move Forward, Turn Left, Move Forward, Move Forward.", "استدر يمينًا، تقدّم للأمام، استدر يسارًا، تقدّم للأمام، تقدّم للأمام."],
    ),
    payload: {
      toolbox: [{ type: "bb_moveForward" }, { type: "bb_turnLeft" }, { type: "bb_turnRight" }],
      variants: [{ rows: [".#.", "..G"], start: { x: 0, y: 0, dir: "E" } }],
      autoCollect: true,
      nonFatalBumps: false,
      checks: [{ id: "reachedGoal", severity: "core" }],
      starCriteria: { threeStarMaxBlocks: 5 },
      startWorkspace,
      solution: hat(right(), move(), left(), move(), move()),
    } satisfies BlockCodingDraft,
  },
  {
    slug: "garden-steps",
    order: 6,
    activityType: "BLOCK_CODING",
    track: "PROGRAMMING",
    title: t("Garden Steps", "درجات الحديقة"),
    story: t(
      "The garden path goes down like stairs: right, down, right, down. Spot the step that repeats.",
      "ينزل طريق الحديقة كالدرج: يمين، أسفل، يمين، أسفل. اكتشف الدرجة التي تتكرر.",
    ),
    objective: t(
      "Recognise a repeating multi-step pattern in a route and express it as a loop body of several blocks.",
      "التعرّف على نمط متكرر من عدة خطوات في مسار والتعبير عنه بجسم حلقة من عدة لبنات.",
    ),
    mission: t("Walk the garden steps to the burrow — find the step that repeats.", "امشِ على درجات الحديقة إلى الجحر — اعثر على الدرجة التي تتكرر."),
    instructions: t(
      "One step is: hop, turn right, hop, turn left. Put all four inside a Repeat, then one last hop.",
      "الدرجة الواحدة هي: اقفز، استدر يمينًا، اقفز، استدر يسارًا. ضع الأربع كلها داخل «كرّر»، ثم قفزة أخيرة.",
    ),
    explanation: t(
      "A loop can repeat a whole little dance, not just one hop. The step 'hop, turn, hop, turn back' happened twice, so a Repeat 2 holds it — and one more hop reaches home.",
      "يمكن للحلقة أن تكرّر رقصة صغيرة كاملة، لا قفزة واحدة فقط. الدرجة «اقفز، استدر، اقفز، استدر للعودة» حدثت مرتين، لذا تحملها «كرّر 2» — وقفزة أخرى توصل إلى البيت.",
    ),
    teacherNotes: { en: "Multi-block loop body. Nine plain blocks pass with two stars; six with the loop earn three.", ar: "جسم حلقة من عدة لبنات. تسع لبنات عادية تنجح بنجمتين؛ وست لبنات مع الحلقة تنال ثلاث نجوم." },
    difficulty: "MEDIUM",
    recommendedGradeMin: 3,
    recommendedGradeMax: 5,
    estimatedMinutes: 6,
    xpReward: 30,
    tags: ["loops", "sequencing"],
    requires: [],
    hints: hints(
      ["Trace the path with your finger. What shape repeats?", "تتبّع المسار بإصبعك. أي شكل يتكرر؟"],
      ["One step down the stairs uses two hops and two turns.", "الدرجة الواحدة تستخدم قفزتين واستدارتين."],
      ["Hop, turn right, hop, turn left — twice. Then one more hop.", "اقفز، استدر يمينًا، اقفز، استدر يسارًا — مرتين. ثم قفزة أخرى."],
      ["Repeat 2: Move, Turn Right, Move, Turn Left. Then Move Forward.", "كرّر 2: تقدّم، استدر يمينًا، تقدّم، استدر يسارًا. ثم تقدّم للأمام."],
    ),
    payload: {
      toolbox: [{ type: "bb_moveForward" }, { type: "bb_turnLeft" }, { type: "bb_turnRight" }, { type: "bb_repeat" }],
      variants: [{ rows: ["..##", "#..#", "##.G"], start: { x: 0, y: 0, dir: "E" } }],
      autoCollect: true,
      nonFatalBumps: false,
      checks: [{ id: "reachedGoal", severity: "core" }],
      starCriteria: { threeStarMaxBlocks: 6 },
      startWorkspace,
      solution: hat(repeat(2, move(), right(), move(), left()), move()),
    } satisfies BlockCodingDraft,
  },
];

// ── Logic Forest — Forest Practice, levels 3–5 ─────────────────────────────

export const forestMore: LevelFixture[] = [
  {
    slug: "tree-or-clear",
    order: 3,
    activityType: "BLOCK_CODING",
    track: "PROGRAMMING",
    title: t("Tree or Clear?", "شجرة أم طريق مفتوح؟"),
    story: t(
      "On one map a tree has fallen across the path; on the other it hasn't. Oona's lantern shows Robo Bunny which — if it looks first.",
      "في إحدى الخريطتين سقطت شجرة على الطريق؛ وفي الأخرى لم تسقط. فانوس أونا يُري الأرنب الآلي أيهما — إن نظر أولًا.",
    ),
    objective: t(
      "Use a single conditional to run one extra instruction only when the sensor detects an obstacle, across two maps.",
      "استخدام شرط واحد لتنفيذ تعليمة إضافية فقط عندما يكتشف المستشعر عائقًا، عبر خريطتين.",
    ),
    mission: t("One program for both maps: turn only if a tree is in the way.", "برنامج واحد للخريطتين: استدر فقط إن كانت شجرة في الطريق."),
    instructions: t(
      "Put Turn Left inside an If with 'path ahead is blocked'. After the If, one hop reaches the burrow on both maps.",
      "ضع «استدر يسارًا» داخل «إذا» مع «الطريق أمامي مسدود». بعد «إذا»، قفزة واحدة تصل إلى الجحر في الخريطتين.",
    ),
    explanation: t(
      "The If turned Robo Bunny on the map with the tree and did nothing on the clear one. Only the turn needed deciding; the hop happens either way, so it sits after the If.",
      "أدارت «إذا» الأرنب الآلي في الخريطة التي فيها الشجرة ولم تفعل شيئًا في المفتوحة. الاستدارة وحدها تحتاج إلى قرار؛ أما القفزة فتحدث في الحالتين، لذا توضع بعد «إذا».",
    ),
    teacherNotes: { en: "Two variants graded together. A program that always turns fails the clear map; one that never turns bumps the tree.", ar: "خريطتان تُقيَّمان معًا. البرنامج الذي يستدير دائمًا يفشل في الخريطة المفتوحة؛ والذي لا يستدير أبدًا يصطدم بالشجرة." },
    difficulty: "MEDIUM",
    recommendedGradeMin: 4,
    recommendedGradeMax: 6,
    estimatedMinutes: 4,
    xpReward: 30,
    tags: ["logic"],
    requires: [],
    hints: hints(
      ["What is different between the two maps?", "ما الفرق بين الخريطتين؟"],
      ["Only the turn depends on the tree. The hop is needed on both maps.", "الاستدارة وحدها تعتمد على الشجرة. القفزة مطلوبة في الخريطتين."],
      ["If 'path ahead is blocked': Turn Left. Then Move Forward, outside the If.", "إذا «الطريق أمامي مسدود»: استدر يسارًا. ثم تقدّم للأمام، خارج «إذا»."],
      ["Three blocks: If (blocked) { Turn Left }, then Move Forward.", "ثلاث لبنات: إذا (مسدود) { استدر يسارًا }، ثم تقدّم للأمام."],
    ),
    payload: {
      toolbox: [
        { type: "bb_moveForward" },
        { type: "bb_turnLeft" },
        { type: "bb_turnRight" },
        { type: "bb_if" },
        { type: "bb_pathAhead" },
      ],
      variants: [
        { rows: ["G.", ".#"], start: { x: 0, y: 1, dir: "E" } },
        { rows: ["..", ".G"], start: { x: 0, y: 1, dir: "E" } },
      ],
      autoCollect: true,
      nonFatalBumps: false,
      checks: [
        { id: "reachedGoal", severity: "core" },
        { id: "usedBlock", severity: "secondary", params: { block: "bb_if" } },
      ],
      starCriteria: { threeStarMaxBlocks: 3 },
      startWorkspace,
      solution: hat(ifBlocked(left()), move()),
    } satisfies BlockCodingDraft,
  },
  {
    slug: "debug-the-trail",
    order: 4,
    activityType: "DEBUGGING",
    track: "PROGRAMMING",
    title: t("Debug the Trail", "أصلح الدرب"),
    story: t(
      "Someone wrote Robo Bunny a route through the ferns, but it walks straight off the map. Two blocks are the wrong way round.",
      "كتب أحدهم للأرنب الآلي طريقًا عبر السرخس، لكنه يمشي خارج الخريطة مباشرة. لبنتان في الاتجاه الخاطئ.",
    ),
    objective: t(
      "Find and fix swapped turn instructions in a short program by running it and reading where it fails.",
      "إيجاد تعليمات استدارة مبدَّلة وإصلاحها في برنامج قصير بتشغيله وقراءة مكان فشله.",
    ),
    mission: t("Fix the two turns so Robo Bunny reaches the burrow.", "أصلح الاستدارتين ليصل الأرنب الآلي إلى الجحر."),
    instructions: t(
      "Run it first and watch where it goes wrong. The hops are fine — look at the turns.",
      "شغّله أولًا وراقب أين يخطئ. القفزات سليمة — انظر إلى الاستدارات.",
    ),
    explanation: t(
      "The route turned left where it needed right, and right where it needed left — so Robo Bunny went up instead of down. Running a program and watching the first wrong step is the fastest way to find a bug.",
      "استدار الطريق يسارًا حيث كان يلزم يمينًا، ويمينًا حيث كان يلزم يسارًا — فذهب الأرنب الآلي إلى الأعلى بدل الأسفل. تشغيل البرنامج ومراقبة أول خطوة خاطئة هو أسرع طريقة لإيجاد الخلل.",
    ),
    teacherNotes: { en: "Only the two turns are wrong. Ask children to say which step first went wrong before they touch a block.", ar: "الخطأ في الاستدارتين فقط. اطلب من الأطفال أن يحددوا أول خطوة أخطأت قبل أن يلمسوا أي لبنة." },
    difficulty: "EASY",
    recommendedGradeMin: 4,
    recommendedGradeMax: 6,
    estimatedMinutes: 4,
    xpReward: 30,
    tags: ["debugging", "sequencing"],
    requires: [],
    hints: hints(
      ["Press Run and watch the first thing that goes wrong.", "اضغط «تشغيل» وراقب أول شيء يخطئ."],
      ["After the first hop, Robo Bunny should go DOWN. Which turn does that?", "بعد القفزة الأولى يجب أن يذهب الأرنب الآلي إلى الأسفل. أي استدارة تفعل ذلك؟"],
      ["Swap the Turn Left and the Turn Right.", "بدّل «استدر يسارًا» و«استدر يمينًا»."],
      ["Move, Turn Right, Move, Turn Left, Move.", "تقدّم، استدر يمينًا، تقدّم، استدر يسارًا، تقدّم."],
    ),
    payload: {
      toolbox: [{ type: "bb_moveForward" }, { type: "bb_turnLeft" }, { type: "bb_turnRight" }],
      variants: [{ rows: ["...", "#.G"], start: { x: 0, y: 0, dir: "E" } }],
      autoCollect: true,
      nonFatalBumps: false,
      checks: [{ id: "reachedGoal", severity: "core" }],
      starCriteria: { threeStarMaxBlocks: 5 },
      brokenWorkspace: hat(move(), left(), move(), right(), move()),
      solution: hat(move(), right(), move(), left(), move()),
    } satisfies DebuggingDraft,
  },
  {
    slug: "until-the-carrots",
    order: 5,
    activityType: "BLOCK_CODING",
    track: "PROGRAMMING",
    title: t("Until the Carrots Run Out", "حتى ينتهي الجزر"),
    story: t(
      "Two carrot trails, one short and one long. Robo Bunny can't count them in advance — but it can keep going until it's home.",
      "دربان للجزر، أحدهما قصير والآخر طويل. لا يستطيع الأرنب الآلي عدّها مسبقًا — لكنه يستطيع المواصلة حتى يصل إلى البيت.",
    ),
    objective: t(
      "Use a condition-controlled loop to complete paths of unknown length while collecting items on the way.",
      "استخدام حلقة يتحكم فيها شرط لإكمال مسارات مجهولة الطول مع جمع العناصر في الطريق.",
    ),
    mission: t("Collect every carrot on both trails with one loop.", "اجمع كل جزرة في الدربين بحلقة واحدة."),
    instructions: t(
      "A Repeat with a number only fits one trail. Repeat until I reach the goal fits both — and hopping over carrots picks them up.",
      "«كرّر» برقم تناسب دربًا واحدًا فقط. «كرّر حتى أصل إلى الهدف» تناسب الدربين — والقفز فوق الجزر يلتقطه.",
    ),
    explanation: t(
      "'Until' asks 'am I home yet?' before every hop, so the same two blocks walk a short trail or a long one. Carrots on the way come along for free.",
      "تسأل «حتى» «هل وصلت إلى البيت؟» قبل كل قفزة، فتمشي اللبنتان نفسهما دربًا قصيرًا أو طويلًا. والجزر في الطريق يأتي مجانًا.",
    ),
    teacherNotes: { en: "Two variants of different lengths. A counted Repeat fits only one of them.", ar: "خريطتان بطولين مختلفين. «كرّر» بعدد ثابت تناسب واحدة منهما فقط." },
    difficulty: "MEDIUM",
    recommendedGradeMin: 4,
    recommendedGradeMax: 6,
    estimatedMinutes: 4,
    xpReward: 30,
    tags: ["loops", "logic"],
    requires: [],
    hints: hints(
      ["The two trails are different lengths.", "الدربان بطولين مختلفين."],
      ["Which loop doesn't need a number?", "أي حلقة لا تحتاج إلى رقم؟"],
      ["Repeat until I reach the goal, with one hop inside.", "«كرّر حتى أصل إلى الهدف» وبداخلها قفزة واحدة."],
      ["Two blocks: Repeat until I reach the goal { Move Forward }.", "لبنتان: كرّر حتى أصل إلى الهدف { تقدّم للأمام }."],
    ),
    payload: {
      toolbox: [{ type: "bb_moveForward" }, { type: "bb_repeat" }, { type: "bb_repeatUntilGoal" }],
      variants: [
        { rows: [".C.G", "...."], start: { x: 0, y: 0, dir: "E" } },
        { rows: [".CC.C.G", "......."], start: { x: 0, y: 0, dir: "E" } },
      ],
      autoCollect: true,
      nonFatalBumps: false,
      checks: [
        { id: "reachedGoal", severity: "core" },
        { id: "collectedAll", severity: "secondary" },
        { id: "usedBlock", severity: "secondary", params: { block: "bb_repeatUntilGoal" } },
      ],
      starCriteria: { threeStarMaxBlocks: 2 },
      startWorkspace,
      solution: hat(untilGoal(move())),
    } satisfies BlockCodingDraft,
  },
];

// ── Robot Lab — Lab Practice, levels 3–5 (nothing collects itself here) ────

export const labMore: LevelFixture[] = [
  {
    slug: "battery-row",
    order: 3,
    activityType: "BLOCK_CODING",
    track: "PROGRAMMING",
    title: t("Battery Row", "صفّ البطاريات"),
    story: t(
      "Three battery cells lie on every other tile of the corridor. In the lab, each one has to be picked up on purpose.",
      "ثلاث خلايا بطارية ملقاة على مربع وآخر في الممر. في المختبر، يجب التقاط كل واحدة عن قصد.",
    ),
    objective: t(
      "Build a loop body that combines movement and an explicit action at a regular interval.",
      "بناء جسم حلقة يجمع بين الحركة وفعل صريح على فترات منتظمة.",
    ),
    mission: t("Pick up all three cells, then reach the charger.", "التقط الخلايا الثلاث، ثم صِل إلى الشاحن."),
    instructions: t(
      "Hop onto a cell, Collect, hop again — that pattern happens three times. Then one more hop to the charger.",
      "اقفز على خلية، ثم «التقط»، ثم اقفز مجددًا — هذا النمط يحدث ثلاث مرات. ثم قفزة أخرى إلى الشاحن.",
    ),
    explanation: t(
      "The loop body was 'hop, collect, hop': it lands on a cell exactly when Collect runs. Getting the order inside a loop right matters as much as the count.",
      "كان جسم الحلقة «اقفز، التقط، اقفز»: يهبط على خلية بالضبط عندما تعمل «التقط». ترتيب ما داخل الحلقة مهم بقدر العدد.",
    ),
    teacherNotes: { en: "Collect placed first in the body grabs air (collectFail) and leaves cells behind: PARTIAL with located feedback.", ar: "وضع «التقط» أولًا في جسم الحلقة يلتقط الهواء (collectFail) ويترك خلايا خلفه: النتيجة PARTIAL (جزئية) مع ملاحظات محددة الموقع." },
    difficulty: "MEDIUM",
    recommendedGradeMin: 4,
    recommendedGradeMax: 6,
    estimatedMinutes: 5,
    xpReward: 30,
    tags: ["loops", "sequencing"],
    requires: [],
    hints: hints(
      ["Where are the cells? Every other tile.", "أين الخلايا؟ على مربع وآخر."],
      ["Collect only works while standing ON the cell.", "«التقط» لا تعمل إلا عند الوقوف على الخلية."],
      ["Repeat 3: Move, Collect, Move. Then Move.", "كرّر 3: تقدّم، التقط، تقدّم. ثم تقدّم."],
      ["Five blocks: Repeat 3 { Move Forward, Collect, Move Forward }, Move Forward.", "خمس لبنات: كرّر 3 { تقدّم، التقط، تقدّم }، تقدّم."],
    ),
    payload: {
      toolbox: [{ type: "bb_moveForward" }, { type: "bb_collect" }, { type: "bb_repeat" }],
      variants: [{ rows: [".C.C.C.G", "........"], start: { x: 0, y: 0, dir: "E" } }],
      autoCollect: false,
      nonFatalBumps: false,
      checks: [
        { id: "reachedGoal", severity: "core" },
        { id: "collectedAll", severity: "secondary" },
      ],
      starCriteria: { threeStarMaxBlocks: 5 },
      startWorkspace,
      solution: hat(repeat(3, move(), collect(), move()), move()),
    } satisfies BlockCodingDraft,
  },
  {
    slug: "boot-order",
    order: 4,
    activityType: "SEQUENCING",
    track: "PROGRAMMING",
    title: t("Boot Order", "ترتيب التشغيل"),
    story: t(
      "Professor Pip's new robot will only wake up if its start-up steps happen in the right order.",
      "روبوت البروفيسور بيب الجديد لن يستيقظ إلا إذا حدثت خطوات تشغيله بالترتيب الصحيح.",
    ),
    objective: t(
      "Order the steps of a real-world procedure where each step depends on the one before it.",
      "ترتيب خطوات إجراء واقعي تعتمد فيه كل خطوة على التي قبلها.",
    ),
    mission: t("Put the robot's start-up steps in the right order.", "رتّب خطوات تشغيل الروبوت بالترتيب الصحيح."),
    instructions: t(
      "Drag or move the steps so each one can actually happen after the one above it.",
      "اسحب الخطوات أو حرّكها بحيث يمكن لكل خطوة أن تحدث فعلًا بعد التي فوقها.",
    ),
    explanation: t(
      "Each step needed the one before it: no power button without a battery, no test without the lights. Programs are the same — an instruction can only use what earlier ones set up.",
      "احتاجت كل خطوة إلى التي قبلها: لا زر تشغيل بلا بطارية، ولا اختبار بلا أضواء. البرامج كذلك — التعليمة لا تستخدم إلا ما جهّزته التعليمات السابقة.",
    ),
    teacherNotes: { en: "Five steps with a strict dependency chain. Ask children to justify each neighbour pair.", ar: "خمس خطوات في سلسلة اعتماد صارمة. اطلب من الأطفال تبرير ترتيب كل خطوتين متجاورتين." },
    difficulty: "EASY",
    recommendedGradeMin: 4,
    recommendedGradeMax: 6,
    estimatedMinutes: 3,
    xpReward: 25,
    tags: ["sequencing"],
    requires: [],
    hints: hints(
      ["What does the robot need before anything else can work?", "ماذا يحتاج الروبوت قبل أن يعمل أي شيء آخر؟"],
      ["The battery goes in first; the delivery is last.", "البطارية أولًا؛ والتوصيل أخيرًا."],
      ["The lights must be on before the test program can run.", "يجب أن تُضاء الأضواء قبل أن يعمل برنامج الاختبار."],
      ["Battery, power button, lights, test program, delivery.", "البطارية، زر التشغيل، الأضواء، برنامج الاختبار، التوصيل."],
    ),
    payload: {
      prompt: t("Put these start-up steps in order, first at the top.", "رتّب خطوات التشغيل هذه، الأولى في الأعلى."),
      items: [
        { id: "battery", text: t("Put the battery in", "ضع البطارية") },
        { id: "power", text: t("Press the power button", "اضغط زر التشغيل") },
        { id: "lights", text: t("Wait for the green lights", "انتظر الأضواء الخضراء") },
        { id: "test", text: t("Run the test program", "شغّل برنامج الاختبار") },
        { id: "deliver", text: t("Start the first delivery", "ابدأ التوصيل الأول") },
      ],
      correctOrder: ["battery", "power", "lights", "test", "deliver"],
    } satisfies SequencingDraft,
  },
  {
    slug: "right-hand-rule",
    order: 5,
    activityType: "BLOCK_CODING",
    track: "PROGRAMMING",
    title: t("The Right-Hand Rule", "قاعدة اليد اليمنى"),
    story: t(
      "Robots in mazes use a trick: keep going, and turn right whenever the way ahead is blocked. Two lab corridors, one rule.",
      "تستخدم الروبوتات في المتاهات حيلة: واصل التقدّم، واستدر يمينًا كلما انسدّ الطريق أمامك. ممرّان في المختبر، وقاعدة واحدة.",
    ),
    objective: t(
      "Combine a condition-controlled loop with a conditional to follow walls on maps of different shapes.",
      "الجمع بين حلقة يتحكم فيها شرط وشرط لمتابعة الجدران في خرائط بأشكال مختلفة.",
    ),
    mission: t("One rule for both corridors: if blocked, turn right — and keep going.", "قاعدة واحدة للممرّين: إن انسدّ الطريق فاستدر يمينًا — وواصل."),
    instructions: t(
      "Inside Repeat until I reach the goal: an If (path ahead is blocked) with Turn Right, then Move Forward.",
      "داخل «كرّر حتى أصل إلى الهدف»: «إذا» (الطريق أمامي مسدود) وبداخلها «استدر يمينًا»، ثم «تقدّم للأمام».",
    ),
    explanation: t(
      "Four blocks solved a short corridor and a long spiral, because the program never knew the map — it looked at every step. A rule that reacts is what lets real robots handle places they have never seen.",
      "حلّت أربع لبنات ممرًّا قصيرًا ولولبًا طويلًا، لأن البرنامج لم يعرف الخريطة قط — بل نظر في كل خطوة. القاعدة التي تتفاعل هي ما يمكّن الروبوتات الحقيقية من التعامل مع أماكن لم ترها من قبل.",
    ),
    teacherNotes: { en: "Wall-following on two variants (a one-turn corridor and a clockwise spiral). The turn must be inside the If and the hop after it.", ar: "تتبّع الجدار على خريطتين (ممر باستدارة واحدة ولولب باتجاه عقارب الساعة). يجب أن تكون الاستدارة داخل «إذا» والقفزة بعدها." },
    difficulty: "HARD",
    recommendedGradeMin: 5,
    recommendedGradeMax: 7,
    estimatedMinutes: 7,
    xpReward: 45,
    tags: ["logic", "loops"],
    requires: [],
    hints: hints(
      ["The same program must work on both maps. Look for the rule, not the route.", "يجب أن يعمل البرنامج نفسه في الخريطتين. ابحث عن القاعدة لا عن المسار."],
      ["Every turn on both maps is a right turn, and it happens when the way ahead is blocked.", "كل استدارة في الخريطتين هي استدارة يمينًا، وتحدث عندما ينسدّ الطريق أمامه."],
      ["Loop until the goal: first check and maybe turn, then hop.", "كرّر حتى الهدف: تحقّق أولًا وربما استدر، ثم اقفز."],
      ["Repeat until I reach the goal { If blocked { Turn Right }, Move Forward }.", "كرّر حتى أصل إلى الهدف { إذا مسدود { استدر يمينًا }، تقدّم للأمام }."],
    ),
    payload: {
      toolbox: [
        { type: "bb_moveForward" },
        { type: "bb_turnLeft" },
        { type: "bb_turnRight" },
        { type: "bb_repeatUntilGoal" },
        { type: "bb_if" },
        { type: "bb_pathAhead" },
      ],
      variants: [
        { rows: [".#", "G."], start: { x: 0, y: 0, dir: "E" } },
        { rows: ["....", "###.", "G..."], start: { x: 0, y: 0, dir: "E" } },
      ],
      autoCollect: false,
      nonFatalBumps: false,
      checks: [
        { id: "reachedGoal", severity: "core" },
        { id: "usedBlock", severity: "secondary", params: { block: "bb_if" } },
      ],
      starCriteria: { threeStarMaxBlocks: 4 },
      startWorkspace,
      solution: hat(untilGoal(ifBlocked(right()), move())),
    } satisfies BlockCodingDraft,
  },
];
