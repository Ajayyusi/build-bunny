"use client";

import type { ActivityPlayerProps } from "../types";
import { getActivityPlayer } from "./registry";

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
  const Player = getActivityPlayer(activityType);
  if (!Player) return null;
  return <Player {...props} />;
}
