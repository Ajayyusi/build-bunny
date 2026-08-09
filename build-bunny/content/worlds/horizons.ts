import type { WorldFixture } from "@/modules/curriculum/schemas";

/**
 * Horizon worlds: visible on the adventure map as "coming next" territory,
 * zero playable modules. Robot Lab is horizon-only for now — its levels are
 * an M3/M4 deliverable; the rest span the full program arc (design doc §6).
 */
export const horizonWorlds: WorldFixture[] = [
  {
    slug: "robot-lab",
    name: { en: "Robot Lab", ar: "مختبر الروبوتات" },
    tagline: {
      en: "Machines that sense, decide, and act — taught by you.",
      ar: "آلات تستشعر وتقرّر وتتصرف — وأنت معلّمها.",
    },
    theme: "lab",
    horizon: true,
    modules: [],
  },
  {
    slug: "data-desert",
    name: { en: "Data Desert", ar: "صحراء البيانات" },
    tagline: {
      en: "Patterns hide in the dunes. Learn to spot them.",
      ar: "الأنماط تختبئ بين الكثبان — تعلّم كيف تكتشفها.",
    },
    theme: "desert",
    horizon: true,
    modules: [],
  },
  {
    slug: "ai-island",
    name: { en: "AI Island", ar: "جزيرة الذكاء الاصطناعي" },
    tagline: {
      en: "What makes a machine smart? Come and find out.",
      ar: "ما الذي يجعل الآلة ذكية؟ تعالَ واكتشف.",
    },
    theme: "island",
    horizon: true,
    modules: [],
  },
  {
    slug: "ml-lab",
    name: { en: "Machine Learning Lab", ar: "مختبر تعلّم الآلة" },
    tagline: {
      en: "Train a real model with your own hands.",
      ar: "درّب نموذجًا حقيقيًا بيديك.",
    },
    theme: "ml",
    horizon: true,
    modules: [],
  },
  {
    slug: "code-city",
    name: { en: "Code City", ar: "مدينة الشيفرة" },
    tagline: {
      en: "Where blocks turn into real code.",
      ar: "حيث تتحول اللبنات إلى شيفرة حقيقية.",
    },
    theme: "city",
    horizon: true,
    modules: [],
  },
  {
    slug: "inventor-island",
    name: { en: "Inventor Island", ar: "جزيرة المخترعين" },
    tagline: {
      en: "No instructions here. Your ideas lead the way.",
      ar: "لا توجد تعليمات هنا — أفكارك هي الدليل.",
    },
    theme: "workshop",
    horizon: true,
    modules: [],
  },
];
