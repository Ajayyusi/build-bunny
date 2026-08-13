import type { z } from "zod";
import type {
  WorldFixture,
  aiClassificationPayload,
  aiEthicsPayload,
  aiSimPayload,
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
type AiEthicsDraft = z.input<typeof aiEthicsPayload>;
type AiSimDraft = z.input<typeof aiSimPayload>;

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
            en: "Robo Bunny has eaten these berries before, so it knows which ones made it sick. Teach it with some of them — then it must work out the NEW berries marked ?. Get all of them right and you win.",
            ar: "أكل الأرنب الآلي هذا التوت من قبل، فهو يعرف ما الذي أصابه بالمرض. علّمه ببعضها — ثم عليه أن يستنتج التوت الجديد المعلَّم بعلامة ؟. أصِبها كلها لتفوز.",
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
            // Colour decides; size is the decoy. Each berry carries what
            // ALREADY happened when the bunny tried it — the child cannot
            // invent which berries are safe, and asking them to would make
            // this a guessing game instead of a lesson. The pool spans BOTH
            // sizes on BOTH colours, so a representative training set is
            // available and an unrepresentative one is equally available.
            // Choosing between them is the entire activity.
            pool: [
              { id: "b1", size: 0.15, color: 0.1, truth: "positive" },
              { id: "b2", size: 0.85, color: 0.18, truth: "positive" },
              { id: "b3", size: 0.2, color: 0.32, truth: "positive" },
              { id: "b4", size: 0.9, color: 0.85, truth: "negative" },
              { id: "b5", size: 0.18, color: 0.92, truth: "negative" },
              { id: "b6", size: 0.8, color: 0.7, truth: "negative" },
            ],
            // Held-out. Both are "large", which is exactly the case a student
            // who only taught small berries will get wrong.
            testSet: [
              { id: "t1", size: 0.78, color: 0.12 },
              { id: "t2", size: 0.72, color: 0.9 },
            ],
            rule: { feature: "color", threshold: 0.5 },
            minPerLabel: 2,
            // 6 = the whole pool, i.e. deliberately not binding. The budget
            // became live in the grader in the same commit, and this is the
            // introductory level: its lesson is WHICH examples, not how few.
            // Frugality is taught explicitly in draw-the-line, which sets
            // maxExamples. Left at 4 this would have silently demoted every
            // already-recorded 6-berry pass from 3 stars to 2.
            starCriteria: { threeStarMaxBlocks: 6 },
          } satisfies AiClassificationDraft,
        },
        {
          slug: "draw-the-line",
          order: 2,
          activityType: "AI_CLASSIFICATION",
          track: "AI_CONCEPTS",
          title: {
            en: "Where Does the Line Go?",
            ar: "أين يمرّ الخط؟",
          },
          story: {
            en: "Robo Bunny is back on the berry path, and today it only has room in its head for two berries. All six are the same size now — only the colour changes, pale at one end and dark at the other. Somewhere along that row, safe turns into not safe. You pick the two berries that show it where.",
            ar: "عاد الأرنب الآلي إلى درب التوت، وهذه المرة لا يتّسع عقله إلا لحبتين. حبات التوت متساوية في الحجم، ولا يتغيّر فيها إلا اللون: فاتح في طرف وغامق في الطرف الآخر. وفي مكان ما بين الطرفين يتحوّل الآمن إلى غير آمن، وأنت من يختار الحبتين اللتين تدلّانه على ذلك المكان.",
          },
          objective: {
            en: "Teach with only two berries and watch where the bunny puts its line: exactly halfway between them. Pick the pair that puts that line in the right place.",
            ar: "علّم الأرنب بحبتين فقط، وراقب أين يضع خطه: في منتصف المسافة بينهما تمامًا. اختر الحبتين اللتين تضعان الخط في مكانه الصحيح.",
          },
          instructions: {
            en: "Pick one safe berry and one unsafe berry. Two is all you get. The bunny draws its line halfway between the pair you picked, and calls everything paler than the line safe. Swap berries and watch the line slide, until both ? berries come out right.",
            ar: "اختر حبة آمنة وحبة غير آمنة، حبتين لا أكثر. يرسم الأرنب خطه في منتصف المسافة بين الحبتين اللتين اخترتهما، ويعدّ كل ما هو أفتح من الخط آمنًا. بدّل الحبتين وراقب الخط وهو ينزلق، حتى يصيب الأرنب حبتَي «؟» كلتيهما.",
          },
          explanation: {
            en: "The palest berry and the darkest one felt like the obvious pair, and they taught the bunny almost nothing: they sit so far apart that halfway between them lands nowhere near the real edge. The pair that won was the pair you could barely tell apart — the two berries sitting either side of the place where safe stops. The examples you are least sure about are the ones that decide everything. One warning: halfway is where THIS bunny puts its line, because it copies the nearest berry you showed it. Other machines work out where to put their line in other ways, and you will meet some of them.",
            ar: "بدت الحبة الأفتح والحبة الأغمق أوضح اختيار، لكنهما لم تعلّما الأرنب شيئًا يُذكر: المسافة بينهما واسعة، ومنتصفها يقع بعيدًا عن الحدّ الحقيقي. أما الحبتان اللتان فازتا فهما الحبتان اللتان تكاد لا تفرّق بينهما، أي الواقعتان على جانبَي الموضع الذي ينتهي عنده الأمان. فالأمثلة التي تتردّد فيها هي وحدها التي تحسم الأمر. وانتبه: وضع الخط في المنتصف هو طريقة هذا الأرنب وحده، لأنه ينسخ إجابة أقرب حبة علّمته إياها. وهناك آلات أخرى تحدّد موضع خطها بطرق مختلفة، وستقابل بعضها لاحقًا.",
          },
          teacherNotes: {
            en: "This level makes the 1-nearest-neighbour decision boundary explicit. With exactly two training points of opposite class, the 1-NN boundary is the perpendicular bisector of the segment joining them — in one dimension, simply the midpoint. The hard cap of maxExamples: 2 is what makes that visible; with three or more points the boundary becomes piecewise and the lesson blurs, so do not relax the cap.\n\nThe trap is an intuition correctly learned in berry-sorter, where spreading examples across the feature space was the right move. Here the widest-margin pair (palest safe, darkest unsafe) puts the midpoint far from the true threshold and misclassifies at least one held-out probe; a near/far mixed pair fails the same way. Only the closest opposite pair — the two specimens straddling the true threshold — places the midpoint inside the correct interval. That is one winning pair out of the nine possible.\n\nThis is the same idea as support vectors: only the points near the boundary carry information, and the comfortably-separated extremes carry none. It also previews active learning — you learn most by labelling the examples you are least certain about, not the ones you are most confident about.\n\nSay out loud that midpoint placement is a property of this 1-NN classifier, not of machine learning in general. Logistic regression or a decision tree fitted to the same two points would place the boundary somewhere else entirely. Children who leave believing \"machines always split the difference\" have learned something they will have to unlearn.\n\nLet the class try the palest/darkest pair and fail before you intervene; the failure is the lesson. Good discussion questions: if you were allowed a third berry, which one would you add, and would it move the line at all? And: which berry on this board is the most useless one to teach with?",
          },
          difficulty: "MEDIUM",
          recommendedGradeMin: 4,
          recommendedGradeMax: 7,
          estimatedMinutes: 8,
          xpReward: 60,
          tags: ["ai", "classification", "boundary"],
          requires: [],
          hints: [
            {
              tier: 1,
              text: {
                en: "The bunny puts its line exactly halfway between your two berries. Watch where the line lands, not just which berries you picked.",
                ar: "يضع الأرنب خطه في منتصف المسافة بين حبتيك تمامًا. راقب أين يستقرّ الخط، لا الحبتين وحدهما.",
              },
            },
            {
              tier: 2,
              text: {
                en: "Picking two berries that look very different feels right, but try it and look: the further apart they are, the further the line slides from where safe really stops.",
                ar: "اختيار حبتين شديدتَي الاختلاف يبدو صائبًا، لكن جرّبه وانظر: كلما تباعدت الحبتان ابتعد الخط عن الموضع الذي ينتهي عنده الأمان حقًّا.",
              },
            },
            {
              tier: 3,
              text: {
                en: "The line has to land in the narrow gap between the last safe berry and the first unsafe one. Which two berries sit closest to that gap?",
                ar: "على الخط أن يقع في الفجوة الضيّقة بين آخر حبة آمنة وأول حبة غير آمنة. أيّ حبتين أقرب إلى تلك الفجوة؟",
              },
            },
            {
              tier: 4,
              text: {
                en: "Find the darkest berry that is still safe, and the palest berry that is not — the two you can hardly tell apart. Halfway between those two is exactly where the line belongs.",
                ar: "ابحث عن أغمق حبة آمنة وأفتح حبة غير آمنة — الحبتين اللتين تكاد لا تميّز بينهما. منتصف المسافة بينهما هو موضع الخط الصحيح تمامًا.",
              },
            },
          ],
          payload: {
            conceptSlug: "decision-boundary",
            labels: {
              positive: {
                en: "Safe to eat",
                ar: "آمنة للأكل",
              },
              negative: {
                en: "Not safe",
                ar: "غير آمنة",
              },
            },
            theme: {
              glyph: "berry",
              featureNames: {
                size: {
                  en: "Size",
                  ar: "الحجم",
                },
                color: {
                  en: "Colour",
                  ar: "اللون",
                },
              },
              truthEmoji: { positive: "😋", negative: "🤢" },
            },
            walkthrough: [
              {
                title: {
                  en: "Six berries in a row",
                  ar: "ستّ حبات في صفّ واحد",
                },
                body: {
                  en: "They are all the same size today. Only the colour changes, pale at one end and dark at the other. Somewhere in that row, safe stops.",
                  ar: "كلها متساوية في الحجم اليوم، ولا يتغيّر فيها إلا اللون: فاتح في طرف وغامق في الآخر. وفي مكان ما من الصفّ ينتهي الأمان.",
                },
              },
              {
                title: {
                  en: "You may teach it two",
                  ar: "لك أن تعلّمه حبتين",
                },
                body: {
                  en: "One safe berry, one not safe. That is the whole budget. The bunny has nothing else to go on.",
                  ar: "حبة آمنة وحبة غير آمنة، وهذا كل ما تملك. ولا شيء آخر يعتمد عليه الأرنب.",
                },
              },
              {
                title: {
                  en: "It draws a line halfway",
                  ar: "يرسم خطه في المنتصف",
                },
                body: {
                  en: "The bunny puts its line exactly midway between your two berries, and calls everything paler than the line safe. Swap a berry and the line slides.",
                  ar: "يضع الأرنب خطه في منتصف المسافة بين حبتيك تمامًا، ويعدّ كل ما هو أفتح منه آمنًا. وإذا بدّلت حبة انزلق الخط.",
                },
              },
              {
                title: {
                  en: "Far apart is not better",
                  ar: "التباعد ليس أفضل",
                },
                body: {
                  en: "Picking the palest and the darkest feels clever. Look at where that leaves the line before you believe it.",
                  ar: "اختيار الأفتح والأغمق يبدو ذكيًّا. انظر أين يترك الخطَّ قبل أن تصدّق ذلك.",
                },
              },
            ],
            board: {
              show: true,
              showBoundary: true,
              axisLabels: {
                x: {
                  en: "Size — every berry is the same",
                  ar: "الحجم — كل الحبات متساوية",
                },
                y: {
                  en: "Colour, from pale to dark",
                  ar: "اللون، من الفاتح إلى الغامق",
                },
              },
            },
            pool: [
              { id: "c1", size: 0.5, color: 0.06, truth: "positive" },
              { id: "c2", size: 0.5, color: 0.2, truth: "positive" },
              { id: "c3", size: 0.5, color: 0.44, truth: "positive" },
              { id: "c4", size: 0.5, color: 0.56, truth: "negative" },
              { id: "c5", size: 0.5, color: 0.66, truth: "negative" },
              { id: "c6", size: 0.5, color: 0.72, truth: "negative" },
            ],
            testSet: [
              { id: "t1", size: 0.5, color: 0.47 },
              { id: "t2", size: 0.5, color: 0.53 },
            ],
            rule: { kind: "threshold", feature: "color", threshold: 0.5 },
            minPerLabel: 1,
            maxExamples: 2,
          } satisfies AiClassificationDraft,
        },
        {
          slug: "the-berry-that-lied",
          order: 3,
          activityType: "AI_CLASSIFICATION",
          track: "AI_CONCEPTS",
          title: {
            en: "The Berry That Lied",
            ar: "الحبة الكاذبة",
          },
          story: {
            en: "Another rabbit tried all these berries before you, and wrote a note on each one saying what happened to it. The notes are almost right. One of them is wrong — that rabbit remembered one berry backwards. Robo Bunny cannot tell. It believes every note you hand it.",
            ar: "جرّب أرنبٌ آخر هذا التوت قبلك، وكتب على كل حبة ملاحظة تقول ما حدث له بعدها. الملاحظات كلها صحيحة إلا واحدة: حبة واحدة تذكّرها ذلك الأرنب بالمقلوب. والأرنب الآلي لا ينتبه إلى ذلك أبدًا، فهو يصدّق كل ملاحظة تناوله إياها.",
          },
          objective: {
            en: "Find the one note that is wrong, and learn that the bunny is never more right than the notes you hand it.",
            ar: "اعثر على الملاحظة الخاطئة الوحيدة، واكتشف أن الأرنب لا يكون أصحّ من الملاحظات التي تعطيه إياها.",
          },
          instructions: {
            en: "One of these notes is wrong. One — not two, and never none. Teach the bunny, look at the ? berries it gets wrong, and work out which note is lying to it.",
            ar: "ملاحظة واحدة من هذه الملاحظات خاطئة؛ واحدة فقط، لا أكثر ولا أقل. علّم الأرنب، ثم انظر إلى حبات «؟» التي أخطأ فيها، واستنتج أيّ ملاحظة تكذب عليه.",
          },
          explanation: {
            en: "The bunny checks nothing. It reads the note on a berry and believes it, so one wrong note turns into one wrong answer — and only for the ? berries sitting nearest to it. That is why the mess showed up in one small patch instead of all over the board. You fixed it by taking a berry away, not by adding one, and that is the opposite of every other level here. One honest thing: you found the lie because we told you there was exactly one. Nobody tells you that about real notes.",
            ar: "الأرنب لا يتحقّق من شيء. يقرأ الملاحظة المكتوبة على الحبة فيصدّقها، فتتحوّل ملاحظة واحدة خاطئة إلى إجابة واحدة خاطئة — ولا يظهر أثرها إلا في حبات «؟» الأقرب إليها. لهذا ظهرت الفوضى في بقعة صغيرة واحدة، لا في اللوحة كلها. وقد أصلحت الأمر بسحب حبة، لا بإضافة حبة، وهذا عكس كل مستوى آخر هنا. وتبقى نقطة صادقة: عرفت مكان الكذبة لأننا أخبرناك أنها واحدة. أما في الملاحظات الحقيقية فلا أحد يخبرك.",
          },
          teacherNotes: {
            en: "The label-noise level, and the only one in the product won by subtraction instead of addition. Exactly one pool specimen carries a truth flag that contradicts the hidden rule: a low-colour \"positive\" label sitting deep inside the negative region. Because the grader fits a 1-nearest-neighbour classifier, that mislabelled point corrupts predictions only inside its own neighbourhood — which is why the damage renders as a small island of wrong shading rather than a shifted decision boundary, and why exactly one held-out specimen fails. Expect the class's first instinct to be adding more examples around the bad patch. That instinct is reasonable and would help a smoother model, but it cannot work here: with 1-NN the nearest neighbour is still the liar, so more data around it changes nothing. There is deliberately no maxExamples cap, so \"teach the whole tray\" stays available and still fails — let the class try it before you say anything, because the failure is the argument. The discussion worth holding is the one the level cannot resolve: we guaranteed there was exactly one bad label. Real training data ships with no such guarantee. Ask the class how they would find a wrong label if nobody told them one existed, and how they would ever know they had found them all. Useful places to take that: crowd-sourced labelling, two people labelling the same photo differently, and why teams measure inter-annotator agreement before trusting a dataset at all. A strong closing question: if a wrong label only spoils its own small corner, is a dataset with a few bad labels still usable — and how would you decide?",
          },
          difficulty: "MEDIUM",
          recommendedGradeMin: 4,
          recommendedGradeMax: 7,
          estimatedMinutes: 9,
          xpReward: 70,
          tags: ["ai", "classification", "data-quality"],
          requires: [],
          hints: [
            {
              tier: 1,
              text: {
                en: "Look at the board after you teach. The wrong colour is not spread everywhere — it sits in one small patch. Start there.",
                ar: "انظر إلى اللوحة بعد أن تعلّمه. اللون الخاطئ ليس منتشرًا في كل مكان، بل يقع في بقعة صغيرة واحدة. ابدأ من هناك.",
              },
            },
            {
              tier: 2,
              text: {
                en: "The berry with a cross on it has an arrow. Follow it. It points at the berry the bunny copied its answer from.",
                ar: "الحبة التي عليها علامة خطأ يخرج منها سهم. اتبعه؛ فهو يشير إلى الحبة التي نسخ منها الأرنب إجابته.",
              },
            },
            {
              tier: 3,
              text: {
                en: "Look hard at the berry that arrow lands on. Everything sitting around it is dark and not safe. Read its note again.",
                ar: "تأمّل جيدًا الحبة التي يشير إليها السهم. كل ما حولها غامق وغير آمن. اقرأ ملاحظتها مرة أخرى.",
              },
            },
            {
              tier: 4,
              text: {
                en: "The note on that one berry is the lie. Adding more berries cannot cover it up, because the bunny still copies the nearest one. Take that berry back out, then test.",
                ar: "ملاحظة تلك الحبة وحدها هي الكذبة. ولن تُخفيها إضافة حبات أخرى، لأن الأرنب سينسخ إجابة أقرب حبة إليه على أي حال. أعد تلك الحبة، ثم اختبره.",
              },
            },
          ],
          payload: {
            conceptSlug: "label-noise",
            labels: {
              positive: {
                en: "Safe to eat",
                ar: "آمنة للأكل",
              },
              negative: {
                en: "Not safe",
                ar: "غير آمنة",
              },
            },
            theme: {
              glyph: "berry",
              featureNames: {
                size: {
                  en: "Size",
                  ar: "الحجم",
                },
                color: {
                  en: "Colour",
                  ar: "اللون",
                },
              },
              truthEmoji: { positive: "😋", negative: "🤢" },
            },
            walkthrough: [
              {
                title: {
                  en: "The notes are not yours",
                  ar: "الملاحظات ليست ملاحظاتك",
                },
                body: {
                  en: "You did not eat these berries. Another rabbit did, and it wrote a note on every one saying what happened to it.",
                  ar: "أنت لم تأكل هذا التوت. أكله أرنب آخر، وكتب على كل حبة ملاحظة تقول ما حدث له بعدها.",
                },
              },
              {
                title: {
                  en: "The bunny believes notes",
                  ar: "والأرنب الآلي يصدّق الملاحظات",
                },
                body: {
                  en: "It never checks. Hand it a berry and it takes the note as the truth, exactly as written.",
                  ar: "هو لا يتحقّق من شيء أبدًا. تناوله حبة فيأخذ ملاحظتها على أنها الحقيقة، كما هي مكتوبة تمامًا.",
                },
              },
              {
                title: {
                  en: "One note is wrong",
                  ar: "وواحدة منها خاطئة",
                },
                body: {
                  en: "The rabbit remembered one berry backwards. We are telling you that now, so all you have to find is which one.",
                  ar: "كتب ذلك الأرنب حبةً واحدة بالمقلوب. نقول لك ذلك الآن، فلا يبقى عليك إلا أن تعرف أيّها هي.",
                },
              },
              {
                title: {
                  en: "It only spoils its own corner",
                  ar: "ولا تفسد إلا ما حولها",
                },
                body: {
                  en: "A wrong note does not spoil the whole board. It spoils the ? berries sitting nearest to it. Watch where the mistakes gather.",
                  ar: "الملاحظة الخاطئة لا تفسد اللوحة كلها، بل تفسد حبات «؟» الأقرب إليها. راقب أين تتجمّع الأخطاء.",
                },
              },
            ],
            board: {
              show: true,
              showBoundary: true,
              axisLabels: {
                x: {
                  en: "Berry size, small to big",
                  ar: "حجم الحبة، من الصغيرة إلى الكبيرة",
                },
                y: {
                  en: "Berry colour, light to dark",
                  ar: "لون الحبة، من الفاتح إلى الغامق",
                },
              },
            },
            pool: [
              { id: "L1", size: 0.2, color: 0.1, truth: "positive" },
              { id: "L2", size: 0.8, color: 0.15, truth: "positive" },
              { id: "L3", size: 0.35, color: 0.3, truth: "positive" },
              { id: "L4", size: 0.7, color: 0.38, truth: "positive" },
              { id: "L5", size: 0.25, color: 0.85, truth: "negative" },
              { id: "L6", size: 0.85, color: 0.9, truth: "negative" },
              { id: "L7", size: 0.6, color: 0.62, truth: "negative" },
              { id: "L8", size: 0.3, color: 0.75, truth: "positive" },
            ],
            testSet: [
              { id: "t1", size: 0.32, color: 0.7 },
              { id: "t2", size: 0.75, color: 0.25 },
              { id: "t3", size: 0.78, color: 0.8 },
            ],
            rule: { kind: "threshold", feature: "color", threshold: 0.5 },
            mislabelled: ["L8"],
            minPerLabel: 2,
          } satisfies AiClassificationDraft,
        },
        {
          slug: "nothing-rules-alone",
          order: 4,
          activityType: "AI_CLASSIFICATION",
          track: "AI_CONCEPTS",
          title: {
            en: "Two Things at Once",
            ar: "شيئان معًا",
          },
          story: {
            en: "Robo Bunny has walked down to the beach. There are crabs all over the sand: some are safe to pick up, and some give a hard pinch. Last level you looked for the one thing that decided everything, and you found it. On this beach, looking for one thing will not get you to the answer.",
            ar: "نزل الأرنب الآلي إلى الشاطئ. على الرمل سلاطعين كثيرة: بعضها آمن يمكنك حمله، وبعضها يقرص قرصة موجعة. في المستوى السابق بحثت عن الصفة الواحدة التي تحسم كل شيء فوجدتها. أما هنا فلن يوصلك البحث عن صفة واحدة إلى الجواب.",
          },
          objective: {
            en: "Meet a kind of creature that neither measurement explains on its own, and learn to show the bunny every group of crabs on the beach — not just the tidy pair.",
            ar: "تعرَّف إلى نوع لا يفسّره الحجم وحده ولا اللون وحده، وتعلّم أن تُري الأرنب كل أنواع السلاطعين على الشاطئ، لا النوعين المرتّبين فقط.",
          },
          instructions: {
            en: "Robo Bunny has met all of these crabs before, so it knows which ones pinched. You have six slots to teach it with. Then it has to work out the crabs marked ?. Get all four right and you win.",
            ar: "قابل الأرنب الآلي هذه السلاطعين من قبل، فهو يعرف أيّها قرصه. أمامك ستة أمثلة تعلّمه بها. بعدها عليه أن يستنتج السلاطعين المعلَّمة بعلامة ؟. أصِب الأربعة كلها لتفوز.",
          },
          explanation: {
            en: "Last level, one measurement decided everything and the other one meant nothing. Forget that here. A crab is safe only when it is small AND pale — the size alone tells you nothing, and the colour alone tells you nothing. That is why the tidy choice fails. Teach it one small pale crab and one big dark crab and you have shown the bunny two kinds out of four on this beach. It never saw a small dark crab or a big pale one, so it had to guess about them. From now on, look at the whole beach before you choose, not one row of it.",
            ar: "في المستوى السابق كانت صفة واحدة تحسم كل شيء والأخرى لا تعني شيئًا. انسَ ذلك هنا. السلطعون آمن فقط إذا كان صغيرًا وفاتحًا معًا؛ فلا الحجم وحده يدلّك، ولا اللون وحده يدلّك. لهذا يفشل الاختيار المرتّب: إن علّمته سلطعونًا صغيرًا فاتحًا وآخر كبيرًا غامقًا، فأنت لم تُرِه إلا نوعين من أربعة على هذا الشاطئ. أما الصغير الغامق والكبير الفاتح فلم يرهما قطّ، فاضطرّ إلى التخمين. من الآن فصاعدًا انظر إلى الشاطئ كله قبل أن تختار، لا إلى صفّ واحد منه.",
          },
          teacherNotes: {
            en: "The rule here is conjunctive — a box in feature space, positive only inside both ranges (small AND pale) — so the two classes are not linearly separable and neither feature carries any predictive value on its own. That is a deliberate reversal of berry-sorter and draw-the-line, where the procedure was \"find the decisive feature, hold it, vary the decoy\". Say the reversal out loud in class before or straight after the first failure. Students who apply the old procedure conclude the level is broken rather than that the concept changed, and a child who thinks the software is buggy stops learning.\n\nThe 1-nearest-neighbour model is only ever as good as the coverage of the training set, and this pool spans four quadrants. The attractive failure is the diagonal: one small-pale positive and one big-dark negative. It looks balanced, it satisfies the minimum per label, and it leaves both off-diagonal quadrants unrepresented — so each held-out crab there is classified by whichever diagonal example happens to be nearer, confidently and arbitrarily. The three habits fail distinguishably, which makes diagnosis legible at a glance: \"colour decides\" misses the big pale crab, \"size decides\" misses the small dark crab, and the tidy diagonal misses the small dark one. Ask which crab was missed before asking what the student was thinking; the missed crab names the misconception.\n\nLet a class fail once before intervening — the surprise is the lesson, same as in berry-sorter. Discussion afterwards: the bunny got three of four right. Was it slightly wrong, or was it wrong about an entire kind of crab it had never been shown? This level is the bridge into the next world, where students read the decision boundary as a region of the feature space rather than a cut across a single axis.",
          },
          difficulty: "HARD",
          recommendedGradeMin: 5,
          recommendedGradeMax: 7,
          estimatedMinutes: 10,
          xpReward: 80,
          tags: ["ai", "classification", "features"],
          requires: [],
          hints: [
            {
              tier: 1,
              text: {
                en: "Look at the crabs you did not teach it with. Is there a kind of crab on this beach the bunny has never seen?",
                ar: "انظر إلى السلاطعين التي لم تعلّمه إياها. هل على الشاطئ نوع لم يره الأرنب قطّ؟",
              },
            },
            {
              tier: 2,
              text: {
                en: "Two of the ? crabs are the odd ones: one is small and dark, one is big and pale. Did you teach it anything that looks like either of those?",
                ar: "اثنان من سلاطعين «؟» هما الغريبان: واحد صغير وغامق، وآخر كبير وفاتح. هل علّمته شيئًا يشبه أيًّا منهما؟",
              },
            },
            {
              tier: 3,
              text: {
                en: "Being pale is not enough on its own, and being small is not enough on its own. Teach it a crab that has one of those but not the other, and watch what changes.",
                ar: "أن يكون فاتحًا لا يكفي وحده، وأن يكون صغيرًا لا يكفي وحده. علّمه سلطعونًا فيه إحدى الصفتين دون الأخرى، وانظر ما الذي يتغيّر.",
              },
            },
            {
              tier: 4,
              text: {
                en: "Use four of your slots on four different crabs: small and pale, small and dark, big and pale, big and dark. Then the bunny has seen every kind on the beach.",
                ar: "استخدم أربعة من أمثلتك الستة لأربعة سلاطعين مختلفة: صغير فاتح، وصغير غامق، وكبير فاتح، وكبير غامق. عندها يكون الأرنب قد رأى كل نوع على الشاطئ.",
              },
            },
          ],
          payload: {
            conceptSlug: "feature-interaction",
            labels: {
              positive: {
                en: "Safe to pick up",
                ar: "آمن للحمل",
              },
              negative: {
                en: "Pinches",
                ar: "يقرص",
              },
            },
            theme: {
              glyph: "berry",
              featureNames: {
                size: {
                  en: "Crab size",
                  ar: "حجم السلطعون",
                },
                color: {
                  en: "Shell colour",
                  ar: "لون القشرة",
                },
              },
              truthEmoji: { positive: "🤝", negative: "🤕" },
            },
            walkthrough: [
              {
                title: {
                  en: "A new beach, a new problem",
                  ar: "شاطئ جديد، ومشكلة جديدة",
                },
                body: {
                  en: "Robo Bunny is down on the sand now. These are crabs, not berries. What worked on the berries is not going to work here.",
                  ar: "نزل الأرنب الآلي إلى الرمل. هذه سلاطعين لا توت. وما نفع مع التوت لن ينفع هنا.",
                },
              },
              {
                title: {
                  en: "You still teach by showing",
                  ar: "ما زلت تعلّمه بأن تريه",
                },
                body: {
                  en: "Every crab in the tray has met the bunny before, so we know which ones pinched. Put some in the baskets. That part has not changed.",
                  ar: "كل سلطعون هنا قابله الأرنب من قبل، فنحن نعرف أيّها قرص. ضع بعضها في السلّتين. هذا الجزء لم يتغيّر.",
                },
              },
              {
                title: {
                  en: "It still copies the closest one",
                  ar: "وما زال ينسخ الأقرب",
                },
                body: {
                  en: "For each crab marked ?, the bunny finds the crab you taught it that looks most like it, and copies that answer. Same as before.",
                  ar: "لكل سلطعون عليه علامة ؟، يبحث الأرنب عن أشبه سلطعون علّمته إياه، ثم ينسخ إجابته. كما في المرة السابقة.",
                },
              },
              {
                title: {
                  en: "One thing is different",
                  ar: "لكنّ شيئًا واحدًا اختلف",
                },
                body: {
                  en: "Last time, one measurement decided everything. Not here. Pick two neat opposites and there are whole kinds of crab the bunny never sees.",
                  ar: "في المرة السابقة حسمت صفة واحدة كل شيء. ليس هنا. إن اخترت نقيضين مرتّبين، بقيت أنواع كاملة من السلاطعين لم يرها الأرنب.",
                },
              },
            ],
            board: {
              show: true,
              showBoundary: true,
              axisLabels: {
                x: {
                  en: "Small to big",
                  ar: "من الصغير إلى الكبير",
                },
                y: {
                  en: "Pale to dark",
                  ar: "من الفاتح إلى الغامق",
                },
              },
            },
            pool: [
              { id: "a1", size: 0.2, color: 0.2, truth: "positive" },
              { id: "a2", size: 0.35, color: 0.15, truth: "positive" },
              { id: "a3", size: 0.15, color: 0.4, truth: "positive" },
              { id: "b1", size: 0.2, color: 0.8, truth: "negative" },
              { id: "b2", size: 0.3, color: 0.65, truth: "negative" },
              { id: "c1", size: 0.8, color: 0.2, truth: "negative" },
              { id: "c2", size: 0.7, color: 0.3, truth: "negative" },
              { id: "d1", size: 0.85, color: 0.85, truth: "negative" },
              { id: "d2", size: 0.75, color: 0.7, truth: "negative" },
            ],
            testSet: [
              { id: "t1", size: 0.3, color: 0.3 },
              { id: "t2", size: 0.28, color: 0.72 },
              { id: "t3", size: 0.78, color: 0.28 },
              { id: "t4", size: 0.8, color: 0.78 },
            ],
            rule: { kind: "box", size: [0, 0.5], color: [0, 0.5] },
            minPerLabel: 2,
            maxExamples: 6,
            starCriteria: { threeStarMaxBlocks: 5 },
          } satisfies AiClassificationDraft,
        },
      ],
    },

    {
      slug: "seeing-and-secrets",
      order: 2,
      name: { en: "Seeing and Secrets", ar: "الرؤية والأسرار" },
      description: {
        en: "Machines don't just learn from you — they look at the world, and sometimes they ask about yours. See through a computer's eyes, then decide what an app deserves to know.",
        ar: "الآلات لا تتعلّم منك فحسب — بل تنظر إلى العالم، وأحيانًا تسأل عن عالمك أنت. انظر بعينَي الحاسوب، ثم قرّر ما الذي يستحق تطبيقٌ أن يعرفه.",
      },
      // Phase G graft: concept explorations with no coding prerequisite —
      // unlockRule OPEN opens every level here the instant the world is
      // published and in the student's program (see adventure.ts).
      unlockRule: { type: "OPEN" },
      levels: [
        // ── 1. see-like-a-computer: AI_SIM pixel-playground ───────────
        {
          slug: "see-like-a-computer",
          order: 1,
          activityType: "AI_SIM",
          track: "AI_CONCEPTS",
          title: { en: "See Like a Computer", ar: "انظر كما ينظر الحاسوب" },
          story: {
            en: "The island's old signal tower still uses low-resolution pictures to send messages across the water. Zoom in close enough, and a photo stops looking like a photo at all — just a grid of coloured squares.",
            ar: "لا يزال برج الإشارة القديم في الجزيرة يستخدم صورًا منخفضة الدقة لإرسال الرسائل عبر الماء. اقترب بما يكفي من أي صورة، وستتوقف عن أن تبدو صورة على الإطلاق — بل مجرد شبكة من المربعات الملوّنة.",
          },
          objective: {
            en: "Zoom a picture down to its pixel grid, drag the resolution slider, and identify three mystery images at low resolution — the way a computer's camera actually 'sees'.",
            ar: "قرّب صورة حتى تصل إلى شبكة بكسلاتها، اسحب شريط الدقة، وحدّد ثلاث صور غامضة عند دقة منخفضة — بالطريقة التي «يرى» بها حاسوب الكاميرا فعلًا.",
          },
          instructions: {
            en: "Drag the resolution slider from 64 down to 8 and watch the picture break into fewer, bigger squares. For each mystery round, guess the picture at the LOWEST resolution you can before checking — then see how low a computer could really go.",
            ar: "اسحب شريط الدقة من 64 إلى 8، وشاهد الصورة تتحول إلى مربعات أقل وأكبر. في كل جولة غموض، خمّن الصورة عند أدنى دقة تستطيعها قبل التحقق — ثم اكتشف إلى أي درجة يستطيع الحاسوب النزول فعلًا.",
          },
          explanation: {
            en: "A photo isn't really a 'picture' to a computer at all — it's a grid of numbers, one small set per square, and that's ALL a computer ever starts with. At 64×64 you could still guess easily; at 8×8 you needed real work, because most of the detail was simply gone. This is honestly why computer vision is hard: a computer never sees a rabbit or a rocket, it only ever sees a grid of numbers and has to work out what they probably mean — the exact same guessing game you just played, just done with maths instead of eyes.",
            ar: "الصورة ليست «صورة» بالنسبة للحاسوب على الإطلاق — إنها شبكة من الأرقام، مجموعة صغيرة لكل مربع، وهذا كل ما يبدأ به الحاسوب دائمًا. عند دقة 64×64 كان بإمكانك التخمين بسهولة؛ وعند 8×8 احتجت لجهد حقيقي، لأن معظم التفاصيل اختفت ببساطة. هذا بصدق سبب صعوبة رؤية الحاسوب: فالحاسوب لا يرى أرنبًا أو صاروخًا أبدًا، بل يرى فقط شبكة من الأرقام وعليه أن يستنتج معناها المحتمل — وهي بالضبط نفس لعبة التخمين التي لعبتها للتو، لكن بالرياضيات بدلًا من العينين.",
          },
          teacherNotes: {
            en: "No model/inference station here by design — this level is honestly limited to pixels, resolution and the child's own guessing, which IS the whole lesson at this stage. Encourage students to try guessing BEFORE dragging the slider up, not after — the productive struggle at 8px is the point, not a bug.",
          },
          difficulty: "MEDIUM",
          recommendedGradeMin: 3,
          recommendedGradeMax: 7,
          estimatedMinutes: 14,
          xpReward: 70,
          tags: ["ai", "computer-vision", "pixels"],
          requires: [],
          hints: [
            {
              tier: 1,
              text: {
                en: "Start with the slider all the way up (64) so you know what the real picture looks like, then slide down slowly.",
                ar: "ابدأ بالشريط في أقصى اليمين (64) لتعرف شكل الصورة الحقيقية، ثم اسحبه ببطء نحو الأسفل.",
              },
            },
            {
              tier: 2,
              text: {
                en: "At low resolution, ignore fine detail and look at big blocks of colour and rough shape instead.",
                ar: "عند الدقة المنخفضة، تجاهل التفاصيل الدقيقة وانظر بدلًا من ذلك إلى كتل اللون الكبيرة والشكل العام.",
              },
            },
            {
              tier: 3,
              text: {
                en: "Every mystery image is one of the same five pictures you already zoomed into earlier — think about which outline matches best.",
                ar: "كل صورة غامضة هي واحدة من نفس الصور الخمس التي كبّرتها سابقًا — فكّر في أي مخطط عام يطابقها أكثر.",
              },
            },
            {
              tier: 4,
              text: {
                en: "It's fine to be unsure at 8×8 — that's honest, not a failure. Make your best guess from shape and colour blocks, then compare it to the real picture.",
                ar: "من الطبيعي أن تكون غير متأكد عند دقة 8×8 — هذا صادق وليس فشلًا. خمّن أفضل تخمين من الشكل وكتل اللون، ثم قارنه بالصورة الحقيقية.",
              },
            },
          ],
          payload: {
            widget: {
              widgetId: "pixel-playground",
              images: [
                { id: "rabbit", src: "/ai-lab/rabbit.svg", name: { en: "Rabbit", ar: "أرنب" } },
                { id: "carrot", src: "/ai-lab/carrot.svg", name: { en: "Carrot", ar: "جزرة" } },
                { id: "tree", src: "/ai-lab/tree.svg", name: { en: "Tree", ar: "شجرة" } },
                { id: "rocket", src: "/ai-lab/rocket.svg", name: { en: "Rocket", ar: "صاروخ" } },
                { id: "house", src: "/ai-lab/house.svg", name: { en: "House", ar: "منزل" } },
              ],
              resolutions: [64, 32, 16, 8],
              rounds: [
                { id: "round-1", imageId: "carrot", resolution: 16 },
                { id: "round-2", imageId: "rocket", resolution: 8 },
                { id: "round-3", imageId: "house", resolution: 16 },
              ],
            },
            intro: {
              en: "Zoom in until a photo becomes a grid of squares — then try to recognise it anyway, the way a computer has to.",
              ar: "قرّب حتى تتحول الصورة إلى شبكة من المربعات — ثم حاول التعرّف عليها رغم ذلك، بالطريقة التي يضطر بها الحاسوب.",
            },
            honesty: {
              kind: "REAL",
              note: {
                en: "Real: the pixel grid and every resolution step are genuinely computed from the picture — there is no hidden model guessing for you here.",
                ar: "حقيقي: شبكة البكسلات وكل خطوة دقة تُحسب فعليًا من الصورة — لا يوجد نموذج مخفي يخمّن نيابة عنك هنا.",
              },
            },
          } satisfies AiSimDraft,
        },

        // ── 2. secret-keepers: AI_ETHICS ──────────────────────────────
        {
          slug: "secret-keepers",
          order: 2,
          activityType: "AI_ETHICS",
          track: "AI_CONCEPTS",
          title: { en: "Secret Keepers", ar: "حرّاس الأسرار" },
          story: {
            en: "A shiny new app washes up on AI Island, very friendly and very curious. It has a lot of questions for you before you can even start playing.",
            ar: "تطبيق جديد لامع وصل إلى جزيرة الذكاء الاصطناعي، ودود جدًا وفضولي جدًا. لديه الكثير من الأسئلة قبل أن تتمكن حتى من البدء باللعب.",
          },
          objective: {
            en: "Walk through four moments where an app asks for something personal, choose how to respond, and assemble a Privacy Shield checklist from what you learn.",
            ar: "مرّ بأربع لحظات يطلب فيها التطبيق شيئًا شخصيًا، اختر كيف تستجيب، واجمع قائمة «درع الخصوصية» مما تتعلمه.",
          },
          instructions: {
            en: "Read what the app asks for, then pick how you'd respond. There's no score for feeling — just read what happens next after every choice, even the ones you wouldn't really make.",
            ar: "اقرأ ما يطلبه التطبيق، ثم اختر كيف تستجيب. لا توجد درجة لِما تشعر به — فقط اقرأ ما يحدث بعد كل اختيار، حتى تلك التي لن تختارها فعليًا.",
          },
          explanation: {
            en: "Every 'ask' in this story was for something that feels small on its own — a name, a photo, a location, a friend's number — but adds up to a lot about you once it's all together. The safe habits you saw work every time: you can always say no, a nickname is enough, and asking a grown-up first is never the wrong move. And here's the honest bit — this whole adventure, on every level, we never once asked for your real name either. That's not an accident. It's the same rule.",
            ar: "كل «طلب» في هذه القصة كان لشيء يبدو صغيرًا بمفرده — اسم، صورة، موقع، رقم صديق — لكنه يتجمّع ليكشف الكثير عنك حين يجتمع معًا. العادات الآمنة التي رأيتها تنجح في كل مرة: يمكنك دائمًا أن تقول لا، والاسم المستعار كافٍ، وسؤال شخص بالغ أولًا ليس خطأً أبدًا. وهذا هو الجزء الصادق — طوال هذه المغامرة، في كل مستوى، لم نطلب منك اسمك الحقيقي ولو مرة واحدة. هذا ليس صدفة. إنها نفس القاعدة.",
          },
          teacherNotes: {
            en: "Completion-based grading (there are no wrong feelings) — every finished path earns a PASS; 3 stars only reflects that the 'safe' option was picked at every visited scene, which is a bonus signal for discussion, not a judgement to relay to the child. The closing beat referencing 'we never asked your real name' is literally true across the whole product (students sign in by school-issued username, never by name) — do not let this level's copy drift from that fact if the app's data practices ever change.",
          },
          difficulty: "MEDIUM",
          recommendedGradeMin: 3,
          recommendedGradeMax: 7,
          estimatedMinutes: 12,
          xpReward: 60,
          tags: ["ai", "ethics", "privacy"],
          requires: [],
          hints: [
            {
              tier: 1,
              text: {
                en: "There's no wrong feeling here — pick whichever answer feels most like something you'd really do.",
                ar: "لا توجد إجابة خاطئة هنا من ناحية الشعور — اختر ما يبدو لك الأقرب لما قد تفعله فعلًا.",
              },
            },
            {
              tier: 2,
              text: {
                en: "A safe habit that works almost every time: you are always allowed to say no, or to ask a grown-up first.",
                ar: "عادة آمنة تنجح تقريبًا في كل مرة: يُسمح لك دائمًا أن تقول لا، أو أن تسأل شخصًا بالغًا أولًا.",
              },
            },
            {
              tier: 3,
              text: {
                en: "A nickname, a general area instead of an exact address, and keeping a friend's details to yourself unless they say it's OK — all of these are safe swaps, not refusals.",
                ar: "اسم مستعار، ومنطقة عامة بدلًا من عنوان دقيق، والاحتفاظ بمعلومات صديقك لنفسك ما لم يوافق — كل هذه بدائل آمنة، لا رفض.",
              },
            },
            {
              tier: 4,
              text: {
                en: "Finish the story, then read every takeaway on the Privacy Shield checklist before tapping finish — that checklist IS the point of this level.",
                ar: "أنهِ القصة، ثم اقرأ كل بند في قائمة «درع الخصوصية» قبل الضغط على «إنهاء» — هذه القائمة هي جوهر هذا المستوى.",
              },
            },
          ],
          payload: {
            prompt: {
              en: "A new app has some questions for you. What do you do?",
              ar: "لدى تطبيق جديد بعض الأسئلة لك. ماذا تفعل؟",
            },
            scenes: [
              {
                id: "asks-name",
                text: {
                  en: "The app pops up with a big smile: 'What's your REAL name? I want to be your friend!'",
                  ar: "يظهر التطبيق بابتسامة عريضة: «ما اسمك الحقيقي؟ أريد أن أكون صديقك!»",
                },
                art: "📛",
                choices: [
                  {
                    id: "give-real-name",
                    text: { en: "Type in my real name", ar: "أكتب اسمي الحقيقي" },
                    outcome: {
                      en: "The app says thanks and moves on — but it never actually NEEDED your real name to be fun. Even Bunny never asks for it.",
                      ar: "شكرك التطبيق وتابع — لكنه لم يكن يحتاج اسمك الحقيقي فعلًا ليكون ممتعًا. حتى الأرنب لا يطلبه أبدًا.",
                    },
                    safe: false,
                  },
                  {
                    id: "use-nickname",
                    text: { en: "Type in a nickname instead", ar: "أكتب اسمًا مستعارًا بدلًا منه" },
                    outcome: {
                      en: "Good move! A nickname lets you play and have fun without sharing something personal.",
                      ar: "خيار جيد! الاسم المستعار يتيح لك اللعب والاستمتاع دون مشاركة شيء شخصي.",
                    },
                    safe: true,
                  },
                  {
                    id: "ask-grownup-name",
                    text: { en: "Ask a grown-up first", ar: "أسأل شخصًا بالغًا أولًا" },
                    outcome: {
                      en: "Smart! A trusted grown-up can help you decide what's okay to share, every time you're unsure.",
                      ar: "ذكي! يمكن لشخص بالغ تثق به أن يساعدك في تحديد ما هو مناسب للمشاركة، في كل مرة تشعر فيها بعدم اليقين.",
                    },
                    safe: true,
                  },
                ],
              },
              {
                id: "asks-photo",
                text: {
                  en: "'Send me a selfie so I know what you look like!' the app says next.",
                  ar: "يقول التطبيق بعد ذلك: «أرسل لي صورة سيلفي لأعرف شكلك!»",
                },
                art: "📷",
                choices: [
                  {
                    id: "send-selfie",
                    text: { en: "Send a selfie", ar: "أرسل صورة سيلفي" },
                    outcome: {
                      en: "A photo can quietly show a lot more than a face — your room, your school uniform, even where you are. Worth a second thought next time.",
                      ar: "قد تكشف الصورة أشياء أكثر بكثير من الوجه — غرفتك، زيّك المدرسي، وحتى مكانك. تستحق تفكيرًا إضافيًا في المرة القادمة.",
                    },
                    safe: false,
                  },
                  {
                    id: "say-no-photo",
                    text: { en: "Say 'no thanks'", ar: "أقول «لا شكرًا»" },
                    outcome: {
                      en: "You can always say no — a fun app should still be fun without a photo of you.",
                      ar: "يمكنك دائمًا أن تقول لا — التطبيق الممتع يبقى ممتعًا حتى بدون صورة لك.",
                    },
                    safe: true,
                  },
                  {
                    id: "ask-grownup-photo",
                    text: { en: "Ask a grown-up first", ar: "أسأل شخصًا بالغًا أولًا" },
                    outcome: {
                      en: "Great instinct — photos are worth checking with a trusted grown-up before sending, every single time.",
                      ar: "حدس ممتاز — تستحق الصور مراجعتها مع شخص بالغ تثق به قبل إرسالها، في كل مرة.",
                    },
                    safe: true,
                  },
                ],
              },
              {
                id: "asks-location",
                text: {
                  en: "'Turn on location so I can find you exactly!' the app asks, with a little pulsing pin.",
                  ar: "يطلب التطبيق مع دبوس نابض صغير: «فعّل الموقع لأتمكن من إيجادك بدقة!»",
                },
                art: "📍",
                choices: [
                  {
                    id: "share-exact-location",
                    text: { en: "Turn on exact location", ar: "أفعّل الموقع الدقيق" },
                    outcome: {
                      en: "Now the app knows exactly where you are, right now — that's a lot of trust for a game to ask for.",
                      ar: "الآن يعرف التطبيق مكانك بدقة، في هذه اللحظة — هذا قدر كبير من الثقة يطلبه تطبيق أو لعبة.",
                    },
                    safe: false,
                  },
                  {
                    id: "decline-location",
                    text: { en: "Say no to location", ar: "أرفض مشاركة الموقع" },
                    outcome: {
                      en: "Solid choice — most games and apps work perfectly well without knowing exactly where you are.",
                      ar: "خيار موثوق — معظم الألعاب والتطبيقات تعمل بشكل ممتاز دون معرفة مكانك بدقة.",
                    },
                    safe: true,
                  },
                  {
                    id: "ask-grownup-location",
                    text: { en: "Ask a grown-up first", ar: "أسأل شخصًا بالغًا أولًا" },
                    outcome: {
                      en: "Exactly right — location is one of the things always worth checking with a trusted grown-up first.",
                      ar: "بالضبط — الموقع من الأمور التي تستحق دائمًا مراجعتها مع شخص بالغ تثق به أولًا.",
                    },
                    safe: true,
                  },
                ],
              },
              {
                id: "asks-friend-details",
                text: {
                  en: "'Invite a friend! Just type in their name and phone number and I'll message them for you.'",
                  ar: "«ادعُ صديقًا! فقط اكتب اسمه ورقم هاتفه وسأرسل له رسالة نيابة عنك.»",
                },
                art: "👫",
                choices: [
                  {
                    id: "give-friend-details",
                    text: { en: "Type in my friend's details", ar: "أكتب بيانات صديقي" },
                    outcome: {
                      en: "That information belongs to your friend, not just to you — it's always kinder to check with them first.",
                      ar: "تلك المعلومات ملك لصديقك، لا لك وحدك — من الألطف دائمًا أن تسأله أولًا.",
                    },
                    safe: false,
                  },
                  {
                    id: "ask-friend-first",
                    text: { en: "Ask my friend first, or skip it", ar: "أسأل صديقي أولًا، أو أتجاوز الأمر" },
                    outcome: {
                      en: "Perfect — your friend's name and number are theirs to share, not yours to give away.",
                      ar: "ممتاز — اسم صديقك ورقمه ملك له ليشاركه، لا لك لتعطيه.",
                    },
                    safe: true,
                  },
                ],
              },
            ],
            takeaways: [
              {
                en: "I don't have to share my real name.",
                ar: "لا يتوجب عليّ مشاركة اسمي الحقيقي.",
              },
              {
                en: "I can always say no.",
                ar: "يمكنني دائمًا أن أقول لا.",
              },
              {
                en: "I ask a grown-up before sharing photos or my location.",
                ar: "أسأل شخصًا بالغًا قبل مشاركة الصور أو موقعي.",
              },
              {
                en: "My friends' information belongs to them — I ask first.",
                ar: "معلومات أصدقائي ملك لهم — أسألهم أولًا.",
              },
              {
                en: "Apps and games can be fun without knowing exactly who I am.",
                ar: "يمكن للتطبيقات والألعاب أن تكون ممتعة دون أن تعرف من أنا بالضبط.",
              },
            ],
          } satisfies AiEthicsDraft,
        },
      ],
    },
  ],
};
