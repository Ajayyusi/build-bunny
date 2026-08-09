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
   * levels 1–5, then Logic Forest levels 6–10). Length = how far the student
   * got; [] = fresh (never played). xpTotal/starsTotal are NOT seeded raw any
   * more — the seed derives them from these per-level completions, so every
   * cache is provably consistent with real StudentProgress rows.
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
 * surface has something honest to show (world layout: Bunny Meadow = 5
 * levels, Logic Forest = 6 levels incl. the CODE_PREDICTION level added in
 * M4's activity-engines wave, 11 total for both worlds):
 *  - 3 fresh accounts that never played (only the first level gets unlocked);
 *  - 6 mid-World-1 (1–4 levels done, next one unlocked);
 *  - 4 finished World 1 and into World 2 (6–7 levels done);
 *  - 3 advanced (8–11 done) — Aisha K. has all 11, the certificate candidate
 *    (genuinely passes — not just completes — every level of both worlds,
 *    so the real issuance path awards her both certificates; m4-contracts).
 * Adam B. (4 levels, silent for 3 weeks) stays the needs-attention demo case.
 */
export const STUDENTS: StudentSeed[] = [
  // ── Grade 3A (Sara Haddad) ──
  {
    firstName: "Aisha", lastInitial: "K", username: "aisha", studentIdentifier: "DEMO-1001",
    className: "Grade 3A", grade: 3, password: "star-bunny-31",
    // All 5 Bunny Meadow + all 6 Logic Forest levels, every one at ≥2 stars
    // (a genuine PASS, never just PARTIAL) — the certificate task's gate.
    progress: { completedStars: [3, 3, 3, 3, 3, 3, 2, 3, 3, 3, 3], streakCurrent: 9, streakBest: 9, lastActiveDaysAgo: 0 },
    loginTrailDays: 5,
  },
  {
    firstName: "Mohammed", lastInitial: "R", username: "mohammed", studentIdentifier: "DEMO-1002",
    className: "Grade 3A", grade: 3, password: "mango-kite-52",
    progress: { completedStars: [3, 3, 2, 3, 3, 2, 3, 3], streakCurrent: 4, streakBest: 7, lastActiveDaysAgo: 1 },
    loginTrailDays: 4,
  },
  {
    firstName: "Layla", lastInitial: "H", username: "layla", studentIdentifier: "DEMO-1003",
    className: "Grade 3A", grade: 3, password: "coral-frog-18",
    progress: { completedStars: [3, 2, 3, 2, 3, 2], streakCurrent: 3, streakBest: 5, lastActiveDaysAgo: 1 },
    loginTrailDays: 3,
  },
  {
    firstName: "Yousef", lastInitial: "A", username: "yousef", studentIdentifier: "DEMO-1004",
    className: "Grade 3A", grade: 3, password: "tiger-cloud-74",
    progress: { completedStars: [2, 2, 3, 2, 3, 2], streakCurrent: 2, streakBest: 4, lastActiveDaysAgo: 2 },
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
    progress: { completedStars: [3, 3, 3, 3, 2, 3, 3, 2, 3], streakCurrent: 7, streakBest: 8, lastActiveDaysAgo: 0 },
    loginTrailDays: 5,
  },
  {
    firstName: "Hamdan", lastInitial: "S", username: "hamdan", studentIdentifier: "DEMO-1010",
    className: "Grade 4A", grade: 4, password: "breeze-lemon-91",
    progress: { completedStars: [3, 2, 3, 3, 2, 3, 2], streakCurrent: 5, streakBest: 5, lastActiveDaysAgo: 1 },
    loginTrailDays: 4,
  },
  {
    firstName: "Hessa", lastInitial: "A", username: "hessa", studentIdentifier: "DEMO-1011",
    className: "Grade 4A", grade: 4, password: "olive-quest-24",
    progress: { completedStars: [2, 3, 2, 3, 2, 3], streakCurrent: 2, streakBest: 6, lastActiveDaysAgo: 2 },
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
