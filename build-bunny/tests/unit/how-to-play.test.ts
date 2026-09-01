import { describe, expect, it } from "vitest";

import { ACTIVITY_PLAYERS } from "@/modules/activities/players/registry";

/**
 * Every activity engine has to SHOW a child how to play, not just describe
 * it.
 *
 * The three coding worlds shipped for months explaining a Blockly workspace
 * to Grade 3 readers in a paragraph, while the AI worlds authored later all
 * had animations — nobody noticed because nothing failed. The gap was only
 * visible by listing all 37 levels next to their activity type.
 *
 * So: a registered player must hand the shared briefing a `howScene`, and
 * every scene must carry a prefers-reduced-motion escape. Both are source
 * checks rather than renders, because what they defend against is an engine
 * being ADDED without one — which no render of the existing engines can see.
 */

const playerSources = import.meta.glob<string>(
  "../../src/modules/activities/players/*Player.tsx",
  { query: "?raw", import: "default", eager: true },
);
const sceneSources = import.meta.glob<string>(
  ["../../src/modules/activities/players/**/*Scene.tsx", "../../src/modules/ai/lab/players/*Scene.tsx"],
  { query: "?raw", import: "default", eager: true },
);

function sourceFor(sources: Record<string, string>, basename: string): string {
  const hit = Object.entries(sources).find(([path]) => path.endsWith(`/${basename}.tsx`));
  expect(hit, `no source found for ${basename}.tsx`).toBeDefined();
  return hit![1];
}

describe("every activity engine shows how to play", () => {
  it("registers a player for each shipped activity type", () => {
    expect(Object.keys(ACTIVITY_PLAYERS).length).toBeGreaterThanOrEqual(9);
  });

  it("every registered player hands the briefing a howScene", () => {
    const players = Object.keys(playerSources).filter((path) => !path.endsWith("ActivityPlayer.tsx"));
    expect(players.length).toBeGreaterThanOrEqual(8);

    for (const path of players) {
      const src = playerSources[path]!;
      // TeachPlayer / GroupPlayer / AiSimPlayer brief through the 4-beat
      // Walkthrough instead; either way the child is shown the mechanic.
      const shows = src.includes("howScene={") || src.includes("<Walkthrough");
      expect(shows, `${path.split("/").pop()} neither passes howScene nor renders a Walkthrough`).toBe(
        true,
      );
    }
  });

  it("every scene degrades to a still diagram under reduced motion", () => {
    const scenes = Object.keys(sceneSources);
    expect(scenes.length).toBeGreaterThanOrEqual(7);
    for (const path of scenes) {
      const src = sceneSources[path]!;
      expect(
        src.includes("prefers-reduced-motion"),
        `${path.split("/").pop()} has no reduced-motion escape`,
      ).toBe(true);
    }
  });

  it("scenes that stand for the grid stay LTR, because grid coordinates are absolute", () => {
    // SimulationCanvas renders dir="ltr" in both locales: "move forward"
    // walks the bunny right in Arabic too. A mirrored scene would teach the
    // opposite of what the level then does.
    for (const name of ["GridScene", "LearnScene"]) {
      expect(sourceFor(sceneSources, name), `${name} must pin dir="ltr"`).toContain('dir="ltr"');
    }
  });
});
