"use client";

import { useState } from "react";

import styles from "./adventure.module.css";
import { LevelIntroSheet } from "./LevelIntroSheet";
import { WorldSegment } from "./WorldSegment";
import type { TrailLevelVM, TrailWorldVM } from "./types";

interface AdventureTrailProps {
  worlds: TrailWorldVM[];
}

/**
 * The path: world cards hanging off a dashed spine, alternating sides on
 * large screens, plus the shared level-intro sheet. Only selection state
 * lives here — everything else arrives resolved from the server.
 */
export function AdventureTrail({ worlds }: AdventureTrailProps) {
  const [selected, setSelected] = useState<TrailLevelVM | null>(null);

  return (
    <>
      <ol className={`${styles.spine} flex flex-col gap-8`}>
        {worlds.map((world, index) => (
          <WorldSegment
            key={world.id}
            world={world}
            index={index}
            onOpenLevel={setSelected}
          />
        ))}
      </ol>
      {selected ? (
        <LevelIntroSheet level={selected} onClose={() => setSelected(null)} />
      ) : null}
    </>
  );
}
