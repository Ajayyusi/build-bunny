"use client";

import { useState } from "react";

import { LevelIntroSheet } from "./LevelIntroSheet";
import { WorldSegment } from "./WorldSegment";
import type { TrailLevelVM, TrailWorldVM } from "./types";

interface AdventureTrailProps {
  worlds: TrailWorldVM[];
}

/**
 * The scrolling trail: world segments stacked flush into one continuous
 * strip, plus the shared level-intro sheet. Only selection state lives here —
 * everything else arrives resolved from the server.
 */
export function AdventureTrail({ worlds }: AdventureTrailProps) {
  const [selected, setSelected] = useState<TrailLevelVM | null>(null);

  return (
    <>
      {worlds.map((world) => (
        <WorldSegment key={world.id} world={world} onOpenLevel={setSelected} />
      ))}
      {selected ? (
        <LevelIntroSheet level={selected} onClose={() => setSelected(null)} />
      ) : null}
    </>
  );
}
