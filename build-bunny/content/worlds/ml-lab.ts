import type { z } from "zod";
import type {
  WorldFixture,
  aiClassificationPayload,
  patternRecognitionPayload,
} from "@/modules/curriculum/schemas";

/**
 * World 6 — Machine Learning Lab. "Train a real model with your own hands."
 *
 * The last playable world, and the one that hands the child the three
 * controls a practitioner actually owns: the test set (keep-some-back), the
 * standard for a mistake (which-mistake-is-worse), and the training loop
 * itself (let-it-run). Nothing here repeats "pick representative examples"
 * — each level changes what COUNTS as doing well, which is the step up from
 * using a machine to being responsible for one.
 *
 * All geometry verified numerically before authoring; the traps are pinned
 * in tests/unit/ai-levels.test.ts and tests/unit/pattern-recognition.test.ts.
 */

type PrDraft = z.input<typeof patternRecognitionPayload>;
type AiDraft = z.input<typeof aiClassificationPayload>;

const POWER_CELL_THEME = {
  glyph: "cell" as const,
  featureNames: {
    size: { en: "Cell size", ar: "حجم الخلية" },
    color: { en: "How hot it runs", ar: "كم تسخن أثناء العمل" },
  },
  truthEmoji: { positive: "🔋", negative: "🔥" },
};

export const mlLab: WorldFixture = {
  slug: "ml-lab",
  name: { en: "Machine Learning Lab", ar: "مختبر تعلّم الآلة" },
  tagline: {
    en: "Train a real model with your own hands.",
    ar: "درّب نموذجًا حقيقيًا بيديك.",
  },
  theme: "ml",
  horizon: false,
  modules: [
    {
      slug: "at-the-controls",
      order: 1,
      name: { en: "At the Controls", ar: "خلف لوحة التحكم" },
      description: {
        en: "You can teach a machine and you can spot a pattern. Now take the controls a real engineer holds: the test, the rules for mistakes, and the training loop itself.",
        ar: "صرت تجيد تعليم الآلة واكتشاف النمط. أمسك الآن بأدوات المهندس الحقيقي: الاختبار، وقواعد الأخطاء، وحلقة التدريب نفسها.",
      },
      levels: [
        // ── 1. keep-some-back ────────────────────────────────────────
        {
          slug: "keep-some-back",
          order: 1,
          activityType: "AI_CLASSIFICATION",
          track: "MACHINE_LEARNING",
          title: { en: "Keep Some Back", ar: "احتفظ ببعضها" },
          story: {
            en: "The lab robots run on power cells, and some cells overheat. You will train a checker — but this time YOU also build the exam. Set cells aside for testing, and remember: a test you rigged to be easy proves nothing at all.",
            ar: "روبوتات المختبر تعمل بخلايا طاقة، وبعض الخلايا تسخن أكثر من اللازم. ستدرّب فاحصًا — لكنك هذه المرة ستبني الامتحان أيضًا. ضع خلايا جانبًا للاختبار، وتذكّر: الامتحان الذي رتّبته ليكون سهلًا لا يثبت شيئًا.",
          },
          objective: {
            en: "Split data into training and testing yourself, and discover that a perfect score on your own test can still hide a broken model.",
            ar: "قسّم البيانات بنفسك إلى تدريب واختبار، واكتشف أن العلامة الكاملة في اختبارك أنت قد تخفي نموذجًا معطوبًا.",
          },
          instructions: {
            en: "Three piles now: Good, Overheats, and Keep for testing. Hold at least 3 cells back — the model never learns from those. Watch your own score, then press the button to face the lab's hidden exam.",
            ar: "ثلاث أكوام الآن: سليمة، وتسخن، واحتفظ بها للاختبار. احجز 3 خلايا على الأقل — لن يتعلم النموذج منها أبدًا. راقب علامتك، ثم اضغط الزر لتواجه امتحان المختبر الخفي.",
          },
          explanation: {
            en: "If you held back only the easy cells, your own scoreboard said perfect — and the lab's exam still failed you, because your model had never faced a hard case and your test never asked it to. A score only means something when the test is honest and the model has not seen it. And every cell you reserve is one you cannot learn from: the big cool cell is worth more in training than in the exam. Splitting data well is a real engineering decision, and now it is yours.",
            ar: "إذا لم تحجز إلا الخلايا السهلة، قالت لوحتك إن العلامة كاملة — ثم أسقطك امتحان المختبر، لأن نموذجك لم يواجه حالة صعبة قط ولم يسأله اختبارك عنها. العلامة لا تعني شيئًا إلا حين يكون الاختبار نزيهًا ولم يرَه النموذج. وكل خلية تحجزها خلية لا تتعلم منها: الخلية الكبيرة الباردة أنفع في التدريب منها في الامتحان. تقسيم البيانات قرار هندسي حقيقي، وهو الآن قرارك.",
          },
          teacherNotes: {
            en: "The one level whose signature failure is passing your own test and losing anyway — let it happen before explaining it. The pinned trap: holding back the three obvious extremes {k1,k2,k10} self-scores 3/3 and fails the hidden set (k2 is the ONLY large cool cell; reserved, the model calls big cells hot). The diagnostic split {k2,k4,k8} self-scores 1/3 and the self-misses tell the student exactly what the model does not know. Vocabulary: train/test split, overfitting to your own test. Ask: why do real exams keep questions secret?",
          },
          difficulty: "MEDIUM",
          recommendedGradeMin: 5,
          recommendedGradeMax: 7,
          estimatedMinutes: 12,
          xpReward: 70,
          tags: ["ml", "train-test-split", "evaluation"],
          requires: [],
          hints: [
            {
              tier: 1,
              text: {
                en: "Pick your test pile the way a fair teacher picks exam questions — not the three easiest cells in the box.",
                ar: "اختر كومة اختبارك كما يختار المعلم العادل أسئلة الامتحان — لا أسهل ثلاث خلايا في الصندوق.",
              },
            },
            {
              tier: 2,
              text: {
                en: "Your own scoreboard can lie to you. 3 of 3 on an easy test tells you less than 2 of 3 on a hard one.",
                ar: "لوحتك الخاصة قد تكذب عليك. ثلاث من ثلاث في اختبار سهل تخبرك أقل من اثنتين من ثلاث في اختبار صعب.",
              },
            },
            {
              tier: 3,
              text: {
                en: "Look at what you reserved. Is there any KIND of cell your model has now never seen in training? That is where the hidden exam will strike.",
                ar: "انظر إلى ما حجزته. هل هناك نوع من الخلايا لم يعد نموذجك يراه في التدريب أبدًا؟ هناك سيضرب الامتحان الخفي.",
              },
            },
            {
              tier: 4,
              text: {
                en: "Keep the borderline cells for testing — the ones near the middle — and let the one big cool cell TEACH. It is the only one of its kind.",
                ar: "احتفظ بالخلايا الحدّية للاختبار — القريبة من الوسط — ودع الخلية الكبيرة الباردة تعلّم. فهي الوحيدة من نوعها.",
              },
            },
          ],
          payload: {
            conceptSlug: "train-test-split",
            labels: {
              positive: { en: "Good cell", ar: "خلية سليمة" },
              negative: { en: "Overheats", ar: "تسخن" },
            },
            theme: POWER_CELL_THEME,
            walkthrough: [
              {
                title: { en: "You build the exam now", ar: "أنت من يبني الامتحان الآن" },
                body: {
                  en: "Until today, someone else always tested your model. This time you set cells aside yourself — and the model never learns from what you set aside.",
                  ar: "حتى اليوم، كان غيرك يمتحن نموذجك دائمًا. هذه المرة أنت من يضع الخلايا جانبًا — والنموذج لا يتعلم أبدًا مما وضعتَه جانبًا.",
                },
              },
              {
                title: { en: "Why keep any back at all?", ar: "لماذا نحجز شيئًا أصلًا؟" },
                body: {
                  en: "A model always looks clever on the cells it memorised. The only honest question is one it has never seen. Held-back cells are that question.",
                  ar: "النموذج يبدو ذكيًا دائمًا مع الخلايا التي حفظها. السؤال النزيه الوحيد هو سؤال لم يره قط. والخلايا المحجوزة هي ذلك السؤال.",
                },
              },
              {
                title: { en: "An easy test proves nothing", ar: "الاختبار السهل لا يثبت شيئًا" },
                body: {
                  en: "Hold back three obvious cells and your scoreboard will glow — and the lab's hidden exam will still catch what your model cannot do.",
                  ar: "احجز ثلاث خلايا واضحة وستتوهج لوحتك — وسيظل امتحان المختبر الخفي يكشف ما يعجز عنه نموذجك.",
                },
              },
              {
                title: { en: "Reserving has a price", ar: "للحجز ثمن" },
                body: {
                  en: "Every cell in your test pile is one the model cannot learn from. If a cell is the only one of its kind, think hard before locking it away.",
                  ar: "كل خلية في كومة اختبارك خلية لا يستطيع النموذج التعلم منها. فإن كانت خلية وحيدة من نوعها، ففكّر مليًّا قبل أن تحبسها.",
                },
              },
            ],
            board: {
              show: true,
              showBoundary: true,
              axisLabels: {
                x: { en: "Cell size, small to large", ar: "حجم الخلية، من الصغير إلى الكبير" },
                y: { en: "Running heat, cool to hot", ar: "حرارة التشغيل، من البارد إلى الساخن" },
              },
            },
            pool: [
              { id: "k1", size: 0.15, color: 0.1, truth: "positive" },
              // The ONLY large-and-cool cell: worth more teaching than testing.
              { id: "k2", size: 0.85, color: 0.14, truth: "positive" },
              { id: "k3", size: 0.35, color: 0.28, truth: "positive" },
              { id: "k4", size: 0.5, color: 0.44, truth: "positive" },
              { id: "k5", size: 0.25, color: 0.46, truth: "positive" },
              { id: "k6", size: 0.2, color: 0.88, truth: "negative" },
              { id: "k7", size: 0.88, color: 0.82, truth: "negative" },
              { id: "k8", size: 0.4, color: 0.62, truth: "negative" },
              { id: "k9", size: 0.7, color: 0.58, truth: "negative" },
              { id: "k10", size: 0.55, color: 0.95, truth: "negative" },
            ],
            // The lab's hidden exam. Pinned: reserving {k1,k2,k10} self-scores
            // 3/3 and misses h4 here; reserving the borderline {k4,k5,k8}
            // scores 4/4. Verified in tests/unit/ai-levels.test.ts.
            testSet: [
              { id: "h1", size: 0.3, color: 0.46 },
              { id: "h2", size: 0.75, color: 0.54 },
              { id: "h3", size: 0.15, color: 0.68 },
              { id: "h4", size: 0.82, color: 0.34 },
            ],
            rule: { kind: "threshold", feature: "color", threshold: 0.5 },
            holdout: { min: 3 },
            minPerLabel: 2,
            starCriteria: {},
          } satisfies AiDraft,
        },

        // ── 2. which-mistake-is-worse ────────────────────────────────
        {
          slug: "which-mistake-is-worse",
          order: 2,
          activityType: "AI_CLASSIFICATION",
          track: "MACHINE_LEARNING",
          title: { en: "Some Mistakes Cost More", ar: "بعض الأخطاء أغلى ثمنًا" },
          story: {
            en: "A checker robot that calls every cell good scores 7 out of 10 — and burns down the lab, because the three it got wrong were the overheating ones. Today accuracy is not the goal. Safety is.",
            ar: "روبوت فاحص يصف كل خلية بأنها سليمة يسجّل 7 من 10 — ويحرق المختبر، لأن الثلاث التي أخطأ فيها كانت هي التي تسخن. اليوم ليست الدقة هي الهدف. السلامة هي الهدف.",
          },
          objective: {
            en: "Discover that when one mistake is dangerous and the other is merely wasteful, the most accurate model can be the wrong model.",
            ar: "اكتشف أنه حين يكون أحد الأخطاء خطيرًا والآخر مجرد هدر، قد يكون النموذج الأدق هو النموذج الخطأ.",
          },
          instructions: {
            en: "The lab's rule: NEVER call an overheating cell good. Up to 2 false alarms the other way are allowed. Lean your teaching toward caution and watch the two tallies — not the total score.",
            ar: "قاعدة المختبر: لا تصف خلية تسخن بأنها سليمة أبدًا. ويُسمح بإنذارين كاذبين على الأكثر في الاتجاه الآخر. مِل بتعليمك نحو الحذر وراقب العدّادين — لا المجموع الكلي.",
          },
          explanation: {
            en: "The balanced training set was RIGHT more often — 9 of 10 — and it failed, because its one mistake was the kind that burns down a lab. The cautious set was right only 8 of 10 and passed: zero dangerous misses, two acceptable false alarms. You made the machine slightly more wrong on purpose, in the direction that is merely wasteful. Real engineers do exactly this — for smoke alarms, for medical tests, for brakes — because accuracy is the wrong question when mistakes have different prices.",
            ar: "مجموعة التدريب المتوازنة أصابت أكثر — 9 من 10 — ورسبت، لأن خطأها الوحيد كان من النوع الذي يحرق مختبرًا. والمجموعة الحذرة أصابت 8 من 10 فقط ونجحت: صفر إخفاقات خطيرة وإنذاران كاذبان مقبولان. لقد جعلت الآلة أكثر خطأً قليلًا عن قصد، في الاتجاه الذي لا يكلف سوى الهدر. وهذا بالضبط ما يفعله المهندسون الحقيقيون — في كواشف الدخان والفحوص الطبية والمكابح — لأن الدقة سؤال خاطئ حين تختلف أثمان الأخطاء.",
          },
          teacherNotes: {
            en: "The first level where the OBJECTIVE changes rather than the controls, and the only genuinely ethical judgement in the curriculum reached by counting rather than lecture. The pinned arithmetic: the sensible balanced set {p1,p3,p5,p6|n1,n2,n3,n4} scores 9/10 and FAILS (one dangerous miss); the cautious set {p1,p2,p3,p4|n1,n2,n3,n5} scores 8/10 and PASSES. Open by acting out the call-everything-good robot (7/10, lab on fire). Discussion gold afterwards: name three real systems where the two mistake directions cost differently, and one where a false alarm is actually the expensive direction.",
          },
          difficulty: "HARD",
          recommendedGradeMin: 5,
          recommendedGradeMax: 7,
          estimatedMinutes: 12,
          xpReward: 80,
          tags: ["ml", "cost-sensitivity", "ethics"],
          requires: ["keep-some-back"],
          hints: [
            {
              tier: 1,
              text: {
                en: "Read the two tallies, not the total. One kind of mistake must be ZERO. The other kind has an allowance.",
                ar: "اقرأ العدّادين لا المجموع. نوع من الأخطاء يجب أن يكون صفرًا. وللنوع الآخر رصيد مسموح.",
              },
            },
            {
              tier: 2,
              text: {
                en: "Where do dangerous mistakes happen? Near the line, where a hot cell looks almost like a good one.",
                ar: "أين تقع الأخطاء الخطيرة؟ قرب الخط، حيث تكاد الخلية الساخنة تشبه السليمة.",
              },
            },
            {
              tier: 3,
              text: {
                en: "Teach it MORE overheating cells near the line, and leave out the good cells that sit close to it. The cautious region will grow across the boundary.",
                ar: "علّمه مزيدًا من الخلايا الساخنة قرب الخط، واترك الخلايا السليمة القريبة منه خارجًا. ستتمدد منطقة الحذر عبر الحدود.",
              },
            },
            {
              tier: 4,
              text: {
                en: "Keep the near-line negatives and drop the two near-line positives. The score will DROP to 8 of 10 — and that is the passing answer.",
                ar: "أبقِ الخلايا الساخنة القريبة من الخط واستبعد السليمتين القريبتين منه. ستهبط العلامة إلى 8 من 10 — وذلك هو الجواب الناجح.",
              },
            },
          ],
          payload: {
            conceptSlug: "cost-of-mistakes",
            labels: {
              positive: { en: "Good cell", ar: "خلية سليمة" },
              negative: { en: "Overheats", ar: "تسخن" },
            },
            theme: POWER_CELL_THEME,
            walkthrough: [
              {
                title: { en: "7 out of 10, lab on fire", ar: "سبعة من عشرة والمختبر يحترق" },
                body: {
                  en: "A robot that calls EVERY cell good gets 7 of 10 on today's batch — and the three it misses are the ones that burn. A high score is not the same thing as a safe robot.",
                  ar: "روبوت يصف كل خلية بأنها سليمة يصيب 7 من 10 في دفعة اليوم — والثلاث التي يخطئها هي التي تحترق. العلامة العالية ليست روبوتًا آمنًا.",
                },
              },
              {
                title: { en: "Two mistakes, two prices", ar: "خطآن وثمنان" },
                body: {
                  en: "Calling a hot cell good burns the lab. Calling a good cell hot only wastes a cell. Same size on a scoreboard — nowhere near the same size in life.",
                  ar: "وصف خلية ساخنة بأنها سليمة يحرق المختبر. ووصف سليمة بأنها ساخنة لا يهدر إلا خلية. متساويان على اللوحة — ولا يتساويان في الحياة أبدًا.",
                },
              },
              {
                title: { en: "The new rule", ar: "القاعدة الجديدة" },
                body: {
                  en: "Dangerous misses: must be zero. False alarms: up to two allowed. Your controls have not changed — what counts as WINNING has.",
                  ar: "الإخفاقات الخطيرة: يجب أن تكون صفرًا. الإنذارات الكاذبة: يُسمح باثنين. لم تتغير أدواتك — بل تغيّر معنى الفوز.",
                },
              },
              {
                title: { en: "Lean it toward caution", ar: "مِله نحو الحذر" },
                body: {
                  en: "Teach it the borderline hot cells and withhold the borderline good ones. It will be right less often — on purpose — and that is the winning model.",
                  ar: "علّمه الخلايا الساخنة الحدّية واحجب عنه السليمة الحدّية. سيصيب أقل — عن قصد — وذلك هو النموذج الفائز.",
                },
              },
            ],
            board: {
              show: true,
              showBoundary: true,
              axisLabels: {
                x: { en: "Cell size, small to large", ar: "حجم الخلية، من الصغير إلى الكبير" },
                y: { en: "Running heat, cool to hot", ar: "حرارة التشغيل، من البارد إلى الساخن" },
              },
            },
            pool: [
              { id: "p1", size: 0.2, color: 0.08, truth: "positive" },
              { id: "p2", size: 0.75, color: 0.12, truth: "positive" },
              { id: "p3", size: 0.4, color: 0.26, truth: "positive" },
              { id: "p4", size: 0.85, color: 0.3, truth: "positive" },
              { id: "p5", size: 0.3, color: 0.44, truth: "positive" },
              { id: "p6", size: 0.65, color: 0.47, truth: "positive" },
              { id: "n1", size: 0.25, color: 0.53, truth: "negative" },
              { id: "n2", size: 0.7, color: 0.55, truth: "negative" },
              { id: "n3", size: 0.45, color: 0.7, truth: "negative" },
              { id: "n4", size: 0.8, color: 0.75, truth: "negative" },
              { id: "n5", size: 0.15, color: 0.88, truth: "negative" },
              { id: "n6", size: 0.6, color: 0.92, truth: "negative" },
            ],
            // Deliberately imbalanced 7 good / 3 overheating, the dangerous
            // three near the line. Pinned: the balanced-accurate set scores
            // 9/10 and FAILS; the cautious set scores 8/10 and PASSES.
            testSet: [
              { id: "q1", size: 0.35, color: 0.52 },
              { id: "q2", size: 0.72, color: 0.56 },
              { id: "q3", size: 0.5, color: 0.84 },
              { id: "q4", size: 0.18, color: 0.1 },
              { id: "q5", size: 0.8, color: 0.16 },
              { id: "q6", size: 0.45, color: 0.3 },
              { id: "q7", size: 0.28, color: 0.4 },
              { id: "q8", size: 0.62, color: 0.42 },
              { id: "q9", size: 0.88, color: 0.34 },
              { id: "q10", size: 0.1, color: 0.24 },
            ],
            rule: { kind: "threshold", feature: "color", threshold: 0.5 },
            passRule: { kind: "safetyFirst", neverMisclassify: "negative", maxOtherErrors: 2 },
            minPerLabel: 2,
            maxExamples: 8,
            starCriteria: {},
          } satisfies AiDraft,
        },

        // ── 3. let-it-run ────────────────────────────────────────────
        {
          slug: "let-it-run",
          order: 3,
          activityType: "PATTERN_RECOGNITION",
          track: "MACHINE_LEARNING",
          title: { en: "Let It Run", ar: "دعها تعمل" },
          story: {
            en: "The grouping machine from the desert is back, upgraded. You no longer place the answer — you place the STARTING point, press Run, and the machine improves its own flags step by step until nothing moves. Where you start it decides where it ends up.",
            ar: "عادت آلة التجميع من الصحراء وقد طُوّرت. لم تعد تضع الإجابة — بل تضع نقطة البداية، وتضغط «شغّل»، فتحسّن الآلة أعلامها خطوة بعد خطوة حتى لا يتحرك شيء. ومكان انطلاقك هو ما يقرر أين تنتهي.",
          },
          objective: {
            en: "Run a real training loop, and discover that a machine which improves at every single step can still finish in the wrong place.",
            ar: "شغّل حلقة تدريب حقيقية، واكتشف أن آلة تتحسن في كل خطوة قد تنتهي في المكان الخطأ مع ذلك.",
          },
          instructions: {
            en: "Place three starting flags, then press Run and watch: every dot joins its nearest flag, every flag walks to the middle of its dots, again and again until it stops. The score that counts is where it STOPS — a sloppy start can win, and a tidy-looking one can lose.",
            ar: "ضع ثلاثة أعلام للبداية ثم اضغط «شغّل» وراقب: كل نقطة تنضم إلى أقرب علم، وكل علم يمشي إلى منتصف نقاطه، مرارًا حتى يتوقف. النتيجة المحسوبة هي حيث يتوقف — البداية المرتبكة قد تفوز، والبداية الأنيقة الشكل قد تخسر.",
          },
          explanation: {
            en: "You watched the machine train: one simple step, repeated — join, move, join, move — and the meter climbed every time. That is a real training loop, and it is how big AI systems learn too. But you also saw its weakness: seeded with two flags inside one crowd, it climbed steadily into a dead end and STOPPED there, better every step and still wrong at the finish. Where you start decides where you end. That is why real engineers train from many starting points and keep the best — the machine cannot tell a good stop from a bad one.",
            ar: "لقد شاهدت الآلة تتدرب: خطوة واحدة بسيطة تتكرر — انضمام فمسير، انضمام فمسير — والعداد يصعد في كل مرة. هذه حلقة تدريب حقيقية، وهكذا تتعلم أنظمة الذكاء الاصطناعي الكبيرة أيضًا. لكنك رأيت ضعفها أيضًا: حين بُذرت بعلمين داخل حشد واحد، صعدت بثبات إلى طريق مسدود وتوقفت هناك — أفضل في كل خطوة وخاطئة عند النهاية. مكان البداية يقرر مكان النهاية. لهذا يدرّب المهندسون من نقاط بداية عديدة ويحتفظون بالأفضل — فالآلة لا تفرّق بين توقف جيد وتوقف سيئ.",
          },
          teacherNotes: {
            en: "The only training loop in the product, and the submission is a SEED, not an answer — say that out loud, twice. The pinned kicker to demonstrate on the projector: seed (0.05,0.05)/(0.60,0.62)/(0.95,0.35) reads 46% BEFORE running and finishes at 95%; seed (0.18,0.24)/(0.26,0.32)/(0.75,0.60) reads 88% before and finishes at 89% — FAIL. The worse-looking start wins. The bad seed's fixed point (big clump split, two far clumps merged) is genuinely stable: every step improved it. Vocabulary for older students: local optimum, initialisation. This is Lloyd's algorithm — the real one.",
          },
          difficulty: "HARD",
          recommendedGradeMin: 5,
          recommendedGradeMax: 7,
          estimatedMinutes: 12,
          xpReward: 80,
          tags: ["ml", "training-loop", "kmeans", "local-optima"],
          requires: ["which-mistake-is-worse"],
          hints: [
            {
              tier: 1,
              text: {
                en: "Your flags are only the STARTING point. Do not polish them — press Run and watch where they walk.",
                ar: "أعلامك ليست إلا نقطة البداية. لا تصقلها — اضغط «شغّل» وراقب إلى أين تمشي.",
              },
            },
            {
              tier: 2,
              text: {
                en: "The machine repeats one step: every dot joins its nearest flag, every flag moves to the middle of its dots. Say it out loud while it runs.",
                ar: "الآلة تكرر خطوة واحدة: كل نقطة تنضم إلى أقرب علم، وكل علم ينتقل إلى منتصف نقاطه. قلها بصوت مسموع وهي تعمل.",
              },
            },
            {
              tier: 3,
              text: {
                en: "If two of your flags start inside the SAME crowd, they will share it forever — and two other crowds will be forced to merge. The machine cannot escape; it only ever improves.",
                ar: "إذا بدأ علمان من أعلامك داخل الحشد نفسه فسيتقاسمانه إلى الأبد — وسيُجبَر حشدان آخران على الاندماج. لا تستطيع الآلة الهرب؛ فهي لا تعرف إلا التحسن.",
              },
            },
            {
              tier: 4,
              text: {
                en: "One flag ROUGHLY near each crowd is enough — even a very sloppy one. The machine does the polishing; you only choose the neighbourhood.",
                ar: "علم واحد قرب كل حشد تقريبًا يكفي — ولو كان مرتبكًا جدًا. الآلة تتولى الصقل؛ وأنت لا تختار إلا الحيّ.",
              },
            },
          ],
          payload: {
            conceptSlug: "training-loop",
            theme: POWER_CELL_THEME,
            walkthrough: [
              {
                title: { en: "You place the start, not the answer", ar: "أنت تضع البداية لا الإجابة" },
                body: {
                  en: "Plant three flags anywhere. They are a seed, not a solution — the machine will move them itself.",
                  ar: "اغرس ثلاثة أعلام في أي مكان. إنها بذرة لا حلًّا — فالآلة ستحركها بنفسها.",
                },
              },
              {
                title: { en: "One step, repeated", ar: "خطوة واحدة تتكرر" },
                body: {
                  en: "Press Run: every dot joins its nearest flag, then every flag walks to the middle of its dots. Again and again, until nothing moves.",
                  ar: "اضغط «شغّل»: كل نقطة تنضم إلى أقرب علم، ثم يمشي كل علم إلى منتصف نقاطه. مرة بعد مرة حتى لا يتحرك شيء.",
                },
              },
              {
                title: { en: "Better every step", ar: "أفضل مع كل خطوة" },
                body: {
                  en: "Watch the meter while it runs — it only ever climbs. The machine cannot make itself worse. That sounds perfect. It is not.",
                  ar: "راقب العداد أثناء العمل — إنه لا يعرف إلا الصعود. الآلة لا تستطيع أن تسوء. يبدو هذا مثاليًا. لكنه ليس كذلك.",
                },
              },
              {
                title: { en: "It can stop in the wrong place", ar: "قد تتوقف في المكان الخطأ" },
                body: {
                  en: "Start two flags inside one crowd and the machine will climb into a dead end and stop there, satisfied. Where you start decides where it ends.",
                  ar: "ابدأ بعلمين داخل حشد واحد وستصعد الآلة إلى طريق مسدود وتتوقف فيه راضية. مكان بدايتك يقرر مكان نهايتها.",
                },
              },
            ],
            specimens: [
              { id: "c1", size: 0.3, color: 0.34 },
              { id: "c2", size: 0.14, color: 0.22 },
              { id: "c3", size: 0.28, color: 0.2 },
              { id: "c4", size: 0.16, color: 0.36 },
              { id: "c5", size: 0.26, color: 0.3 },
              { id: "c6", size: 0.18, color: 0.26 },
              { id: "c7", size: 0.24, color: 0.24 },
              { id: "c8", size: 0.2, color: 0.32 },
              { id: "c9", size: 0.77, color: 0.74 },
              { id: "c10", size: 0.67, color: 0.66 },
              { id: "c11", size: 0.76, color: 0.65 },
              { id: "c12", size: 0.68, color: 0.75 },
              { id: "c13", size: 0.85, color: 0.49 },
              { id: "c14", size: 0.75, color: 0.41 },
              { id: "c15", size: 0.84, color: 0.4 },
              { id: "c16", size: 0.76, color: 0.5 },
            ],
            markers: { min: 3, max: 3 },
            maxExclusions: 0,
            // Pinned in tests/unit/pattern-recognition.test.ts: a one-per-
            // clump seed converges to 0.9534 (PASS); a two-flags-in-the-big-
            // clump seed converges to a stable 0.8859 (FAIL); the sloppy seed
            // reads 0.4635 before training and 0.9534 after.
            objective: { minTightness: 0.92 },
            training: { kind: "lloyd", iterations: 8 },
            groundTruth: {
              referencePlacement: [
                { size: 0.22, color: 0.28 },
                { size: 0.72, color: 0.7 },
                { size: 0.8, color: 0.45 },
              ],
            },
            starCriteria: {},
          } satisfies PrDraft,
        },
      ],
    },
  ],
};
