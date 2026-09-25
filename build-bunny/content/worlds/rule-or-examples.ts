import type { z } from "zod";
import type { ModuleFixture, aiClassificationPayload } from "@/modules/curriculum/schemas";

import { hints, t } from "./kit";

/**
 * "Rule or Examples?" — the bridge the product redesign brief (2026-09-25)
 * asks for right after the first sorter: the same sorting job done the
 * coding way and the machine-learning way, side by side.
 *
 *  1. Write a rule. Yesterday only blue and red berries grew, and one short
 *     rule ("blue berries are safe") fits every one of them.
 *  2. Something new. Today purple berries have appeared, and they are safe
 *     too. The rule says exactly what it was written to say, so it calls
 *     them not safe. A rule never changes by itself.
 *  3. Teach instead. The bunny has now tasted some purple berries. Teach it
 *     with examples — including a purple one — and it sorts today's new
 *     berries correctly.
 *
 * Honest about the difference: a person COULD rewrite the rule ("blue or
 * purple"), and the quick check says so. The point is who changes it: a rule
 * changes when someone rewrites it; a learner changes when it is shown new
 * examples.
 *
 * Numbers (berry glyph: colour 0 = blue, 0.5 = purple, 1 = red). Ground
 * truth is colour < 0.7. Without a purple example, the purple mystery berry
 * at colour 0.52 sits nearer the red examples than the blue ones and is
 * misread — so leaving purple out fails, which is the lesson. The rule round
 * has its own specimens (y*, d*) and never touches the graded testSet (t*).
 */

type AiClassificationDraft = z.input<typeof aiClassificationPayload>;
type LevelDraft = ModuleFixture["levels"][number];

export const ruleOrExamples: LevelDraft = {
  slug: "rule-or-examples",
  order: 2,
  activityType: "AI_CLASSIFICATION",
  track: "AI_CONCEPTS",
  title: t("Rule or Examples?", "قاعدة أم أمثلة؟"),
  story: t(
    "Yesterday only blue and red berries grew on the island, and sorting them was easy: one short rule did it. This morning, purple berries have popped up everywhere.",
    "أمس لم ينبت في الجزيرة إلا توت أزرق وأحمر، وكان فرزه سهلًا: قاعدة قصيرة واحدة تكفي. وهذا الصباح ظهر توت بنفسجي في كل مكان.",
  ),
  objective: t(
    "Compare a hand-written rule with a classifier trained on examples, and see that a rule only changes when someone rewrites it, while a learner changes when it is shown new examples.",
    "المقارنة بين قاعدة يكتبها إنسان ومصنِّف يتدرّب على الأمثلة، وملاحظة أن القاعدة لا تتغيّر إلا إذا أعاد أحدهم كتابتها، أما المتعلّم فيتغيّر حين تريه أمثلة جديدة.",
  ),
  mission: t(
    "Write a rule for yesterday's berries, see it meet today's, then teach with examples.",
    "اكتب قاعدة لتوت الأمس، وانظر ماذا تفعل بتوت اليوم، ثم علّم بالأمثلة.",
  ),
  instructions: t(
    "The bunny has now tasted some of the purple berries too. Teach it with examples, and make sure it can sort the new berries marked ?.",
    "تذوّق الأرنب الآلي الآن بعض التوت البنفسجي أيضًا. علّمه بالأمثلة، وتأكّد أنه يستطيع فرز التوت الجديد المعلَّم بعلامة ؟.",
  ),
  explanation: t(
    "Your rule did exactly what it said, and nothing else. It was right about yesterday's berries, but it had never heard of purple ones, so it called them not safe. A rule only changes when a person rewrites it. The learner was different: you showed it a purple berry, and it sorted the new purple ones by copying that example. That is the difference between coding and machine learning. Both need people: someone writes the rule, or someone chooses the examples.",
    "فعلت قاعدتك ما تقوله بالضبط، ولا شيء غيره. كانت صحيحة مع توت الأمس، لكنها لم تسمع بالتوت البنفسجي قطّ، فقالت إنه غير آمن. القاعدة لا تتغيّر إلا إذا أعاد إنسان كتابتها. أما المتعلّم فكان مختلفًا: أريته حبة بنفسجية، ففرز الحبات البنفسجية الجديدة بتقليد ذلك المثال. هذا هو الفرق بين البرمجة وتعلّم الآلة. وكلاهما يحتاج إلى الناس: أحدٌ يكتب القاعدة، أو أحدٌ يختار الأمثلة.",
  ),
  teacherNotes: t(
    "The bridge between the three coding worlds and AI Island. Part 1 is ungraded: children try rule cards against yesterday's berries until one fits all of them (only the colour rule does). Part 2 shows that rule meeting today's purple berries and misreading them. Part 3 is the graded task: a 1-nearest-neighbour learner scored on held-out berries, which fails unless a purple example is taught. Say out loud that a person could rewrite the rule too; the point is WHO changes each one. Discussion: which would you rather maintain on a real island where new berries keep appearing, and why might you still want a rule sometimes?",
    "الجسر بين عوالم البرمجة الثلاثة وجزيرة الذكاء الاصطناعي. الجزء الأول غير مقيَّم: يجرّب الأطفال بطاقات القواعد على توت الأمس حتى تناسبه واحدة كله (قاعدة اللون وحدها تفعل ذلك). ويُظهر الجزء الثاني تلك القاعدة أمام توت اليوم البنفسجي وهي تخطئ فيه. أما الجزء الثالث فهو المهمة المقيَّمة: متعلّم «الجار الأقرب» يُختبر على توت محجوز، ويفشل ما لم يُعلَّم مثالًا بنفسجيًا. قل بصوت عالٍ إن الإنسان يستطيع أيضًا إعادة كتابة القاعدة؛ الفكرة هي مَن يغيّر كلًّا منهما. للنقاش: أيّهما تفضّل أن تعتني به في جزيرة حقيقية يظهر فيها توت جديد باستمرار، ولماذا قد تريد قاعدة أحيانًا رغم ذلك؟",
  ),
  difficulty: "EASY",
  recommendedGradeMin: 3,
  recommendedGradeMax: 7,
  estimatedMinutes: 6,
  xpReward: 50,
  tags: ["ai", "classification"],
  requires: [],
  hints: hints(
    [
      "First find a rule that fits every berry from yesterday. Look at what the safe ones have in common.",
      "ابحث أولًا عن قاعدة تناسب كل حبات الأمس. انظر إلى ما تشترك فيه الحبات الآمنة.",
    ],
    [
      "When you teach with examples, the bunny copies the example that looks most like each new berry. Has it seen a purple one?",
      "حين تعلّم بالأمثلة، يقلّد الأرنب المثال الأقرب شبهًا بكل حبة جديدة. هل رأى حبة بنفسجية؟",
    ],
    [
      "Teach one blue berry, one purple berry, and two red ones. That is enough.",
      "علّمه حبة زرقاء، وحبة بنفسجية، وحبتين حمراوين. هذا يكفي.",
    ],
    [
      "Purple berries are safe. Put at least one purple berry in the safe basket, then press Test the bunny.",
      "التوت البنفسجي آمن. ضع حبة بنفسجية واحدة على الأقل في سلة الآمن، ثم اضغط «اختبر الأرنب».",
    ],
  ),
  payload: {
    conceptSlug: "rules-versus-learning",
    labels: {
      positive: t("Safe to eat", "آمنة للأكل"),
      negative: t("Not safe", "غير آمنة"),
    },
    // Blue → purple → red that actually LOOKS blue, purple and red.
    theme: {
      glyph: "namedBerry",
      featureNames: { size: t("Size", "الحجم"), color: t("Colour", "اللون") },
      truthEmoji: { positive: "😋", negative: "🤢" },
    },
    walkthrough: [
      {
        title: t("Two ways to sort", "طريقتان للفرز"),
        body: t(
          "You can WRITE a rule, like in the coding worlds. Or you can SHOW the bunny examples and let it work the rule out. Today you'll try both.",
          "يمكنك أن تكتب قاعدة، كما في عوالم البرمجة. أو أن تُري الأرنب أمثلة وتتركه يستنتج القاعدة بنفسه. اليوم ستجرّب الطريقتين.",
        ),
      },
      {
        title: t("First, a rule", "أولًا: قاعدة"),
        body: t(
          "Pick a rule card and test it on yesterday's berries. Keep going until one fits them all.",
          "اختر بطاقة قاعدة واختبرها على توت الأمس. تابع حتى تجد واحدة تناسبه كله.",
        ),
      },
      {
        title: t("Then, something new", "ثم: شيء جديد"),
        body: t(
          "Purple berries have appeared. Watch what your rule does with them.",
          "ظهر توت بنفسجي. انظر ماذا تفعل قاعدتك به.",
        ),
      },
      {
        title: t("Now teach instead", "والآن: علّم بدلًا من ذلك"),
        body: t(
          "Teach the bunny with examples, and it can sort berries it has never seen — as long as your examples cover them.",
          "علّم الأرنب بالأمثلة، وسيستطيع فرز توت لم يره من قبل — ما دامت أمثلتك تغطيه.",
        ),
      },
    ],
    ruleRound: {
      rules: [
        { id: "blue", feature: "color", positiveWhen: "below", threshold: 0.4, label: t("Blue berries are safe", "التوت الأزرق آمن") },
        { id: "small", feature: "size", positiveWhen: "below", threshold: 0.5, label: t("Small berries are safe", "التوت الصغير آمن") },
        { id: "big", feature: "size", positiveWhen: "above", threshold: 0.5, label: t("Big berries are safe", "التوت الكبير آمن") },
      ],
      // Only colour explains yesterday: both sizes on both colours.
      yesterday: [
        { id: "y1", size: 0.3, color: 0.08, truth: "positive" },
        { id: "y2", size: 0.7, color: 0.18, truth: "positive" },
        { id: "y3", size: 0.32, color: 0.88, truth: "negative" },
        { id: "y4", size: 0.72, color: 0.92, truth: "negative" },
        { id: "y5", size: 0.5, color: 0.12, truth: "positive" },
        { id: "y6", size: 0.55, color: 0.85, truth: "negative" },
      ],
      // The rule that fits yesterday misreads both purple ones.
      today: [
        { id: "d1", size: 0.4, color: 0.5, truth: "positive" },
        { id: "d2", size: 0.65, color: 0.56, truth: "positive" },
        { id: "d3", size: 0.5, color: 0.1, truth: "positive" },
        { id: "d4", size: 0.45, color: 0.9, truth: "negative" },
      ],
    },
    pool: [
      { id: "p1", size: 0.3, color: 0.1, truth: "positive" },
      { id: "p2", size: 0.7, color: 0.15, truth: "positive" },
      { id: "p3", size: 0.35, color: 0.5, truth: "positive" },
      { id: "p4", size: 0.65, color: 0.55, truth: "positive" },
      { id: "p5", size: 0.3, color: 0.9, truth: "negative" },
      { id: "p6", size: 0.7, color: 0.85, truth: "negative" },
    ],
    testSet: [
      { id: "t1", size: 0.4, color: 0.52 },
      { id: "t2", size: 0.6, color: 0.5 },
      { id: "t3", size: 0.5, color: 0.12 },
      { id: "t4", size: 0.5, color: 0.88 },
    ],
    rule: { feature: "color", threshold: 0.7 },
    minPerLabel: 2,
    maxExamples: 6,
    // Four is enough: one blue, one purple, two red.
    starCriteria: { threeStarMaxBlocks: 4 },
  } satisfies AiClassificationDraft,
};
