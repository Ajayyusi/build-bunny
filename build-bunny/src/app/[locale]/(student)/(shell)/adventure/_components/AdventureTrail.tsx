"use client";

import { useState } from "react";

import styles from "./adventure.module.css";
import { LevelIntroSheet } from "./LevelIntroSheet";
import { WorldIntro } from "./WorldIntro";
import { WorldSegment } from "./WorldSegment";
import type { TrailLevelVM, TrailWorldVM } from "./types";

interface AdventureTrailProps {
  worlds: TrailWorldVM[];
  /** Keys the per-device "story seen" memory (shared classroom tablets). */
  userId: string;
}

/**
 * The path: world cards hanging off a dashed spine, alternating sides on
 * large screens, plus the shared level-intro sheet and the world story
 * scene (auto-shown once when a world opens, replayable from its card).
 * Only selection state lives here — everything else arrives resolved from
 * the server.
 */
export function AdventureTrail({ worlds, userId }: AdventureTrailProps) {
  const [selected, setSelected] = useState<TrailLevelVM | null>(null);
  const [replay, setReplay] = useState<string | null>(null);

  return (
    <>
      <ol className={`${styles.spine} flex flex-col gap-8`}>
        {worlds.map((world, index) => (
          <WorldSegment
            key={world.id}
            world={world}
            index={index}
            onOpenLevel={setSelected}
            onReplayStory={() => setReplay(world.slug)}
          />
        ))}
      </ol>
      {selected ? (
        <LevelIntroSheet level={selected} onClose={() => setSelected(null)} />
      ) : null}
      <WorldIntro
        worlds={worlds}
        userId={userId}
        replaySlug={replay}
        onReplayDone={() => setReplay(null)}
      />
    </>
  );
}
