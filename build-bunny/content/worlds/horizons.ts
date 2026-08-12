import type { WorldFixture } from "@/modules/curriculum/schemas";

/**
 * Horizon worlds: visible on the adventure map as "coming next" territory,
 * zero playable modules. Robot Lab graduated to real content in M3 wave 3
 * (content/worlds/robot-lab.ts); the rest span the program arc (design §6).
 */
export const horizonWorlds: WorldFixture[] = [
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
