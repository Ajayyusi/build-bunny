"use client";

import { WorldMusic } from "@/modules/audio/scene";

import type { ActivityPlayerProps } from "../types";
import { getActivityPlayer } from "./registry";
import { useAttemptOutbox } from "./shared/attempt-outbox";
import { LevelContext } from "./shared/level-context";

interface Props extends ActivityPlayerProps {
  activityType: string;
}

/**
 * Client entry point for the player registry.
 *
 * A Server Component may RENDER a client component but may not CALL a function
 * that lives behind a "use client" boundary — doing so throws at request time
 * ("Attempted to call getActivityPlayer() from the server"). So the lookup
 * happens here, on the client, and the page just renders this. Whether a level
 * is playable at all is decided server-side via getActivityEngine(), which is
 * the server half of the same registry.
 */
export function ActivityPlayer({ activityType, ...props }: Props) {
  // Runs saved on this device while offline are sent as soon as a level
  // opens, or the moment the connection comes back.
  useAttemptOutbox(props.intro.playerKey);
  const Player = getActivityPlayer(activityType);
  if (!Player) return null;
  return (
    <>
      {/* Each world has its own tune while its levels are being played. */}
      <WorldMusic theme={props.intro.worldTheme} />
      <LevelContext.Provider value={{ levelId: props.intro.levelId }}>
        <Player {...props} />
      </LevelContext.Provider>
    </>
  );
}
