/**
 * Display preferences — pure data, unit-tested. Text size, high contrast
 * and reduced motion, chosen by the child (or their teacher) on this device
 * and stored in localStorage: like audio, they describe the device and the
 * person holding it, not the account.
 *
 * Applied as data attributes on <html> (see displayAttributes) so plain CSS
 * can act on them, and read by a tiny inline boot script before hydration
 * so a larger-text device never flashes small text first.
 */

export type TextSize = "normal" | "large" | "xl";

export interface DisplayPrefs {
  version: 1;
  textSize: TextSize;
  contrast: "normal" | "high";
  /** "auto" follows the OS setting; "reduce" forces it on. */
  motion: "auto" | "reduce";
}

export const DISPLAY_STORAGE_KEY = "bb:display:v1";

export const DEFAULT_DISPLAY_PREFS: DisplayPrefs = {
  version: 1,
  textSize: "normal",
  contrast: "normal",
  motion: "auto",
};

const TEXT_SIZES = new Set<TextSize>(["normal", "large", "xl"]);

export function parseDisplayPrefs(stored: string | null): DisplayPrefs {
  if (!stored) return DEFAULT_DISPLAY_PREFS;
  let raw: Record<string, unknown>;
  try {
    const parsed: unknown = JSON.parse(stored);
    if (!parsed || typeof parsed !== "object") return DEFAULT_DISPLAY_PREFS;
    raw = parsed as Record<string, unknown>;
  } catch {
    return DEFAULT_DISPLAY_PREFS;
  }
  return {
    version: 1,
    textSize: TEXT_SIZES.has(raw.textSize as TextSize) ? (raw.textSize as TextSize) : "normal",
    contrast: raw.contrast === "high" ? "high" : "normal",
    motion: raw.motion === "reduce" ? "reduce" : "auto",
  };
}

/**
 * The <html> attributes for a preference set. Defaults produce no attribute
 * at all, so the CSS for the default look is simply the CSS with nothing
 * matched — nothing to keep in sync.
 */
export function displayAttributes(prefs: DisplayPrefs): Record<string, string> {
  const attributes: Record<string, string> = {};
  if (prefs.textSize !== "normal") attributes["data-text-size"] = prefs.textSize;
  if (prefs.contrast === "high") attributes["data-contrast"] = "high";
  if (prefs.motion === "reduce") attributes["data-motion"] = "reduce";
  return attributes;
}

/** Every attribute displayAttributes can set — cleared before re-applying. */
export const DISPLAY_ATTRIBUTES = ["data-text-size", "data-contrast", "data-motion"] as const;

/**
 * The boot script inlined into <head>: applies stored preferences to <html>
 * before the first paint. Kept tiny and dependency-free on purpose; it must
 * mirror displayAttributes exactly (a unit test compares them).
 */
export const DISPLAY_BOOT_SCRIPT = `(function(){try{var p=JSON.parse(localStorage.getItem(${JSON.stringify(
  DISPLAY_STORAGE_KEY,
)})||"null")||{};var d=document.documentElement;if(p.textSize==="large"||p.textSize==="xl")d.setAttribute("data-text-size",p.textSize);if(p.contrast==="high")d.setAttribute("data-contrast","high");if(p.motion==="reduce")d.setAttribute("data-motion","reduce");}catch(e){}})();`;
