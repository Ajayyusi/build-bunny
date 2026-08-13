/**
 * Fixture data for the NITAQ Demo School seed (plan §0.1-25) — pure data, no
 * imports from src/. Passwords are deterministic on purpose: this is a demo
 * environment handed to sales/QA, and the seed prints + writes them to the
 * gitignored prisma/seed-output/credentials.md.
 */

export const SEED_ACTOR = { userId: "seed-script", role: "SYSTEM" } as const;

export const DEMO_SCHOOL = {
  name: "NITAQ Demo School",
  slug: "nitaq-demo",
  code: "DEMO",
  timezone: "Asia/Dubai",
} as const;

export const DEMO_LICENCE = {
  seats: 120,
  startsAt: new Date("2026-08-01T00:00:00.000Z"),
  expiresAt: new Date("2027-07-31T00:00:00.000Z"),
} as const;

export const DEMO_ACADEMIC_YEAR = {
  name: "2026–2027",
  startsAt: new Date("2026-08-24T00:00:00.000Z"),
  endsAt: new Date("2027-07-02T00:00:00.000Z"),
  isActive: true,
} as const;

export interface PlatformStaffSeed {
  role: "SUPER_ADMIN" | "NITAQ_ADMIN";
  email: string;
  displayName: string;
  password: string;
}

export const PLATFORM_STAFF: PlatformStaffSeed[] = [
  {
    role: "SUPER_ADMIN",
    email: "super@nitaq.demo",
    displayName: "Faisal Al Nuaimi",
    password: "SuperDemo-2026",
  },
  {
    role: "NITAQ_ADMIN",
    email: "admin@nitaq.demo",
    displayName: "Reem Al Shamsi",
    password: "AdminDemo-2026",
  },
];

export const SCHOOL_ADMIN = {
  email: "principal@nitaqdemo.school",
  displayName: "Huda Al Mansoori",
  password: "SchoolDemo-2026",
} as const;

export type DemoClassName = "Grade 3A" | "Grade 4A";

export interface TeacherSeed {
  email: string;
  displayName: string;
  title: string;
  password: string;
  className: DemoClassName;
}

export const TEACHERS: TeacherSeed[] = [
  {
    email: "sara@nitaqdemo.school",
    displayName: "Sara Haddad",
    title: "Grade 3 – Computing",
    password: "TeachDemo-2026",
    className: "Grade 3A",
  },
  {
    email: "omar@nitaqdemo.school",
    displayName: "Omar Farouk",
    title: "Grade 4 – Computing",
    password: "TeachDemo-2026",
    className: "Grade 4A",
  },
];

export const CLASSES: { name: DemoClassName; grade: number }[] = [
  { name: "Grade 3A", grade: 3 },
  { name: "Grade 4A", grade: 4 },
];

export interface StudentProgressSeed {
  /**
   * Stars earned per COMPLETED level, in global program order (Bunny Meadow
   * levels 1–6, then Logic Forest levels 7–12). Length = how far the student
   * got; [] = fresh (never played). xpTotal/starsTotal are NOT seeded raw any
   * more — the seed derives them from these per-level completions, so every
   * cache is provably consistent with real StudentProgress rows.
   *
   * A 0 is a real value, not a gap: Bunny Meadow's 5th entry is the
   * learn-repeat Learn step, which awards no stars by design
   * (docs/build-bunny/LEARN-STEP-SPEC.md). Everything else is 2–3.
   */
  completedStars: number[];
  streakCurrent: number;
  streakBest: number;
  /**
   * Days before seed time for lastActiveDate; null = never active (fresh).
   * When loginTrailDays is set, the trail's most recent school day wins so
   * lastActiveDate and the LearningEvent stream stay consistent.
   */
  lastActiveDaysAgo: number | null;
}

export interface StudentSeed {
  firstName: string;
  lastInitial: string;
  /** Per-school username (lowercase first name; add a letter on collision). */
  username: string;
  studentIdentifier: string;
  className: DemoClassName;
  grade: number;
  password: string;
  progress: StudentProgressSeed;
  /** STUDENT_LOGIN events on the N most recent school days (Mon–Fri, UAE). */
  loginTrailDays?: number;
}

/**
 * 16 students, 8 per class — a deliberate spread of curriculum states so every
 * surface has something honest to show. World layout: Bunny Meadow = 6 levels,
 * Logic Forest = 9, Robot Lab = 7, AI Island = 6, Data Desert = 6,
 * ML Lab = 3 — 37 in all, five of them CONCEPT_CARDS Learn steps that score
 * no stars, plus the M4 CODE_PREDICTION and SEQUENCING levels. The four
 * phase-G graft levels (ai-island/seeing-and-secrets and
 * data-desert/lines-in-the-sand) sit in unlockRule OPEN modules, so every
 * student — even the fresh ones — has them UNLOCKED without any coding
 * progress; none of the arrays below records a completion there, keeping
 * them appended strictly past every student's frontier:
 *  - 3 fresh accounts that never played (only the first level gets unlocked);
 *  - 6 mid-World-1 (1–4 levels done, next one unlocked);
 *  - 4 finished World 1 and into World 2 (7–8 levels done);
 *  - 3 advanced — Aisha K. has all 22 up to AI Island, the certificate
 *    candidate (genuinely passes — not just completes — every level, so the
 *    real issuance path awards her the world certificates; m4-contracts).
 *    She has to be that far along for the AI level to be reachable at all:
 *    worlds unlock in order, so without one student through Robot Lab,
 *    AI Island cannot be opened by anyone in a demo.
 * Adam B. (4 levels, silent for 3 weeks) stays the needs-attention demo case —
 * and now sits with the Learn step as his next unlocked node.
 */
export const STUDENTS: StudentSeed[] = [
  // ── Grade 3A (Sara Haddad) ──
  {
    firstName: "Aisha", lastInitial: "K", username: "aisha", studentIdentifier: "DEMO-1001",
    className: "Grade 3A", grade: 3, password: "star-bunny-31",
    // Three worlds plus most of AI Island: 6 Bunny Meadow + 9 Logic Forest +
    // 7 Robot Lab + 3 AI Island = 25. She has to reach this far or the AI
    // world is invisible in a demo — worlds unlock in order, so one student
    // must clear three worlds before anyone can even see the fourth. Every
    // scored level is ≥2 stars (a genuine PASS, never just PARTIAL) because
    // the certificate issuance path gates on that. The 0s are Learn steps,
    // which have no stars to earn: index 4 learn-repeat, 6 learn-loop-body,
    // 9 learn-if, 11 learn-repeat-until, 17 learn-if-else.
    //
    // This array is POSITIONAL along the flattened trail (world → module →
    // level order), so inserting a level anywhere before the end silently
    // rewrites her history. New levels are appended, never spliced in.
    progress: {
      completedStars: [
        3, 3, 3, 3, 0, 3, // Bunny Meadow
        0, 3, 3, 0, 2, 0, 3, 3, 3, // Logic Forest
        3, 3, 0, 3, 3, 3, 3, // Robot Lab
        // AI Island, deliberately one short: nothing-rules-alone stays her
        // live frontier so a demo always has an unplayed level to open.
        3, 3, 2,
      ],
      streakCurrent: 9, streakBest: 9, lastActiveDaysAgo: 0,
    },
    loginTrailDays: 5,
  },
  {
    firstName: "Mohammed", lastInitial: "R", username: "mohammed", studentIdentifier: "DEMO-1002",
    className: "Grade 3A", grade: 3, password: "mango-kite-52",
    progress: { completedStars: [3, 3, 2, 3, 0, 3, 2, 3, 3], streakCurrent: 4, streakBest: 7, lastActiveDaysAgo: 1 },
    loginTrailDays: 4,
  },
  {
    firstName: "Layla", lastInitial: "H", username: "layla", studentIdentifier: "DEMO-1003",
    className: "Grade 3A", grade: 3, password: "coral-frog-18",
    progress: { completedStars: [3, 2, 3, 2, 0, 3, 2], streakCurrent: 3, streakBest: 5, lastActiveDaysAgo: 1 },
    loginTrailDays: 3,
  },
  {
    firstName: "Yousef", lastInitial: "A", username: "yousef", studentIdentifier: "DEMO-1004",
    className: "Grade 3A", grade: 3, password: "tiger-cloud-74",
    progress: { completedStars: [2, 2, 3, 2, 0, 3, 2], streakCurrent: 2, streakBest: 4, lastActiveDaysAgo: 2 },
  },
  {
    firstName: "Fatima", lastInitial: "S", username: "fatima", studentIdentifier: "DEMO-1005",
    className: "Grade 3A", grade: 3, password: "honey-daisy-26",
    progress: { completedStars: [3, 2, 2], streakCurrent: 0, streakBest: 3, lastActiveDaysAgo: 5 },
  },
  {
    firstName: "Zayed", lastInitial: "M", username: "zayed", studentIdentifier: "DEMO-1006",
    className: "Grade 3A", grade: 3, password: "eagle-river-63",
    progress: { completedStars: [2, 3], streakCurrent: 1, streakBest: 2, lastActiveDaysAgo: 3 },
  },
  {
    firstName: "Mariam", lastInitial: "T", username: "mariam", studentIdentifier: "DEMO-1007",
    className: "Grade 3A", grade: 3, password: "jelly-panda-49",
    progress: { completedStars: [], streakCurrent: 0, streakBest: 0, lastActiveDaysAgo: null },
  },
  {
    // Not banned, simply gone quiet for 3 weeks — the needs-attention demo case.
    firstName: "Adam", lastInitial: "B", username: "adam", studentIdentifier: "DEMO-1008",
    className: "Grade 3A", grade: 3, password: "acorn-whale-85",
    progress: { completedStars: [2, 3, 2, 2], streakCurrent: 0, streakBest: 6, lastActiveDaysAgo: 21 },
  },
  // ── Grade 4A (Omar Farouk) ──
  {
    firstName: "Noor", lastInitial: "E", username: "noor", studentIdentifier: "DEMO-1009",
    className: "Grade 4A", grade: 4, password: "violet-nest-37",
    progress: { completedStars: [3, 3, 3, 3, 0, 2, 3, 3, 2, 3], streakCurrent: 7, streakBest: 8, lastActiveDaysAgo: 0 },
    loginTrailDays: 5,
  },
  {
    firstName: "Hamdan", lastInitial: "S", username: "hamdan", studentIdentifier: "DEMO-1010",
    className: "Grade 4A", grade: 4, password: "breeze-lemon-91",
    progress: { completedStars: [3, 2, 3, 3, 0, 2, 3, 2], streakCurrent: 5, streakBest: 5, lastActiveDaysAgo: 1 },
    loginTrailDays: 4,
  },
  {
    firstName: "Hessa", lastInitial: "A", username: "hessa", studentIdentifier: "DEMO-1011",
    className: "Grade 4A", grade: 4, password: "olive-quest-24",
    progress: { completedStars: [2, 3, 2, 3, 0, 2, 3], streakCurrent: 2, streakBest: 6, lastActiveDaysAgo: 2 },
  },
  {
    firstName: "Rashid", lastInitial: "K", username: "rashid", studentIdentifier: "DEMO-1012",
    className: "Grade 4A", grade: 4, password: "ember-grape-58",
    progress: { completedStars: [3, 2, 3, 2], streakCurrent: 1, streakBest: 3, lastActiveDaysAgo: 4 },
  },
  {
    firstName: "Salama", lastInitial: "M", username: "salama", studentIdentifier: "DEMO-1013",
    className: "Grade 4A", grade: 4, password: "fern-island-42",
    progress: { completedStars: [2, 2, 3], streakCurrent: 0, streakBest: 2, lastActiveDaysAgo: 7 },
  },
  {
    firstName: "Tariq", lastInitial: "J", username: "tariq", studentIdentifier: "DEMO-1014",
    className: "Grade 4A", grade: 4, password: "glow-zebra-16",
    progress: { completedStars: [2], streakCurrent: 0, streakBest: 1, lastActiveDaysAgo: 12 },
  },
  {
    firstName: "Amna", lastInitial: "F", username: "amna", studentIdentifier: "DEMO-1015",
    className: "Grade 4A", grade: 4, password: "dune-apple-77",
    progress: { completedStars: [], streakCurrent: 0, streakBest: 0, lastActiveDaysAgo: null },
  },
  {
    firstName: "Khalifa", lastInitial: "N", username: "khalifa", studentIdentifier: "DEMO-1016",
    className: "Grade 4A", grade: 4, password: "yoyo-cloud-29",
    progress: { completedStars: [], streakCurrent: 0, streakBest: 0, lastActiveDaysAgo: null },
  },
];

export function studentDisplayName(s: StudentSeed): string {
  return `${s.firstName} ${s.lastInitial}.`;
}

/** Narrative bucket for the credentials file's Demo state section. */
export type DemoStage = "fresh" | "mid-world-1" | "into-world-2" | "advanced";

export function demoStage(s: StudentSeed): DemoStage {
  const n = s.progress.completedStars.length;
  if (n === 0) return "fresh";
  if (n <= 4) return "mid-world-1";
  if (n <= 7) return "into-world-2";
  return "advanced";
}
