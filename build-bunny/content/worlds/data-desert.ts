import type { z } from "zod";
import type {
  WorldFixture,
  aiClassificationPayload,
  aiSimPayload,
  patternRecognitionPayload,
} from "@/modules/curriculum/schemas";

/**
 * World 5 — Data Desert. "Patterns hide in the dunes. Learn to spot them."
 *
 * AI Island taught teaching: you choose examples, the machine finds the
 * rule. This world removes the labels entirely. Three of its four levels
 * run on PATTERN_RECOGNITION, where the data carries no answers anywhere —
 * not on screen, not in the payload, not on the server — and the child's
 * job is to SEE the structure: how many kinds, which reading is a lie, and
 * finally (back on the classifier) whether the pattern they found is the
 * one that matters.
 *
 * Every geometry below was verified numerically before authoring: the
 * reference answers pass, the documented traps fail, and the margins are
 * wide enough that no child ever loses to a float. The numbers are pinned
 * in tests/unit/pattern-recognition.test.ts and tests/unit/ai-levels.test.ts.
 */

type PrDraft = z.input<typeof patternRecognitionPayload>;
type AiDraft = z.input<typeof aiClassificationPayload>;
type AiSimDraft = z.input<typeof aiSimPayload>;

const NIGHT_CAMERA_THEME = {
  glyph: "blip" as const,
  featureNames: {
    size: { en: "How big it was", ar: "كم كان حجمه" },
    color: { en: "How warm it was", ar: "كم كانت حرارته" },
  },
  // Unused by the grouping player (nothing has a truth), kept for schema
  // symmetry with the classification theme.
  truthEmoji: { positive: "🐾", negative: "🚫" },
};

export const dataDesert: WorldFixture = {
  slug: "data-desert",
  name: { en: "Data Desert", ar: "صحراء البيانات" },
  tagline: {
    en: "Patterns hide in the dunes. Learn to spot them.",
    ar: "الأنماط تختبئ بين الكثبان — تعلّم كيف تكتشفها.",
  },
  theme: "desert",
  horizon: false,
  modules: [
    {
      slug: "reading-the-dunes",
      order: 1,
      name: { en: "Reading the Dunes", ar: "قراءة الكثبان" },
      description: {
        en: "On the island you taught the machine with answers you already had. Out here nobody has answers — the machine can still find the groups, and you are about to see how.",
        ar: "في الجزيرة علّمت الآلة بإجابات كانت بين يديك. أما هنا فلا إجابات عند أحد — ومع ذلك تستطيع الآلة إيجاد المجموعات، وستكتشف الآن كيف.",
      },
      levels: [
        // ── 1. two-piles ──────────────────────────────────────────────
        {
          slug: "two-piles",
          order: 1,
          activityType: "PATTERN_RECOGNITION",
          track: "AI_CONCEPTS",
          title: { en: "Two Piles in the Sand", ar: "كومتان في الرمل" },
          story: {
            en: "A night camera watched the waterhole and recorded twelve creatures — how big each one was, and how warm. Nobody wrote down what they were. There were no labels to write.",
            ar: "راقبت كاميرا ليلية مورد الماء وسجّلت اثني عشر مخلوقًا — حجم كل منها وحرارته. لم يدوّن أحد ما هي، فلا توجد أسماء تُدوَّن.",
          },
          objective: {
            en: "Discover that a machine can find groups in data with no labels at all — a group simply means the readings nearest one flag.",
            ar: "اكتشف أن الآلة تستطيع إيجاد مجموعات في بيانات بلا أسماء إطلاقًا — فالمجموعة ببساطة هي القراءات الأقرب إلى علم واحد.",
          },
          instructions: {
            en: "Plant two flags on the board. Every reading joins its nearest flag. Make your piles tight enough and you will find out what visited the waterhole.",
            ar: "اغرس علمين على اللوحة. كل قراءة تنضم إلى أقرب علم إليها. اجعل كومتيك متراصّتين بما يكفي وستعرف ما الذي زار مورد الماء.",
          },
          explanation: {
            en: "Nobody told the machine what a jerboa or a fennec fox is — and nobody told you either. The groups were already there, in the readings themselves, and the flags only marked them. That is a second kind of machine learning: finding structure with no answers, and it is how scientists first sort data nobody has named yet.",
            ar: "لم يخبر أحدٌ الآلة ما اليربوع وما ثعلب الفنك — ولم يخبرك أحد أنت أيضًا. كانت المجموعتان موجودتين أصلًا في القراءات نفسها، ولم تفعل الأعلام سوى الإشارة إليهما. هذا نوع ثانٍ من تعلّم الآلة: إيجاد البنية بلا إجابات، وهكذا يفرز العلماء بيانات لم يسمِّها أحد بعد.",
          },
          teacherNotes: {
            en: "First unsupervised level, and the contrast with AI Island is the point: ask the class what is MISSING from this board (answers/labels) before anyone places a flag. The two clumps are far apart and the passing region is generous — nobody should lose on precision. The reveal (jerboas and fennec foxes) prints only after a pass; let students discover that the machine never knew the names either. Discussion: what would the camera have to record for the two piles to overlap?",
          },
          difficulty: "EASY",
          recommendedGradeMin: 4,
          recommendedGradeMax: 7,
          estimatedMinutes: 8,
          xpReward: 50,
          tags: ["ai", "clustering"],
          requires: [],
          hints: [
            {
              tier: 1,
              text: {
                en: "Look at the board before you click. Do the dots look like one crowd, or more than one?",
                ar: "انظر إلى اللوحة قبل أن تنقر. هل تبدو النقاط حشدًا واحدًا أم أكثر من حشد؟",
              },
            },
            {
              tier: 2,
              text: {
                en: "Plant a flag and watch the lines. Every dot grabs the flag nearest to it — that is what a group IS here.",
                ar: "اغرس علمًا وراقب الخطوط. كل نقطة تتشبث بأقرب علم إليها — وهذا هو معنى المجموعة هنا.",
              },
            },
            {
              tier: 3,
              text: {
                en: "A flag stranded between the two crowds makes both piles loose. Put each flag in the MIDDLE of its own crowd.",
                ar: "العلم العالق بين الحشدين يجعل الكومتين مفكّكتين. ضع كل علم في وسط حشده.",
              },
            },
            {
              tier: 4,
              text: {
                en: "One flag near the small cool dots at the bottom, one near the big warm dots at the top. The meter will jump.",
                ar: "علم قرب النقاط الصغيرة الباردة في الأسفل، وعلم قرب الكبيرة الدافئة في الأعلى. سيقفز العداد.",
              },
            },
          ],
          payload: {
            conceptSlug: "clustering",
            theme: NIGHT_CAMERA_THEME,
            walkthrough: [
              {
                title: { en: "Nobody labelled these", ar: "لا أحد وضع أسماء" },
                body: {
                  en: "A camera recorded twelve creatures at the waterhole: how big, how warm. That is all anyone knows. There are no right answers hiding anywhere.",
                  ar: "سجّلت كاميرا اثني عشر مخلوقًا عند مورد الماء: الحجم والحرارة. هذا كل ما يعرفه أي أحد. لا توجد إجابات صحيحة مخبأة في أي مكان.",
                },
              },
              {
                title: { en: "A group means “nearest this flag”", ar: "المجموعة تعني «الأقرب إلى هذا العلم»" },
                body: {
                  en: "Plant a flag and every reading joins whichever flag is closest. That is the machine's whole idea of a group. Move a flag and the groups change with it.",
                  ar: "اغرس علمًا فتنضم كل قراءة إلى أقرب علم إليها. هذه هي فكرة الآلة الكاملة عن المجموعة. حرّك العلم فتتغير المجموعات معه.",
                },
              },
              {
                title: { en: "The meter says how tight", ar: "العداد يقيس التراصّ" },
                body: {
                  en: "Piles where everything sits close to its own flag score high. A flag caught between two crowds scores low. Watch the meter as you place.",
                  ar: "الأكوام التي يجلس كل شيء فيها قريبًا من علمه تسجّل نتيجة عالية. والعلم العالق بين حشدين يسجّل نتيجة منخفضة. راقب العداد وأنت تضع الأعلام.",
                },
              },
              {
                title: { en: "Win, and find out what they were", ar: "افز، ثم اعرف ما كانت" },
                body: {
                  en: "Separate the piles well and the camera's secret unlocks: you will see what actually visited the waterhole — something the machine never knew either.",
                  ar: "افصل الكومتين جيدًا وسينكشف سرّ الكاميرا: سترى ما الذي زار مورد الماء فعلًا — وهو ما لم تعرفه الآلة نفسها.",
                },
              },
            ],
            specimens: [
              { id: "w1", size: 0.2, color: 0.26 },
              { id: "w2", size: 0.28, color: 0.34 },
              { id: "w3", size: 0.22, color: 0.38 },
              { id: "w4", size: 0.3, color: 0.24 },
              { id: "w5", size: 0.24, color: 0.3 },
              { id: "w6", size: 0.26, color: 0.28 },
              { id: "w7", size: 0.7, color: 0.66 },
              { id: "w8", size: 0.78, color: 0.74 },
              { id: "w9", size: 0.72, color: 0.78 },
              { id: "w10", size: 0.8, color: 0.64 },
              { id: "w11", size: 0.74, color: 0.7 },
              { id: "w12", size: 0.76, color: 0.68 },
            ],
            markers: { min: 2, max: 2 },
            maxExclusions: 0,
            // Reference scores 0.9676; a sloppy one-per-clump answer 0.9100;
            // one flag in the gap 0.3894. Verified in
            // tests/unit/pattern-recognition.test.ts.
            objective: { minTightness: 0.75 },
            groundTruth: {
              referencePlacement: [
                { size: 0.25, color: 0.3 },
                { size: 0.75, color: 0.7 },
              ],
              hiddenKinds: {
                w1: 0, w2: 0, w3: 0, w4: 0, w5: 0, w6: 0,
                w7: 1, w8: 1, w9: 1, w10: 1, w11: 1, w12: 1,
              },
              kindNames: [
                { en: "Jerboas", ar: "يرابيع" },
                { en: "Fennec foxes", ar: "ثعالب فنك" },
              ],
            },
            starCriteria: {},
          } satisfies PrDraft,
        },

        // ── 2. how-many-kinds ────────────────────────────────────────
        {
          slug: "how-many-kinds",
          order: 2,
          activityType: "PATTERN_RECOGNITION",
          track: "AI_CONCEPTS",
          title: { en: "How Many Kinds?", ar: "كم نوعًا؟" },
          story: {
            en: "The camera ran again the next night, and this time nobody will tell you how many kinds came to drink. The machine will not tell you either — its score only ever goes UP when you add flags, even when the picture gets worse.",
            ar: "عملت الكاميرا ليلة أخرى، وهذه المرة لن يخبرك أحد كم نوعًا جاء ليشرب. ولن تخبرك الآلة أيضًا — فنتيجتها لا تعرف إلا الصعود كلما أضفت أعلامًا، حتى حين تسوء الصورة.",
          },
          objective: {
            en: "Choose the NUMBER of groups yourself, and discover why the machine's own score can never make that choice for you.",
            ar: "اختر عدد المجموعات بنفسك، واكتشف لماذا لا تستطيع نتيجة الآلة اتخاذ هذا القرار عنك أبدًا.",
          },
          instructions: {
            en: "Use 2, 3 or 4 flags — your choice. Two cannot reach the bar. Four scores higher than three but chops a real crowd in half, and costs a star. Find the number that matches the data.",
            ar: "استخدم 2 أو 3 أو 4 أعلام — القرار قرارك. علمان لا يبلغان الحد. وأربعة تسجّل أعلى من ثلاثة لكنها تشطر حشدًا حقيقيًا نصفين، وتكلفك نجمة. جِد العدد الذي يطابق البيانات.",
          },
          explanation: {
            en: "The meter never once went DOWN when you added a flag — more flags always score higher, even when the fourth one cut a real crowd in two. That is why choosing how many groups is YOUR job, not the machine's: a number that only ever goes up cannot tell you when to stop. Scientists call this the elbow — the moment adding more stops being worth it.",
            ar: "لم ينخفض العداد مرة واحدة حين أضفت علمًا — فالأعلام الأكثر تسجّل دائمًا نتيجة أعلى، حتى حين شطر العلم الرابع حشدًا حقيقيًا نصفين. لهذا كان اختيار عدد المجموعات مهمتك أنت لا مهمة الآلة: رقمٌ لا يعرف إلا الصعود لا يستطيع أن يقول لك متى تتوقف. يسمّي العلماء هذه اللحظة «الكوع» — اللحظة التي يكفّ فيها المزيد عن أن يستحق.",
          },
          teacherNotes: {
            en: "The first level in the product where doing MORE is penalised. Let students discover the plateau themselves: ask everyone to try their best two-flag answer first and report the highest meter reading anyone found (~53%). Then three flags (~97%). Then ask a volunteer to add a fourth and read the meter (~98%, higher!) while the class looks at the board and says what went wrong. The star loss for four flags is the graded form of that discussion. Vocabulary if wanted: this is why 'K' in K-means is a human decision.",
          },
          difficulty: "MEDIUM",
          recommendedGradeMin: 4,
          recommendedGradeMax: 7,
          estimatedMinutes: 10,
          xpReward: 60,
          tags: ["ai", "clustering", "model-selection"],
          requires: ["two-piles"],
          hints: [
            {
              tier: 1,
              text: {
                en: "Before placing anything, count the crowds with your eyes. How many separate huddles do you see?",
                ar: "قبل أن تضع شيئًا، عُدَّ الحشود بعينيك. كم تجمّعًا منفصلًا ترى؟",
              },
            },
            {
              tier: 2,
              text: {
                en: "Try your best with two flags and watch the meter. It stops climbing well below the bar — that plateau is telling you something.",
                ar: "ابذل وسعك بعلمين وراقب العداد. سيتوقف عن الصعود دون الحد بكثير — وهذا الثبات يقول لك شيئًا.",
              },
            },
            {
              tier: 3,
              text: {
                en: "With two flags, two of the crowds are forced to SHARE one flag. No placement can fix a missing flag.",
                ar: "بعلمين، يُجبَر حشدان على تقاسم علم واحد. ولا موضع في الدنيا يعوّض علمًا ناقصًا.",
              },
            },
            {
              tier: 4,
              text: {
                en: "Three flags, one in the middle of each crowd. A fourth will raise the score — and split a real crowd, and cost you the third star.",
                ar: "ثلاثة أعلام، واحد في وسط كل حشد. الرابع سيرفع النتيجة — ويشطر حشدًا حقيقيًا، ويكلفك النجمة الثالثة.",
              },
            },
          ],
          payload: {
            conceptSlug: "choosing-k",
            theme: NIGHT_CAMERA_THEME,
            walkthrough: [
              {
                title: { en: "A new night, new visitors", ar: "ليلة جديدة وزوار جدد" },
                body: {
                  en: "Same camera, same waterhole. Nobody counted the kinds this time — that is now your job.",
                  ar: "الكاميرا نفسها والمورد نفسه. لم يعُدَّ أحدٌ الأنواع هذه المرة — صار العدّ مهمتك أنت.",
                },
              },
              {
                title: { en: "You choose how many flags", ar: "أنت تختار عدد الأعلام" },
                body: {
                  en: "Two, three or four — the machine will happily group with any number you hand it. It has no opinion at all.",
                  ar: "اثنان أو ثلاثة أو أربعة — ستقبل الآلة أي عدد تعطيه إياها وتجمع به بكل رضا. ليس لديها رأي إطلاقًا.",
                },
              },
              {
                title: { en: "Careful: the score always climbs", ar: "انتبه: النتيجة تصعد دائمًا" },
                body: {
                  en: "Every extra flag makes the meter read higher — even a flag that chops a real crowd in half. A number that only goes up cannot tell you when to stop.",
                  ar: "كل علم إضافي يرفع قراءة العداد — حتى العلم الذي يشطر حشدًا حقيقيًا نصفين. رقمٌ لا يعرف إلا الصعود لا يقول لك متى تتوقف.",
                },
              },
              {
                title: { en: "Match the data, not the meter", ar: "طابق البيانات لا العداد" },
                body: {
                  en: "The right number of flags is the number of real crowds on the board. Your eyes decide that — the machine only measures.",
                  ar: "عدد الأعلام الصحيح هو عدد الحشود الحقيقية على اللوحة. عيناك تقرران ذلك — أما الآلة فلا تفعل سوى القياس.",
                },
              },
            ],
            specimens: [
              { id: "n1", size: 0.2, color: 0.25 },
              { id: "n2", size: 0.25, color: 0.29 },
              { id: "n3", size: 0.15, color: 0.21 },
              { id: "n4", size: 0.24, color: 0.2 },
              { id: "n5", size: 0.16, color: 0.3 },
              { id: "n6", size: 0.5, color: 0.78 },
              { id: "n7", size: 0.55, color: 0.82 },
              { id: "n8", size: 0.45, color: 0.74 },
              { id: "n9", size: 0.54, color: 0.73 },
              { id: "n10", size: 0.46, color: 0.83 },
              { id: "n11", size: 0.8, color: 0.3 },
              { id: "n12", size: 0.85, color: 0.34 },
              { id: "n13", size: 0.75, color: 0.26 },
              { id: "n14", size: 0.84, color: 0.25 },
              { id: "n15", size: 0.76, color: 0.35 },
            ],
            markers: { min: 2, max: 4 },
            maxExclusions: 0,
            // Three flags on the clump means → 0.9728. Best possible two-flag
            // answer → 0.5291 (unreachable bar). Four flags → 0.9756, passes,
            // and the 3-flag star budget takes the third star. Verified.
            objective: { minTightness: 0.72 },
            groundTruth: {
              referencePlacement: [
                { size: 0.2, color: 0.25 },
                { size: 0.5, color: 0.78 },
                { size: 0.8, color: 0.3 },
              ],
            },
            starCriteria: { threeStarMaxBlocks: 3 },
          } satisfies PrDraft,
        },

        // ── 3. impossible-reading ────────────────────────────────────
        {
          slug: "impossible-reading",
          order: 3,
          activityType: "PATTERN_RECOGNITION",
          track: "AI_CONCEPTS",
          title: { en: "The Reading That Couldn't Be Real", ar: "القراءة التي يستحيل أن تكون حقيقية" },
          story: {
            en: "Thirteen readings tonight — and one of them says something enormous and freezing cold walked past. Nothing in the desert is enormous and freezing. That reading is a truck's headlight, not an animal. But the machine does not know deserts. It believes every number it is given.",
            ar: "ثلاث عشرة قراءة الليلة — وواحدة منها تقول إن شيئًا ضخمًا ومتجمدًا مرّ من هنا. لا شيء في الصحراء ضخم ومتجمد. تلك القراءة ضوء شاحنة لا حيوان. لكن الآلة لا تعرف الصحارى، فهي تصدّق كل رقم يُعطى لها.",
          },
          objective: {
            en: "Meet leverage: one impossible value drags the whole answer, and the damage shows up in a group the bad reading is nowhere near.",
            ar: "تعرّف على قوة الجذب: قيمة واحدة مستحيلة تجرّ الإجابة كلها، ويظهر الضرر في مجموعة ليست القراءة السيئة قريبة منها أصلًا.",
          },
          instructions: {
            en: "Three flags, and for the first time you may strike ONE reading out. Placing and counting will not save you here — look at the data itself.",
            ar: "ثلاثة أعلام، ولأول مرة يمكنك شطب قراءة واحدة. لن ينقذك الوضع ولا العدّ هنا — دقّق في البيانات نفسها.",
          },
          explanation: {
            en: "With the headlight in, every answer was bad — either a flag wasted guarding one fake dot, or a flag dragged out of its crowd toward the corner. And the pile that suffered was on the FAR side of the board: leverage means the damage appears where the cause is not. Striking out one impossible reading fixed all three groups at once. Cleaning data is not cheating — it is the job.",
            ar: "بوجود ضوء الشاحنة كانت كل إجابة سيئة: إما علم مهدور يحرس نقطة زائفة واحدة، وإما علم مجرور خارج حشده نحو الزاوية. والكومة التي عانت كانت في الطرف البعيد من اللوحة: قوة الجذب تعني أن الضرر يظهر حيث لا يوجد السبب. شطبُ قراءة واحدة مستحيلة أصلح المجموعات الثلاث دفعة واحدة. تنظيف البيانات ليس غشًّا — إنه صميم العمل.",
          },
          teacherNotes: {
            en: "The first data-cleaning act in the curriculum. The trap is REMOTE damage: with the outlier kept, the best three-flag answer strands a flag near the corner and forces two real clumps to share — students will try placement and counting first and both fail, which is the intended path. Ask afterwards WHY the reading had to be fake (enormous + freezing has no desert animal) — the justification matters, because striking out data you merely dislike is the opposite lesson. Contrast with the-berry-that-lied if the class played AI Island: there the bad record had a wrong ANSWER on it; here it has an impossible VALUE and no answer at all.",
          },
          difficulty: "MEDIUM",
          recommendedGradeMin: 5,
          recommendedGradeMax: 7,
          estimatedMinutes: 10,
          xpReward: 60,
          tags: ["ai", "clustering", "outliers", "data-cleaning"],
          requires: ["how-many-kinds"],
          hints: [
            {
              tier: 1,
              text: {
                en: "One of these readings could not have been an animal. Which dot sits alone, far from every crowd?",
                ar: "إحدى هذه القراءات يستحيل أن تكون حيوانًا. أي نقطة تجلس وحيدة بعيدًا عن كل الحشود؟",
              },
            },
            {
              tier: 2,
              text: {
                en: "Try placing your three flags with the strange dot still in. Watch which pile goes loose — it is not the one next to the strange dot.",
                ar: "جرّب وضع أعلامك الثلاثة والنقطة الغريبة ما تزال موجودة. راقب أي كومة تتفكك — إنها ليست المجاورة للنقطة الغريبة.",
              },
            },
            {
              tier: 3,
              text: {
                en: "Something enormous and freezing does not exist in the desert. Tap that reading and mark it “not an animal”.",
                ar: "شيء ضخم ومتجمد لا وجود له في الصحراء. انقر تلك القراءة واشطبها بوصفها «ليست حيوانًا».",
              },
            },
            {
              tier: 4,
              text: {
                en: "Strike out the corner reading, then one flag in the middle of each of the three real crowds. The board heals everywhere at once.",
                ar: "اشطب قراءة الزاوية، ثم ضع علمًا في وسط كل حشد من الحشود الثلاثة الحقيقية. ستتعافى اللوحة كلها دفعة واحدة.",
              },
            },
          ],
          payload: {
            conceptSlug: "outliers",
            theme: NIGHT_CAMERA_THEME,
            walkthrough: [
              {
                title: { en: "One reading is lying", ar: "قراءة واحدة تكذب" },
                body: {
                  en: "The camera caught something enormous and freezing cold. No desert animal is both. A truck's headlight fooled the sensor.",
                  ar: "التقطت الكاميرا شيئًا ضخمًا ومتجمدًا. لا حيوان صحراوي يجمع الصفتين. لقد خدع ضوءُ شاحنةٍ المستشعرَ.",
                },
              },
              {
                title: { en: "The machine believes everything", ar: "الآلة تصدّق كل شيء" },
                body: {
                  en: "It does not know deserts. To the machine that corner dot is as real as every other reading, and your flags must answer for it.",
                  ar: "إنها لا تعرف الصحارى. تلك النقطة في الزاوية حقيقية عند الآلة كأي قراءة أخرى، وعلى أعلامك أن تتحمل حسابها.",
                },
              },
              {
                title: { en: "The damage lands far away", ar: "الضرر يقع بعيدًا" },
                body: {
                  en: "Keep it, and watch: a flag gets dragged toward the corner, and a pile on the OTHER side of the board falls apart. The symptom is never where the cause is.",
                  ar: "أبقِها وراقب: علم يُجَرّ نحو الزاوية، وكومة في الطرف الآخر من اللوحة تتفكك. العَرَض لا يظهر أبدًا حيث يكون السبب.",
                },
              },
              {
                title: { en: "You may strike one out", ar: "لك أن تشطب واحدة" },
                body: {
                  en: "For the first time, you can remove a reading — because you can SAY why it cannot be real. That reason is what makes it cleaning and not cheating.",
                  ar: "لأول مرة يمكنك حذف قراءة — لأنك تستطيع أن تقول لماذا يستحيل أن تكون حقيقية. هذا السبب هو ما يجعل الأمر تنظيفًا لا غشًّا.",
                },
              },
            ],
            specimens: [
              { id: "d1", size: 0.25, color: 0.34 },
              { id: "d2", size: 0.15, color: 0.26 },
              { id: "d3", size: 0.24, color: 0.25 },
              { id: "d4", size: 0.16, color: 0.35 },
              { id: "d5", size: 0.35, color: 0.79 },
              { id: "d6", size: 0.25, color: 0.71 },
              { id: "d7", size: 0.34, color: 0.7 },
              { id: "d8", size: 0.26, color: 0.8 },
              { id: "d9", size: 0.75, color: 0.84 },
              { id: "d10", size: 0.65, color: 0.76 },
              { id: "d11", size: 0.74, color: 0.75 },
              { id: "d12", size: 0.66, color: 0.85 },
              // The truck headlight: enormous and freezing. No desert animal
              // is both, which is exactly why it is safe to strike out.
              { id: "d13", size: 0.98, color: 0.02 },
            ],
            markers: { min: 3, max: 3 },
            maxExclusions: 1,
            // Keep the outlier: best three-clump placement 0.6032; best
            // spend-a-flag-on-it placement 0.7983 — both under the bar.
            // Exclude it: reference 0.9595; even 0.06 off on every axis
            // still 0.8885. Verified numerically.
            objective: { minTightness: 0.86 },
            groundTruth: {
              referencePlacement: [
                { size: 0.2, color: 0.3 },
                { size: 0.3, color: 0.75 },
                { size: 0.7, color: 0.8 },
              ],
            },
            starCriteria: {},
          } satisfies PrDraft,
        },

        // ── 4. mirage-pattern ────────────────────────────────────────
        {
          slug: "mirage-pattern",
          order: 4,
          activityType: "AI_CLASSIFICATION",
          track: "MACHINE_LEARNING",
          title: { en: "The Pattern That Wasn't", ar: "النمط الذي لم يكن" },
          story: {
            en: "The survey team logged twelve sand samples, marking where digging found water. Fine grain means water below — that is real desert science. But look at the board: every fine sample they logged is also pale, and every coarse one is also dark. Two explanations fit the same records, and only one is true.",
            ar: "سجّل فريق المسح اثنتي عشرة عينة رمل، مدوّنًا أين وجد الحفرُ ماءً. الحبيبات الناعمة تعني ماءً في الأسفل — هذا علم صحراوي حقيقي. لكن انظر إلى اللوحة: كل عينة ناعمة سجّلوها فاتحة اللون أيضًا، وكل خشنة غامقة أيضًا. تفسيران يطابقان السجلات نفسها، وواحد فقط صحيح.",
          },
          objective: {
            en: "Meet spurious correlation: a training set can be fair, spread out and honest, and still teach the wrong pattern — because two patterns fit it equally well.",
            ar: "تعرّف على الارتباط الزائف: قد تكون مجموعة التدريب عادلة وموزعة وصادقة، وتعلّم النمط الخطأ مع ذلك — لأن نمطين يطابقانها بالتساوي.",
          },
          instructions: {
            en: "Five slots. The ? probes sit in the empty corners where the two explanations disagree. Teach the machine which explanation is the real one — grain, not colour.",
            ar: "خمسة مقاعد. حبات «؟» تجلس في الزوايا الفارغة حيث يختلف التفسيران. علّم الآلة أيّ التفسيرين هو الحقيقي — الحبيبات لا اللون.",
          },
          explanation: {
            en: "A fair, well-spread training set from the survey's records still failed — because in those records, grain and colour always travelled together, so the machine had no way to tell which one mattered. The fix was not MORE data. It was the RIGHT data: the rare samples where the two explanations disagree. When two patterns fit everything you have, go looking for the record on which they would argue.",
            ar: "مجموعة تدريب عادلة وموزّعة من سجلات المسح فشلت مع ذلك — لأن الحبيبات واللون كانا يسيران معًا دائمًا في تلك السجلات، فلم يكن أمام الآلة سبيل لمعرفة أيهما المهم. لم يكن العلاج مزيدًا من البيانات، بل البيانات الصحيحة: العينات النادرة التي يختلف فيها التفسيران. حين يطابق نمطان كلَّ ما لديك، فاذهب وابحث عن السجل الذي سيتخاصمان عليه.",
          },
          teacherNotes: {
            en: "The capstone of the world and the only level here that cannot be solved by coverage: a representative sample of the confounded core IS well-spread and still fails (the pinned lazy set scores 2 of 4). The winning insight is to spot that the diagonal is suspicious and to seek out the correlation-breakers (s9-s12), which sit off it. The board makes the empty corners visible — point students at the emptiness itself. This is the closest a Grade 5-7 class gets to real scientific method: two hypotheses, one experiment that separates them. The 5-slot cap blocks teach-everything.",
          },
          difficulty: "HARD",
          recommendedGradeMin: 5,
          recommendedGradeMax: 7,
          estimatedMinutes: 12,
          xpReward: 80,
          tags: ["ai", "classification", "spurious-correlation"],
          requires: ["impossible-reading"],
          hints: [
            {
              tier: 1,
              text: {
                en: "Look at the board. All the water samples huddle in one corner, all the dry ones in the opposite corner. What is strange about that?",
                ar: "انظر إلى اللوحة. كل عينات الماء متجمعة في زاوية، وكل الجافة في الزاوية المقابلة. ما الغريب في ذلك؟",
              },
            },
            {
              tier: 2,
              text: {
                en: "Two stories fit those records: “fine grain means water” and “pale colour means water”. The ? probes sit exactly where the stories disagree.",
                ar: "قصتان تطابقان تلك السجلات: «الحبيبات الناعمة تعني ماء» و«اللون الفاتح يعني ماء». وحبات «؟» تجلس تمامًا حيث تختلف القصتان.",
              },
            },
            {
              tier: 3,
              text: {
                en: "Four samples sit OFF the diagonal — fine but dark, coarse but pale. Those are the only records that can settle the argument.",
                ar: "أربع عينات تقع خارج القطر — ناعمة لكن غامقة، وخشنة لكن فاتحة. تلك هي السجلات الوحيدة القادرة على حسم الخلاف.",
              },
            },
            {
              tier: 4,
              text: {
                en: "Teach it a fine-dark sample as WATER and a coarse-pale one as DRY. Now only the grain story fits — and the corners stop being empty.",
                ar: "علّمه عينة ناعمة غامقة على أنها ماء، وخشنة فاتحة على أنها جافة. الآن لا تصمد إلا قصة الحبيبات — وتكفّ الزوايا عن الفراغ.",
              },
            },
          ],
          payload: {
            conceptSlug: "spurious-correlation",
            labels: {
              positive: { en: "Water below", ar: "ماء في الأسفل" },
              negative: { en: "Dry sand", ar: "رمل جاف" },
            },
            theme: {
              glyph: "grain",
              featureNames: {
                size: { en: "Grain size", ar: "حجم الحبيبات" },
                color: { en: "Sand colour", ar: "لون الرمل" },
              },
              truthEmoji: { positive: "💧", negative: "🏜️" },
            },
            walkthrough: [
              {
                title: { en: "Real desert science", ar: "علم صحراوي حقيقي" },
                body: {
                  en: "Fine grains pack tight and hold water underneath. The survey team dug at twelve spots and wrote down what they found.",
                  ar: "الحبيبات الناعمة تتراصّ فتحبس الماء تحتها. حفر فريق المسح في اثني عشر موضعًا ودوّن ما وجد.",
                },
              },
              {
                title: { en: "Two stories fit the records", ar: "قصتان تطابقان السجلات" },
                body: {
                  en: "In their records, every wet sample is fine AND pale; every dry one is coarse AND dark. “Grain means water” and “colour means water” both fit perfectly. Only one is true.",
                  ar: "في سجلاتهم كل عينة رطبة ناعمة وفاتحة معًا، وكل جافة خشنة وغامقة معًا. «الحبيبات تعني الماء» و«اللون يعني الماء» تنطبقان تمامًا. وواحدة فقط صحيحة.",
                },
              },
              {
                title: { en: "The corners are empty", ar: "الزوايا فارغة" },
                body: {
                  en: "Look where the ? probes sit: fine-but-dark, coarse-but-pale. The records where the two stories disagree — and the survey never logged one.",
                  ar: "انظر أين تجلس حبات «؟»: ناعمة لكن غامقة، خشنة لكن فاتحة. إنها السجلات التي تختلف فيها القصتان — ولم يسجل المسح واحدة منها قط.",
                },
              },
              {
                title: { en: "Break the tie on purpose", ar: "احسم التعادل عمدًا" },
                body: {
                  en: "A fair sample of the survey's records will train the wrong machine. Seek out the rare off-diagonal samples — they are the only ones that settle which story is real.",
                  ar: "العينة العادلة من سجلات المسح ستدرّب الآلة الخطأ. اقصد العينات النادرة خارج القطر — فهي وحدها تحسم أي القصتين حقيقية.",
                },
              },
            ],
            board: {
              show: true,
              showBoundary: true,
              axisLabels: {
                x: { en: "Grain size, fine to coarse", ar: "حجم الحبيبات، من الناعم إلى الخشن" },
                y: { en: "Sand colour, pale to dark", ar: "لون الرمل، من الفاتح إلى الغامق" },
              },
            },
            pool: [
              // The confounded core: wet ⇔ fine ⇔ pale, dry ⇔ coarse ⇔ dark.
              { id: "s1", size: 0.12, color: 0.18, truth: "positive" },
              { id: "s2", size: 0.22, color: 0.3, truth: "positive" },
              { id: "s3", size: 0.32, color: 0.22, truth: "positive" },
              { id: "s4", size: 0.28, color: 0.36, truth: "positive" },
              { id: "s5", size: 0.68, color: 0.72, truth: "negative" },
              { id: "s6", size: 0.78, color: 0.64, truth: "negative" },
              { id: "s7", size: 0.72, color: 0.8, truth: "negative" },
              { id: "s8", size: 0.88, color: 0.76, truth: "negative" },
              // The correlation breakers: off the diagonal, where the two
              // explanations disagree. The only records that settle it.
              { id: "s9", size: 0.22, color: 0.78, truth: "positive" },
              { id: "s10", size: 0.18, color: 0.88, truth: "positive" },
              { id: "s11", size: 0.78, color: 0.22, truth: "negative" },
              { id: "s12", size: 0.86, color: 0.14, truth: "negative" },
            ],
            // All four probes live where the stories disagree. The pinned
            // lazy set {s1,s3,s4|s5,s8} misses t1 and t2 (2 of 4, FAIL);
            // {s3,s9|s5,s11} answers all four (PASS at 4 = 3 stars).
            testSet: [
              { id: "t1", size: 0.3, color: 0.85 },
              { id: "t2", size: 0.7, color: 0.15 },
              { id: "t3", size: 0.4, color: 0.3 },
              { id: "t4", size: 0.62, color: 0.66 },
            ],
            rule: { kind: "threshold", feature: "size", threshold: 0.5 },
            minPerLabel: 2,
            maxExamples: 5,
            starCriteria: { threeStarMaxBlocks: 4 },
          } satisfies AiDraft,
        },
      ],
    },

    {
      slug: "lines-in-the-sand",
      order: 2,
      name: { en: "Lines in the Sand", ar: "خطوط في الرمل" },
      description: {
        en: "You found the groups by planting flags. Now draw the machine's other two tools with your own hand — a boundary that separates, and a trend line that predicts.",
        ar: "وجدتَ المجموعات بغرس الأعلام. الآن ارسم أداتَي الآلة الأخريين بيدك — حدًّا يفصل، وخطَّ اتجاه يتنبأ.",
      },
      // Phase G graft: concept explorations with no coding prerequisite —
      // unlockRule OPEN opens every level here the instant the world is
      // published and in the student's program (see adventure.ts).
      unlockRule: { type: "OPEN" },
      levels: [
        // ── 1. you-be-the-classifier: AI_SIM boundary-builder ─────────
        {
          slug: "you-be-the-classifier",
          order: 1,
          activityType: "AI_SIM",
          track: "AI_CONCEPTS",
          title: { en: "You Be the Classifier", ar: "كن أنت المصنِّف" },
          story: {
            en: "A desert market stall has a basket of mixed fruit: some tart, some sweet, and no labels. The stallholder wants a quick way to sort future baskets without tasting every single piece.",
            ar: "على كشك في سوق الصحراء سلة فواكه مختلطة: بعضها حامض وبعضها حلو، بلا بطاقات. يريد صاحب الكشك طريقة سريعة لفرز السلال القادمة دون تذوّق كل قطعة.",
          },
          objective: {
            en: "Draw a dividing line on a size-vs-sweetness scatter to separate tart fruit from sweet fruit, then compare it to a computer's own simple rule.",
            ar: "ارسم خطًا فاصلًا على رسم يوضّح الحجم مقابل الحلاوة لتفصل الفاكهة الحامضة عن الحلوة، ثم قارنه بقاعدة بسيطة يضعها الحاسوب بنفسه.",
          },
          instructions: {
            en: "Each dot is one piece of fruit, placed by its size and its sweetness. Drag the line so tart fruit ends up on one side and sweet fruit on the other. A wobbling dot is on the wrong side of your line — try to leave at most one wobbling.",
            ar: "كل نقطة تمثل قطعة فاكهة واحدة، موضوعة حسب حجمها وحلاوتها. اسحب الخط بحيث تقع الفاكهة الحامضة في جهة والحلوة في الجهة الأخرى. النقطة المهتزّة تقع في الجهة الخطأ من خطك — حاول ألا تترك أكثر من نقطة واحدة مهتزّة.",
          },
          explanation: {
            en: "You just did something a computer can also do: draw a boundary between two groups using only two measurements. When you pressed 'computer's turn', it placed its own line using a simple method — find the middle of each group and draw the line between them. That's honestly how simple as this gets: no thousands of examples, no training, just averages and geometry. Real classifiers (like the ones sorting recycling by camera) use the SAME idea with many more measurements at once — but the core trick, finding a boundary between groups, is exactly what you just did by hand.",
            ar: "لقد فعلت للتو ما يستطيع الحاسوب فعله أيضًا: رسم حدّ فاصل بين مجموعتين باستخدام قياسين فقط. عندما ضغطت «دور الحاسوب»، وضع خطّه الخاص باستخدام طريقة بسيطة — إيجاد مركز كل مجموعة ورسم الخط بينهما. هذا صادقٌ تمامًا وبهذه البساطة: لا آلاف الأمثلة، لا تدريب، فقط متوسطات وهندسة. المصنِّفات الحقيقية (مثل تلك التي تفرز إعادة التدوير بالكاميرا) تستخدم نفس الفكرة بعدد أكبر من القياسات دفعة واحدة — لكن الحيلة الأساسية، إيجاد حدّ فاصل بين مجموعتين، هي بالضبط ما فعلته للتو بيدك.",
          },
          teacherNotes: {
            en: "The 'computer's turn' centroid-rule line is a genuinely computed result, not an animation — it will differ from a student's line whenever their line isn't optimal, which is the honest teaching moment (invite them to compare). One tart fruit (4,4) and the nearest sweet fruit (6,6) sit closer together than the rest of each group — that gap is where a careless line usually goes wrong, and maxErrors:1 gives a genuine attempt near that gap a pass even before a student finds the fully clean line. A careful, well-angled line CAN classify every point correctly (0 wobbles) — worth celebrating as a distinct, harder goal from just passing.",
          },
          difficulty: "MEDIUM",
          recommendedGradeMin: 4,
          recommendedGradeMax: 7,
          estimatedMinutes: 12,
          xpReward: 70,
          tags: ["ai", "classification", "boundaries"],
          requires: [],
          hints: [
            {
              tier: 1,
              text: {
                en: "Look at the two colours of dots before you touch the line. Where does each colour mostly sit — left/right, or high/low?",
                ar: "انظر إلى لوني النقاط قبل أن تلمس الخط. أين يقع كل لون غالبًا — يسارًا/يمينًا، أم عاليًا/منخفضًا؟",
              },
            },
            {
              tier: 2,
              text: {
                en: "Drag the line into the empty gap between the two colour groups, not through the middle of either one.",
                ar: "اسحب الخط إلى الفراغ بين مجموعتَي اللون، لا عبر منتصف إحداهما.",
              },
            },
            {
              tier: 3,
              text: {
                en: "Tilt the line, not just slide it — a diagonal line often separates two groups better than a flat or straight-up-and-down one.",
                ar: "أمِل الخط، لا تكتفِ بتحريكه — الخط المائل غالبًا يفصل بين مجموعتين أفضل من الخط الأفقي أو العمودي.",
              },
            },
            {
              tier: 4,
              text: {
                en: "Two fruits — one tart, one sweet — sit closer to each other than the rest of their groups. Angle your line to pass between exactly those two, and every dot can stop wobbling.",
                ar: "ثمة فاكهتان — واحدة حامضة وواحدة حلوة — تقعان أقرب لبعضهما من بقية مجموعتيهما. أمِل خطك ليمرّ بينهما بالضبط، وستتوقف كل نقطة عن الاهتزاز.",
              },
            },
          ],
          payload: {
            widget: {
              widgetId: "boundary-builder",
              xAxis: { en: "Size", ar: "الحجم" },
              yAxis: { en: "Sweetness", ar: "الحلاوة" },
              labels: [
                { id: "tart", text: { en: "Tart", ar: "حامض" } },
                { id: "sweet", text: { en: "Sweet", ar: "حلو" } },
              ],
              points: [
                { id: "p1", x: 1, y: 1, label: "tart" },
                { id: "p2", x: 1, y: 3, label: "tart" },
                { id: "p3", x: 2, y: 2, label: "tart" },
                { id: "p4", x: 2, y: 4, label: "tart" },
                { id: "p5", x: 3, y: 1, label: "tart" },
                { id: "p6", x: 3, y: 3, label: "tart" },
                // Nearest tart↔sweet pair (below): closer to each other than
                // to the rest of their own group — the genuinely tricky part
                // of the exercise, without making a perfect line impossible.
                { id: "p14", x: 4, y: 4, label: "tart" },
                { id: "p7", x: 6, y: 6, label: "sweet" },
                { id: "p8", x: 6, y: 8, label: "sweet" },
                { id: "p9", x: 7, y: 7, label: "sweet" },
                { id: "p10", x: 7, y: 5, label: "sweet" },
                { id: "p11", x: 8, y: 6, label: "sweet" },
                { id: "p12", x: 8, y: 9, label: "sweet" },
                { id: "p13", x: 9, y: 8, label: "sweet" },
              ],
              maxErrors: 1,
            },
            intro: {
              en: "Draw one line that keeps the tart fruit on one side and the sweet fruit on the other — then the stall can sort new fruit without tasting it.",
              ar: "ارسم خطًا واحدًا يُبقي الفاكهة الحامضة في جهة والحلوة في الجهة الأخرى — عندها يستطيع البسطة فرز فاكهة جديدة دون تذوّقها.",
            },
            walkthrough: [
              {
                title: { en: "Someone already tasted these", ar: "أحدهم تذوّق هذه بالفعل" },
                body: {
                  en: "Every dot is one fruit the stallholder tasted. Red ones were tart, green ones were sweet. Bigger fruit sits further right, sweeter fruit sits higher up.",
                  ar: "كل نقطة فاكهة تذوّقها صاحب البسطة. الحمراء كانت حامضة والخضراء كانت حلوة. الفاكهة الأكبر تقع نحو اليمين، والأحلى تقع نحو الأعلى.",
                },
              },
              {
                title: { en: "Your line goes in the gap", ar: "خطك يمرّ في الفجوة" },
                body: {
                  en: "Drag one straight line into the empty space between the two colours — reds on one side, greens on the other. Not through the middle of a group.",
                  ar: "اسحب خطًا مستقيمًا واحدًا إلى الفراغ بين اللونين — الأحمر في جهة والأخضر في الجهة الأخرى. لا تمرّ به وسط إحدى المجموعتين.",
                },
              },
              {
                title: { en: "Tilt it, don't just slide it", ar: "أمِله، لا تحرّكه فقط" },
                body: {
                  en: "Two fruits sit awkwardly close to the other colour. A slanted line can slip between them when a straight up-and-down one cannot.",
                  ar: "توجد فاكهتان قريبتان بشكل محرج من اللون الآخر. الخط المائل قد يمرّ بينهما بينما يعجز الخط الرأسي عن ذلك.",
                },
              },
              {
                title: { en: "Now it can sort a new fruit", ar: "الآن يستطيع فرز فاكهة جديدة" },
                body: {
                  en: "Drop in a fruit nobody has tasted. Whichever side of your line it lands on is the guess. That is all a classifier is — a line, and a side.",
                  ar: "ضع فاكهة لم يتذوّقها أحد. الجهة التي تقع فيها من خطك هي التخمين. هذا كل ما يعنيه المصنِّف — خط، وجهة.",
                },
              },
            ],
            honesty: {
              kind: "REAL",
              note: {
                en: "Real: the line-fitting maths genuinely runs. It's honestly a SIMPLE method (averages, not learning) — the machine learning in the rest of this desert goes deeper.",
                ar: "حقيقي: حسابات الخط الفاصل تُنفَّذ فعليًا. لكنها بصدق طريقة بسيطة (متوسطات، وليست تعلّمًا) — تعلّم الآلة في بقية هذه الصحراء أعمق من ذلك.",
              },
            },
          } satisfies AiSimDraft,
        },

        // ── 2. fortune-teller: AI_SIM trend-line ──────────────────────
        {
          slug: "fortune-teller",
          order: 2,
          activityType: "AI_SIM",
          track: "AI_CONCEPTS",
          title: { en: "Fortune Teller", ar: "قارئة الطالع" },
          story: {
            en: "Ten desert sunflower seedlings each got a different amount of daily sunlight. Three weeks later, an oasis gardener measured how tall every single one grew.",
            ar: "حصلت عشر شتلات دوّار شمس صحراوية على كمية مختلفة من ضوء الشمس يوميًا. وبعد ثلاثة أسابيع، قاس أحد بستانيي الواحة طول كل واحدة منها.",
          },
          objective: {
            en: "Fit a trend line to real, honestly noisy data by eye, compare it to the computer's least-squares line, then predict a value beyond the measured data with an honest error range.",
            ar: "اضبط خط اتجاه على بيانات حقيقية بها تشويش صادق بالعين، قارنه بخط الحاسوب الأدق حسابيًا، ثم توقّع قيمة خارج البيانات المُقاسة مع مدى خطأ صادق.",
          },
          instructions: {
            en: "Drag your line to make the 'total miss' score as small as you can — that number is how far every dot sits from your line, added up. Then let the computer take its turn, and predict how tall a seedling would grow with even MORE sunlight than any in the data.",
            ar: "اسحب خطك لتجعل درجة «الخطأ الكلي» أصغر ما يمكن — هذا الرقم هو مجموع بُعد كل نقطة عن خطك. ثم دع الحاسوب يأخذ دوره، وتوقّع طول شتلة حصلت على ضوء شمس أكثر من أي شتلة في البيانات.",
          },
          explanation: {
            en: "The computer's line is called a least-squares fit — it's the ONE line that makes the 'total miss' score as small as it can possibly be, checked by real arithmetic, not a guess. But look at your prediction: it came with a band around it, not one exact number. That band is the honest part — more sunlight almost always means a taller plant here, but 'almost always' is not 'always', and the further you predict beyond the real data, the less certain any line can be. Predictions are educated guesses built from real evidence — not facts, and not magic.",
            ar: "يُسمّى خط الحاسوب بخط أقل المربعات — إنه الخط الوحيد الذي يجعل درجة «الخطأ الكلي» أصغر ما يمكن، محسوبًا بعملية حسابية حقيقية، لا تخمينًا. لكن انظر إلى توقّعك: جاء مصحوبًا بمدى حوله، لا برقم واحد دقيق. هذا المدى هو الجزء الصادق — ضوء الشمس الأكثر يعني غالبًا نبتة أطول هنا، لكن «غالبًا» ليست «دائمًا»، وكلما توقّعت أبعد عن البيانات الحقيقية، قلّ يقين أي خط. التوقّعات تخمينات مبنية على أدلّة حقيقية — وليست حقائق، وليست سحرًا.",
          },
          teacherNotes: {
            en: "The dataset has small deliberate noise (real measurements never sit on a perfect line) — do not let a student 'fix' this by insisting their line should touch every point. predictAt (12 hours) sits beyond the dataset's max (10 hours) on purpose, so the error band widens honestly. Good discussion prompt: 'why can't the computer be 100% sure about 12 hours, when it was so close for the points it already measured?'",
          },
          difficulty: "MEDIUM",
          recommendedGradeMin: 4,
          recommendedGradeMax: 7,
          estimatedMinutes: 12,
          xpReward: 70,
          tags: ["ai", "prediction", "regression"],
          requires: [],
          hints: [
            {
              tier: 1,
              text: {
                en: "Look at the overall slope of the dots first — do taller plants tend to sit on the left or the right?",
                ar: "انظر أولًا إلى الاتجاه العام للنقاط — هل تميل النباتات الأطول إلى اليسار أم إلى اليمين؟",
              },
            },
            {
              tier: 2,
              text: {
                en: "Aim your line through the MIDDLE of the scatter, not through any one dot — some dots should sit above your line and some below.",
                ar: "وجّه خطك عبر منتصف التشتّت، لا عبر نقطة واحدة بعينها — يجب أن تقع بعض النقاط فوق خطك وبعضها تحته.",
              },
            },
            {
              tier: 3,
              text: {
                en: "The total-miss score drops as your line gets closer to more dots at once — small nudges, then watch the number.",
                ar: "تنخفض درجة الخطأ الكلي كلما اقترب خطك من عدد أكبر من النقاط دفعة واحدة — حرّكه قليلًا قليلًا وراقب الرقم.",
              },
            },
            {
              tier: 4,
              text: {
                en: "For the prediction: follow your line's direction PAST the last real dot to where 12 hours would land — then trust the error band the computer draws around it, not one exact number.",
                ar: "بالنسبة للتوقّع: تابع اتجاه خطك بعد آخر نقطة حقيقية حتى تصل إلى موضع 12 ساعة — ثم ثق بمدى الخطأ الذي يرسمه الحاسوب حوله، لا برقم دقيق واحد.",
              },
            },
          ],
          payload: {
            widget: {
              widgetId: "trend-line",
              xAxis: { en: "Hours of sunlight per day", ar: "ساعات الشمس يوميًا" },
              yAxis: { en: "Plant height after 3 weeks (cm)", ar: "ارتفاع النبتة بعد 3 أسابيع (سم)" },
              points: [
                { x: 1, y: 3 },
                { x: 2, y: 5 },
                { x: 3, y: 6 },
                { x: 4, y: 9 },
                { x: 5, y: 10 },
                { x: 6, y: 13 },
                { x: 7, y: 14 },
                { x: 8, y: 17 },
                { x: 9, y: 18 },
                { x: 10, y: 21 },
              ],
              toleranceFactor: 1.6,
              predictAt: 12,
            },
            intro: {
              en: "Ten plants got different amounts of sun. Draw the line that fits them best — then guess how tall a plant with even MORE sun would grow.",
              ar: "عشر نبتات حصلت على كميات مختلفة من الشمس. ارسم الخط الذي يناسبها أفضل ما يكون — ثم خمّن كم يبلغ طول نبتة نالت شمسًا أكثر.",
            },
            walkthrough: [
              {
                title: { en: "Every dot is a real plant", ar: "كل نقطة نبتة حقيقية" },
                body: {
                  en: "A gardener measured ten sunflowers. More sun on the right, taller plants higher up. The dots are a bit scattered — real measurements never sit in a perfect line.",
                  ar: "قاس بستاني عشر زهرات دوّار شمس. الشمس أكثر كلما اتجهت يمينًا، والنبتة أطول كلما ارتفعت. النقاط مبعثرة قليلًا — القياسات الحقيقية لا تقع أبدًا على خط مثالي.",
                },
              },
              {
                title: { en: "Your line goes through the middle", ar: "خطك يمرّ من المنتصف" },
                body: {
                  en: "Drag your line so it runs through the middle of the dots. The red gaps show how far each dot sits from your line. Add all the gaps up and that is your total miss — make it small.",
                  ar: "اسحب خطك ليمرّ من منتصف النقاط. الفجوات الحمراء تُظهر بُعد كل نقطة عن خطك. اجمع كل الفجوات فيكون ذلك خطأك الكلي — اجعله صغيرًا.",
                },
              },
              {
                title: { en: "Then the computer tries", ar: "ثم يحاول الحاسوب" },
                body: {
                  en: "The computer checks every line there is and keeps the one with the smallest total miss. It is not magic and it is not guessing — it is arithmetic. See if you can get close to it.",
                  ar: "يفحص الحاسوب كل خط ممكن ويحتفظ بالخط صاحب أصغر خطأ كلي. ليس سحرًا ولا تخمينًا — إنه حساب. جرّب أن تقترب منه.",
                },
              },
              {
                title: { en: "Past the dots, answers get fuzzy", ar: "بعد النقاط تصبح الإجابات ضبابية" },
                body: {
                  en: "Last, you predict a plant with more sun than anyone measured. Nobody can know that exactly, so the answer is a shaded range, not one number. That is the honest way to guess.",
                  ar: "أخيرًا تتوقّع نبتة نالت شمسًا أكثر من كل ما قِيس. لا أحد يعرف ذلك بالضبط، لذا تكون الإجابة مدًى مظللًا لا رقمًا واحدًا. هذه هي الطريقة الصادقة في التخمين.",
                },
              },
            ],
            honesty: {
              kind: "REAL",
              note: {
                en: "Real: your total-miss score and the computer's least-squares line are both genuinely computed from the data — nothing here is scripted.",
                ar: "حقيقي: درجة خطئك الكلي وخط الحاسوب الأدق كلاهما محسوبان فعليًا من البيانات — لا شيء هنا مُعدّ مسبقًا.",
              },
            },
          } satisfies AiSimDraft,
        },
      ],
    },
  ],
};
