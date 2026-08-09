/**
 * Serializable view-model for the adventure trail. The page (server) resolves
 * localized text and fetches level intros up front, so the client components
 * never see LocalizedText objects, payloads or hints — only display strings
 * (answer-bearing content stays server-held, m2 §content rules).
 */

export type TrailLevelState =
  | "LOCKED"
  | "UNLOCKED"
  | "IN_PROGRESS"
  | "COMPLETED";

export interface TrailIntroVM {
  title: string;
  story: string;
  objective: string;
  instructions: string;
  /** Raw difficulty key (EASY | MEDIUM | HARD) — labelled via messages. */
  difficulty: string;
  estimatedMinutes: number;
  stars: number;
  maxStars: number;
}

export interface TrailLevelVM {
  id: string;
  /** 1-based position within the world, counted across its modules. */
  number: number;
  title: string;
  state: TrailLevelState;
  stars: number;
  maxStars: number;
  current: boolean;
  /** Module name shown as a waypoint label on the module's first level
   *  (only when the world has more than one module). */
  moduleLabel: string | null;
  /** Null while locked — locked nodes never open the sheet. */
  intro: TrailIntroVM | null;
  /** Previous level number for the locked hint; null = first level of the
   *  world, where the prerequisite is the previous world. */
  prereqNumber: number | null;
}

export interface TrailWorldVM {
  id: string;
  theme: string;
  name: string;
  tagline: string | null;
  state: "LOCKED" | "AVAILABLE" | "CURRENT" | "COMPLETED";
  completedLevels: number;
  totalLevels: number;
  starsEarned: number;
  totalStars: number;
  levels: TrailLevelVM[];
}

export interface HorizonWorldVM {
  id: string;
  theme: string;
  name: string;
  tagline: string | null;
}
