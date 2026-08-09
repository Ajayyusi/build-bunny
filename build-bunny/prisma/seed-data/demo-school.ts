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
  xpTotal: number;
  starsTotal: number;
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
 * 16 students, 8 per class — a deliberate spread of progress states so every
 * dashboard view has something honest to show: top performers with streaks,
 * mid-pack, a long-inactive student (Adam B., 3 weeks — future needs-attention
 * signal), and three completely fresh accounts that never signed in.
 */
export const STUDENTS: StudentSeed[] = [
  // ── Grade 3A (Sara Haddad) ──
  {
    firstName: "Aisha", lastInitial: "K", username: "aisha", studentIdentifier: "DEMO-1001",
    className: "Grade 3A", grade: 3, password: "star-bunny-31",
    progress: { xpTotal: 840, starsTotal: 27, streakCurrent: 9, streakBest: 9, lastActiveDaysAgo: 0 },
    loginTrailDays: 5,
  },
  {
    firstName: "Mohammed", lastInitial: "R", username: "mohammed", studentIdentifier: "DEMO-1002",
    className: "Grade 3A", grade: 3, password: "mango-kite-52",
    progress: { xpTotal: 610, starsTotal: 20, streakCurrent: 4, streakBest: 7, lastActiveDaysAgo: 1 },
    loginTrailDays: 4,
  },
  {
    firstName: "Layla", lastInitial: "H", username: "layla", studentIdentifier: "DEMO-1003",
    className: "Grade 3A", grade: 3, password: "coral-frog-18",
    progress: { xpTotal: 455, starsTotal: 15, streakCurrent: 3, streakBest: 5, lastActiveDaysAgo: 1 },
    loginTrailDays: 3,
  },
  {
    firstName: "Yousef", lastInitial: "A", username: "yousef", studentIdentifier: "DEMO-1004",
    className: "Grade 3A", grade: 3, password: "tiger-cloud-74",
    progress: { xpTotal: 320, starsTotal: 11, streakCurrent: 2, streakBest: 4, lastActiveDaysAgo: 2 },
  },
  {
    firstName: "Fatima", lastInitial: "S", username: "fatima", studentIdentifier: "DEMO-1005",
    className: "Grade 3A", grade: 3, password: "honey-daisy-26",
    progress: { xpTotal: 180, starsTotal: 6, streakCurrent: 0, streakBest: 3, lastActiveDaysAgo: 5 },
  },
  {
    firstName: "Zayed", lastInitial: "M", username: "zayed", studentIdentifier: "DEMO-1006",
    className: "Grade 3A", grade: 3, password: "eagle-river-63",
    progress: { xpTotal: 95, starsTotal: 3, streakCurrent: 1, streakBest: 2, lastActiveDaysAgo: 3 },
  },
  {
    firstName: "Mariam", lastInitial: "T", username: "mariam", studentIdentifier: "DEMO-1007",
    className: "Grade 3A", grade: 3, password: "jelly-panda-49",
    progress: { xpTotal: 0, starsTotal: 0, streakCurrent: 0, streakBest: 0, lastActiveDaysAgo: null },
  },
  {
    // Not banned, simply gone quiet for 3 weeks — the needs-attention demo case.
    firstName: "Adam", lastInitial: "B", username: "adam", studentIdentifier: "DEMO-1008",
    className: "Grade 3A", grade: 3, password: "acorn-whale-85",
    progress: { xpTotal: 240, starsTotal: 8, streakCurrent: 0, streakBest: 6, lastActiveDaysAgo: 21 },
  },
  // ── Grade 4A (Omar Farouk) ──
  {
    firstName: "Noor", lastInitial: "E", username: "noor", studentIdentifier: "DEMO-1009",
    className: "Grade 4A", grade: 4, password: "violet-nest-37",
    progress: { xpTotal: 720, starsTotal: 24, streakCurrent: 7, streakBest: 8, lastActiveDaysAgo: 0 },
    loginTrailDays: 5,
  },
  {
    firstName: "Hamdan", lastInitial: "S", username: "hamdan", studentIdentifier: "DEMO-1010",
    className: "Grade 4A", grade: 4, password: "breeze-lemon-91",
    progress: { xpTotal: 530, starsTotal: 17, streakCurrent: 5, streakBest: 5, lastActiveDaysAgo: 1 },
    loginTrailDays: 4,
  },
  {
    firstName: "Hessa", lastInitial: "A", username: "hessa", studentIdentifier: "DEMO-1011",
    className: "Grade 4A", grade: 4, password: "olive-quest-24",
    progress: { xpTotal: 380, starsTotal: 13, streakCurrent: 2, streakBest: 6, lastActiveDaysAgo: 2 },
  },
  {
    firstName: "Rashid", lastInitial: "K", username: "rashid", studentIdentifier: "DEMO-1012",
    className: "Grade 4A", grade: 4, password: "ember-grape-58",
    progress: { xpTotal: 265, starsTotal: 9, streakCurrent: 1, streakBest: 3, lastActiveDaysAgo: 4 },
  },
  {
    firstName: "Salama", lastInitial: "M", username: "salama", studentIdentifier: "DEMO-1013",
    className: "Grade 4A", grade: 4, password: "fern-island-42",
    progress: { xpTotal: 140, starsTotal: 5, streakCurrent: 0, streakBest: 2, lastActiveDaysAgo: 7 },
  },
  {
    firstName: "Tariq", lastInitial: "J", username: "tariq", studentIdentifier: "DEMO-1014",
    className: "Grade 4A", grade: 4, password: "glow-zebra-16",
    progress: { xpTotal: 60, starsTotal: 2, streakCurrent: 0, streakBest: 1, lastActiveDaysAgo: 12 },
  },
  {
    firstName: "Amna", lastInitial: "F", username: "amna", studentIdentifier: "DEMO-1015",
    className: "Grade 4A", grade: 4, password: "dune-apple-77",
    progress: { xpTotal: 0, starsTotal: 0, streakCurrent: 0, streakBest: 0, lastActiveDaysAgo: null },
  },
  {
    firstName: "Khalifa", lastInitial: "N", username: "khalifa", studentIdentifier: "DEMO-1016",
    className: "Grade 4A", grade: 4, password: "yoyo-cloud-29",
    progress: { xpTotal: 0, starsTotal: 0, streakCurrent: 0, streakBest: 0, lastActiveDaysAgo: null },
  },
];

export function studentDisplayName(s: StudentSeed): string {
  return `${s.firstName} ${s.lastInitial}.`;
}
