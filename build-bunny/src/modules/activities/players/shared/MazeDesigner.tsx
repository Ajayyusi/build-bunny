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

const TILE_GLYPH: Record<string, string> = { "#": "🪨", W: "🌊", C: "🥕", G: "🕳️" };
const DIR_ARROW: Record<Direction, string> = { N: "↑", E: "→", S: "↓", W: "←" };

export interface MazeDesignerProps {
  rules: MazeRules;
  design: GridVariantSpec;
  onChange: (design: GridVariantSpec) => void;
  issues: MazeIssue[];
}

export function MazeDesigner({ rules, design, onChange, issues }: MazeDesignerProps) {
  const t = useTranslations("student.play.maze");
  const [brush, setBrush] = useState<Brush>(rules.palette[0] ?? "G");
  const [focus, setFocus] = useState({ x: 0, y: 0 });

  const brushes: { id: Brush; glyph: string; label: string }[] = [
    { id: "start", glyph: "🐰", label: t("brush.start") },
    { id: "G", glyph: TILE_GLYPH["G"]!, label: t("brush.goal") },
    ...rules.palette.map((tile) => ({
      id: tile as Brush,
      glyph: TILE_GLYPH[tile]!,
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
        role="grid"
        aria-label={t("gridLabel", { width: rules.board.width, height: rules.board.height })}
        className="mx-auto grid w-fit gap-1 rounded-xl border border-border-token bg-surface-sunken p-2"
        style={{ gridTemplateColumns: `repeat(${rules.board.width}, minmax(0, 1fr))` }}
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
                role="gridcell"
                aria-label={cellName(x, y)}
                tabIndex={focused ? 0 : -1}
                onClick={() => paint(x, y)}
                onKeyDown={(event) => onKeyDown(event, x, y)}
                className={cn(
                  "grid size-11 place-items-center rounded-md border text-2xl leading-none transition-colors sm:size-12",
                  tile === "#" || tile === "W"
                    ? "border-border-token bg-surface"
                    : (x + y) % 2 === 0
                      ? "border-border-token bg-[color-mix(in_oklab,var(--color-positive)_18%,white)]"
                      : "border-border-token bg-[color-mix(in_oklab,var(--color-positive)_28%,white)]",
                  "hover:ring-2 hover:ring-brand focus-visible:ring-2 focus-visible:ring-focus",
                )}
              >
                <span aria-hidden="true">
                  {isStart ? (
                    <span className="relative inline-block">
                      🐰
                      <span className="absolute -end-2 -top-2 text-xs font-bold text-ink">
                        {DIR_ARROW[design.start.dir]}
                      </span>
                    </span>
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
