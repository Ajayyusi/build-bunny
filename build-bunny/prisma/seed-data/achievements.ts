/**
 * The 12 launch achievement definitions (m3-contracts wave 3) — pure data,
 * no imports from src/. Criteria JSON shapes match the evaluator in
 * src/modules/grading/server/achievements.ts; definitions whose content
 * (tags, activity types, worlds) does not exist yet are intentionally
 * present — achievements are data-driven, and they become earnable the
 * moment matching content ships.
 */

export interface AchievementSeed {
  slug: string;
  name: { en: string; ar: string };
  description: { en: string; ar?: string };
  icon: string;
  criteria: Record<string, unknown>;
  order: number;
}

export const ACHIEVEMENTS: AchievementSeed[] = [
  {
    slug: "first-program",
    name: { en: "First Program", ar: "أول برنامج" },
    description: {
      en: "Pass your very first level — every programmer starts with one.",
      ar: "اجتز مستواك الأول — كل مبرمج يبدأ ببرنامج واحد.",
    },
    icon: "🎉",
    criteria: { type: "FIRST_PASS" },
    order: 1,
  },
  {
    slug: "loop-master",
    name: { en: "Loop Master", ar: "سيّد الحلقات" },
    description: {
      en: "Complete 5 levels that use loops.",
      ar: "أكمل خمسة مستويات تستخدم الحلقات.",
    },
    icon: "🔁",
    criteria: { type: "LEVELS_WITH_TAG", tag: "loops", count: 5 },
    order: 2,
  },
  {
    slug: "logic-explorer",
    name: { en: "Logic Explorer", ar: "مستكشف المنطق" },
    description: {
      en: "Complete 3 levels built on logic and decisions.",
      ar: "أكمل ثلاثة مستويات قائمة على المنطق واتخاذ القرار.",
    },
    icon: "🧭",
    criteria: { type: "LEVELS_WITH_TAG", tag: "logic", count: 3 },
    order: 3,
  },
  {
    slug: "bug-hunter",
    name: { en: "Bug Hunter", ar: "صيّاد الأخطاء" },
    description: {
      en: "Fix a broken program in a debugging level.",
      ar: "أصلح برنامجًا معطّلًا في مستوى تصحيح الأخطاء.",
    },
    icon: "🐛",
    criteria: { type: "ACTIVITY_TYPE_PASSED", activityType: "DEBUGGING" },
    order: 4,
  },
  {
    slug: "pattern-pro",
    name: { en: "Pattern Pro", ar: "محترف الأنماط" },
    description: {
      en: "Complete 3 levels about spotting patterns.",
      ar: "أكمل ثلاثة مستويات في اكتشاف الأنماط.",
    },
    icon: "🧩",
    criteria: { type: "LEVELS_WITH_TAG", tag: "patterns", count: 3 },
    order: 5,
  },
  {
    slug: "robot-trainer",
    name: { en: "Robot Trainer", ar: "مدرّب الروبوتات" },
    description: {
      en: "Complete every level of the Robot Lab.",
      ar: "أكمل جميع مستويات مختبر الروبوتات.",
    },
    icon: "🤖",
    criteria: { type: "WORLD_COMPLETED", worldSlug: "robot-lab" },
    order: 6,
  },
  {
    slug: "data-detective",
    name: { en: "Data Detective", ar: "محقق البيانات" },
    description: {
      en: "Complete 3 levels about working with data.",
      ar: "أكمل ثلاثة مستويات في التعامل مع البيانات.",
    },
    icon: "🔎",
    criteria: { type: "LEVELS_WITH_TAG", tag: "data", count: 3 },
    order: 7,
  },
  {
    slug: "ml-beginner",
    name: { en: "ML Beginner", ar: "مبتدئ تعلّم الآلة" },
    description: {
      en: "Train your first real machine-learning model.",
      ar: "درّب نموذجك الأول في تعلّم الآلة.",
    },
    icon: "🧠",
    criteria: { type: "ACTIVITY_TYPE_PASSED", activityType: "REAL_ML" },
    order: 8,
  },
  {
    slug: "seven-day-streak",
    name: { en: "Seven-Day Streak", ar: "سلسلة سبعة أيام" },
    description: {
      en: "Play on 7 school days in a row.",
      ar: "تدرّب سبعة أيام دراسية متتالية.",
    },
    icon: "🔥",
    criteria: { type: "STREAK_DAYS", days: 7 },
    order: 9,
  },
  {
    slug: "world-champion",
    name: { en: "World Champion", ar: "بطل العوالم" },
    description: {
      en: "Earn 30 stars across your adventure.",
      ar: "اجمع ثلاثين نجمة في مغامرتك.",
    },
    icon: "🏆",
    criteria: { type: "STARS_TOTAL", count: 30 },
    order: 10,
  },
  {
    slug: "ai-rookie",
    name: { en: "AI Rookie", ar: "مبتدئ الذكاء الاصطناعي" },
    description: {
      en: "Complete your first AI level.",
      ar: "أكمل مستواك الأول في الذكاء الاصطناعي.",
    },
    icon: "✨",
    criteria: { type: "LEVELS_WITH_TAG", tag: "ai", count: 1 },
    order: 11,
  },
  {
    slug: "ai-explorer",
    name: { en: "AI Explorer", ar: "مستكشف الذكاء الاصطناعي" },
    description: {
      en: "Complete 5 AI levels.",
      ar: "أكمل خمسة مستويات في الذكاء الاصطناعي.",
    },
    icon: "🚀",
    criteria: { type: "LEVELS_WITH_TAG", tag: "ai", count: 5 },
    order: 12,
  },
];
