import type { CharacterId } from "./cast";
import type { CharacterState } from "./states";

/**
 * Placeholder art for the supporting cast: original, simple SVG drawn from
 * the handoff's concept directions (Ruli: white robot, blue visor, fork-arrow
 * chest; Tessa: cream tortoise, teal tiled shell, green belt; Noura: tan
 * houbara, crest, green scarf). Production art replaces these per state
 * through CAST[id].art, so faces and outfits stay consistent across states.
 *
 * Every part that moves has a class (ch-head, ch-eyes, ch-arm) animated in
 * characters.module.css; the expression (eyes and mouth) changes by state,
 * so the static fallback under reduced motion still shows the reaction.
 */

const INK = "#1f2937";

function Mouth({ state, x, y }: { state: CharacterState; x: number; y: number }) {
  switch (state) {
    case "error":
      return <path d={`M${x - 5} ${y + 2} Q${x} ${y - 2} ${x + 5} ${y + 2}`} fill="none" stroke={INK} strokeWidth="2.2" strokeLinecap="round" />;
    case "thinking":
      return <circle cx={x} cy={y} r="2.2" fill={INK} />;
    case "celebration":
      return <path d={`M${x - 6} ${y - 1} Q${x} ${y + 7} ${x + 6} ${y - 1} Z`} fill={INK} />;
    default:
      return <path d={`M${x - 5} ${y - 1} Q${x} ${y + 4} ${x + 5} ${y - 1}`} fill="none" stroke={INK} strokeWidth="2.2" strokeLinecap="round" />;
  }
}

/** Eyes look up while thinking and squeeze shut in a celebration. */
function Eyes({ state, left, right, y, r, fill, pupil }: { state: CharacterState; left: number; right: number; y: number; r: number; fill: string; pupil: string }) {
  if (state === "celebration") {
    return (
      <g className="ch-eyes" stroke={pupil} strokeWidth="2.4" fill="none" strokeLinecap="round">
        <path d={`M${left - r} ${y + 1} Q${left} ${y - r} ${left + r} ${y + 1}`} />
        <path d={`M${right - r} ${y + 1} Q${right} ${y - r} ${right + r} ${y + 1}`} />
      </g>
    );
  }
  const dy = state === "thinking" ? -2 : 0;
  return (
    <g className="ch-eyes">
      <circle cx={left} cy={y} r={r} fill={fill} />
      <circle cx={right} cy={y} r={r} fill={fill} />
      <circle cx={left + 1} cy={y + dy} r={r * 0.5} fill={pupil} />
      <circle cx={right + 1} cy={y + dy} r={r * 0.5} fill={pupil} />
      <circle cx={left + 2} cy={y + dy - 1.5} r={r * 0.18} fill="#fff" />
      <circle cx={right + 2} cy={y + dy - 1.5} r={r * 0.18} fill="#fff" />
    </g>
  );
}

function Ruli({ state }: { state: CharacterState }) {
  return (
    <g className="ch-root">
      {/* Legs */}
      <rect x="44" y="104" width="12" height="24" rx="6" fill="#fff" stroke={INK} strokeWidth="2.5" />
      <rect x="64" y="104" width="12" height="24" rx="6" fill="#fff" stroke={INK} strokeWidth="2.5" />
      {/* Body with the fork-arrow: one path in, two ways out */}
      <rect x="36" y="68" width="48" height="42" rx="14" fill="#fff" stroke={INK} strokeWidth="2.5" />
      <path d="M60 100 V90 M60 90 Q60 82 51 80 M60 90 Q60 82 69 80" fill="none" stroke="#2563eb" strokeWidth="3" strokeLinecap="round" />
      <path d="M69 80 l-5 -2 M69 80 l-3 4" stroke="#dc2626" strokeWidth="3" strokeLinecap="round" />
      <path d="M51 80 l5 -2 M51 80 l3 4" stroke="#2563eb" strokeWidth="3" strokeLinecap="round" />
      <circle cx="60" cy="101" r="3" fill="#22d3ee" stroke={INK} strokeWidth="1.5" />
      {/* Arms: the end-side arm makes the hint gesture */}
      <rect x="22" y="72" width="14" height="30" rx="7" fill="#fff" stroke={INK} strokeWidth="2.5" />
      <g className="ch-arm">
        <rect x="84" y="72" width="14" height="30" rx="7" fill="#fff" stroke={INK} strokeWidth="2.5" />
      </g>
      <g className="ch-head">
        {/* Antenna */}
        <path d="M84 20 L90 8" stroke={INK} strokeWidth="2.5" />
        <circle cx="91" cy="7" r="5" fill="#ef4444" stroke={INK} strokeWidth="2" />
        {/* Head and visor */}
        <rect x="26" y="16" width="68" height="54" rx="18" fill="#fff" stroke={INK} strokeWidth="2.5" />
        <rect x="33" y="24" width="54" height="34" rx="12" fill="#1d4ed8" stroke={INK} strokeWidth="2" />
        <Eyes state={state} left={48} right={72} y={41} r={7} fill="#a5f3fc" pupil="#1e3a8a" />
        <g transform="translate(0 0)">
          <Mouth state={state} x={60} y={64} />
        </g>
      </g>
    </g>
  );
}

function Tessa({ state }: { state: CharacterState }) {
  return (
    <g className="ch-root">
      {/* Shell, behind: teal with a 2x2 tile window */}
      <ellipse cx="44" cy="88" rx="30" ry="32" fill="#14b8a6" stroke={INK} strokeWidth="2.5" />
      <rect x="31" y="74" width="12" height="12" rx="2" fill="#bef264" stroke={INK} strokeWidth="1.5" />
      <rect x="45" y="74" width="12" height="12" rx="2" fill="#ecfeff" stroke={INK} strokeWidth="1.5" />
      <rect x="31" y="88" width="12" height="12" rx="2" fill="#ecfeff" stroke={INK} strokeWidth="1.5" />
      <rect x="45" y="88" width="12" height="12" rx="2" fill="#bef264" stroke={INK} strokeWidth="1.5" />
      {/* Legs */}
      <ellipse cx="56" cy="124" rx="10" ry="7" fill="#fef3c7" stroke={INK} strokeWidth="2.5" />
      <ellipse cx="80" cy="124" rx="10" ry="7" fill="#fef3c7" stroke={INK} strokeWidth="2.5" />
      {/* Body, belt */}
      <rect x="52" y="70" width="36" height="50" rx="16" fill="#fef3c7" stroke={INK} strokeWidth="2.5" />
      <rect x="52" y="98" width="36" height="7" fill="#84cc16" stroke={INK} strokeWidth="1.5" />
      <circle cx="70" cy="101.5" r="3.5" fill="#22d3ee" stroke={INK} strokeWidth="1.5" />
      {/* Arm holding a tiny test box: the hint gesture lifts it */}
      <g className="ch-arm">
        <rect x="84" y="74" width="12" height="26" rx="6" fill="#fef3c7" stroke={INK} strokeWidth="2.5" />
        <rect x="88" y="62" width="20" height="14" rx="3" fill="#ecfeff" stroke={INK} strokeWidth="2" />
        <rect x="92" y="66" width="5" height="5" fill="#bef264" />
        <rect x="99" y="66" width="5" height="5" fill="#22d3ee" />
      </g>
      <g className="ch-head">
        <ellipse cx="72" cy="42" rx="28" ry="26" fill="#fef3c7" stroke={INK} strokeWidth="2.5" />
        <path d="M52 26 Q58 18 66 18" fill="none" stroke="#14b8a6" strokeWidth="5" strokeLinecap="round" />
        <Eyes state={state} left={62} right={82} y={40} r={6.5} fill="#fff" pupil="#0e7490" />
        <circle cx="56" cy="52" r="4" fill="#bef264" opacity="0.8" />
        <Mouth state={state} x={72} y={55} />
      </g>
    </g>
  );
}

function Noura({ state }: { state: CharacterState }) {
  return (
    <g className="ch-root">
      {/* Legs */}
      <path d="M52 104 L46 130 M68 104 L74 130" stroke="#334155" strokeWidth="3.5" strokeLinecap="round" />
      <circle cx="49" cy="116" r="3" fill="#22d3ee" stroke={INK} strokeWidth="1.2" />
      <circle cx="71" cy="116" r="3" fill="#22d3ee" stroke={INK} strokeWidth="1.2" />
      {/* Body and tail */}
      <path d="M26 86 Q38 62 64 66 Q90 70 88 92 Q84 110 60 108 Q36 106 26 86 Z" fill="#e7c9a0" stroke={INK} strokeWidth="2.5" />
      <path d="M30 88 Q14 84 8 92 Q20 96 32 96 Z" fill="#b08a5b" stroke={INK} strokeWidth="2" />
      {/* Wing and the green scarf */}
      <path d="M40 84 Q58 76 76 88 Q60 98 40 92 Z" fill="#c8a57a" stroke={INK} strokeWidth="2" />
      <path d="M58 66 Q70 72 84 68 L82 74 Q70 78 58 72 Z" fill="#4ade80" stroke={INK} strokeWidth="1.8" />
      {/* Wing tip raised for the hint gesture */}
      <g className="ch-arm">
        <path d="M78 80 Q96 70 102 60 Q92 80 82 88 Z" fill="#c8a57a" stroke={INK} strokeWidth="2" />
      </g>
      <g className="ch-head">
        {/* Neck with the dark stripe */}
        <path d="M64 68 Q60 50 66 36" fill="none" stroke="#e7c9a0" strokeWidth="14" strokeLinecap="round" />
        <path d="M60 66 Q57 52 62 40" fill="none" stroke="#1f2937" strokeWidth="3" strokeLinecap="round" />
        {/* Crest */}
        <path d="M62 16 Q58 4 66 2 Q66 10 70 14 Q74 4 80 6 Q76 12 76 18 Z" fill="#b08a5b" stroke={INK} strokeWidth="1.8" />
        <ellipse cx="70" cy="30" rx="15" ry="14" fill="#e7c9a0" stroke={INK} strokeWidth="2.5" />
        <path d="M84 30 L96 33 L84 36 Z" fill="#64748b" stroke={INK} strokeWidth="1.5" />
        <Eyes state={state} left={66} right={77} y={27} r={4.5} fill="#fff" pupil="#0f766e" />
        <Mouth state={state} x={80} y={38} />
      </g>
    </g>
  );
}

export function CharacterArt({ id, state }: { id: Exclude<CharacterId, "bunny">; state: CharacterState }) {
  return (
    <svg viewBox="0 0 120 136" xmlns="http://www.w3.org/2000/svg" className="h-full w-full overflow-visible">
      {id === "ruli" ? <Ruli state={state} /> : id === "tessa" ? <Tessa state={state} /> : <Noura state={state} />}
    </svg>
  );
}
