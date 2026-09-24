"use client";

import { createContext, useContext } from "react";

/**
 * Which level is being played, for shared pieces (the success card's
 * reflection row) that sit below every player without each player having to
 * thread the id through its own props.
 */
export const LevelContext = createContext<{ levelId: string } | null>(null);

export function useLevelContext(): { levelId: string } | null {
  return useContext(LevelContext);
}
