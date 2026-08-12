import type { z } from "zod";
import type {
  WorldFixture,
  aiClassificationPayload,
} from "@/modules/curriculum/schemas";

/**
 * World 4 — AI Island. The first world where the student stops writing rules.
 *
 * Everything before this taught programming: you tell the bunny exactly what
 * to do and it obeys. Here the student never writes a rule at all — they show
 * examples and the machine works the rule out. That distinction is the whole
 * point of the world, and it is why AI Island graduates from a horizon world
 * to real content rather than staying roadmap art.
 *
 * Deliberately NOT an AI costume over a grid puzzle: there is no maze, no
 * movement blocks and no program. If a level here could be solved by writing
 * instructions, it belongs in Robot Lab instead.
 */

type AiClassificationDraft = z.input<typeof aiClassificationPayload>;

export const aiIsland: WorldFixture = {
  slug: "ai-island",
  name: { en: "AI Island", ar: "جزيرة الذكاء الاصطناعي" },
  tagline: {
    en: "What makes a machine smart? Come and find out.",
    ar: "ما الذي يجعل الآلة ذكية؟ تعالَ واكتشف.",
  },
  theme: "island",
  horizon: false,
  modules: [
    {
      slug: "teaching-machines",
      order: 1,
      name: { en: "Teaching Machines", ar: "تعليم الآلات" },
      description: {
        en: "You have spent three worlds telling Robo Bunny what to do. On this island you stop telling it, and start showing it.",
        ar: "قضيت ثلاثة عوالم وأنت تخبر الأرنب الآلي بما يفعل. في هذه الجزيرة تتوقّف عن الإخبار وتبدأ بالإراءة.",
      },
      levels: [
        {
          slug: "berry-sorter",
          order: 1,
          activityType: "AI_CLASSIFICATION",
          track: "AI_CONCEPTS",
          title: { en: "Teach the Bunny", ar: "علّم الأرنب" },
          story: {
            en: "The island is full of berries, and Robo Bunny has never seen any of them. Some are safe. Some are definitely not. You cannot write a rule this time — you can only show it examples and hope it works the rest out.",
            ar: "الجزيرة مليئة بالتوت، والأرنب الآلي لم يرَ أيًّا منه من قبل. بعضه آمن وبعضه ليس كذلك بالتأكيد. لا يمكنك كتابة قاعدة هذه المرة — كل ما تملكه أن تريه أمثلة وتأمل أن يستنتج الباقي.",
          },
          objective: {
            en: "Train a classifier by example and discover that WHICH examples you choose decides whether it works on berries it has never seen.",
            ar: "درّب مصنّفًا بالأمثلة، واكتشف أن اختيارك للأمثلة هو ما يحدّد نجاحه مع توت لم يره من قبل.",
          },
          instructions: {
            en: "Put berries into the two baskets to teach Robo Bunny. Watch its guesses change as you teach. When it can name every test berry correctly, press Test the bunny.",
            ar: "ضع حبات التوت في السلّتين لتعليم الأرنب الآلي. راقب تغيّر تخميناته وأنت تعلّمه. وعندما يصبح قادرًا على تسمية كل حبة اختبار بشكل صحيح، اضغط «اختبر الأرنب».",
          },
          explanation: {
            en: "You never wrote a rule. You gave examples, and the bunny found the rule itself — that is machine learning, and it is a completely different job from programming. Notice what actually mattered: colour decided everything and size decided nothing. If you only ever taught it small berries, it had no idea what to do with a big one. That is why the examples you choose matter more than how many you give.",
            ar: "لم تكتب قاعدة قطّ. أعطيت أمثلة فاستنتج الأرنب القاعدة بنفسه — هذا هو تعلّم الآلة، وهو عمل مختلف تمامًا عن البرمجة. ولاحظ ما كان مهمًّا حقًّا: اللون هو ما حسم كل شيء، أما الحجم فلم يحسم شيئًا. وإذا لم تعلّمه إلا حبات صغيرة، فلن يعرف ما يفعل بحبة كبيرة. لهذا فإن اختيار الأمثلة أهمّ من عددها.",
          },
          teacherNotes: {
            en: "The first non-programming level in the product, and the moment to say that out loud: nobody writes instructions here. The hidden rule is colour; size is a decoy. Expect a class to teach only small berries and then be surprised when a big one is misread — let that happen before explaining it, because the surprise is the lesson. Good discussion question afterwards: the bunny was confident and wrong. How would you ever know?",
          },
          difficulty: "EASY",
          recommendedGradeMin: 4,
          recommendedGradeMax: 7,
          estimatedMinutes: 6,
          xpReward: 50,
          tags: ["ai", "classification"],
          requires: [],
          hints: [
            {
              tier: 1,
              text: {
                en: "Put a few berries in each basket. The bunny cannot guess anything until it has seen both kinds.",
                ar: "ضع بضع حبات في كل سلّة. لا يستطيع الأرنب تخمين شيء قبل أن يرى النوعين معًا.",
              },
            },
            {
              tier: 2,
              text: {
                en: "Look at the berries it gets wrong. What do they look like — and did you ever teach it one like that?",
                ar: "انظر إلى الحبات التي يخطئ فيها. كيف تبدو؟ وهل علّمته يومًا حبة مثلها؟",
              },
            },
            {
              tier: 3,
              text: {
                en: "Two things change between berries: how big they are, and their colour. Only one of them decides whether a berry is safe. Which one?",
                ar: "يتغيّر شيئان بين الحبات: حجمها ولونها. واحد منهما فقط يحدّد إن كانت الحبة آمنة. أيّهما؟",
              },
            },
            {
              tier: 4,
              text: {
                en: "Colour is what matters. Teach it a big blue berry AND a small blue one, then a big red AND a small red — so size stops confusing it.",
                ar: "اللون هو المهم. علّمه حبة زرقاء كبيرة وأخرى زرقاء صغيرة، ثم حمراء كبيرة وأخرى حمراء صغيرة — حتى يتوقّف الحجم عن إرباكه.",
              },
            },
          ],
          payload: {
            conceptSlug: "training-by-example",
            labels: {
              positive: { en: "Safe to eat", ar: "آمنة للأكل" },
              negative: { en: "Not safe", ar: "غير آمنة" },
            },
            // Colour decides; size is the decoy. The pool spans BOTH sizes on
            // BOTH colours on purpose, so a representative training set is
            // available — and an unrepresentative one is equally available,
            // which is what makes the choice meaningful.
            pool: [
              { id: "b1", size: 0.15, color: 0.1 },
              { id: "b2", size: 0.85, color: 0.18 },
              { id: "b3", size: 0.2, color: 0.32 },
              { id: "b4", size: 0.9, color: 0.85 },
              { id: "b5", size: 0.18, color: 0.92 },
              { id: "b6", size: 0.8, color: 0.7 },
            ],
            // Held-out. Both are "large", which is exactly the case a student
            // who only taught small berries will get wrong.
            testSet: [
              { id: "t1", size: 0.78, color: 0.12 },
              { id: "t2", size: 0.72, color: 0.9 },
            ],
            rule: { feature: "color", threshold: 0.5 },
            minPerLabel: 2,
            starCriteria: { threeStarMaxBlocks: 4 },
          } satisfies AiClassificationDraft,
        },
      ],
    },
  ],
};
