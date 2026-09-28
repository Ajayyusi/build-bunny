import { resolveNextSceneIndex, type AiEthicsActivityPayload } from "../types";

export type PathStep = { sceneId: string; choiceId: string; tried?: string[] };

/**
 * Rebuild a branching story in progress from an autosaved draft, walking it
 * with the SAME rule the grader uses (resolveNextSceneIndex from scene 0):
 * each step must sit on the scene the previous one led to. The walk stops at
 * the first step that doesn't (an edited level, a stale draft), so the child
 * resumes where the story really is. A finished story comes back finished —
 * resuming it on its last scene used to add a step past the end, which the
 * grader rejects, so the story could never be saved.
 */
export function restoreEthicsDraft(
  draft: unknown,
  payload: Pick<AiEthicsActivityPayload, "scenes">,
): { sceneIndex: number; path: PathStep[]; finished: boolean } {
  const empty = { sceneIndex: 0, path: [], finished: false };
  if (draft === null || typeof draft !== "object") return empty;
  const source = draft as { path?: unknown };
  if (!Array.isArray(source.path)) return empty;

  const path: PathStep[] = [];
  let index = 0;
  for (const step of source.path) {
    const scene = payload.scenes[index];
    if (!scene || typeof step !== "object" || step === null) break;
    const { sceneId, choiceId, tried } = step as { sceneId?: unknown; choiceId?: unknown; tried?: unknown };
    if (sceneId !== scene.id || typeof choiceId !== "string") break;
    const choice = scene.choices.find((c) => c.id === choiceId);
    if (!choice) break;
    // Earlier tries survive only if they are still this scene's choices.
    const kept = Array.isArray(tried)
      ? [...new Set(tried.filter((id): id is string => typeof id === "string" && id !== choiceId && scene.choices.some((c) => c.id === id)))]
      : [];
    path.push(kept.length > 0 ? { sceneId: scene.id, choiceId, tried: kept } : { sceneId: scene.id, choiceId });
    index = resolveNextSceneIndex(payload.scenes, index, choice.next);
  }
  const finished = index >= payload.scenes.length;
  return { sceneIndex: finished ? payload.scenes.length - 1 : index, path, finished };
}
