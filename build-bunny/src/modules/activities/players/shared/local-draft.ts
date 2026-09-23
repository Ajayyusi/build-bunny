/**
 * This device's mirror of a child's in-progress blocks.
 *
 * The server draft is the durable copy, but it is written on a two-second
 * debounce; the mirror is written on every change, so after an interruption
 * (tab closed, tablet asleep, Wi-Fi gone) the level reopens exactly as it
 * was left. Keyed by the child AND the level: a shared classroom tablet
 * must never hand one child another child's program.
 *
 * Which copy wins is decided by the SERVER's draft version, never by
 * clocks (classroom tablets often have the wrong time). Each mirror
 * remembers the server version it was based on (`base`: the server's
 * draftSavedAt, or null when there was none). On reopen the mirror is used
 * only if the server still holds that same version — i.e. nothing newer
 * was saved from another tablet, and the level was not passed (a pass
 * clears the server draft) — and the mirror has edits the server lacks.
 *
 * Pure functions over localStorage; every call survives a private-mode or
 * quota failure by doing nothing.
 */

export interface DraftKey {
  playerKey: string;
  levelId: string;
}

export interface LocalDraft {
  json: unknown;
  /** The server draft version this mirror was based on (null: none). */
  base: string | null;
}

const PREFIX = "bb:draft:v2:";
const LEGACY_PREFIX = "bb:draft:v1:";
/** Mirrors kept per device; the oldest go first beyond this. */
const MAX_MIRRORS = 150;

const key = ({ playerKey, levelId }: DraftKey) => `${PREFIX}${playerKey}:${levelId}`;

export function readLocalDraft(draft: DraftKey): LocalDraft | null {
  try {
    const raw = window.localStorage.getItem(key(draft));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { json?: unknown; base?: unknown };
    if (!parsed || typeof parsed !== "object" || !("json" in parsed)) return null;
    return {
      json: parsed.json ?? null,
      base: typeof parsed.base === "string" ? parsed.base : null,
    };
  } catch {
    return null;
  }
}

export function writeLocalDraft(draft: DraftKey, json: unknown, base: string | null): void {
  try {
    window.localStorage.setItem(key(draft), JSON.stringify({ json, base, at: Date.now() }));
  } catch {
    // Quota or private mode: make room once, then give up quietly (the
    // server draft still exists).
    try {
      pruneLocalDrafts(Math.floor(MAX_MIRRORS / 2));
      window.localStorage.setItem(key(draft), JSON.stringify({ json, base, at: Date.now() }));
    } catch {
      // Nothing more to do.
    }
  }
}

/** After a successful server save: the mirror is now based on that version. */
export function setLocalDraftBase(draft: DraftKey, base: string): void {
  const current = readLocalDraft(draft);
  if (current) writeLocalDraft(draft, current.json, base);
}

export function clearLocalDraft(draft: DraftKey): void {
  try {
    window.localStorage.removeItem(key(draft));
  } catch {
    // Nothing to do.
  }
}

/**
 * Keep at most `keep` mirrors on this device (oldest removed first), and
 * drop the old unversioned format, which cannot be safely compared.
 */
export function pruneLocalDrafts(keep: number = MAX_MIRRORS): void {
  try {
    const store = window.localStorage;
    const mirrors: { k: string; at: number }[] = [];
    for (let i = 0; i < store.length; i += 1) {
      const k = store.key(i);
      if (!k) continue;
      if (k.startsWith(LEGACY_PREFIX)) {
        mirrors.push({ k, at: -1 });
      } else if (k.startsWith(PREFIX)) {
        let at = 0;
        try {
          at = Number((JSON.parse(store.getItem(k) ?? "{}") as { at?: unknown }).at) || 0;
        } catch {
          // Unreadable: treat as oldest.
        }
        mirrors.push({ k, at });
      }
    }
    const legacy = mirrors.filter((m) => m.at === -1);
    const current = mirrors.filter((m) => m.at !== -1).sort((a, b) => b.at - a.at);
    for (const m of [...legacy, ...current.slice(keep)]) store.removeItem(m.k);
  } catch {
    // Storage unavailable.
  }
}

/** JSON with object keys sorted, so key order never makes two programs "differ". */
export function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`).join(",")}}`;
  }
  return JSON.stringify(value ?? null);
}
