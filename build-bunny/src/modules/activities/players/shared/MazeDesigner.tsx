"use client";

import { useState, type KeyboardEvent } from "react";
import { useTranslations } from "next-intl";

import type { Direction, GridVariantSpec } from "@/engine";
import {
  MIN_GOAL_HOPS,
  nextDirection,
  tileAt,
  withTile,
  type MazeIssue,
  type MazeRules,
} from "@/modules/activities/maze";
import { cn } from "@/ui";
import { collectableGlyph, tintHex, worldColor } from "@/ui/worldColors";

/**
 * The maze designer: pick a tile, tap the map. No dragging anywhere — a
 * brush and a grid of buttons, so it works the same with a finger, a mouse,
 * a keyboard (arrows move, Enter/Space paints) and a switch. Every cell has
 * a spoken name ("row 2, column 3: rock"), and the checklist under the map
 * says in words what is still missing, never just a colour.
 *
 * Coordinates are absolute (dir="ltr" like the simulation canvas): the map
 * a child draws is the map Robo Bunny runs on, in both languages.
 */

type Brush = "." | "#" | "W" | "C" | "G" | "start";

const TILE_GLYPH: Record<string, string> = { "#": "🪨", W: "🌊", C: "🥕" };
const DIR_ARROW: Record<Direction, string> = { N: "↑", E: "→", S: "↓", W: "←" };
const DIR_TURN: Record<Direction, number> = { N: 0, E: 90, S: 180, W: 270 };

/**
 * The same Robo Bunny the game board draws (white shell, blue visor,
 * glowing eyes, sunshine antenna bulbs), ears pointing the way it faces.
 * The designer used to show a pink 🐰 emoji on flat grey-green squares, a
 * different world from the board the child's maze then runs on.
 */
function RoboBunnyGlyph({ dir = "N", size = 30 }: { dir?: Direction; size?: number }) {
  return (
    <svg viewBox="-50 -70 100 110" width={size} height={size} style={{ transform: `rotate(${DIR_TURN[dir]}deg)` }} aria-hidden="true">
      <g stroke="#173a63" strokeWidth="4.5" strokeLinejoin="round">
        {[-20, 8].map((ex) => (
          <g key={ex}>
            <rect x={ex} y={-62} width={13} height={38} rx={6.5} fill="#ffffff" />
            <rect x={ex + 3.5} y={-55} width={6} height={24} rx={3} fill="#ff9ec4" stroke="none" />
            <circle cx={ex + 6.5} cy={-63} r={5.5} fill="#ffd23f" />
          </g>
        ))}
        <rect x={-34} y={-30} width={68} height={60} rx={27} fill="#ffffff" />
        <rect x={-27} y={-18} width={54} height={26} rx={13} fill="#1b64c6" />
      </g>
      <ellipse cx={-12} cy={-5} rx={5.5} ry={7.5} fill="#9ff7ff" />
      <ellipse cx={12} cy={-5} rx={5.5} ry={7.5} fill="#9ff7ff" />
    </svg>
  );
}

/** The burrow as the board draws it: a dark hole with a little flag. */
function BurrowGlyph({ size = 30 }: { size?: number }) {
  return (
    <svg viewBox="0 0 40 40" width={size} height={size} aria-hidden="true">
      <ellipse cx="18" cy="28" rx="15" ry="8" fill="#2b1846" />
      <ellipse cx="18" cy="27" rx="11" ry="5" fill="#140a24" />
      <path d="M28 6v18" stroke="#8a5a2b" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M29 6l9 4-9 4z" fill="#ff3d6e" />
    </svg>
  );
}

export interface MazeDesignerProps {
  rules: MazeRules;
  design: GridVariantSpec;
  onChange: (design: GridVariantSpec) => void;
  issues: MazeIssue[];
  /** World theme: the designer's squares wear the same colours as the board. */
  theme?: string;
}

export function MazeDesigner({ rules, design, onChange, issues, theme = "" }: MazeDesignerProps) {
  const color = worldColor(theme);
  const groundA = tintHex(color.fill, 0.2);
  const groundB = tintHex(color.fill, 0.1);
  const item = collectableGlyph(theme);
  const t = useTranslations("student.play.maze");
  const [brush, setBrush] = useState<Brush>(rules.palette[0] ?? "G");
  const [focus, setFocus] = useState({ x: 0, y: 0 });

  const brushes: { id: Brush; glyph: React.ReactNode; label: string }[] = [
    { id: "start", glyph: <RoboBunnyGlyph size={26} />, label: t("brush.start") },
    { id: "G", glyph: <BurrowGlyph size={26} />, label: t("brush.goal") },
    ...rules.palette.map((tile) => ({
      id: tile as Brush,
      glyph: tile === "C" ? item : TILE_GLYPH[tile]!,
      label: t(`brush.${tile === "#" ? "rock" : tile === "W" ? "water" : "carrot"}`),
    })),
    { id: ".", glyph: "✕", label: t("brush.clear") },
  ];

  const paint = (x: number, y: number) => {
    setFocus({ x, y });
    if (brush === "start") {
      const onStart = design.start.x === x && design.start.y === y;
      onChange({
        // Robo Bunny cannot stand on a rock or in water; placing it clears the tile.
        rows: onStart || !"#W".includes(tileAt(design, x, y)) ? design.rows : withTile(design, x, y, ".").rows,
        start: onStart ? { ...design.start, dir: nextDirection(design.start.dir) } : { x, y, dir: design.start.dir },
      });
      return;
    }
    onChange(withTile(design, x, y, brush));
  };

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>, x: number, y: number) => {
    const moves: Record<string, [number, number]> = {
      ArrowUp: [0, -1],
      ArrowDown: [0, 1],
      ArrowLeft: [-1, 0],
      ArrowRight: [1, 0],
    };
    const move = moves[event.key];
    if (!move) return;
    event.preventDefault();
    const nx = Math.min(rules.board.width - 1, Math.max(0, x + move[0]));
    const ny = Math.min(rules.board.height - 1, Math.max(0, y + move[1]));
    setFocus({ x: nx, y: ny });
    document.getElementById(cellId(nx, ny))?.focus();
  };

  const cellName = (x: number, y: number) => {
    const isStart = design.start.x === x && design.start.y === y;
    const tile = tileAt(design, x, y);
    const what = isStart
      ? t("tile.start", { dir: t(`dir.${design.start.dir}`) })
      : t(`tile.${tile === "#" ? "rock" : tile === "W" ? "water" : tile === "C" ? "carrot" : tile === "G" ? "goal" : "empty"}`);
    return t("cell", { row: y + 1, col: x + 1, what });
  };

  const counts = countTiles(design);
  const checklist: { id: string; ok: boolean; text: string }[] = [
    { id: "goal", ok: counts.goals === 1, text: t("check.oneGoal") },
    ...(rules.mustInclude.obstacles > 0
      ? [{
          id: "obstacles",
          ok: counts.obstacles >= rules.mustInclude.obstacles,
          text: t("check.obstacles", { need: rules.mustInclude.obstacles, have: counts.obstacles }),
        }]
      : []),
    ...(rules.mustInclude.carrots > 0
      ? [{
          id: "carrots",
          ok: counts.carrots >= rules.mustInclude.carrots,
          text: t("check.carrots", { need: rules.mustInclude.carrots, have: counts.carrots }),
        }]
      : []),
    {
      id: "startFree",
      ok: !issues.some((i) => i.code === "startBlocked" || i.code === "startOutside"),
      text: t("check.startFree"),
    },
    { id: "reach", ok: !issues.some((i) => i.code === "unreachableGoal"), text: t("check.reachGoal") },
    {
      id: "far",
      ok: counts.goals === 1 && !issues.some((i) => i.code === "goalTooClose" || i.code === "unreachableGoal"),
      text: t("check.farEnough", { need: rules.minGoalHops ?? MIN_GOAL_HOPS }),
    },
    ...(counts.carrots > 0
      ? [{ id: "reachCarrots", ok: !issues.some((i) => i.code === "unreachableCarrot"), text: t("check.reachCarrots") }]
      : []),
  ];

  return (
    <div className="flex flex-col gap-4">
      <div role="radiogroup" aria-label={t("brushLabel")} className="flex flex-wrap gap-2">
        {brushes.map((entry) => (
          <button
            key={entry.id}
            type="button"
            role="radio"
            aria-checked={brush === entry.id}
            onClick={() => setBrush(entry.id)}
            className={cn(
              "inline-flex h-12 items-center gap-2 rounded-lg border-2 px-3 text-sm font-bold transition-colors",
              brush === entry.id
                ? "border-brand bg-brand text-on-brand"
                : "border-border-token bg-surface-raised text-ink hover:bg-surface-sunken",
            )}
          >
            <span aria-hidden="true" className="text-xl leading-none">{entry.glyph}</span>
            {entry.label}
          </button>
        ))}
      </div>
      <p className="text-sm text-ink-muted">
        {brush === "start" ? t("hint.start") : t("hint.paint")}
      </p>

      <div
        dir="ltr"
        // A group of labelled buttons (roving tabindex + arrow keys): a
        // "grid" role would need row elements that this layout doesn't have.
        role="group"
        aria-label={t("gridLabel", { width: rules.board.width, height: rules.board.height })}
        className="mx-auto grid w-fit gap-1.5 rounded-2xl p-2.5"
        // The board's frame: the world colour's dark ledge under a soft tint.
        style={{
          gridTemplateColumns: `repeat(${rules.board.width}, minmax(0, 1fr))`,
          background: tintHex(color.fill, 0.35),
          boxShadow: `0 6px 0 ${color.ledge}`,
        }}
      >
        {design.rows.map((row, y) =>
          row.split("").map((tile, x) => {
            const isStart = design.start.x === x && design.start.y === y;
            const focused = focus.x === x && focus.y === y;
            return (
              <button
                key={`${x},${y}`}
                id={cellId(x, y)}
                type="button"
                aria-label={cellName(x, y)}
                tabIndex={focused ? 0 : -1}
                onClick={() => paint(x, y)}
                onKeyDown={(event) => onKeyDown(event, x, y)}
                className={cn(
                  "grid size-11 place-items-center rounded-[10px] text-2xl leading-none transition-transform sm:size-12",
                  "hover:-translate-y-0.5 hover:ring-2 hover:ring-brand focus-visible:ring-2 focus-visible:ring-focus",
                )}
                style={{
                  background: tile === "W" ? "#8fe0ff" : (x + y) % 2 === 0 ? groundA : groundB,
                  boxShadow: `inset 0 -3px 0 ${tintHex(color.fill, 0.3)}`,
                }}
              >
                <span aria-hidden="true">
                  {isStart ? (
                    <span className="relative inline-grid place-items-center">
                      <RoboBunnyGlyph dir={design.start.dir} />
                      <span className="absolute -end-2 -top-2 rounded-full bg-surface-raised px-1 text-xs font-bold text-ink shadow-sm">
                        {DIR_ARROW[design.start.dir]}
                      </span>
                    </span>
                  ) : tile === "G" ? (
                    <BurrowGlyph />
                  ) : tile === "C" ? (
                    item
                  ) : (
                    (TILE_GLYPH[tile] ?? "")
                  )}
                </span>
              </button>
            );
          }),
        )}
      </div>

      <ul aria-label={t("checklistTitle")} className="grid gap-1.5 text-sm">
        {checklist.map((item) => (
          <li key={item.id} className="flex items-start gap-2">
            <span
              aria-hidden="true"
              className={cn(
                "mt-0.5 grid size-5 shrink-0 place-items-center rounded-full text-xs font-bold",
                item.ok ? "bg-positive text-on-brand" : "bg-surface-sunken text-ink-muted",
              )}
            >
              {item.ok ? "✓" : "•"}
            </span>
            <span className={item.ok ? "text-ink" : "text-ink-muted"}>
              <span className="sr-only">{item.ok ? t("check.done") : t("check.todo")} </span>
              {item.text}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function cellId(x: number, y: number): string {
  return `maze-cell-${x}-${y}`;
}

function countTiles(design: GridVariantSpec): { goals: number; obstacles: number; carrots: number } {
  let goals = 0;
  let obstacles = 0;
  let carrots = 0;
  for (const row of design.rows) {
    for (const tile of row) {
      if (tile === "G") goals += 1;
      else if (tile === "#" || tile === "W") obstacles += 1;
      else if (tile === "C") carrots += 1;
    }
  }
  return { goals, obstacles, carrots };
}
