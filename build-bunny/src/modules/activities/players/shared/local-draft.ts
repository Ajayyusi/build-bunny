/**
 * This device's mirror of a child's in-progress blocks.
 *
 * The server draft is the durable copy, but it is written on a two-second
 * debounce; the mirror is written on every change, so after an interruption
 * (tab closed, tablet asleep, Wi-Fi gone) the level reopens exactly as it
 * was left. Keyed by the child AND the level: a shared classroom tablet
 * must never hand one child another child's program.
 *
 * Pure functions over localStorage; every call survives a private-mode or
 * quota failure by doing nothing.
 */

export interface DraftKey {
  playerKey: string;
  levelId: string;
}

const key = ({ playerKey, levelId }: DraftKey) => `bb:draft:v1:${playerKey}:${levelId}`;

export function readLocalDraft(draft: DraftKey): unknown | null {
  try {
    const raw = window.localStorage.getItem(key(draft));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { json?: unknown };
    return parsed && typeof parsed === "object" && "json" in parsed ? (parsed.json ?? null) : null;
  } catch {
    return null;
  }
}

export function writeLocalDraft(draft: DraftKey, json: unknown): void {
  try {
    window.localStorage.setItem(key(draft), JSON.stringify({ json, at: Date.now() }));
  } catch {
    // Quota or private mode — the server draft still exists.
  }
}

export function clearLocalDraft(draft: DraftKey): void {
  try {
    window.localStorage.removeItem(key(draft));
  } catch {
    // Nothing to do.
  }
}
