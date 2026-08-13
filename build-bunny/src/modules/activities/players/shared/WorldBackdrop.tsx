import { cn } from "@/ui";

/**
 * Full-bleed environment for the game-entry transition: the place the bunny
 * runs into. Deliberately separate from the adventure map's scenery strip —
 * that one is a 72px band inside a card, this one fills a screen and reads at
 * a glance in under a second, so it is built from big shapes, not detail.
 *
 * Themes are authored content strings: match by substring, always fall back.
 * Purely decorative (the caller marks the whole stage aria-hidden).
 */

type BackdropKind = "meadow" | "forest" | "robot" | "island" | "desert" | "ml";

const THEME_KINDS: ReadonlyArray<readonly [string, BackdropKind]> = [
  ["meadow", "meadow"],
  ["forest", "forest"],
  ["robot", "robot"],
  ["island", "island"],
  ["desert", "desert"],
  ["ml", "ml"],
  ["lab", "robot"],
  ["city", "robot"],
];

function kindFor(theme: string): BackdropKind {
  const needle = theme.toLowerCase();
  for (const [key, kind] of THEME_KINDS) {
    if (needle.includes(key)) return kind;
  }
  return "meadow";
}

/** sky top, sky bottom, ground, accent — token primitives only. */
const PALETTES: Record<BackdropKind, [string, string, string, string]> = {
  meadow: ["var(--bb-sky-100)", "var(--bb-meadow-50)", "var(--bb-meadow-300)", "var(--bb-meadow-500)"],
  forest: ["var(--bb-sky-200)", "var(--bb-meadow-100)", "var(--bb-meadow-600)", "var(--bb-meadow-800)"],
  robot: ["var(--bb-sky-100)", "var(--bb-sky-50)", "var(--bb-sky-200)", "var(--bb-sky-500)"],
  island: ["var(--bb-sky-100)", "var(--bb-sky-200)", "var(--bb-star-200)", "var(--bb-sky-500)"],
  desert: ["var(--bb-star-100)", "var(--bb-star-50)", "var(--bb-star-300)", "var(--bb-star-500)"],
  ml: ["var(--bb-sky-50)", "var(--bb-cream-50)", "var(--bb-sky-200)", "var(--bb-sky-600)"],
};

function Features({ kind, accent }: { kind: BackdropKind; accent: string }) {
  switch (kind) {
    case "meadow":
      return (
        <g opacity="0.7">
          <g fill="#ffffff" opacity="0.85">
            <ellipse cx="90" cy="46" rx="34" ry="14" />
            <ellipse cx="120" cy="40" rx="24" ry="12" />
            <ellipse cx="300" cy="34" rx="28" ry="11" />
          </g>
          <g fill={accent}>
            <circle cx="48" cy="124" r="26" />
            <circle cx="352" cy="128" r="20" />
          </g>
        </g>
      );
    case "forest":
      return (
        <g>
          <g fill={accent} opacity="0.85">
            <path d="M44 152 l30-64 l30 64 Z" />
            <path d="M108 152 l22-48 l22 48 Z" />
            <path d="M286 152 l26-56 l26 56 Z" />
            <path d="M348 152 l20-44 l20 44 Z" />
          </g>
          <path
            d="M0 176 C80 166 140 186 220 174 C300 162 350 182 400 172"
            fill="none"
            stroke="var(--bb-sky-400)"
            strokeWidth="3"
            strokeDasharray="10 8"
            strokeLinecap="round"
            opacity="0.9"
          />
        </g>
      );
    case "robot":
      return (
        <g opacity="0.8">
          <g fill={accent} opacity="0.35">
            <rect x="26" y="76" width="58" height="76" rx="6" />
            <rect x="96" y="100" width="42" height="52" rx="6" />
            <rect x="300" y="88" width="52" height="64" rx="6" />
          </g>
          <path
            d="M150 150 h44 v-38 h40 v52 h48"
            fill="none"
            stroke={accent}
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity="0.9"
          />
          <circle cx="234" cy="112" r="5" fill="var(--bb-star-400)" />
        </g>
      );
    case "island":
      return (
        <g opacity="0.85">
          <path d="M120 150 Q190 92 280 118 Q330 132 344 150 Z" fill="var(--bb-star-200)" />
          <g stroke="var(--bb-sky-500)" strokeWidth="2.4" fill="none" opacity="0.9">
            <path d="M28 96 L86 72 L86 124 L28 96 M86 72 L146 88 M86 124 L146 110" />
            <path d="M372 100 L316 76 L316 128 L372 100" />
          </g>
          <g fill="var(--bb-sky-600)">
            <circle cx="28" cy="96" r="5" /><circle cx="86" cy="72" r="5" /><circle cx="86" cy="124" r="5" />
            <circle cx="372" cy="100" r="5" /><circle cx="316" cy="76" r="5" /><circle cx="316" cy="128" r="5" />
          </g>
        </g>
      );
    case "desert":
      return (
        <g opacity="0.85">
          <circle cx="330" cy="46" r="24" fill="var(--bb-star-400)" opacity="0.6" />
          <path d="M0 150 Q70 112 150 146 T300 134 T400 154 L400 200 L0 200 Z" fill={accent} opacity="0.55" />
          <g>
            <path d="M180 148 l14 -46 l14 46 l-14 14 Z" fill="var(--bb-sky-300)" stroke="var(--bb-sky-600)" strokeWidth="2" />
            <path d="M240 150 l10 -30 l10 30 l-10 10 Z" fill="var(--bb-sky-200)" stroke="var(--bb-sky-600)" strokeWidth="2" />
          </g>
        </g>
      );
    case "ml":
      return (
        <g opacity="0.85">
          <path
            d="M40 148 C90 142 104 104 150 92 C196 80 220 74 268 70"
            fill="none"
            stroke={accent}
            strokeWidth="3.5"
            strokeLinecap="round"
          />
          <g>
            <circle cx="300" cy="96" r="11" fill="var(--bb-meadow-400)" />
            <circle cx="326" cy="116" r="11" fill="var(--bb-meadow-400)" />
            <circle cx="352" cy="94" r="11" fill="var(--bb-coral-300)" />
            <circle cx="342" cy="140" r="11" fill="var(--bb-coral-300)" />
            <path d="M338 62 L330 152" stroke="var(--bb-ink-700)" strokeWidth="2.5" strokeDasharray="7 6" strokeLinecap="round" />
          </g>
        </g>
      );
  }
}

export interface WorldBackdropProps {
  theme: string;
  className?: string;
}

export function WorldBackdrop({ theme, className }: WorldBackdropProps) {
  const kind = kindFor(theme);
  const [skyTop, skyBottom, ground, accent] = PALETTES[kind];
  const gradientId = `bb-backdrop-${kind}`;

  return (
    <span aria-hidden="true" className={cn("block", className)}>
      <svg
        viewBox="0 0 400 200"
        preserveAspectRatio="xMidYMid slice"
        className="block h-full w-full"
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={skyTop} />
            <stop offset="100%" stopColor={skyBottom} />
          </linearGradient>
        </defs>
        <rect width="400" height="200" fill={`url(#${gradientId})`} />
        <Features kind={kind} accent={accent} />
        <path d="M0 152 Q100 142 200 150 T400 146 L400 200 L0 200 Z" fill={ground} opacity="0.8" />
      </svg>
    </span>
  );
}
