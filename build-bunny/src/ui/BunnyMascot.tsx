import { cn } from "./cn";

export type BunnyState =
  | "idle"
  | "thinking"
  | "excited"
  | "celebrating"
  | "confused"
  | "pointing"
  | "jumping"
  | "running"
  | "waving"
  | "sleeping"
  | "surprised";

export type BunnySize = "xs" | "sm" | "md" | "lg" | "xl";

export interface BunnyMascotProps {
  /**
   * Character state. Poses are static CSS transforms (they survive
   * prefers-reduced-motion); the life on top is keyframes (they don't).
   * `jumping` and `surprised` are one-shot entrances; the rest loop.
   * `pointing` and `running` mirror automatically under RTL so the bunny
   * faces the reading direction.
   */
  state?: BunnyState;
  size?: BunnySize;
  className?: string;
  /**
   * Accessible label. When omitted the bunny is decorative
   * (`aria-hidden`) — pass a localized label only where the mascot carries
   * meaning on its own (an empty state, a guide moment).
   */
  label?: string;
}

const sizeClasses: Record<BunnySize, string> = {
  xs: "w-8",
  sm: "w-12",
  md: "w-20",
  lg: "w-28",
  xl: "w-40",
};

/** States where the bunny faces the inline-end and must mirror in RTL. */
const DIRECTIONAL: ReadonlySet<BunnyState> = new Set(["pointing", "running"]);

// Toy Box robot bunny: navy outline, white shell, blue visor with glowing
// eyes, sunshine antenna bulbs on the ear tips.
const STROKE = "var(--bb-toy-navy, #173a63)";
const FUR = "#ffffff";
const VISOR = "var(--bb-toy-blue, #1b64c6)";
const GLOW = "#9ff7ff";
const BULB = "var(--bb-toy-sun, #ffd23f)";
const EAR_INNER = "#ff9ec4";
const CHEEK = "#ffb3cf";
const PANEL = "#e6f4ff";

/**
 * The Build Bunny character — Robo Bunny, a robot bunny (Toy Box style) drawn
 * as an articulated SVG (ears, head,
 * eyes, mouth set, arms, feet all independently posable) styled and
 * animated by src/app/bunny.css. Server-renderable, zero JS at runtime;
 * state changes are pure CSS. Replaces the platform-dependent 🐰 emoji so
 * the mascot looks identical on every school device and can actually act.
 */
export function BunnyMascot({
  state = "idle",
  size = "md",
  className,
  label,
}: BunnyMascotProps) {
  return (
    <span
      role={label === undefined ? undefined : "img"}
      aria-label={label}
      aria-hidden={label === undefined ? true : undefined}
      data-state={state}
      data-flip={DIRECTIONAL.has(state) ? "" : undefined}
      className={cn("bb-bunny", sizeClasses[size], className)}
    >
      <svg viewBox="0 -30 120 162" xmlns="http://www.w3.org/2000/svg">
        <g className="bb-b-root">
          {/* Tail */}
          <circle cx="96" cy="108" r="9" fill={FUR} stroke={STROKE} strokeWidth="3" />
          {/* Body */}
          <path
            d="M60 62 C36 62 26 82 26 100 C26 118 40 126 60 126 C80 126 94 118 94 100 C94 82 84 62 60 62 Z"
            fill={FUR}
            stroke={STROKE}
            strokeWidth="3"
          />
          {/* Chest panel with a little status light */}
          <rect x="46" y="90" width="28" height="20" rx="7" fill={PANEL} stroke={STROKE} strokeWidth="2.2" />
          <circle cx="54" cy="100" r="3.6" fill={BULB} stroke={STROKE} strokeWidth="1.4" />
          <rect x="60" y="97" width="9" height="2.6" rx="1.3" fill={VISOR} />
          <rect x="60" y="101.5" width="6" height="2.6" rx="1.3" fill={VISOR} />
          <g className="bb-b-footL">
            <ellipse cx="45" cy="123" rx="11" ry="6.5" fill={FUR} stroke={STROKE} strokeWidth="3" />
          </g>
          <g className="bb-b-footR">
            <ellipse cx="75" cy="123" rx="11" ry="6.5" fill={FUR} stroke={STROKE} strokeWidth="3" />
          </g>
          <g className="bb-b-armL">
            <ellipse cx="31" cy="88" rx="6.5" ry="13" fill={FUR} stroke={STROKE} strokeWidth="3" />
          </g>
          <g className="bb-b-armR">
            <ellipse cx="89" cy="88" rx="6.5" ry="13" fill={FUR} stroke={STROKE} strokeWidth="3" />
          </g>
          {/* Collar band */}
          <path d="M40 67 Q60 77 80 67 L78 73 Q60 83 42 73 Z" fill={VISOR} stroke={STROKE} strokeWidth="2" />
          <g className="bb-b-head">
            <g className="bb-b-earL">
              <rect x="38" y="-22" width="16" height="44" rx="8" fill={FUR} stroke={STROKE} strokeWidth="3" />
              <rect x="42" y="-14" width="8" height="28" rx="4" fill={EAR_INNER} />
              <circle cx="46" cy="-24" r="6" fill={BULB} stroke={STROKE} strokeWidth="2.5" />
            </g>
            <g className="bb-b-earR">
              <rect x="66" y="-22" width="16" height="44" rx="8" fill={FUR} stroke={STROKE} strokeWidth="3" />
              <rect x="70" y="-14" width="8" height="28" rx="4" fill={EAR_INNER} />
              <circle cx="74" cy="-24" r="6" fill={BULB} stroke={STROKE} strokeWidth="2.5" />
            </g>
            {/* Head */}
            <rect x="26" y="16" width="68" height="58" rx="27" fill={FUR} stroke={STROKE} strokeWidth="3" />
            {/* Visor */}
            <rect x="33" y="28" width="54" height="26" rx="13" fill={VISOR} stroke={STROKE} strokeWidth="2.5" />
            <circle cx="34" cy="62" r="5" fill={CHEEK} />
            <circle cx="86" cy="62" r="5" fill={CHEEK} />
            <g className="bb-b-eyes">
              <g className="bb-b-eyes-open">
                <ellipse cx="48" cy="41" rx="6" ry="7.5" fill={GLOW} />
                <ellipse cx="72" cy="41" rx="6" ry="7.5" fill={GLOW} />
                <circle cx="50" cy="38.5" r="2.2" fill={FUR} />
                <circle cx="74" cy="38.5" r="2.2" fill={FUR} />
              </g>
              <g
                className="bb-b-eyes-closed"
                stroke={GLOW}
                strokeWidth="3"
                strokeLinecap="round"
                fill="none"
              >
                <path d="M42 42 Q48 46 54 42" />
                <path d="M66 42 Q72 46 78 42" />
              </g>
            </g>
            <g className="bb-b-teeth">
              <rect x="55.8" y="64" width="4" height="4.5" rx="1.2" fill={FUR} stroke={STROKE} strokeWidth="1.4" />
              <rect x="60.2" y="64" width="4" height="4.5" rx="1.2" fill={FUR} stroke={STROKE} strokeWidth="1.4" />
            </g>
            <path
              className="bb-m-smile"
              d="M50 62 Q55 67 60 64 M70 62 Q65 67 60 64"
              stroke={STROKE}
              strokeWidth="2.6"
              strokeLinecap="round"
              fill="none"
            />
            <path className="bb-m-open" d="M51 62 Q60 72 69 62 Q60 66 51 62 Z" fill={STROKE} />
            <ellipse className="bb-m-o" cx="60" cy="64" rx="3.6" ry="4.4" fill={STROKE} />
            <line
              className="bb-m-flat"
              x1="54"
              y1="64"
              x2="66"
              y2="64"
              stroke={STROKE}
              strokeWidth="2.6"
              strokeLinecap="round"
            />
          </g>
        </g>
      </svg>
    </span>
  );
}
