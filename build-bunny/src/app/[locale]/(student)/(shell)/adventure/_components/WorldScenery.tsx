import { cn } from "@/ui";

/**
 * Decorative per-world scenery strip that sits behind a world card's header,
 * so each world reads as a *place* rather than a tinted rectangle.
 *
 * Inline SVG on purpose: it inherits the card's own --world-band/--world-edge
 * tints (set in adventure.module.css by theme substring), costs no network
 * request on classroom wifi, and scales without art assets. Always decorative
 * — the world's name and progress carry all the meaning, so this is
 * aria-hidden everywhere.
 *
 * Themes are authored content strings, so match by substring with a neutral
 * fallback: an unknown world still renders, just with the plain horizon.
 */

type SceneryKind =
  | "meadow"
  | "forest"
  | "robot"
  | "island"
  | "desert"
  | "ml"
  | "plain";

const THEME_KINDS: ReadonlyArray<readonly [string, SceneryKind]> = [
  ["meadow", "meadow"],
  ["forest", "forest"],
  ["robot", "robot"],
  ["island", "island"],
  ["desert", "desert"],
  ["ml", "ml"],
  ["lab", "robot"],
  ["city", "robot"],
];

export function sceneryKind(theme: string): SceneryKind {
  const needle = theme.toLowerCase();
  for (const [key, kind] of THEME_KINDS) {
    if (needle.includes(key)) return kind;
  }
  return "plain";
}

/** Ground band shared by every scene — the horizon the world sits on. */
function Ground({ opacity = 0.5 }: { opacity?: number }) {
  return (
    <path
      d="M0 52 Q40 44 80 50 T160 48 T240 52 T320 47 L320 72 L0 72 Z"
      fill="var(--world-edge)"
      opacity={opacity}
    />
  );
}

function Meadow() {
  return (
    <>
      <circle cx="266" cy="18" r="10" fill="var(--bb-star-300)" opacity="0.55" />
      <g fill="var(--bb-cream-50)" opacity="0.75">
        <ellipse cx="52" cy="20" rx="18" ry="8" />
        <ellipse cx="66" cy="16" rx="12" ry="7" />
        <ellipse cx="196" cy="14" rx="14" ry="6" />
      </g>
      <Ground />
      {/* trees */}
      <g>
        <rect x="30" y="40" width="4" height="14" rx="1.5" fill="var(--bb-ink-600)" opacity="0.5" />
        <circle cx="32" cy="36" r="10" fill="var(--bb-meadow-400)" opacity="0.7" />
        <rect x="228" y="42" width="3.5" height="12" rx="1.5" fill="var(--bb-ink-600)" opacity="0.5" />
        <circle cx="230" cy="38" r="8" fill="var(--bb-meadow-500)" opacity="0.6" />
      </g>
      {/* carrots poking out of the grass */}
      <g opacity="0.85">
        <path d="M120 56 l3 9 l3-9 Z" fill="var(--bb-coral-400)" />
        <path d="M121 55 l-3-4 M123 55 l0-5 M125 55 l3-4" stroke="var(--bb-meadow-600)" strokeWidth="1.4" strokeLinecap="round" />
        <path d="M164 58 l2.5 7 l2.5-7 Z" fill="var(--bb-coral-400)" />
        <path d="M165 57 l-2.5-3 M167 57 l0-4" stroke="var(--bb-meadow-600)" strokeWidth="1.2" strokeLinecap="round" />
      </g>
    </>
  );
}

function Forest() {
  return (
    <>
      <Ground opacity={0.65} />
      {/* layered conifers, darker toward the front */}
      <g fill="var(--bb-meadow-700)" opacity="0.35">
        <path d="M40 46 l12-22 l12 22 Z" />
        <path d="M104 44 l10-18 l10 18 Z" />
        <path d="M262 46 l11-20 l11 20 Z" />
      </g>
      <g fill="var(--bb-meadow-800)" opacity="0.55">
        <path d="M16 52 l14-26 l14 26 Z" />
        <path d="M196 52 l13-24 l13 24 Z" />
        <path d="M292 50 l12-22 l12 22 Z" />
      </g>
      {/* the glowing logic path winding between the trunks */}
      <path
        d="M0 62 C60 56 90 66 140 60 C190 54 230 64 320 58"
        fill="none"
        stroke="var(--bb-sky-400)"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeDasharray="7 6"
        opacity="0.8"
      />
      <g fill="var(--bb-sky-300)" opacity="0.9">
        <circle cx="88" cy="62" r="2.6" />
        <circle cx="176" cy="57" r="2.6" />
        <circle cx="258" cy="60" r="2.6" />
      </g>
    </>
  );
}

function RobotLab() {
  return (
    <>
      <Ground opacity={0.4} />
      {/* server racks */}
      <g opacity="0.5">
        <rect x="18" y="24" width="26" height="30" rx="3" fill="var(--bb-sky-200)" />
        <rect x="50" y="32" width="20" height="22" rx="3" fill="var(--bb-sky-300)" />
        <g fill="var(--bb-sky-600)">
          <rect x="22" y="28" width="18" height="2.5" rx="1.25" />
          <rect x="22" y="34" width="18" height="2.5" rx="1.25" />
          <rect x="22" y="40" width="12" height="2.5" rx="1.25" />
        </g>
      </g>
      {/* a little robot on the bench */}
      <g>
        <rect x="146" y="34" width="26" height="20" rx="5" fill="var(--bb-sky-100)" stroke="var(--bb-sky-600)" strokeWidth="2" />
        <circle cx="154" cy="43" r="3" fill="var(--bb-sky-600)" />
        <circle cx="164" cy="43" r="3" fill="var(--bb-sky-600)" />
        <path d="M159 34 v-7" stroke="var(--bb-sky-600)" strokeWidth="2" strokeLinecap="round" />
        <circle cx="159" cy="25" r="3" fill="var(--bb-star-400)" />
        <rect x="150" y="54" width="6" height="4" rx="1.5" fill="var(--bb-sky-600)" />
        <rect x="162" y="54" width="6" height="4" rx="1.5" fill="var(--bb-sky-600)" />
      </g>
      {/* circuit trace */}
      <path
        d="M196 50 h28 v-14 h22 v18 h30"
        fill="none"
        stroke="var(--bb-sky-500)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.7"
      />
      <circle cx="246" cy="36" r="3" fill="var(--bb-star-400)" opacity="0.9" />
    </>
  );
}

function Island() {
  return (
    <>
      {/* water */}
      <path d="M0 56 Q80 50 160 56 T320 54 L320 72 L0 72 Z" fill="var(--bb-sky-300)" opacity="0.45" />
      {/* island mass */}
      <path d="M96 56 Q128 30 176 40 Q214 46 224 56 Z" fill="var(--bb-star-200)" opacity="0.75" />
      {/* palm */}
      <g>
        <path d="M150 54 q-3 -12 3 -18" stroke="var(--bb-ink-600)" strokeWidth="2.5" fill="none" strokeLinecap="round" opacity="0.6" />
        <g fill="var(--bb-meadow-500)" opacity="0.8">
          <ellipse cx="146" cy="35" rx="9" ry="3.5" transform="rotate(-24 146 35)" />
          <ellipse cx="161" cy="35" rx="9" ry="3.5" transform="rotate(24 161 35)" />
          <ellipse cx="153" cy="31" rx="8" ry="3.2" />
        </g>
      </g>
      {/* neural pathways glowing over the water */}
      <g opacity="0.85">
        <path d="M24 42 L60 30 L60 54 L24 42 M60 30 L96 38 M60 54 L96 48" stroke="var(--bb-sky-500)" strokeWidth="1.6" fill="none" />
        <path d="M232 44 L268 32 L268 56 L232 44 M268 32 L300 40 M268 56 L300 50" stroke="var(--bb-sky-500)" strokeWidth="1.6" fill="none" />
        <g fill="var(--bb-sky-600)">
          <circle cx="24" cy="42" r="3.2" /><circle cx="60" cy="30" r="3.2" /><circle cx="60" cy="54" r="3.2" />
          <circle cx="232" cy="44" r="3.2" /><circle cx="268" cy="32" r="3.2" /><circle cx="268" cy="56" r="3.2" />
        </g>
      </g>
    </>
  );
}

function Desert() {
  return (
    <>
      <circle cx="52" cy="20" r="11" fill="var(--bb-star-400)" opacity="0.5" />
      {/* dunes */}
      <path d="M0 54 Q56 34 120 52 T240 46 T320 56 L320 72 L0 72 Z" fill="var(--bb-star-200)" opacity="0.7" />
      <path d="M0 62 Q80 48 168 62 T320 60 L320 72 L0 72 Z" fill="var(--bb-star-300)" opacity="0.6" />
      {/* data crystals rising from the sand */}
      <g opacity="0.9">
        <path d="M150 50 l7 -18 l7 18 l-7 7 Z" fill="var(--bb-sky-300)" stroke="var(--bb-sky-600)" strokeWidth="1.4" />
        <path d="M196 54 l5 -12 l5 12 l-5 5 Z" fill="var(--bb-sky-200)" stroke="var(--bb-sky-600)" strokeWidth="1.2" />
        <path d="M112 56 l4 -9 l4 9 l-4 4 Z" fill="var(--bb-sky-200)" stroke="var(--bb-sky-600)" strokeWidth="1.2" />
      </g>
      {/* signal arcs */}
      <g fill="none" stroke="var(--bb-sky-500)" strokeWidth="1.6" opacity="0.75" strokeLinecap="round">
        <path d="M244 44 q10 -8 20 0" />
        <path d="M240 50 q14 -13 28 0" />
      </g>
      <circle cx="254" cy="52" r="2.6" fill="var(--bb-sky-600)" opacity="0.9" />
    </>
  );
}

function MlLab() {
  return (
    <>
      <Ground opacity={0.35} />
      {/* training curve on a lab display */}
      <rect x="14" y="18" width="96" height="38" rx="4" fill="var(--bb-sky-100)" opacity="0.7" />
      <path
        d="M22 50 C40 48 44 34 62 30 C80 26 88 24 102 23"
        fill="none"
        stroke="var(--bb-sky-600)"
        strokeWidth="2.4"
        strokeLinecap="round"
      />
      <g fill="var(--bb-sky-600)" opacity="0.8">
        <circle cx="22" cy="50" r="2.2" /><circle cx="62" cy="30" r="2.2" /><circle cx="102" cy="23" r="2.2" />
      </g>
      {/* labelled sample clusters */}
      <g opacity="0.85">
        <circle cx="150" cy="34" r="5" fill="var(--bb-meadow-400)" />
        <circle cx="162" cy="42" r="5" fill="var(--bb-meadow-400)" />
        <circle cx="146" cy="46" r="5" fill="var(--bb-meadow-400)" />
        <circle cx="196" cy="32" r="5" fill="var(--bb-coral-300)" />
        <circle cx="208" cy="42" r="5" fill="var(--bb-coral-300)" />
        <circle cx="194" cy="46" r="5" fill="var(--bb-coral-300)" />
        {/* the boundary the machine learned */}
        <path d="M176 22 L180 58" stroke="var(--bb-ink-600)" strokeWidth="2" strokeDasharray="5 4" strokeLinecap="round" />
      </g>
      {/* flask */}
      <g opacity="0.8">
        <path d="M262 26 v10 l-9 18 h26 l-9 -18 v-10 Z" fill="var(--bb-sky-200)" stroke="var(--bb-sky-600)" strokeWidth="1.8" strokeLinejoin="round" />
        <path d="M258 46 h18" stroke="var(--bb-sky-500)" strokeWidth="4" strokeLinecap="round" opacity="0.7" />
        <path d="M258 24 h14" stroke="var(--bb-sky-600)" strokeWidth="2" strokeLinecap="round" />
      </g>
    </>
  );
}

const SCENES: Record<SceneryKind, () => React.JSX.Element> = {
  meadow: Meadow,
  forest: Forest,
  robot: RobotLab,
  island: Island,
  desert: Desert,
  ml: MlLab,
  plain: () => <Ground />,
};

export interface WorldSceneryProps {
  theme: string;
  className?: string;
}

export function WorldScenery({ theme, className }: WorldSceneryProps) {
  const Scene = SCENES[sceneryKind(theme)];
  return (
    <span aria-hidden="true" className={cn("block", className)}>
      <svg
        viewBox="0 0 320 72"
        preserveAspectRatio="xMidYMax slice"
        className="block h-full w-full"
      >
        <Scene />
      </svg>
    </span>
  );
}
