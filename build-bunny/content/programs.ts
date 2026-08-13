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
  // AI Island sits ahead of Data Desert. Every Data Desert level assumes the
  // child already knows what teaching by example means — the desert is about
  // structure that exists in data BEFORE anyone labels it, and that only lands
  // as a contrast once labelling is familiar.
  //
  // Safe to reorder now rather than later: both worlds sit past every demo
  // student's frontier, so no recorded progress moves. (completedStars indexes
  // the flattened trail in world → module → level order, so reordering worlds
  // a student HAS reached would silently rewrite their history.)
  worlds: [
    "bunny-meadow",
    "logic-forest",
    "robot-lab",
    "ai-island",
    "data-desert",
    "ml-lab",
    "code-city",
    "inventor-island",
  ],
};

export const programs: ProgramFixture[] = [foundations];
