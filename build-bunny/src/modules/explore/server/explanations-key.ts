import "server-only";

/**
 * Which phrases in the explanation builder hold up (explore/explanations.ts).
 * Kept on the server so the page can't give it away; used only to show a
 * teacher how sound a child's sentence is, never to mark the child.
 */
export const SOUND_PARTS: ReadonlySet<string> = new Set([
  "examples.what2", "examples.why1", "examples.next3",
  "rules.what1", "rules.why3", "rules.next2",
  "vision.what3", "vision.why1", "vision.next2",
  "fairness.what1", "fairness.why2", "fairness.next1",
  "checking.what2", "checking.why3", "checking.next1",
  "prediction.what1", "prediction.why2", "prediction.next3",
  "people.what3", "people.why1", "people.next2",
]);

export function soundCount(parts: readonly string[]): number {
  return parts.filter((part) => SOUND_PARTS.has(part)).length;
}
