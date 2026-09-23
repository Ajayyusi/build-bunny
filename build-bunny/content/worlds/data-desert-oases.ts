import type { z } from "zod";
import type { ModuleFixture, patternRecognitionPayload } from "@/modules/curriculum/schemas";

/**
 * Data Desert, module 3 — Three Oases: one more clustering level, with three
 * groups instead of two, for a child who wants another dune after the
 * Grouping Machine. Same night-camera readings, same flags, one more of
 * them; the reference placement is proven by the unit tests.
 */

type PrDraft = z.input<typeof patternRecognitionPayload>;

const NIGHT_CAMERA_THEME = {
  glyph: "blip" as const,
  featureNames: {
    size: { en: "How big it was", ar: "كم كان حجمه" },
    color: { en: "How warm it was", ar: "كم كانت حرارته" },
  },
  truthEmoji: { positive: "🐾", negative: "🚫" },
};

export const threeOases: ModuleFixture = {
  slug: "three-oases",
  order: 3,
  name: { en: "Three Oases", ar: "ثلاث واحات" },
  description: {
    en: "Three crowds at three waterholes. Three flags.",
    ar: "ثلاثة حشود عند ثلاثة موارد ماء. ثلاثة أعلام.",
  },
  levels: [
    {
      slug: "three-waterholes",
      order: 1,
      activityType: "PATTERN_RECOGNITION",
      track: "AI_CONCEPTS",
      title: { en: "Three Waterholes", ar: "ثلاثة موارد ماء" },
      story: {
        en: "Dr. Nova moved the night camera to a valley with three waterholes. Fifteen readings came back — size and warmth, no names. This time the crowds don't sit in two corners.",
        ar: "نقلت الدكتورة نوفا كاميرا الليل إلى وادٍ فيه ثلاثة موارد ماء. عادت خمس عشرة قراءة — الحجم والحرارة، بلا أسماء. هذه المرة لا تجلس الحشود في زاويتين.",
      },
      objective: {
        en: "Cluster unlabelled readings into three groups by placing three markers, reading the tightness meter to judge the placement.",
        ar: "تجميع قراءات غير مسمّاة في ثلاث مجموعات بوضع ثلاث علامات، وقراءة عداد التراصّ للحكم على الوضع.",
      },
      mission: {
        en: "Plant three flags so every reading sits close to its own crowd.",
        ar: "اغرس ثلاثة أعلام بحيث تجلس كل قراءة قريبة من حشدها.",
      },
      instructions: {
        en: "Look for three crowds before you click. Plant one flag in the middle of each. The meter rises as the piles get tighter — move a flag and watch it.",
        ar: "ابحث عن ثلاثة حشود قبل أن تنقر. اغرس علمًا في وسط كل منها. يرتفع العداد كلما ازداد تراصّ الأكوام — حرّك علمًا وراقبه.",
      },
      explanation: {
        en: "Three flags, three crowds — and still nobody told the machine what a sand cat is. The only thing that changed from two piles is how many flags you were allowed. Choosing that number is the hardest part of this kind of learning; here the valley made it obvious, and you'll see how it's chosen when it isn't.",
        ar: "ثلاثة أعلام وثلاثة حشود — ولم يخبر أحد الآلة بعد ما هو قط الرمال. الشيء الوحيد الذي تغيّر عن الكومتين هو عدد الأعلام المسموح بها. اختيار هذا العدد هو الجزء الأصعب في هذا النوع من التعلم؛ هنا جعله الوادي واضحًا، وسترى كيف يُختار عندما لا يكون كذلك.",
      },
      teacherNotes: {
        en: "Three well-separated clumps of five; markers fixed at three. The reference placement scores well above the pass bar (see tests/unit/pattern-recognition.test.ts). Discussion: what if only two flags were allowed — which two crowds would get merged, and what would the meter say?",
        ar: "ثلاثة تجمّعات متباعدة جيدًا في كل منها خمس قراءات؛ وعدد العلامات مثبّت على ثلاث. يحقق الوضع المرجعي درجة أعلى بكثير من حدّ النجاح (انظر tests/unit/pattern-recognition.test.ts). للنقاش: ماذا لو سُمح بعلمين فقط — أي حشدين سيُدمجان، وماذا سيُظهر العداد؟",
      },
      difficulty: "MEDIUM",
      recommendedGradeMin: 4,
      recommendedGradeMax: 7,
      estimatedMinutes: 6,
      xpReward: 45,
      tags: ["ai", "clustering"],
      requires: [],
      hints: [
        { tier: 1, text: { en: "Count the crowds first. How many separate groups of dots do you see?", ar: "عُدّ الحشود أولًا. كم مجموعة منفصلة من النقاط ترى؟" } },
        { tier: 2, text: { en: "One flag per crowd, in its middle. A flag between two crowds makes both piles loose.", ar: "علم واحد لكل حشد، في وسطه. العلم بين حشدين يجعل الكومتين مفكّكتين." } },
        { tier: 3, text: { en: "Small and cool at the bottom-left, mid-size and warm at the top, big and mild on the right.", ar: "صغير وبارد في أسفل اليسار، ومتوسط ودافئ في الأعلى، وكبير ومعتدل على اليمين." } },
        { tier: 4, text: { en: "Flags near (small, cool), (medium, warm) and (big, mild). The meter should pass 0.8.", ar: "أعلام قرب (صغير، بارد) و(متوسط، دافئ) و(كبير، معتدل). يجب أن يتجاوز العداد 0.8." } },
      ],
      payload: {
        conceptSlug: "clustering",
        theme: NIGHT_CAMERA_THEME,
        specimens: [
          { id: "a1", size: 0.16, color: 0.18 },
          { id: "a2", size: 0.24, color: 0.22 },
          { id: "a3", size: 0.2, color: 0.28 },
          { id: "a4", size: 0.14, color: 0.26 },
          { id: "a5", size: 0.22, color: 0.14 },
          { id: "b1", size: 0.46, color: 0.8 },
          { id: "b2", size: 0.54, color: 0.84 },
          { id: "b3", size: 0.5, color: 0.74 },
          { id: "b4", size: 0.44, color: 0.72 },
          { id: "b5", size: 0.56, color: 0.78 },
          { id: "c1", size: 0.84, color: 0.36 },
          { id: "c2", size: 0.9, color: 0.3 },
          { id: "c3", size: 0.8, color: 0.42 },
          { id: "c4", size: 0.88, color: 0.44 },
          { id: "c5", size: 0.94, color: 0.38 },
        ],
        markers: { min: 3, max: 3 },
        maxExclusions: 0,
        objective: { minTightness: 0.8 },
        groundTruth: {
          referencePlacement: [
            { size: 0.19, color: 0.22 },
            { size: 0.5, color: 0.78 },
            { size: 0.87, color: 0.38 },
          ],
          hiddenKinds: {
            a1: 0, a2: 0, a3: 0, a4: 0, a5: 0,
            b1: 1, b2: 1, b3: 1, b4: 1, b5: 1,
            c1: 2, c2: 2, c3: 2, c4: 2, c5: 2,
          },
          kindNames: [
            { en: "Sand skinks", ar: "سقنقور الرمال" },
            { en: "Desert hares", ar: "أرانب الصحراء البرية" },
            { en: "Sand cats", ar: "قطط الرمال" },
          ],
        },
        starCriteria: {},
      } satisfies PrDraft,
    },
  ],
};
