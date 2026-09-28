import type { AdventureState } from "@/modules/learning/server/adventure";

export interface RouteProgress {
  done: number;
  total: number;
}

/**
 * Levels finished out of levels available, per route (AI worlds and Coding
 * Lab), over the worlds a child can actually play — roadmap ("horizon")
 * worlds and empty ones don't count towards either.
 */
export function routeProgress(state: Pick<AdventureState, "worlds">): Record<"ai" | "coding", RouteProgress> {
  const result = { ai: { done: 0, total: 0 }, coding: { done: 0, total: 0 } };
  for (const world of state.worlds) {
    if (world.horizon || world.totalLevels === 0) continue;
    result[world.kind].done += world.completedLevels;
    result[world.kind].total += world.totalLevels;
  }
  return result;
}

export interface LandingNotices {
  /** Unread messages from a teacher. */
  messages: number;
  /** Assignments still to finish (closed ones are never listed). */
  toDo: number;
}

/**
 * What a teacher sent that the child hasn't dealt with yet, for the notice
 * on Explore AI that leads to My Learning. Null when there is nothing, so
 * the landing shows no empty box.
 */
export function landingNotices(unreadMessages: number, assignments: readonly { done: boolean }[]): LandingNotices | null {
  const toDo = assignments.filter((assignment) => !assignment.done).length;
  return unreadMessages > 0 || toDo > 0 ? { messages: unreadMessages, toDo } : null;
}
