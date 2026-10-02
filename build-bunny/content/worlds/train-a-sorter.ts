import type { z } from "zod";
import type { ModuleFixture, aiClassificationPayload } from "@/modules/curriculum/schemas";

import { hints, t } from "./kit";

/**
 * "Train a Sorter" — the redesign brief's first-session activity, as the
 * developer handoff describes it: "Can you teach a robot to sort shapes?"
 * The child labels 3 to 5 examples, the robot makes an understandable
 * mistake on a new shape, the child adds a better example and tests again.
 *
 * The mistake is the handoff's own story (Ruli learns "red means circle"):
 * the robot's first examples happen to line colour up with shape — red
 * circles, orange squares — so a 1-nearest-neighbour learner copies the
 * COLOUR. An orange circle comes out "square" and a red square "circle".
 * One better example of each (an orange circle, a red square) fixes it.
 *
 * Geometry (shape glyph): feature 1 is roundness, 0.05 = circle, 0.3 =
 * square; feature 2 is colour, 0 = orange, ~0.35 = red. The shape gap (0.25)
 * is smaller than the colour gap (0.35), which is exactly what makes colour
 * win until the child shows the robot a counterexample. The content suite
 * brute-forces this: every set without both better examples fails.
 */

type AiClassificationDraft = z.input<typeof aiClassificationPayload>;

export const firstSorts: ModuleFixture = {
  slug: "first-sorts",
  order: 1,
  name: t("First Sorts", "أول فرز"),
  description: t(
    "Teach a robot with examples before anything else — no code, just shapes.",
    "علّم روبوتًا بالأمثلة قبل أي شيء آخر — بلا برمجة، أشكال فقط.",
  ),
  levels: [
    {
      slug: "train-a-sorter",
      order: 1,
      activityType: "AI_CLASSIFICATION",
      track: "AI_CONCEPTS",
      title: t("Train a Sorter", "درّب آلة فرز"),
      story: t(
        "Robo Bunny's sorting robot has never seen a shape. Everything it will ever know about circles and squares, it learns from the examples you show it.",
        "روبوت الفرز الذي يملكه الأرنب الآلي لم يرَ شكلًا قطّ. كل ما سيعرفه عن الدوائر والمربعات سيتعلّمه من الأمثلة التي نُريه إياها.",
      ),
      objective: t(
        "Train a classifier with a few labelled examples, predict what it will do on new shapes, watch it copy a misleading feature (colour), and fix it with a better example.",
        "تدريب مصنِّف بأمثلة قليلة مصنّفة، وتوقّع ما سيفعله مع أشكال جديدة، وملاحظة تقليده لخاصية مضلِّلة (اللون)، وإصلاح ذلك بمثال أفضل.",
      ),
      mission: t("Teach the robot circles and squares with a few examples.", "لنعلّم الروبوت الدوائر والمربعات ببضعة أمثلة."),
      instructions: t(
        "Pick a few shapes to teach with. Then guess what the robot will say about the new shapes marked ?, and test it.",
        "لنختر بضعة أشكال نعلّمه بها، ثم نخمّن ماذا سيقول الروبوت عن الأشكال الجديدة المعلَّمة بعلامة «؟»، ونختبره.",
      ),
      explanation: t(
        "The robot never knew what a circle was. It copied the example that looked most like each new shape — and at first, colour was what looked most alike, so it thought red meant circle. When you showed it an orange circle and a red square, colour stopped working and shape started to. That is how machines learn: from examples. Change the examples, and you change what it learns.",
        "لم يعرف الروبوت قطّ ما هي الدائرة. كان يقلّد المثال الأشبه بكل شكل جديد — وفي البداية كان اللون هو الأشبه، فظنّ أن الأحمر يعني دائرة. وحين رأى دائرة برتقالية ومربعًا أحمر، لم يعد اللون ينفع وصار الشكل هو ما ينفع. هكذا تتعلّم الآلات: من الأمثلة. إذا تغيّرت الأمثلة، تغيّر ما تتعلّمه الآلة.",
      ),
      keyIdea: { en: "A robot that learns from examples copies what they have in common, so it can get new cases wrong until you show it better examples.", ar: "الروبوت الذي يتعلّم من الأمثلة ينسخ ما تشترك فيه، لذلك قد يخطئ في الحالات الجديدة حتى يرى أمثلة أفضل." },
      teacherNotes: t(
        "The first-session activity from the redesign brief (\"Can you teach a robot to sort shapes?\"). Two parts matter. PREDICT: before the robot's guesses appear, children say what they think it will answer — most will expect it to get the shapes right, because THEY can see the shapes. OBSERVE: it copies colour instead, because the first examples line colour up with shape. Let the surprise land, then ask: which one example would stop it copying colour? The fix is one orange circle and one red square. Discussion: the robot was not wrong about what it saw — it learned exactly what the examples taught it.",
        "النشاط الأول في الجلسة الأولى من موجز إعادة التصميم («هل تستطيع أن تعلّم روبوتًا فرز الأشكال؟»). جزءان مهمّان. التوقّع: قبل ظهور تخمينات الروبوت يقول الأطفال ماذا يظنّون أنه سيجيب — وسيتوقّع أكثرهم أن يصيب في الأشكال لأنهم هم يرون الأشكال. الملاحظة: إنه يقلّد اللون بدلًا من ذلك، لأن الأمثلة الأولى تربط اللون بالشكل. دع المفاجأة تحدث، ثم اسأل: أيّ مثال واحد سيمنعه من تقليد اللون؟ الحل دائرة برتقالية ومربع أحمر. للنقاش: لم يخطئ الروبوت فيما رآه — لقد تعلّم بالضبط ما علّمته إياه الأمثلة.",
      ),
      difficulty: "EASY",
      recommendedGradeMin: 3,
      recommendedGradeMax: 7,
      estimatedMinutes: 6,
      xpReward: 50,
      tags: ["ai", "classification"],
      requires: [],
      hints: hints(
        ["Teach at least one circle and one square. The robot needs to see both.", "علّمه دائرة واحدة ومربعًا واحدًا على الأقل. يحتاج الروبوت إلى رؤية الاثنين."],
        [
          "Look at the shapes it gets wrong. Is it looking at the shape, or at the colour?",
          "انظر إلى الأشكال التي يخطئ فيها. هل ينظر إلى الشكل أم إلى اللون؟",
        ],
        [
          "Your circles are all red and your squares all orange, so colour tells them apart. Show it a circle that isn't red.",
          "كل دوائرك حمراء وكل مربعاتك برتقالية، فاللون يفرّق بينها. أرِه دائرة ليست حمراء.",
        ],
        [
          "Teach it the orange circle and the red square. Then colour can't fool it any more.",
          "علّمه الدائرة البرتقالية والمربع الأحمر. عندها لن يخدعه اللون بعد الآن.",
        ],
      ),
      payload: {
        conceptSlug: "training-by-example",
        labels: { positive: t("Circle", "دائرة"), negative: t("Square", "مربع") },
        theme: {
          glyph: "shape",
          featureNames: { size: t("Roundness", "الاستدارة"), color: t("Colour", "اللون") },
          truthEmoji: { positive: "⚪", negative: "⬜" },
        },
        walkthrough: [
          {
            title: t("A robot that knows nothing", "روبوت لا يعرف شيئًا"),
            body: t(
              "It has never seen a circle or a square. It will only know what your examples show it.",
              "لم يرَ دائرة ولا مربعًا قطّ. لن يعرف إلا ما تريه إياه أمثلتك.",
            ),
          },
          {
            title: t("Teach a few", "علّمه بضعة أمثلة"),
            body: t("Tap a shape to put it in the circle basket or the square basket.", "اضغط على شكل لتضعه في سلة الدوائر أو سلة المربعات."),
          },
          {
            title: t("Guess first", "خمّن أولًا"),
            body: t(
              "Before you see the robot's answers, guess what it will say about the new shapes.",
              "قبل أن ترى إجابات الروبوت، خمّن ماذا سيقول عن الأشكال الجديدة.",
            ),
          },
          {
            title: t("Test, then fix", "اختبر، ثم أصلح"),
            body: t(
              "If it gets one wrong, add a better example and test again.",
              "إذا أخطأ في واحد، أضف مثالًا أفضل واختبر مرة أخرى.",
            ),
          },
        ],
        // The robot's known shapes. p1–p4 line colour up with shape (red
        // circles, orange squares); p5 and p6 are the counterexamples.
        pool: [
          { id: "p1", size: 0.05, color: 0.35, truth: "positive" },
          { id: "p2", size: 0.05, color: 0.38, truth: "positive" },
          { id: "p3", size: 0.3, color: 0.02, truth: "negative" },
          { id: "p4", size: 0.3, color: 0.05, truth: "negative" },
          { id: "p5", size: 0.05, color: 0.0, truth: "positive" },
          { id: "p6", size: 0.3, color: 0.36, truth: "negative" },
        ],
        testSet: [
          { id: "t1", size: 0.05, color: 0.03 },
          { id: "t2", size: 0.3, color: 0.33 },
          { id: "t3", size: 0.05, color: 0.4 },
          { id: "t4", size: 0.3, color: 0.0 },
        ],
        rule: { feature: "size", threshold: 0.175 },
        // The handoff's "3 to 5 examples": one of each kind and 3 in all
        // before the first test, at most 5.
        minPerLabel: 1,
        minExamples: 3,
        maxExamples: 5,
        starCriteria: { threeStarMaxBlocks: 4 },
        predictFirst: true,
      } satisfies AiClassificationDraft,
    },
  ],
};
