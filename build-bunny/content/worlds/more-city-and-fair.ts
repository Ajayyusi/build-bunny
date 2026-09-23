import type { z } from "zod";
import type {
  LevelFixture,
  ModuleFixture,
  blockCodingPayload,
  codePredictionPayload,
  creativeProjectPayload,
  debuggingPayload,
  sequencingPayload,
} from "@/modules/curriculum/schemas";

import {
  addCounter,
  doTrick,
  hat,
  hints,
  left,
  move,
  repeat,
  right,
  sayCounter,
  setCounter,
  startWorkspace,
  t,
  trick,
  withTops,
} from "./kit";

/**
 * Code City module 4 (counters and tricks in practice, plus reading code)
 * and three more build-your-own mazes for Inventor Island's Fair — the last
 * of the curriculum-expansion levels toward 100. Every grid program and maze
 * sample passes the publish gates with three stars.
 */

type BlockCodingDraft = z.input<typeof blockCodingPayload>;
type CodePredictionDraft = z.input<typeof codePredictionPayload>;
type DebuggingDraft = z.input<typeof debuggingPayload>;
type SequencingDraft = z.input<typeof sequencingPayload>;
type MazeDraft = z.input<typeof creativeProjectPayload>;

const counterToolbox = [
  { type: "bb_moveForward" },
  { type: "bb_repeat" },
  { type: "bb_setCounter" },
  { type: "bb_changeCounter" },
  { type: "bb_sayCounter" },
];
const trickToolbox = [
  { type: "bb_moveForward" },
  { type: "bb_turnLeft" },
  { type: "bb_turnRight" },
  { type: "bb_repeat" },
  { type: "bb_defineTrick", limit: 1 },
  { type: "bb_doTrick" },
];

export const cityWorkshop: ModuleFixture = {
  slug: "city-workshop",
  order: 4,
  name: t("City Workshop", "ورشة المدينة"),
  description: t("Counting down, doubling up, and reading tricks as code.", "العدّ التنازلي، والمضاعفة، وقراءة الحيل كشيفرة."),
  levels: [
    {
      slug: "countdown",
      order: 1,
      activityType: "BLOCK_CODING",
      track: "PROGRAMMING",
      title: t("Countdown", "العدّ التنازلي"),
      story: t(
        "The city tram counts DOWN to each stop: 3, 2, 1, 0 — arrived! Make Robo Bunny's counter do the same.",
        "ترام المدينة يعدّ تنازليًا إلى كل محطة: 3، 2، 1، 0 — وصلنا! اجعل عدّاد الأرنب الآلي يفعل الشيء نفسه.",
      ),
      objective: t(
        "Initialise a variable to a non-zero value and decrement it in a loop so it reaches zero exactly at the goal.",
        "تهيئة متغيّر بقيمة غير صفرية وإنقاصه في حلقة ليصل إلى الصفر عند الهدف بالضبط.",
      ),
      mission: t("Start the counter at 3, count down each hop, and say 0 at the stop.", "ابدأ العدّاد من 3، وعُدّ تنازليًا مع كل قفزة، وقل 0 عند المحطة."),
      instructions: t(
        "Set the counter to 3. Each hop, add -1 (a minus number takes away). When Robo Bunny arrives, say the counter.",
        "اجعل العدّاد 3. مع كل قفزة أضف -1 (الرقم السالب ينقص). عندما يصل الأرنب الآلي، قل قيمة العدّاد.",
      ),
      explanation: t(
        "Adding -1 is taking away one. Starting at 3 and taking away one per hop lands on 0 exactly when the three hops are done — a countdown is just a counter going the other way.",
        "إضافة -1 تعني إنقاص واحد. البدء من 3 وإنقاص واحد مع كل قفزة يصل إلى 0 بالضبط عندما تنتهي القفزات الثلاث — العدّ التنازلي مجرد عدّاد يسير في الاتجاه الآخر.",
      ),
      teacherNotes: { en: "Negative change. The 'add' field accepts -9..9; children who add +1 end on 6.", ar: "تغيير سالب. يقبل حقل «أضف» القيم من -9 إلى 9؛ والأطفال الذين يضيفون +1 ينتهون عند 6." },
      difficulty: "MEDIUM",
      recommendedGradeMin: 5,
      recommendedGradeMax: 7,
      estimatedMinutes: 5,
      xpReward: 35,
      tags: ["variables", "loops"],
      requires: [],
      hints: hints(
        ["The counter must START at 3.", "يجب أن يبدأ العدّاد من 3."],
        ["To count down, add a minus number.", "لتعدّ تنازليًا، أضف رقمًا سالبًا."],
        ["Inside the loop: hop, then add -1.", "داخل الحلقة: اقفز، ثم أضف -1."],
        ["Set counter to 3. Repeat 3 { Move Forward, add -1 to counter }. Say the counter.", "اجعل العدّاد 3. كرّر 3 { تقدّم للأمام، أضف -1 إلى العدّاد }. قل قيمة العدّاد."],
      ),
      payload: {
        // Counting down needs a starting value: one Set block only.
        toolbox: counterToolbox.map((block) => (block.type === "bb_setCounter" ? { ...block, limit: 1 } : block)),
        variants: [{ rows: ["...G", "...."], start: { x: 0, y: 0, dir: "E" } }],
        autoCollect: true,
        nonFatalBumps: false,
        checks: [
          { id: "reachedGoal", severity: "core" },
          { id: "variableEquals", severity: "core", params: { name: "counter", value: 0 } },
          { id: "usedBlock", severity: "core", params: { block: "bb_changeCounter" } },
          { id: "expectedOutput", severity: "secondary", params: { expected: ["0"] } },
        ],
        starCriteria: { threeStarMaxBlocks: 5 },
        startWorkspace,
        solution: hat(setCounter(3), repeat(3, move(), addCounter(-1)), sayCounter()),
      } satisfies BlockCodingDraft,
    },
    {
      slug: "double-count",
      order: 2,
      activityType: "BLOCK_CODING",
      track: "PROGRAMMING",
      title: t("Double Count", "العدّ المضاعف"),
      story: t(
        "Every street block has two houses. Count the houses, not the hops, on the way to the market.",
        "في كل مربع من الشارع بيتان. عُدّ البيوت لا القفزات في الطريق إلى السوق.",
      ),
      objective: t(
        "Accumulate a variable by a step other than one and predict its final value from the loop count.",
        "مراكمة متغيّر بخطوة غير الواحد وتوقّع قيمته النهائية من عدد دورات الحلقة.",
      ),
      mission: t("Count two houses per hop, and say 8 at the market.", "عُدّ بيتين مع كل قفزة، وقل 8 عند السوق."),
      instructions: t(
        "Four hops to the market. Add 2 to the counter every hop, then say the counter.",
        "أربع قفزات إلى السوق. أضف 2 إلى العدّاد مع كل قفزة، ثم قل قيمة العدّاد.",
      ),
      explanation: t(
        "Four hops of +2 makes 8 — the same as 4 × 2. A loop that adds the same amount every time is how computers multiply by counting.",
        "أربع قفزات بـ +2 تساوي 8 — كما في 4 × 2. الحلقة التي تضيف المقدار نفسه كل مرة هي طريقة الحاسوب في الضرب بالعدّ.",
      ),
      teacherNotes: { en: "Connects loops to multiplication. Four blocks earn three stars.", ar: "يربط الحلقات بالضرب. أربع لبنات تكسب ثلاث نجوم." },
      difficulty: "MEDIUM",
      recommendedGradeMin: 5,
      recommendedGradeMax: 7,
      estimatedMinutes: 5,
      xpReward: 35,
      tags: ["variables", "loops"],
      requires: [],
      hints: hints(
        ["How many houses per hop?", "كم بيتًا مع كل قفزة؟"],
        ["Change the number in 'add … to counter' to 2.", "غيّر الرقم في «أضف … إلى العدّاد» إلى 2."],
        ["Say the counter once, after the loop.", "قل قيمة العدّاد مرة واحدة، بعد الحلقة."],
        ["Repeat 4 { Move Forward, add 2 to counter }. Say the counter.", "كرّر 4 { تقدّم للأمام، أضف 2 إلى العدّاد }. قل قيمة العدّاد."],
      ),
      payload: {
        // No Set block: the counter starts at 0, so 8 can only come from counting.
        toolbox: counterToolbox.filter((block) => block.type !== "bb_setCounter"),
        variants: [{ rows: ["....G", "....."], start: { x: 0, y: 0, dir: "E" } }],
        autoCollect: true,
        nonFatalBumps: false,
        checks: [
          { id: "reachedGoal", severity: "core" },
          { id: "variableEquals", severity: "core", params: { name: "counter", value: 8 } },
          { id: "usedBlock", severity: "core", params: { block: "bb_changeCounter" } },
          { id: "expectedOutput", severity: "secondary", params: { expected: ["8"] } },
        ],
        starCriteria: { threeStarMaxBlocks: 4 },
        startWorkspace,
        solution: hat(repeat(4, move(), addCounter(2)), sayCounter()),
      } satisfies BlockCodingDraft,
    },
    {
      slug: "counter-question",
      order: 3,
      activityType: "CODE_PREDICTION",
      track: "PROGRAMMING",
      title: t("What Will It Say?", "ماذا سيقول؟"),
      story: t(
        "Mayor Mo found this program on a delivery bot and wants to know what it announces — before anyone presses Run.",
        "وجد العمدة مو هذا البرنامج في روبوت توصيل ويريد أن يعرف ماذا يعلن — قبل أن يضغط أحد «تشغيل».",
      ),
      objective: t(
        "Trace a variable through initialisation and a loop in text code to predict the output.",
        "تتبّع متغيّر عبر التهيئة والحلقة في شيفرة نصية لتوقّع المخرجات.",
      ),
      mission: t("Read the code and predict the number the bot says.", "اقرأ الشيفرة وتوقّع الرقم الذي يقوله الروبوت."),
      instructions: t(
        "Write the counter's value after each line on paper, then choose.",
        "اكتب قيمة العدّاد بعد كل سطر على الورق، ثم اختر.",
      ),
      explanation: t(
        "counter starts at 0, then is set to 2. The loop adds 2 three times: 4, 6, 8. So the bot says 8 — tracing line by line beats guessing.",
        "يبدأ counter من 0، ثم يُضبط على 2. تضيف الحلقة 2 ثلاث مرات: 4، 6، 8. إذًا يقول الروبوت 8 — التتبّع سطرًا سطرًا أفضل من التخمين.",
      ),
      teacherNotes: { en: "Common wrong answers: 6 (ignoring the starting 2) and 2 (ignoring the loop).", ar: "الإجابات الخاطئة الشائعة: 6 (تجاهل القيمة الابتدائية 2) و2 (تجاهل الحلقة)." },
      difficulty: "MEDIUM",
      recommendedGradeMin: 5,
      recommendedGradeMax: 7,
      estimatedMinutes: 4,
      xpReward: 30,
      tags: ["variables", "reading-code"],
      requires: [],
      hints: hints(
        ["What is counter after the second line?", "ما قيمة counter بعد السطر الثاني؟"],
        ["The loop body runs 3 times.", "جسم الحلقة يعمل 3 مرات."],
        ["Each time round it adds 2.", "في كل دورة يضيف 2."],
        ["2, then 4, 6, 8.", "2، ثم 4، 6، 8."],
      ),
      payload: {
        code:
          "var counter = 0;\n" +
          "counter = 2;\n" +
          "for (var i = 0; i < 3; i++) {\n" +
          "  counter = counter + 2;\n" +
          "}\n" +
          "say(String(counter));\n",
        prompt: t("What number does the bot say?", "ما الرقم الذي يقوله الروبوت؟"),
        options: [
          { id: "two", text: t("2", "2") },
          { id: "six", text: t("6", "6") },
          { id: "eight", text: t("8", "8") },
          { id: "five", text: t("5", "5") },
        ],
        correctOptionId: "eight",
        wrongFeedback: t(
          "Trace it: the counter is set to 2 BEFORE the loop, then the loop adds 2 three times.",
          "تتبّعها: يُضبط العدّاد على 2 قبل الحلقة، ثم تضيف الحلقة 2 ثلاث مرات.",
        ),
      } satisfies CodePredictionDraft,
    },
    {
      slug: "trick-count",
      order: 4,
      activityType: "CODE_PREDICTION",
      track: "PROGRAMMING",
      title: t("How Many Hops?", "كم قفزة؟"),
      story: t(
        "A bot's route is written as a function. How far will it go?",
        "مسار روبوت مكتوب على شكل دالّة. إلى أي مدى سيذهب؟",
      ),
      objective: t(
        "Trace calls to a user-defined function to count the instructions it runs.",
        "تتبّع استدعاءات دالّة معرّفة من المستخدم لعدّ التعليمات التي تنفّذها.",
      ),
      mission: t("Count how many times moveForward() really runs.", "عُدّ كم مرة تعمل moveForward() فعلًا."),
      instructions: t(
        "The function is defined once and called three times. Count the hops in it, then multiply.",
        "تُعرَّف الدالّة مرة واحدة وتُستدعى ثلاث مرات. عُدّ القفزات فيها، ثم اضرب.",
      ),
      explanation: t(
        "Defining myTrick runs nothing. Each myTrick() call runs its two hops, and there are three calls: 2 × 3 = 6.",
        "تعريف myTrick لا ينفّذ شيئًا. كل استدعاء myTrick() ينفّذ قفزتيها، وهناك ثلاثة استدعاءات: 2 × 3 = 6.",
      ),
      teacherNotes: { en: "Misconception check: 2 (counting the definition only) or 3 (counting calls only).", ar: "فحص للمفاهيم الخاطئة: 2 (عدّ التعريف فقط) أو 3 (عدّ الاستدعاءات فقط)." },
      difficulty: "MEDIUM",
      recommendedGradeMin: 5,
      recommendedGradeMax: 7,
      estimatedMinutes: 4,
      xpReward: 30,
      tags: ["functions", "reading-code"],
      requires: [],
      hints: hints(
        ["Does defining the function move the bot?", "هل يحرّك تعريفُ الدالّة الروبوت؟"],
        ["How many moveForward() are inside the function?", "كم moveForward() داخل الدالّة؟"],
        ["How many times is myTrick() called?", "كم مرة تُستدعى myTrick()؟"],
        ["2 hops per call, 3 calls.", "قفزتان في كل استدعاء، وثلاثة استدعاءات."],
      ),
      payload: {
        code:
          "function myTrick() {\n" +
          "  moveForward();\n" +
          "  moveForward();\n" +
          "}\n" +
          "myTrick();\n" +
          "myTrick();\n" +
          "myTrick();\n",
        prompt: t("How many times does moveForward() run?", "كم مرة تعمل moveForward()؟"),
        options: [
          { id: "two", text: t("2 times", "مرتين") },
          { id: "three", text: t("3 times", "3 مرات") },
          { id: "five", text: t("5 times", "5 مرات") },
          { id: "six", text: t("6 times", "6 مرات") },
        ],
        correctOptionId: "six",
        wrongFeedback: t(
          "The definition only teaches the trick. Every call runs both hops — count the calls.",
          "التعريف يعلّم الحيلة فقط. كل استدعاء ينفّذ القفزتين — عُدّ الاستدعاءات.",
        ),
      } satisfies CodePredictionDraft,
    },
    {
      slug: "trick-gone-wrong",
      order: 5,
      activityType: "DEBUGGING",
      track: "PROGRAMMING",
      title: t("Trick Gone Wrong", "حيلة خاطئة"),
      story: t(
        "The stair-step trick is broken: Robo Bunny climbs UP instead of down. Fix the trick once and every call is fixed.",
        "حيلة الدرج معطّلة: يصعد الأرنب الآلي إلى الأعلى بدل النزول. أصلح الحيلة مرة واحدة فيُصلَح كل استدعاء.",
      ),
      objective: t(
        "Locate a bug inside a function body and fix it once, observing that every call site is corrected.",
        "تحديد خلل داخل جسم دالّة وإصلاحه مرة واحدة، وملاحظة أن كل موضع استدعاء قد صُحّح.",
      ),
      mission: t("Fix the trick so the stairs go down to the burrow.", "أصلح الحيلة لينزل الدرج إلى الجحر."),
      instructions: t(
        "Run it and watch the first step. The bug is inside 'my trick', not in the program under 'when start'.",
        "شغّله وراقب الدرجة الأولى. الخلل داخل «حيلتي»، لا في البرنامج تحت «عند البدء».",
      ),
      explanation: t(
        "The turns inside the trick were swapped. Because both calls use the same trick, fixing it in one place fixed both steps — the big advantage of a function.",
        "كانت الاستدارتان داخل الحيلة مبدَّلتين. ولأن الاستدعاءين يستخدمان الحيلة نفسها، أصلح التعديل في مكان واحد الدرجتين — وهذه الميزة الكبرى للدالّة.",
      ),
      teacherNotes: { en: "Only the trick body is wrong. Children who rewrite the whole program without the trick reach the goal but get PARTIAL (usedTrick is secondary): the point is to fix the trick.", ar: "الخطأ في جسم الحيلة فقط. الأطفال الذين يعيدون كتابة البرنامج كله دون الحيلة يصلون إلى الهدف لكنهم ينالون PARTIAL (فحص usedTrick ثانوي): المقصود هو إصلاح الحيلة." },
      difficulty: "MEDIUM",
      recommendedGradeMin: 5,
      recommendedGradeMax: 7,
      estimatedMinutes: 5,
      xpReward: 40,
      tags: ["functions", "debugging"],
      requires: [],
      hints: hints(
        ["Which way does Robo Bunny go on the first step? Which way should it go?", "إلى أين يذهب الأرنب الآلي في الدرجة الأولى؟ وإلى أين يجب أن يذهب؟"],
        ["The program under 'when start' is fine. Look inside 'my trick'.", "البرنامج تحت «عند البدء» سليم. انظر داخل «حيلتي»."],
        ["Swap the two turns inside the trick.", "بدّل الاستدارتين داخل الحيلة."],
        ["My trick: Move, Turn Right, Move, Turn Left.", "حيلتي: تقدّم، استدر يمينًا، تقدّم، استدر يسارًا."],
      ),
      payload: {
        toolbox: trickToolbox,
        variants: [{ rows: ["..##", "#..#", "##.G"], start: { x: 0, y: 0, dir: "E" } }],
        autoCollect: true,
        nonFatalBumps: false,
        checks: [
          { id: "reachedGoal", severity: "core" },
          { id: "usedTrick", severity: "secondary" },
        ],
        starCriteria: { threeStarMaxBlocks: 8 },
        brokenWorkspace: withTops([trick(move(), left(), move(), right())], repeat(2, doTrick()), move()),
        solution: withTops([trick(move(), right(), move(), left())], repeat(2, doTrick()), move()),
      } satisfies DebuggingDraft,
    },
    {
      slug: "zigzag-trick",
      order: 6,
      activityType: "BLOCK_CODING",
      track: "PROGRAMMING",
      title: t("Zigzag Street", "شارع متعرّج"),
      story: t(
        "Zigzag Street goes down, along, down, along. Teach one zig-and-zag as a trick and do it twice.",
        "ينزل الشارع المتعرّج: أسفل، ثم على الطول، ثم أسفل، ثم على الطول. علّم تعرّجة واحدة كحيلة ونفّذها مرتين.",
      ),
      objective: t(
        "Define a procedure for a repeating movement pattern and call it from a loop.",
        "تعريف إجراء لنمط حركة متكرر واستدعاؤه من حلقة.",
      ),
      mission: t("Teach one zigzag as a trick, do it twice, then hop to the burrow.", "علّم تعرّجة واحدة كحيلة، ونفّذها مرتين، ثم اقفز إلى الجحر."),
      instructions: t(
        "One zigzag is: turn right, hop, turn left, hop. Put it in 'my trick', then Repeat 2 with 'do my trick', then one more hop.",
        "التعرّجة الواحدة هي: استدر يمينًا، اقفز، استدر يسارًا، اقفز. ضعها في «حيلتي»، ثم «كرّر 2» مع «نفّذ حيلتي»، ثم قفزة أخرى.",
      ),
      explanation: t(
        "A trick holds a shape; a loop repeats it. Zigzag Street is two of the same shape plus one step, so the program says exactly that.",
        "الحيلة تحمل شكلًا؛ والحلقة تكرّره. الشارع المتعرّج شكلان متماثلان وخطوة، والبرنامج يقول ذلك تمامًا.",
      ),
      teacherNotes: { en: "Eight blocks with the trick. usedTrick is secondary: plain solutions, or an empty trick, are PARTIAL.", ar: "ثماني لبنات مع الحيلة. فحص usedTrick ثانوي: الحلول العادية التي لا تستخدم الحيلة، أو الحيلة الفارغة، تُعدّ PARTIAL (جزئية)." },
      difficulty: "MEDIUM",
      recommendedGradeMin: 5,
      recommendedGradeMax: 7,
      estimatedMinutes: 6,
      xpReward: 40,
      tags: ["functions", "loops"],
      requires: [],
      hints: hints(
        ["Which four moves make one zigzag?", "أي أربع حركات تصنع تعرّجة واحدة؟"],
        ["Build the zigzag inside 'my trick'.", "ابنِ التعرّجة داخل «حيلتي»."],
        ["Under 'when start': Repeat 2 with 'do my trick', then Move Forward.", "تحت «عند البدء»: «كرّر 2» مع «نفّذ حيلتي»، ثم تقدّم للأمام."],
        ["My trick: Turn Right, Move, Turn Left, Move.", "حيلتي: استدر يمينًا، تقدّم، استدر يسارًا، تقدّم."],
      ),
      payload: {
        toolbox: trickToolbox,
        variants: [{ rows: [".#..", "..#.", "#..G"], start: { x: 0, y: 0, dir: "E" } }],
        autoCollect: true,
        nonFatalBumps: false,
        checks: [
          { id: "reachedGoal", severity: "core" },
          { id: "usedTrick", severity: "secondary" },
        ],
        starCriteria: { threeStarMaxBlocks: 8 },
        startWorkspace,
        solution: withTops([trick(right(), move(), left(), move())], repeat(2, doTrick()), move()),
      } satisfies BlockCodingDraft,
    },
    {
      slug: "tally-lines",
      order: 7,
      activityType: "SEQUENCING",
      track: "PROGRAMMING",
      title: t("Put the Code in Order", "رتّب الشيفرة"),
      story: t(
        "The lines of a counting program fell out of order in the Mayor's notebook. Put them back so the bot counts its hops.",
        "اختلط ترتيب أسطر برنامج العدّ في دفتر العمدة. أعدها بحيث يعدّ الروبوت قفزاته.",
      ),
      objective: t(
        "Order lines of text code so a variable is declared before use, updated inside a loop and output after it.",
        "ترتيب أسطر شيفرة نصية بحيث يُعلَن عن المتغيّر قبل استخدامه، ويُحدَّث داخل حلقة، ويُخرَج بعدها.",
      ),
      mission: t("Order the code lines so the bot counts 4 hops and says 4.", "رتّب أسطر الشيفرة ليعدّ الروبوت 4 قفزات ويقول 4."),
      instructions: t(
        "Think like the computer: what must exist before it can be used? What goes inside the loop, and what after?",
        "فكّر مثل الحاسوب: ما الذي يجب أن يوجد قبل استخدامه؟ وما الذي داخل الحلقة، وما الذي بعدها؟",
      ),
      explanation: t(
        "Declare the counter first, open the loop, hop and count inside it, close the loop, then say the result. It's the same program your blocks make — the Code tab writes these exact lines.",
        "أعلن عن العدّاد أولًا، وافتح الحلقة، واقفز وعُدّ داخلها، وأغلق الحلقة، ثم قل النتيجة. إنه البرنامج نفسه الذي تصنعه لبناتك — تبويب «الكود» يكتب هذه الأسطر بالضبط.",
      ),
      teacherNotes: { en: "Text-code ordering bridges blocks to typed code. Ask why say() must be after the closing brace.", ar: "ترتيب الشيفرة النصية جسر بين اللبنات والشيفرة المكتوبة. اسأل لماذا يجب أن تأتي say() بعد القوس المعقوف الختامي." },
      difficulty: "MEDIUM",
      recommendedGradeMin: 5,
      recommendedGradeMax: 7,
      estimatedMinutes: 5,
      xpReward: 35,
      tags: ["variables", "reading-code", "sequencing"],
      requires: [],
      hints: hints(
        ["The counter must be created before anything uses it.", "يجب إنشاء العدّاد قبل أن يستخدمه أي شيء."],
        ["The loop opens with 'for' and closes with '}'.", "تُفتح الحلقة بـ «for» وتُغلق بـ «}»."],
        ["Hopping and counting both go inside the loop.", "القفز والعدّ كلاهما داخل الحلقة."],
        ["var counter, for…, moveForward, counter + 1, }, say.", "var counter، for…، moveForward، counter + 1، }، say."],
      ),
      payload: {
        prompt: t("Put these lines in order, first at the top.", "رتّب هذه الأسطر، الأول في الأعلى."),
        items: [
          { id: "var", text: t("var counter = 0;", "var counter = 0; (إنشاء العدّاد)") },
          { id: "for", text: t("for (var i = 0; i < 4; i++) {", "for (var i = 0; i < 4; i++) { (بداية الحلقة)") },
          { id: "move", text: t("  moveForward();", "  moveForward(); (قفزة)") },
          { id: "add", text: t("  counter = counter + 1;", "  counter = counter + 1; (أضف واحدًا)") },
          { id: "close", text: t("}", "} (نهاية الحلقة)") },
          { id: "say", text: t("say(String(counter));", "say(String(counter)); (قل النتيجة)") },
        ],
        correctOrder: ["var", "for", "move", "add", "close", "say"],
      } satisfies SequencingDraft,
    },
  ],
};

// ── Inventor Island — The Fair, levels 4–6 ─────────────────────────────────

export const fairMore: LevelFixture[] = [
  {
    slug: "tiny-maze",
    order: 4,
    activityType: "CREATIVE_PROJECT",
    track: "PROGRAMMING",
    title: t("Tiny Maze", "متاهة صغيرة"),
    story: t(
      "Fenn wants a maze small enough for the youngest visitors at the Fair. One rock, a few squares, and a way through.",
      "يريد فِنّ متاهة صغيرة تناسب أصغر زوار المعرض. صخرة واحدة، وبضعة مربعات، وطريق للعبور.",
    ),
    objective: t(
      "Design a very small maze with one obstacle and program a route through it.",
      "تصميم متاهة صغيرة جدًّا بعائق واحد وبرمجة طريق عبرها.",
    ),
    mission: t("Put one rock in a tiny maze, then program Robo Bunny through.", "ضع صخرة واحدة في متاهة صغيرة، ثم برمج الأرنب الآلي ليعبرها."),
    instructions: t(
      "Tap Rock, then tap a square to place it. When every line of the checklist has a tick, press Build my program.",
      "انقر «صخرة»، ثم انقر مربعًا لوضعها. عندما يحمل كل سطر في قائمة الفحص علامة صح، اضغط «ابنِ برنامجي».",
    ),
    explanation: t(
      "You made a puzzle and solved it. Even a tiny maze needs a plan: where is the rock, and which way round is shorter?",
      "صنعت لغزًا وحللته. حتى المتاهة الصغيرة تحتاج إلى خطة: أين الصخرة، وأي طريق حولها أقصر؟",
    ),
    teacherNotes: { en: "Starter maze for ages 7–8: 4×3 board, rocks only, no loops needed.", ar: "متاهة تمهيدية للأعمار 7–8: لوحة 4×3، وصخور فقط، ولا حاجة إلى حلقات." },
    difficulty: "EASY",
    recommendedGradeMin: 3,
    recommendedGradeMax: 4,
    estimatedMinutes: 6,
    xpReward: 30,
    tags: ["creative", "sequencing"],
    requires: [],
    hints: hints(
      ["Put the rock anywhere — just don't block the whole way.", "ضع الصخرة في أي مكان — فقط لا تسدّ الطريق كله."],
      ["The checklist tells you what is still missing.", "قائمة الفحص تخبرك بما ينقص."],
      ["When you build, count the squares and the turns.", "عند البناء، عُدّ المربعات والاستدارات."],
      ["Try: Turn Right, Move, Move, Turn Left, Move, Move, Move.", "جرّب: استدر يمينًا، تقدّم، تقدّم، استدر يسارًا، تقدّم، تقدّم، تقدّم."],
    ),
    payload: {
      kind: "MAZE",
      board: { width: 4, height: 3 },
      palette: ["#"],
      mustInclude: { obstacles: 1, carrots: 0 },
      toolbox: [{ type: "bb_moveForward" }, { type: "bb_turnLeft" }, { type: "bb_turnRight" }],
      starCriteria: { threeStarMaxBlocks: 7 },
      startWorkspace,
      sample: {
        design: { rows: ["..#.", "....", "...G"], start: { x: 0, y: 0, dir: "E" } },
        solution: hat(right(), move(), move(), left(), move(), move(), move()),
      },
    } satisfies MazeDraft,
  },
  {
    slug: "water-works",
    order: 5,
    activityType: "CREATIVE_PROJECT",
    track: "PROGRAMMING",
    title: t("Water Works", "أعمال الماء"),
    story: t(
      "Oona wants a river maze: water that Robo Bunny must go around, and a carrot on the far bank.",
      "تريد أونا متاهة نهر: ماء يجب أن يلتفّ حوله الأرنب الآلي، وجزرة على الضفة البعيدة.",
    ),
    objective: t(
      "Design a maze using water hazards and a collectable, then solve it with loops.",
      "تصميم متاهة تستخدم مخاطر الماء وعنصرًا للجمع، ثم حلّها بالحلقات.",
    ),
    mission: t("Build a river of at least three water tiles, add a carrot, then solve it.", "ابنِ نهرًا من ثلاثة مربعات ماء على الأقل، وأضف جزرة، ثم حلّها."),
    instructions: t(
      "Water is deadly for Robo Bunny, so leave a way around it. Place a carrot where your route will pass. Use Repeat for long straight runs.",
      "الماء مميت للأرنب الآلي، فاترك طريقًا حوله. ضع جزرة حيث سيمرّ طريقك. استخدم «كرّر» للمسافات المستقيمة الطويلة.",
    ),
    explanation: t(
      "A good maze has a hazard, a reward and a way through. Long straight runs became Repeats, so even a big river maze needed only a few blocks.",
      "المتاهة الجيدة فيها خطر ومكافأة وطريق للعبور. صارت المسافات المستقيمة الطويلة حلقات «كرّر»، لذا لم تحتج حتى متاهة النهر الكبيرة إلا إلى بضع لبنات.",
    ),
    teacherNotes: { en: "Only water is on the palette, so the three obstacles form the river. The burrow must be at least 5 hops away, and using Repeat is a secondary check (PARTIAL without it). Six blocks with two Repeats is the three-star line.", ar: "لا يوجد على اللوحة سوى الماء، فالعوائق الثلاثة تشكّل النهر. يجب أن يبعد الجحر 5 قفزات على الأقل، واستخدام «كرّر» فحص ثانوي (PARTIAL من دونه). ست لبنات مع حلقتي «كرّر» هي حدّ النجوم الثلاث." },
    difficulty: "MEDIUM",
    recommendedGradeMin: 4,
    recommendedGradeMax: 7,
    estimatedMinutes: 9,
    xpReward: 45,
    tags: ["creative", "loops"],
    requires: [],
    hints: hints(
      ["Make the river, but leave a gap or a way round.", "اصنع النهر، لكن اترك فجوة أو طريقًا حوله."],
      ["Put the carrot on the route you plan to take.", "ضع الجزرة على الطريق الذي تنوي سلوكه."],
      ["Long straight hops fit in a Repeat.", "القفزات المستقيمة الطويلة تناسبها «كرّر»."],
      ["River along the second row, carrot on the top row: Repeat along the top, turn, Repeat down.", "النهر على طول الصف الثاني، والجزرة في الصف العلوي: «كرّر» على طول الأعلى، ثم استدر، ثم «كرّر» إلى الأسفل."],
    ),
    payload: {
      kind: "MAZE",
      board: { width: 6, height: 5 },
      // Water only: the three obstacles ARE the river the mission asks for.
      palette: ["W", "C"],
      mustInclude: { obstacles: 3, carrots: 1 },
      minGoalHops: 5,
      requiredBlocks: ["bb_repeat"],
      toolbox: [{ type: "bb_moveForward" }, { type: "bb_turnLeft" }, { type: "bb_turnRight" }, { type: "bb_repeat" }],
      starCriteria: { threeStarMaxBlocks: 6 },
      startWorkspace,
      sample: {
        design: { rows: ["..C...", "WWWW..", "......", "......", ".....G"], start: { x: 0, y: 0, dir: "E" } },
        solution: hat(repeat(5, move()), right(), repeat(4, move())),
      },
    } satisfies MazeDraft,
  },
  {
    slug: "grand-finale",
    order: 6,
    activityType: "CREATIVE_PROJECT",
    track: "PROGRAMMING",
    title: t("Grand Finale", "الختام الكبير"),
    story: t(
      "The Fair's last stall is yours: the biggest board yet. Every friend is watching. Make a maze worth solving — then solve it.",
      "آخر كشك في المعرض لك: أكبر لوحة حتى الآن. كل الأصدقاء يشاهدون. اصنع متاهة تستحق الحل — ثم حلّها.",
    ),
    objective: t(
      "Design a large maze with several obstacles and collectables and solve it within a block budget using loops or a trick.",
      "تصميم متاهة كبيرة فيها عدة عوائق وعناصر للجمع وحلّها ضمن حدّ من اللبنات باستخدام الحلقات أو الحيلة.",
    ),
    mission: t("Build the biggest maze: five obstacles, two carrots, then solve it.", "ابنِ أكبر متاهة: خمسة عوائق وجزرتان، ثم حلّها."),
    instructions: t(
      "Design first: five rocks or water tiles and two carrots. Then build a program — loops and 'my trick' keep it short.",
      "صمّم أولًا: خمس صخور أو مربعات ماء وجزرتين. ثم ابنِ برنامجًا — الحلقات و«حيلتي» تجعله قصيرًا.",
    ),
    explanation: t(
      "You designed a big puzzle, placed its rewards, and wrote a short program that beats it. That's the whole of Build Bunny in one level — sequences, loops, tricks, and an idea of your own.",
      "صمّمت لغزًا كبيرًا، ووضعت مكافآته، وكتبت برنامجًا قصيرًا يتغلب عليه. هذا هو Build Bunny كله في مستوى واحد — تسلسلات وحلقات وحيل وفكرة من صنعك.",
    ),
    teacherNotes: { en: "Open capstone on an 8×6 board. Encourage children to swap and solve each other's mazes on paper afterwards.", ar: "مشروع ختامي مفتوح على لوحة 8×6. شجّع الأطفال بعد ذلك على تبادل متاهاتهم وحلّ متاهات بعضهم بعضًا على الورق." },
    difficulty: "HARD",
    recommendedGradeMin: 5,
    recommendedGradeMax: 7,
    estimatedMinutes: 12,
    xpReward: 60,
    tags: ["creative", "loops", "functions"],
    requires: [],
    hints: hints(
      ["Start with the route, then put obstacles beside it.", "ابدأ بالطريق، ثم ضع العوائق بجانبه."],
      ["Carrots on the route cost no extra blocks.", "الجزر على الطريق لا يكلّف لبنات إضافية."],
      ["Long straight runs fit a Repeat; a repeating shape fits a trick.", "المسافات المستقيمة الطويلة تناسبها «كرّر»؛ والشكل المتكرر تناسبه حيلة."],
      ["Simple plan: along the top row, then straight down the right side.", "خطة بسيطة: على طول الصف العلوي، ثم مباشرة إلى الأسفل على الجانب الأيمن."],
    ),
    payload: {
      kind: "MAZE",
      board: { width: 8, height: 6 },
      palette: ["#", "W", "C"],
      mustInclude: { obstacles: 5, carrots: 2 },
      // The biggest board: a real journey, not a hop next door.
      minGoalHops: 8,
      toolbox: trickToolbox,
      starCriteria: { threeStarMaxBlocks: 10 },
      startWorkspace,
      sample: {
        design: {
          rows: [".C..C...", "#####...", "........", "........", "........", ".......G"],
          start: { x: 0, y: 0, dir: "E" },
        },
        solution: hat(repeat(7, move()), right(), repeat(5, move())),
      },
    } satisfies MazeDraft,
  },
];
