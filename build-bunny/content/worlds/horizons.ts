import type { WorldFixture } from "@/modules/curriculum/schemas";

/**
 * Horizon worlds: visible on the adventure map as "coming next" territory,
 * zero playable modules. Robot Lab graduated in M3 wave 3, AI Island when
 * AI_CLASSIFICATION landed, and Data Desert + ML Lab when the Grouping
 * Machine (PATTERN_RECOGNITION) landed — leaving Code City and Inventor
 * Island as the remaining roadmap (design §6).
 */
export const horizonWorlds: WorldFixture[] = [
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
