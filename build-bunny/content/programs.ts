import type { ProgramFixture } from "@/modules/curriculum/schemas";

/**
 * Launch program (m2 contract): one program spanning Grades 3–7. A future
 * grade-band split becomes a second program referencing the same worlds —
 * zero content duplication.
 */
export const foundations: ProgramFixture = {
  slug: "foundations",
  name: {
    en: "AI & Coding Foundations",
    ar: "أساسيات البرمجة والذكاء الاصطناعي",
  },
  description: {
    en: "From a first hop to real machine learning: sequences, loops, decisions, data, and AI — one adventure across eight worlds.",
    ar: "من القفزة الأولى إلى تعلّم الآلة الحقيقي: التسلسل، الحلقات، القرارات، البيانات، والذكاء الاصطناعي — مغامرة واحدة عبر ثمانية عوالم.",
  },
  gradeMin: 3,
  gradeMax: 7,
  worlds: [
    "bunny-meadow",
    "logic-forest",
    "robot-lab",
    "data-desert",
    "ai-island",
    "ml-lab",
    "code-city",
    "inventor-island",
  ],
};

export const programs: ProgramFixture[] = [foundations];
