"use client";

import { useEffect, useRef } from "react";

import {
  parseGrid,
  type Direction,
  type EngineEvent,
  type GridVariantSpec,
  type RunResult,
} from "@/engine";
import type { ProgramRun } from "@/modules/blockly/interpreter";
import { cn } from "@/ui/cn";

/**
 * Canvas playback of an engine event log (m3 pinned contract). The canvas is
 * a pure viewer: the run is fully computed before playback starts, so this
 * component only interpolates poses between events — it never re-runs
 * program logic. Grid coordinates are absolute (dir="ltr" wrapper): the map
 * NEVER mirrors in RTL, matching the engine's fixed compass.
 */

export interface SimulationCanvasProps {
  variant: GridVariantSpec;
  /** World theme string (content data) — picks the tile tint family. */
  theme: string;
  run?: ProgramRun | null;
  playing: boolean;
  /** Base duration of one movement step. */
  speedMs?: number;
  onPlaybackEnd: (result: RunResult) => void;
  onStepChange?: (step: number, blockId: string | null) => void;
  reducedMotion: boolean;
  className?: string;
  /** Localized description of the map for assistive tech. */
  ariaLabel?: string;
}

/** N is "up" on screen; angles in degrees, clockwise. */
const DIR_ANGLE: Record<Direction, number> = { N: 0, E: 90, S: 180, W: 270 };

interface FramePose {
  x: number;
  y: number;
  angle: number;
  scale: number;
  opacity: number;
  /** Extra vertical offset in tile units (hop arc). */
  lift: number;
}

interface Frame {
  pose: FramePose;
  /** Keys "x,y" of collectables already gone. */
  collected: ReadonlySet<string>;
  /** Carrot mid-pop: key + progress 0..1. */
  popping: { key: string; t: number } | null;
  bubble: string | null;
  /** Effect glyph drawn near a grid cell. */
  fx: { glyph: string; x: number; y: number; t: number } | null;
  celebrating: number; // 0..1 goal celebration progress
}

interface Segment {
  event: EngineEvent;
  duration: number;
  before: { x: number; y: number; angle: number };
  after: { x: number; y: number; angle: number };
  collectedBefore: ReadonlySet<string>;
  collectedAfter: ReadonlySet<string>;
  step: number | null;
  blockId: string | null;
}

/** Continuous shortest-arc target angle for a facing change. */
function towardAngle(from: number, toDir: Direction): number {
  const target = DIR_ANGLE[toDir];
  let delta = ((target - from) % 360) + 0;
  while (delta > 180) delta -= 360;
  while (delta < -180) delta += 360;
  return from + delta;
}

function segmentDuration(event: EngineEvent, base: number): number {
  switch (event.type) {
    case "move":
      return base;
    case "turn":
      return base * 0.7;
    case "collect":
    case "collectFail":
      return base * 0.5;
    case "bump":
    case "splash":
      return base * 1.2;
    case "say":
      return Math.max(750, base * 2);
    case "goal":
      return base * 1.6;
    case "budgetExceeded":
      return base * 0.8;
    case "start":
      return 0;
  }
}

function buildTimeline(run: ProgramRun, variant: GridVariantSpec, base: number): Segment[] {
  const segments: Segment[] = [];
  let pose = {
    x: variant.start.x,
    y: variant.start.y,
    angle: DIR_ANGLE[variant.start.dir],
  };
  let collected: ReadonlySet<string> = new Set<string>();
  const highlights = run.highlights;

  const blockForStep = (step: number): string | null => {
    let found: string | null = null;
    for (const h of highlights) {
      if (h.step <= step) found = h.blockId;
      else break;
    }
    return found;
  };

  for (const event of run.events) {
    if (event.type === "start") {
      pose = { x: event.pose.x, y: event.pose.y, angle: DIR_ANGLE[event.pose.dir] };
      continue;
    }
    const before = pose;
    let after = pose;
    let collectedAfter = collected;

    if (event.type === "move") {
      after = { x: event.to.x, y: event.to.y, angle: towardAngle(before.angle, event.to.dir) };
    } else if (event.type === "turn") {
      after = { ...before, angle: towardAngle(before.angle, event.pose.dir) };
    } else if (event.type === "collect") {
      const next = new Set(collected);
      next.add(`${event.x},${event.y}`);
      collectedAfter = next;
    }

    const step = "step" in event ? event.step : null;
    segments.push({
      event,
      duration: segmentDuration(event, base),
      before,
      after,
      collectedBefore: collected,
      collectedAfter,
      step,
      blockId: step === null ? null : blockForStep(step),
    });
    pose = after;
    collected = collectedAfter;
  }
  return segments;
}

const EMPTY_SET: ReadonlySet<string> = new Set();

function idleFrame(variant: GridVariantSpec): Frame {
  return {
    pose: {
      x: variant.start.x,
      y: variant.start.y,
      angle: DIR_ANGLE[variant.start.dir],
      scale: 1,
      opacity: 1,
      lift: 0,
    },
    collected: EMPTY_SET,
    popping: null,
    bubble: null,
    fx: null,
    celebrating: 0,
  };
}

const easeInOut = (t: number) => t * t * (3 - 2 * t);

/** The visual state at local progress t (0..1) inside one segment. */
function frameAt(seg: Segment, t: number, instant: boolean): Frame {
  const e = easeInOut(Math.min(1, Math.max(0, t)));
  const done = instant || t >= 1;
  const base: Frame = {
    pose: {
      x: done ? seg.after.x : seg.before.x + (seg.after.x - seg.before.x) * e,
      y: done ? seg.after.y : seg.before.y + (seg.after.y - seg.before.y) * e,
      angle: done
        ? seg.after.angle
        : seg.before.angle + (seg.after.angle - seg.before.angle) * e,
      scale: 1,
      opacity: 1,
      lift: 0,
    },
    collected: done ? seg.collectedAfter : seg.collectedBefore,
    popping: null,
    bubble: null,
    fx: null,
    celebrating: 0,
  };

  switch (seg.event.type) {
    case "move":
      if (!done) base.pose.lift = Math.sin(Math.PI * e) * 0.22;
      break;
    case "collect": {
      const key = `${seg.event.x},${seg.event.y}`;
      if (!done) base.popping = { key, t: e };
      break;
    }
    case "collectFail":
      base.fx = { glyph: "❔", x: base.pose.x, y: base.pose.y - 0.6, t: e };
      break;
    case "bump": {
      if (!done) {
        // Lunge 30% toward the wall and bounce back.
        const k = t < 0.4 ? t / 0.4 : Math.max(0, 1 - (t - 0.4) / 0.4);
        const dx = seg.event.x - seg.before.x;
        const dy = seg.event.y - seg.before.y;
        base.pose.x = seg.before.x + dx * 0.3 * k;
        base.pose.y = seg.before.y + dy * 0.3 * k;
      }
      if (instant || t > 0.25) {
        base.fx = { glyph: "💥", x: seg.event.x, y: seg.event.y, t: e };
      }
      break;
    }
    case "splash": {
      // Slide onto the water tile, then sink.
      const slide = Math.min(1, t / 0.45);
      base.pose.x = seg.before.x + (seg.event.x - seg.before.x) * easeInOut(slide);
      base.pose.y = seg.before.y + (seg.event.y - seg.before.y) * easeInOut(slide);
      if (t > 0.45 || instant) {
        const sink = instant ? 1 : Math.min(1, (t - 0.45) / 0.55);
        base.pose.scale = 1 - sink * 0.55;
        base.pose.opacity = 1 - sink * 0.6;
        base.fx = { glyph: "💦", x: seg.event.x, y: seg.event.y - 0.3, t: sink };
      }
      break;
    }
    case "say":
      base.bubble = seg.event.text;
      break;
    case "goal":
      base.celebrating = instant ? 1 : e;
      if (!done) base.pose.lift = Math.abs(Math.sin(Math.PI * 2 * e)) * 0.18;
      break;
    case "budgetExceeded":
      base.fx = { glyph: "💫", x: base.pose.x, y: base.pose.y - 0.6, t: e };
      break;
    default:
      break;
  }
  return base;
}

// ── Theme palette (design tokens via computed styles) ────────────────────

interface SimPalette {
  groundA: string;
  groundB: string;
  edge: string;
  deep: string;
  water: string;
  bubbleBg: string;
  /** Resolved font-family — canvas cannot evaluate var() in ctx.font. */
  bodyFont: string;
}

/** Token families per world theme; substring match like the map bands. */
function paletteVars(theme: string): { a: string; b: string; edge: string; deep: string } {
  const needle = theme.toLowerCase();
  if (needle.includes("meadow")) {
    return { a: "--bb-meadow-100", b: "--bb-meadow-50", edge: "--bb-meadow-300", deep: "--bb-meadow-800" };
  }
  if (needle.includes("forest")) {
    return { a: "--bb-meadow-200", b: "--bb-meadow-100", edge: "--bb-meadow-400", deep: "--bb-meadow-900" };
  }
  if (needle.includes("robot") || needle.includes("lab") || needle.includes("city")) {
    return { a: "--bb-sky-100", b: "--bb-sky-50", edge: "--bb-sky-300", deep: "--bb-sky-900" };
  }
  if (needle.includes("desert") || needle.includes("island")) {
    return { a: "--bb-star-100", b: "--bb-star-50", edge: "--bb-star-300", deep: "--bb-star-800" };
  }
  return { a: "--bb-cream-100", b: "--bb-cream-50", edge: "--bb-cream-300", deep: "--bb-ink-800" };
}

function readPalette(el: HTMLElement, theme: string): SimPalette {
  const cs = getComputedStyle(el);
  const read = (name: string, fallback: string): string => {
    const value = cs.getPropertyValue(name).trim();
    return value || fallback;
  };
  const vars = paletteVars(theme);
  return {
    groundA: read(vars.a, "#e8e2d2"),
    groundB: read(vars.b, "#f3efe3"),
    edge: read(vars.edge, "#cbbe9f"),
    deep: read(vars.deep, "#333"),
    water: read("--bb-sky-200", "#9be3d6"),
    bubbleBg: read("--color-surface-raised", "#ffffff"),
    bodyFont: cs.fontFamily || "sans-serif",
  };
}

// ── Component ────────────────────────────────────────────────────────────

export default function SimulationCanvas({
  variant,
  theme,
  run = null,
  playing,
  speedMs = 350,
  onPlaybackEnd,
  onStepChange,
  reducedMotion,
  className,
  ariaLabel,
}: SimulationCanvasProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const paletteRef = useRef<SimPalette | null>(null);
  const frameRef = useRef<Frame>(idleFrame(variant));
  // The canvas has no DOM text — "say" dialogue is otherwise invisible to a
  // screen reader (m5 §41 audit finding). Mirrored via a ref (not React
  // state) so announcing it doesn't force a re-render on every animation
  // frame; only written when the bubble text actually changes.
  const liveRegionRef = useRef<HTMLDivElement | null>(null);
  const lastBubbleRef = useRef<string | null>(null);
  const onEndRef = useRef(onPlaybackEnd);
  const onStepRef = useRef(onStepChange);
  onEndRef.current = onPlaybackEnd;
  onStepRef.current = onStepChange;

  // Drawing lives in a ref so resize + playback share one renderer without
  // re-creating closures per frame.
  const drawRef = useRef<() => void>(() => {});

  useEffect(() => {
    const host = hostRef.current;
    const canvas = canvasRef.current;
    if (!host || !canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const grid = parseGrid(variant.rows);
    paletteRef.current = readPalette(host, theme);

    const emojiFont = (size: number) =>
      `${Math.round(size)}px "Segoe UI Emoji","Apple Color Emoji","Noto Color Emoji",sans-serif`;

    const draw = () => {
      const palette = paletteRef.current;
      if (!palette) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 3);
      const cssW = host.clientWidth;
      const cssH = host.clientHeight;
      if (cssW === 0 || cssH === 0) return;
      const pxW = Math.round(cssW * dpr);
      const pxH = Math.round(cssH * dpr);
      if (canvas.width !== pxW || canvas.height !== pxH) {
        canvas.width = pxW;
        canvas.height = pxH;
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, cssW, cssH);

      const tile = Math.min(cssW / grid.width, cssH / grid.height);
      const originX = (cssW - tile * grid.width) / 2;
      const originY = (cssH - tile * grid.height) / 2;
      const cx = (x: number) => originX + (x + 0.5) * tile;
      const cy = (y: number) => originY + (y + 0.5) * tile;
      const frame = frameRef.current;

      // Tiles: soft checkerboard, water tinted, rounded cells.
      const inset = tile * 0.03;
      const radius = tile * 0.16;
      for (let y = 0; y < grid.height; y++) {
        for (let x = 0; x < grid.width; x++) {
          const ch = grid.tiles[y]![x]!;
          ctx.beginPath();
          ctx.roundRect(
            originX + x * tile + inset,
            originY + y * tile + inset,
            tile - inset * 2,
            tile - inset * 2,
            radius,
          );
          ctx.fillStyle =
            ch === "W"
              ? palette.water
              : (x + y) % 2 === 0
                ? palette.groundA
                : palette.groundB;
          ctx.fill();
        }
      }

      // Static glyphs: rocks, water ripples, goal burrow + flag.
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      for (let y = 0; y < grid.height; y++) {
        for (let x = 0; x < grid.width; x++) {
          const ch = grid.tiles[y]![x]!;
          if (ch === "#") {
            ctx.font = emojiFont(tile * 0.62);
            ctx.fillText("🪨", cx(x), cy(y) + tile * 0.02);
          } else if (ch === "W") {
            ctx.font = emojiFont(tile * 0.4);
            ctx.globalAlpha = 0.85;
            ctx.fillText("🌊", cx(x), cy(y));
            ctx.globalAlpha = 1;
          } else if (ch === "G") {
            ctx.font = emojiFont(tile * 0.58);
            ctx.fillText("🕳️", cx(x), cy(y) + tile * 0.06);
            ctx.font = emojiFont(tile * 0.34);
            ctx.fillText("🚩", cx(x) + tile * 0.24, cy(y) - tile * 0.26);
          }
        }
      }

      // Carrots (skip collected; pop the one being collected).
      for (const c of grid.collectables) {
        const key = `${c.x},${c.y}`;
        if (frame.collected.has(key)) continue;
        let size = tile * 0.52;
        let alpha = 1;
        if (frame.popping && frame.popping.key === key) {
          const t = frame.popping.t;
          size *= 1 + t * 0.5;
          alpha = 1 - t;
        }
        ctx.font = emojiFont(size);
        ctx.globalAlpha = alpha;
        ctx.fillText("🥕", cx(c.x), cy(c.y));
        ctx.globalAlpha = 1;
      }

      // Goal celebration sparkles.
      if (frame.celebrating > 0 && grid.goal) {
        const t = frame.celebrating;
        ctx.font = emojiFont(tile * 0.3);
        ctx.globalAlpha = Math.min(1, t * 1.5);
        const gx = cx(grid.goal.x);
        const gy = cy(grid.goal.y);
        const r = tile * (0.45 + t * 0.35);
        for (let i = 0; i < 5; i++) {
          const a = (Math.PI * 2 * i) / 5 - Math.PI / 2 + t * 0.8;
          ctx.fillText("✨", gx + Math.cos(a) * r, gy + Math.sin(a) * r);
        }
        ctx.globalAlpha = 1;
      }

      // Bunny: rotated per facing (pinned contract).
      const p = frame.pose;
      ctx.save();
      ctx.translate(cx(p.x), cy(p.y) - p.lift * tile);
      ctx.rotate((p.angle * Math.PI) / 180);
      ctx.globalAlpha = p.opacity;
      ctx.font = emojiFont(tile * 0.66 * p.scale);
      ctx.fillText("🐰", 0, 0);
      ctx.restore();

      // Effect glyph (bump/splash/confusion).
      if (frame.fx) {
        const rise = frame.fx.glyph === "❔" || frame.fx.glyph === "💫";
        ctx.font = emojiFont(tile * 0.5);
        ctx.globalAlpha = 1 - Math.max(0, frame.fx.t - 0.6) * 2.5;
        ctx.fillText(
          frame.fx.glyph,
          cx(frame.fx.x),
          cy(frame.fx.y) - (rise ? frame.fx.t * tile * 0.3 : 0),
        );
        ctx.globalAlpha = 1;
      }

      // Mirror the bubble text into the live region exactly once per change
      // (not per frame — frame.bubble stays the same string across every
      // tick of a "say" segment, and re-writing textContent identically
      // would still (mis)trigger some screen readers to re-announce it).
      if (frame.bubble !== lastBubbleRef.current) {
        lastBubbleRef.current = frame.bubble;
        if (liveRegionRef.current) liveRegionRef.current.textContent = frame.bubble ?? "";
      }

      // Speech bubble — drawn last, LTR-independent position above bunny.
      if (frame.bubble) {
        const text = frame.bubble;
        ctx.font = `600 ${Math.max(12, Math.round(tile * 0.26))}px ${palette.bodyFont}`;
        const metrics = ctx.measureText(text);
        const padX = tile * 0.22;
        const w = Math.min(cssW - 8, metrics.width + padX * 2);
        const h = tile * 0.52;
        let bx = cx(p.x) - w / 2;
        bx = Math.max(4, Math.min(bx, cssW - w - 4));
        let by = cy(p.y) - tile * 0.95 - h;
        if (by < 4) by = cy(p.y) + tile * 0.55;
        ctx.beginPath();
        ctx.roundRect(bx, by, w, h, h / 2.6);
        ctx.fillStyle = palette.bubbleBg;
        ctx.fill();
        ctx.strokeStyle = palette.edge;
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.fillStyle = palette.deep;
        ctx.fillText(text, bx + w / 2, by + h / 2 + 1, w - padX * 2);
      }
    };

    drawRef.current = draw;
    draw();

    const observer = new ResizeObserver(() => draw());
    observer.observe(host);
    return () => observer.disconnect();
  }, [variant, theme]);

  // ── Playback loop ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!playing || !run) {
      // Idle: show the start pose with every carrot in place; after a
      // finished (non-playing) run the last frame simply stays rendered.
      if (!run) {
        frameRef.current = idleFrame(variant);
        drawRef.current();
      }
      return;
    }

    const base = reducedMotion ? 0 : speedMs;
    const timeline = buildTimeline(run, variant, base);
    // Reduced motion: instant stepping with 120ms pauses (pinned contract).
    if (reducedMotion) for (const seg of timeline) seg.duration = 120;

    frameRef.current = idleFrame(variant);
    drawRef.current();

    let raf = 0;
    let cancelled = false;
    let index = -1;
    let segStart = performance.now();
    const HOLD_MS = 350;

    const advance = (now: number) => {
      index += 1;
      segStart = now;
      const seg = timeline[index];
      if (seg && onStepRef.current && seg.step !== null) {
        onStepRef.current(seg.step, seg.blockId);
      }
    };

    const tick = (now: number) => {
      if (cancelled) return;
      if (index === -1) advance(now);

      let seg = timeline[index];
      while (seg && now - segStart >= seg.duration) {
        // Commit the segment's end state before moving on.
        frameRef.current = frameAt(seg, 1, true);
        advance(now);
        seg = timeline[index];
      }

      if (!seg) {
        drawRef.current();
        // Brief hold on the final frame so the ending reads, then hand off.
        window.setTimeout(() => {
          if (!cancelled) onEndRef.current(run);
        }, HOLD_MS);
        return;
      }

      const t = seg.duration === 0 ? 1 : (now - segStart) / seg.duration;
      frameRef.current = frameAt(seg, t, reducedMotion);
      drawRef.current();
      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
    };
  }, [playing, run, variant, speedMs, reducedMotion]);

  return (
    <div
      ref={hostRef}
      // The grid is a map, not text: it keeps LTR geometry in RTL locales.
      dir="ltr"
      role="img"
      aria-label={ariaLabel}
      className={cn("relative h-full w-full", className)}
    >
      <canvas ref={canvasRef} className="block h-full w-full" />
      {/* "say"-block dialogue, the only run content with no DOM text
          otherwise (m5 §41). polite: mid-run chatter shouldn't interrupt. */}
      <div ref={liveRegionRef} aria-live="polite" className="sr-only" />
    </div>
  );
}
