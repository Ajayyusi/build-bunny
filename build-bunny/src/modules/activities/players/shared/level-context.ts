"use client";

import { createContext, useContext } from "react";

import type { ExploreLevelContext } from "../../types";

/**
 * Which level is being played, for shared pieces (the success card's
 * reflection row and quick check) that sit below every player without each
 * player having to thread them through its own props.
 */
export interface LevelContextValue {
  levelId: string;
  explore?: ExploreLevelContext;
}

export const LevelContext = createContext<LevelContextValue | null>(null);

export function useLevelContext(): LevelContextValue | null {
  return useContext(LevelContext);
}
