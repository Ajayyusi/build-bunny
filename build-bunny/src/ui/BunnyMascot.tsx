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

const STROKE = "var(--bb-ink-900)";
const FUR = "#ffffff";

/**
 * The Build Bunny character — a hand-drawn articulated SVG (ears, head,
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
          <circle cx="96" cy="108" r="9" fill={FUR} stroke={STROKE} strokeWidth="2.5" />
          <path
            d="M60 62 C36 62 26 82 26 100 C26 118 40 126 60 126 C80 126 94 118 94 100 C94 82 84 62 60 62 Z"
            fill={FUR}
            stroke={STROKE}
            strokeWidth="2.5"
          />
          <ellipse cx="60" cy="104" rx="19" ry="15" fill="var(--bb-cream-100)" />
          <g className="bb-b-footL">
            <ellipse cx="45" cy="123" rx="11" ry="6.5" fill={FUR} stroke={STROKE} strokeWidth="2.5" />
          </g>
          <g className="bb-b-footR">
            <ellipse cx="75" cy="123" rx="11" ry="6.5" fill={FUR} stroke={STROKE} strokeWidth="2.5" />
          </g>
          <g className="bb-b-armL">
            <ellipse cx="31" cy="88" rx="6.5" ry="13" fill={FUR} stroke={STROKE} strokeWidth="2.5" />
          </g>
          <g className="bb-b-armR">
            <ellipse cx="89" cy="88" rx="6.5" ry="13" fill={FUR} stroke={STROKE} strokeWidth="2.5" />
          </g>
          {/* NITAQ-green neckerchief — the brand accent. */}
          <path
            d="M42 66 Q60 76 78 66 L74 74 Q60 82 46 74 Z"
            fill="var(--bb-meadow-400)"
            stroke="var(--bb-meadow-600)"
            strokeWidth="1.5"
          />
          <g className="bb-b-head">
            <g className="bb-b-earL">
              <ellipse cx="46" cy="0" rx="8" ry="26" fill={FUR} stroke={STROKE} strokeWidth="2.5" />
              <ellipse cx="46" cy="3" rx="3.8" ry="17" fill="var(--bb-coral-200)" />
            </g>
            <g className="bb-b-earR">
              <ellipse cx="74" cy="0" rx="8" ry="26" fill={FUR} stroke={STROKE} strokeWidth="2.5" />
              <ellipse cx="74" cy="3" rx="3.8" ry="17" fill="var(--bb-coral-200)" />
            </g>
            <ellipse cx="60" cy="46" rx="31" ry="27" fill={FUR} stroke={STROKE} strokeWidth="2.5" />
            <circle cx="40" cy="53" r="5.5" fill="var(--bb-coral-100)" />
            <circle cx="80" cy="53" r="5.5" fill="var(--bb-coral-100)" />
            <g stroke="var(--bb-ink-300)" strokeWidth="1.4" strokeLinecap="round">
              <line x1="31" y1="49" x2="24" y2="48" />
              <line x1="31" y1="53" x2="24" y2="55" />
              <line x1="89" y1="49" x2="96" y2="48" />
              <line x1="89" y1="53" x2="96" y2="55" />
            </g>
            <g className="bb-b-eyes">
              <g className="bb-b-eyes-open">
                <circle cx="49" cy="44" r="4.2" fill={STROKE} />
                <circle cx="71" cy="44" r="4.2" fill={STROKE} />
                <circle cx="50.4" cy="42.6" r="1.4" fill={FUR} />
                <circle cx="72.4" cy="42.6" r="1.4" fill={FUR} />
              </g>
              <g
                className="bb-b-eyes-closed"
                stroke={STROKE}
                strokeWidth="2.2"
                strokeLinecap="round"
                fill="none"
              >
                <path d="M45 45 Q49 48 53 45" />
                <path d="M67 45 Q71 48 75 45" />
              </g>
            </g>
            <path d="M57 52 Q60 50 63 52 Q60 56 57 52 Z" fill="var(--bb-coral-400)" />
            <g className="bb-b-teeth">
              <rect x="55.8" y="55.5" width="4" height="5" rx="1.2" fill={FUR} stroke={STROKE} strokeWidth="1.4" />
              <rect x="60.2" y="55.5" width="4" height="5" rx="1.2" fill={FUR} stroke={STROKE} strokeWidth="1.4" />
            </g>
            <path
              className="bb-m-smile"
              d="M52 59 Q56 62 60 60 M68 59 Q64 62 60 60"
              stroke={STROKE}
              strokeWidth="2"
              strokeLinecap="round"
              fill="none"
            />
            <path className="bb-m-open" d="M53 61 Q60 69 67 61 Q60 64 53 61 Z" fill={STROKE} />
            <ellipse className="bb-m-o" cx="60" cy="61" rx="3.4" ry="4.2" fill={STROKE} />
            <line
              className="bb-m-flat"
              x1="55"
              y1="60"
              x2="65"
              y2="60"
              stroke={STROKE}
              strokeWidth="2"
              strokeLinecap="round"
            />
          </g>
        </g>
      </svg>
    </span>
  );
}
