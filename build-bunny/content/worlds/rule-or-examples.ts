import type { z } from "zod";
import type { ModuleFixture, aiClassificationPayload } from "@/modules/curriculum/schemas";

import { hints, t } from "./kit";

/**
 * "Rule or Examples?" — the rules-versus-learning bridge, on the SAME
 * sorting challenge as the first-session Train a Sorter (the handoff:
 * "colour rule vs trained sorter on a new shape").
 *
 *  1. Write a rule. Yesterday every circle was red and every square orange,
 *     so one short colour rule ("red shapes are circles") fits them all.
 *     Ruli, the rule robot, only has a colour sensor, so every rule card is
 *     about colour — the handoff's own story ("Ruli learns red means
 *     circle").
 *  2. Something new. Today an orange circle and a red square turn up. The
 *     rule says exactly what it was written to say, so it gets both wrong.
 *     A rule never changes by itself.
 *  3. Teach instead. Teach the learner with examples — including an orange
 *     circle and a red square — and it sorts today's new shapes correctly.
 *
 * Honest about the difference: a person COULD rewrite the rule, and the
 * quick check says so. The point is who changes it: a rule changes when
 * someone rewrites it; a learner changes when it is shown new examples.
 *
 * Numbers (shape glyph): feature 1 is roundness, 0.05 = circle, 0.3 =
 * square; colour 0 = orange, ~0.35 = red. Ground truth is roundness < 0.175,
 * as in Train a Sorter. Without the orange circle, the orange mystery circle
 * sits nearer the orange squares; without the red square, the red mystery
 * square sits nearer the red circles — so both counterexamples are needed.
 * The rule round has its own specimens (y*, d*) and never touches the graded
 * testSet (t*).
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
    "Yesterday every circle in the sorting room was red and every square was orange, so Ruli the rule robot sorted them with one short rule. This morning, new shapes have arrived.",
    "أمس كانت كل دائرة في غرفة الفرز حمراء وكل مربع برتقاليًا، ففرزها «رولي» روبوت القواعد بقاعدة قصيرة واحدة. وهذا الصباح وصلت أشكال جديدة.",
  ),
  objective: t(
    "Compare a hand-written rule with a classifier trained on examples, on the same shapes challenge, and see that a rule only changes when someone rewrites it, while a learner changes when it is shown new examples.",
    "المقارنة بين قاعدة يكتبها إنسان ومصنِّف يتدرّب على الأمثلة، في تحدّي الأشكال نفسه، وملاحظة أن القاعدة لا تتغيّر إلا إذا أعاد أحدهم كتابتها، أما المتعلّم فيتغيّر حين تريه أمثلة جديدة.",
  ),
  mission: t(
    "Pick a rule for yesterday's shapes, see it meet today's, then teach with examples.",
    "اختر قاعدة لأشكال الأمس، وانظر ماذا تفعل بأشكال اليوم، ثم علّم بالأمثلة.",
  ),
  instructions: t(
    "Now teach the sorting robot with examples instead, and make sure it can sort the new shapes marked ?.",
    "والآن علّم روبوت الفرز بالأمثلة بدلًا من ذلك، وتأكّد أنه يستطيع فرز الأشكال الجديدة المعلَّمة بعلامة ؟.",
  ),
  explanation: t(
    "Ruli's rule did exactly what it said, and nothing else. It was right about yesterday's shapes, but it only looked at colour, so an orange circle and a red square fooled it. A rule only changes when a person rewrites it. The learner was different: you showed it an orange circle and a red square, and it sorted the new ones by copying those examples. That is the difference between coding and machine learning. Both need people: someone writes the rule, or someone chooses the examples.",
    "فعلت قاعدة «رولي» ما تقوله بالضبط، ولا شيء غيره. كانت صحيحة مع أشكال الأمس، لكنها لم تنظر إلا إلى اللون، فخدعتها دائرة برتقالية ومربع أحمر. القاعدة لا تتغيّر إلا إذا أعاد إنسان كتابتها. أما المتعلّم فكان مختلفًا: أريته دائرة برتقالية ومربعًا أحمر، ففرز الأشكال الجديدة بتقليد هذين المثالين. هذا هو الفرق بين البرمجة وتعلّم الآلة. وكلاهما يحتاج إلى الناس: أحدٌ يكتب القاعدة، أو أحدٌ يختار الأمثلة.",
  ),
  keyIdea: { en: "A written rule only knows what its author thought of; a learner can be taught new cases with new examples.", ar: "القاعدة المكتوبة لا تعرف إلا ما فكّر فيه كاتبها؛ أما المتعلّم فيمكن تعليمه حالات جديدة بأمثلة جديدة." },
  teacherNotes: t(
    "The bridge between rules and learning, on the same circles-and-squares challenge as Train a Sorter. Part 1 is ungraded: children try Ruli's colour rule cards against yesterday's shapes until one fits all of them (only \"red shapes are circles\" does). Part 2 shows that rule meeting today's orange circle and red square and getting both wrong. Part 3 is the graded task: a 1-nearest-neighbour learner scored on held-out shapes, which fails unless an orange circle and a red square are taught. Say out loud that a person could rewrite the rule too (\"round shapes are circles\"); the point is WHO changes each one. Discussion: which would you rather maintain in a sorting room where new shapes keep arriving, and why might you still want a rule sometimes?",
    "الجسر بين القواعد والتعلّم، في تحدّي الدوائر والمربعات نفسه الذي في «درّب آلة فرز». الجزء الأول غير مقيَّم: يجرّب الأطفال بطاقات قواعد اللون عند «رولي» على أشكال الأمس حتى تناسبها واحدة كلها (قاعدة «الأشكال الحمراء دوائر» وحدها تفعل ذلك). ويُظهر الجزء الثاني تلك القاعدة أمام دائرة برتقالية ومربع أحمر اليوم وهي تخطئ في الاثنين. أما الجزء الثالث فهو المهمة المقيَّمة: متعلّم «الجار الأقرب» يُختبر على أشكال محجوزة، ويفشل ما لم يُعلَّم دائرة برتقالية ومربعًا أحمر. قل بصوت عالٍ إن الإنسان يستطيع أيضًا إعادة كتابة القاعدة («الأشكال المستديرة دوائر»)؛ الفكرة هي مَن يغيّر كلًّا منهما. للنقاش: أيّهما تفضّل أن تعتني به في غرفة فرز تصلها أشكال جديدة باستمرار، ولماذا قد تريد قاعدة أحيانًا رغم ذلك؟",
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
      "First find a rule that fits every shape from yesterday. Look at what colour the circles are.",
      "ابحث أولًا عن قاعدة تناسب كل أشكال الأمس. انظر إلى لون الدوائر.",
    ],
    [
      "When you teach with examples, the robot copies the example that looks most like each new shape. Has it seen an orange circle? A red square?",
      "حين تعلّم بالأمثلة، يقلّد الروبوت المثال الأقرب شبهًا بكل شكل جديد. هل رأى دائرة برتقالية؟ ومربعًا أحمر؟",
    ],
    [
      "Teach one red circle, one orange circle, one orange square and one red square. That is enough.",
      "علّمه دائرة حمراء، ودائرة برتقالية، ومربعًا برتقاليًا، ومربعًا أحمر. هذا يكفي.",
    ],
    [
      "Put the orange circle in the circle basket and the red square in the square basket, then press Test the bunny.",
      "ضع الدائرة البرتقالية في سلة الدوائر والمربع الأحمر في سلة المربعات، ثم اضغط «اختبر الأرنب».",
    ],
  ),
  payload: {
    conceptSlug: "rules-versus-learning",
    labels: { positive: t("Circle", "دائرة"), negative: t("Square", "مربع") },
    theme: {
      glyph: "shape",
      featureNames: { size: t("Roundness", "الاستدارة"), color: t("Colour", "اللون") },
      truthEmoji: { positive: "⚪", negative: "⬜" },
    },
    walkthrough: [
      {
        title: t("Two ways to sort", "طريقتان للفرز"),
        body: t(
          "You can WRITE a rule, like in the coding worlds. Or you can SHOW the robot examples and let it work the rule out. Today you'll try both.",
          "يمكنك أن تكتب قاعدة، كما في عوالم البرمجة. أو أن تُري الروبوت أمثلة وتتركه يستنتج القاعدة بنفسه. اليوم ستجرّب الطريقتين.",
        ),
      },
      {
        title: t("First, a rule", "أولًا: قاعدة"),
        body: t(
          "Ruli the rule robot can only see colour. Pick one of its rule cards and test it on yesterday's shapes. Keep going until one fits them all.",
          "«رولي» روبوت القواعد لا يرى إلا اللون. اختر إحدى بطاقات قواعده واختبرها على أشكال الأمس. تابع حتى تجد واحدة تناسبها كلها.",
        ),
      },
      {
        title: t("Then, something new", "ثم: شيء جديد"),
        body: t(
          "An orange circle and a red square have arrived. Watch what the rule does with them.",
          "وصلت دائرة برتقالية ومربع أحمر. انظر ماذا تفعل القاعدة بهما.",
        ),
      },
      {
        title: t("Now teach instead", "والآن: علّم بدلًا من ذلك"),
        body: t(
          "Teach the sorting robot with examples, and it can sort shapes it has never seen — as long as your examples cover them.",
          "علّم روبوت الفرز بالأمثلة، وسيستطيع فرز أشكال لم يرها من قبل — ما دامت أمثلتك تغطيها.",
        ),
      },
    ],
    ruleRound: {
      rules: [
        { id: "red", feature: "color", positiveWhen: "above", threshold: 0.2, label: t("Red shapes are circles", "الأشكال الحمراء دوائر") },
        { id: "orange", feature: "color", positiveWhen: "below", threshold: 0.2, label: t("Orange shapes are circles", "الأشكال البرتقالية دوائر") },
        { id: "purple", feature: "color", positiveWhen: "above", threshold: 0.7, label: t("Purple shapes are circles", "الأشكال البنفسجية دوائر") },
      ],
      // Only the red rule explains yesterday: colour lines up with shape.
      yesterday: [
        { id: "y1", size: 0.05, color: 0.35, truth: "positive" },
        { id: "y2", size: 0.3, color: 0.02, truth: "negative" },
        { id: "y3", size: 0.05, color: 0.4, truth: "positive" },
        { id: "y4", size: 0.3, color: 0.06, truth: "negative" },
        { id: "y5", size: 0.05, color: 0.32, truth: "positive" },
        { id: "y6", size: 0.3, color: 0.08, truth: "negative" },
      ],
      // The rule that fits yesterday gets the orange circle and the red square wrong.
      today: [
        { id: "d1", size: 0.05, color: 0.03, truth: "positive" },
        { id: "d2", size: 0.3, color: 0.37, truth: "negative" },
        { id: "d3", size: 0.05, color: 0.36, truth: "positive" },
        { id: "d4", size: 0.3, color: 0.04, truth: "negative" },
      ],
    },
    pool: [
      { id: "s1", size: 0.05, color: 0.36, truth: "positive" },
      { id: "s2", size: 0.05, color: 0.4, truth: "positive" },
      { id: "s3", size: 0.3, color: 0.03, truth: "negative" },
      { id: "s4", size: 0.3, color: 0.06, truth: "negative" },
      // The two counterexamples: an orange circle and a red square.
      { id: "s5", size: 0.05, color: 0.02, truth: "positive" },
      { id: "s6", size: 0.3, color: 0.38, truth: "negative" },
    ],
    testSet: [
      { id: "t1", size: 0.05, color: 0.05 },
      { id: "t2", size: 0.3, color: 0.34 },
      { id: "t3", size: 0.05, color: 0.38 },
      { id: "t4", size: 0.3, color: 0.01 },
    ],
    rule: { feature: "size", threshold: 0.175 },
    minPerLabel: 2,
    maxExamples: 6,
    // Four is enough: a red and an orange of each shape.
    starCriteria: { threeStarMaxBlocks: 4 },
    predictFirst: true,
  } satisfies AiClassificationDraft,
};
