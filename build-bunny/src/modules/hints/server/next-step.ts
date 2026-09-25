import "server-only";

import { z } from "zod";

import type { GridVariantSpec } from "@/engine";
import { trueLabel } from "@/modules/activities/server/ai-classification";
import { analyzeMazeDesign, type MazeIssue } from "@/modules/activities/maze";
import { centroidRule } from "@/modules/ai/lab/math/centroidRule";
import { leastSquares } from "@/modules/ai/lab/math/leastSquares";
import type { Line } from "@/modules/ai/lab/math/types";
import { fittingRules } from "@/modules/ai/rule-round";
import { solveAiClassification } from "@/modules/ai/solve";
import { BUNNY_DEFINE_BLOCK, BUNNY_HAT_BLOCK, BUNNY_SENSOR_BLOCKS } from "@/modules/blockly/blocks";
import {
  aiClassificationPayload,
  aiEthicsPayload,
  aiSimPayload,
  codePredictionPayload,
  conceptCardsPayload,
  creativeProjectPayload,
  patternRecognitionPayload,
  sequencingPayload,
} from "@/modules/curriculum/schemas";

/**
 * "Show me the next step" — the hint that helps a child SOLVE the level,
 * rather than explain the idea again.
 *
 * Every other helper in the player is deliberately not the answer ("Ask Robo
 * Bunny" explains a block, a failure, the concept). This one is: it looks at
 * what the child has built or chosen SO FAR, compares it with a known
 * working answer, and names the single next thing to do — "add Turn Right
 * after block 2", "teach the small dark crab", "plant a flag here", "move
 * 'Press the power button' to number 2". Following it one step at a time
 * always ends in a pass; the replay suite proves that for all 100 levels.
 *
 * It runs on the server because the answer keys (solutions, correct orders,
 * rules, reference placements) are stripped from what a child's browser
 * receives, and it is recorded as a top-tier hint, so the level's third
 * star is capped exactly as a tier-3+ ladder hint already caps it.
 */

// ── What the client renders ───────────────────────────────────────────────

export type { BlockPlace, NextStep } from "../types";
import type { BlockPlace, NextStep } from "../types";

/** Grades a candidate answer with the level's real engine: true = PASS. */
export type PassCheck = (answer: unknown) => { pass: boolean; top: boolean };

// ── Block programs ────────────────────────────────────────────────────────

interface SBlock {
  type?: unknown;
  fields?: Record<string, unknown>;
  inputs?: Record<string, { block?: SBlock } | undefined>;
  next?: { block?: SBlock };
}

const SENSORS = new Set<string>(BUNNY_SENSOR_BLOCKS);
const NUMBER_FIELDS = ["TIMES", "DELTA", "VALUE"] as const;

/** One block of a program in reading order, placed relative to what came before. */
interface Entry {
  type: string;
  /** 1-based statement ordinal (what "block 3" means on screen); null for sensors and trick hats. */
  ord: number | null;
  value: number | null;
  place: BlockPlace;
}

function topBlocks(json: unknown): SBlock[] {
  const blocks = (json as { blocks?: { blocks?: unknown } } | null)?.blocks?.blocks;
  return Array.isArray(blocks) ? (blocks as SBlock[]) : [];
}

function numberOf(block: SBlock): number | null {
  for (const name of NUMBER_FIELDS) {
    const v = block.fields?.[name];
    if (typeof v === "number") return v;
    if (typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v))) return Number(v);
  }
  return null;
}

/**
 * Flattens a workspace in the same order programBlocks numbers it (main
 * program first, bodies before the block below, then trick bodies), so the
 * ordinals in a hint name the blocks a child counts on screen.
 */
function flatten(json: unknown): { entries: Entry[]; loose: string[] } {
  const entries: Entry[] = [];
  let ord = 0;
  const walkChain = (first: SBlock | undefined, firstPlace: BlockPlace) => {
    let place = firstPlace;
    for (let b = first; b && typeof b.type === "string"; b = b.next?.block) {
      const type = b.type as string;
      const isSensor = SENSORS.has(type);
      const entry: Entry = { type, ord: isSensor ? null : ++ord, value: numberOf(b), place };
      entries.push(entry);
      const self = entry.ord ?? 0;
      // A fixed order, not the JSON's key order: an authored solution may
      // list DO before CONDITION while Blockly saves CONDITION first, and
      // comparing the two in different orders sent a child round in circles.
      for (const name of ["CONDITION", "DO", "ELSE"] as const) {
        const child = b.inputs?.[name]?.block;
        if (!child) continue;
        if (name === "CONDITION") {
          walkChain(child, { kind: "condition", index: self, block: type });
        } else if (name === "DO" || name === "ELSE") {
          walkChain(child, { kind: "inside", index: self, block: type, mouth: name });
        }
      }
      place = { kind: "after", index: self, block: type };
    }
  };
  const tops = topBlocks(json);
  const loose: string[] = [];
  for (const top of tops) {
    if (top.type === BUNNY_HAT_BLOCK) walkChain(top.next?.block, { kind: "start" });
  }
  for (const top of tops) {
    if (top.type === BUNNY_DEFINE_BLOCK) {
      entries.push({ type: BUNNY_DEFINE_BLOCK, ord: null, value: null, place: { kind: "newTrick" } });
      walkChain(top.inputs?.["DO"]?.block, { kind: "insideTrick" });
    }
  }
  for (const top of tops) {
    if (top.type !== BUNNY_HAT_BLOCK && top.type !== BUNNY_DEFINE_BLOCK && typeof top.type === "string") {
      loose.push(top.type);
    }
  }
  return { entries, loose };
}

const samePlace = (a: BlockPlace, b: BlockPlace) => JSON.stringify(a) === JSON.stringify(b);

/**
 * The next edit that brings the child's program one block closer to a known
 * working program. Pure; the caller has already checked the program does
 * not pass as it stands.
 */
export function nextBlockEdit(childJson: unknown, solutionJson: unknown): NextStep {
  const child = flatten(childJson);
  const target = flatten(solutionJson).entries;
  if (child.loose.length > 0) return { code: "looseBlock", block: child.loose[0]! };
  const have = child.entries;
  for (let i = 0; i < Math.max(have.length, target.length); i += 1) {
    const c = have[i];
    const s = target[i];
    if (!c && s) {
      return { code: "addBlock", block: s.type, place: s.place, ...(s.value !== null ? { value: s.value } : {}) };
    }
    if (c && !s) {
      if (c.ord === null) return { code: "removeBlock", index: 0, block: c.type };
      return { code: "removeBlock", index: c.ord, block: c.type };
    }
    if (!c || !s) break;
    if (c.type === s.type) {
      if (!samePlace(c.place, s.place)) {
        // In the wrong place. Moving a block needs a drag; taking it away and
        // letting the next hint re-add it where it belongs is all taps.
        return c.ord !== null
          ? { code: "removeBlock", index: c.ord, block: c.type }
          : { code: "addBlock", block: s.type, place: s.place };
      }
      if (s.value !== null && c.value !== s.value && c.ord !== null) {
        return { code: "setNumber", index: c.ord, block: c.type, value: s.value };
      }
      continue;
    }
    // Types differ at i. One block missing, one extra, or one wrong?
    if (target[i + 1]?.type === c.type) {
      // A block missing at the TOP of a mouth that already holds something
      // cannot be added there by tapping (the palette only fills an empty
      // mouth, or goes after the selected block). Clear the way instead: the
      // next hints then add the blocks in order.
      if ((s.place.kind === "inside" || s.place.kind === "insideTrick") && samePlace(c.place, s.place) && c.ord !== null) {
        return { code: "removeBlock", index: c.ord, block: c.type };
      }
      return { code: "addBlock", block: s.type, place: s.place, ...(s.value !== null ? { value: s.value } : {}) };
    }
    if (have[i + 1]?.type === s.type && c.ord !== null) {
      return { code: "removeBlock", index: c.ord, block: c.type };
    }
    if (c.ord !== null && s.ord !== null) {
      return { code: "changeBlock", index: c.ord, from: c.type, to: s.type, ...(s.value !== null ? { value: s.value } : {}) };
    }
    if (c.ord !== null) return { code: "removeBlock", index: c.ord, block: c.type };
    return { code: "addBlock", block: s.type, place: s.place };
  }
  return { code: "ready" };
}

// ── Mazes a child designs ─────────────────────────────────────────────────

const DELTA: Record<string, [number, number]> = { N: [0, -1], E: [1, 0], S: [0, 1], W: [-1, 0] };
const DIRS = ["N", "E", "S", "W"] as const;

function passable(design: GridVariantSpec, x: number, y: number): boolean {
  const row = design.rows[y];
  if (!row || x < 0 || x >= row.length) return false;
  const tile = row[x];
  return tile !== "#" && tile !== "W";
}

/** Shortest route that visits every carrot and ends on the burrow, as compass steps. */
export function mazeRoute(design: GridVariantSpec): ("N" | "E" | "S" | "W")[] | null {
  const carrots: [number, number][] = [];
  let goal: [number, number] | null = null;
  for (let y = 0; y < design.rows.length; y += 1) {
    const row = design.rows[y]!;
    for (let x = 0; x < row.length; x += 1) {
      if (row[x] === "C") carrots.push([x, y]);
      if (row[x] === "G") goal = [x, y];
    }
  }
  if (goal === null || carrots.length > 6) return null;
  const all = (1 << carrots.length) - 1;
  const key = (x: number, y: number, m: number) => `${x},${y},${m}`;
  const maskAt = (x: number, y: number, m: number) => {
    const i = carrots.findIndex(([cx, cy]) => cx === x && cy === y);
    return i >= 0 ? m | (1 << i) : m;
  };
  const start = { x: design.start.x, y: design.start.y, m: maskAt(design.start.x, design.start.y, 0) };
  const prev = new Map<string, { from: string; dir: (typeof DIRS)[number] } | null>([[key(start.x, start.y, start.m), null]]);
  const queue = [start];
  const [gx, gy] = goal;
  while (queue.length) {
    const cur = queue.shift()!;
    if (cur.x === gx && cur.y === gy && cur.m === all) {
      const steps: (typeof DIRS)[number][] = [];
      let k = key(cur.x, cur.y, cur.m);
      for (let p = prev.get(k); p; p = prev.get(k)) {
        steps.unshift(p.dir);
        k = p.from;
      }
      return steps;
    }
    for (const dir of DIRS) {
      const [dx, dy] = DELTA[dir]!;
      const nx = cur.x + dx;
      const ny = cur.y + dy;
      if (!passable(design, nx, ny)) continue;
      // The burrow ends the run the moment the bunny lands on it.
      if (nx === gx && ny === gy && maskAt(nx, ny, cur.m) !== all) continue;
      const m = maskAt(nx, ny, cur.m);
      const k = key(nx, ny, m);
      if (prev.has(k)) continue;
      prev.set(k, { from: key(cur.x, cur.y, cur.m), dir });
      queue.push({ x: nx, y: ny, m });
    }
  }
  return null;
}

/**
 * A working program for a child's own maze: turns plus hops, with straight
 * runs folded into Repeat when the level's toolbox has it (and must use it).
 */
export function mazeProgram(design: GridVariantSpec, useRepeat: boolean): unknown | null {
  const route = mazeRoute(design);
  if (!route) return null;
  const blocks: SBlock[] = [];
  let facing = DIRS.indexOf(design.start.dir as (typeof DIRS)[number]);
  let i = 0;
  while (i < route.length) {
    const want = DIRS.indexOf(route[i]!);
    const turn = (want - facing + 4) % 4;
    if (turn === 1) blocks.push({ type: "bb_turnRight" });
    else if (turn === 3) blocks.push({ type: "bb_turnLeft" });
    else if (turn === 2) blocks.push({ type: "bb_turnRight" }, { type: "bb_turnRight" });
    facing = want;
    let run = 0;
    while (i < route.length && DIRS.indexOf(route[i]!) === want) {
      run += 1;
      i += 1;
    }
    if (useRepeat && run >= 2) {
      blocks.push({ type: "bb_repeat", fields: { TIMES: run }, inputs: { DO: { block: { type: "bb_moveForward" } } } });
    } else {
      for (let r = 0; r < run; r += 1) blocks.push({ type: "bb_moveForward" });
    }
  }
  // Chain them under the hat.
  const chained = blocks.reduceRight<SBlock | undefined>((next, b) => ({ ...b, ...(next ? { next: { block: next } } : {}) }), undefined);
  return { blocks: { languageVersion: 0, blocks: [{ type: BUNNY_HAT_BLOCK, ...(chained ? { next: { block: chained } } : {}) }] } };
}

/** The first change that moves a child's design toward one the level accepts. */
export function nextDesignFix(rules: z.infer<typeof creativeProjectPayload>, design: GridVariantSpec): NextStep | null {
  const issues = analyzeMazeDesign(rules, design);
  if (issues.length === 0) return null;
  const issue = issues[0]!;
  const cells: [number, number][] = [];
  design.rows.forEach((row, y) => [...row].forEach((_t, x) => cells.push([x, y])));
  const withTileOn = (d: GridVariantSpec, x: number, y: number, t: string): GridVariantSpec => ({
    ...d,
    rows: d.rows.map((row, ry) => (ry === y ? row.slice(0, x) + t + row.slice(x + 1) : row)),
  });
  const isStart = (x: number, y: number) => x === design.start.x && y === design.start.y;
  const tile = (x: number, y: number) => design.rows[y]?.[x] ?? "";
  const stillFine = (d: GridVariantSpec, allowed: MazeIssue["code"][]) =>
    analyzeMazeDesign(rules, d).every((i) => allowed.includes(i.code));
  switch (issue.code) {
    case "noGoal":
    case "goalTooClose": {
      // The farthest open square that still leaves the design winnable.
      const route = (d: GridVariantSpec) => mazeRoute(d)?.length ?? -1;
      const cleared: GridVariantSpec = { ...design, rows: design.rows.map((r) => r.replace(/G/g, ".")) };
      let best: [number, number] | null = null;
      let bestLen = -1;
      for (const [x, y] of cells) {
        if (isStart(x, y) || cleared.rows[y]?.[x] !== ".") continue;
        const len = route(withTileOn(cleared, x, y, "G"));
        if (len > bestLen) {
          bestLen = len;
          best = [x, y];
        }
      }
      return best ? { code: "designGoal", x: best[0], y: best[1] } : { code: "designFix", issue: issue.code };
    }
    case "fewObstacles": {
      const t: "#" | "W" = rules.palette.includes("#") ? "#" : "W";
      for (const [x, y] of cells) {
        if (isStart(x, y) || tile(x, y) !== ".") continue;
        const d = withTileOn(design, x, y, t);
        if (stillFine(d, ["fewObstacles", "fewCarrots"]) && mazeRoute({ ...d, rows: d.rows }) !== null) {
          return { code: "designAdd", tile: t, x, y };
        }
      }
      return { code: "designFix", issue: issue.code };
    }
    case "fewCarrots": {
      // On the current route, so collecting it costs no detour.
      const route = mazeRoute(design) ?? [];
      let x = design.start.x;
      let y = design.start.y;
      for (const dir of route) {
        x += DELTA[dir]![0];
        y += DELTA[dir]![1];
        if (tile(x, y) === ".") return { code: "designAdd", tile: "C", x, y };
      }
      for (const [cx, cy] of cells) {
        if (!isStart(cx, cy) && tile(cx, cy) === "." && mazeRoute(withTileOn(design, cx, cy, "C"))) {
          return { code: "designAdd", tile: "C", x: cx, y: cy };
        }
      }
      return { code: "designFix", issue: issue.code };
    }
    case "unreachableGoal":
    case "unreachableCarrot":
    case "startBlocked": {
      if (issue.code === "startBlocked") return { code: "designRemove", x: design.start.x, y: design.start.y };
      for (const [x, y] of cells) {
        const t = tile(x, y);
        if (t !== "#" && t !== "W") continue;
        if (mazeRoute(withTileOn(design, x, y, "."))) return { code: "designRemove", x, y };
      }
      return { code: "designFix", issue: issue.code };
    }
    default:
      return { code: "designFix", issue: issue.code };
  }
}

// ── Per activity type ─────────────────────────────────────────────────────

export const nextStepStateSchema = z.object({
  workspaceJson: z.unknown().optional(),
  design: z.unknown().optional(),
  ruledOut: z.array(z.string()).max(8).optional(),
  order: z.array(z.string()).max(12).optional(),
  gapBlock: z.string().nullable().optional(),
  examples: z.array(z.object({ id: z.string(), label: z.enum(["positive", "negative"]) })).max(64).optional(),
  held: z.array(z.string()).max(64).optional(),
  markers: z.array(z.object({ size: z.number(), color: z.number() })).max(6).optional(),
  excluded: z.array(z.string()).max(4).optional(),
  sceneId: z.string().nullable().optional(),
  line: z.object({ slope: z.number(), intercept: z.number() }).optional(),
  phase: z.enum(["fit", "predict"]).optional(),
  prediction: z.number().nullable().optional(),
  rounds: z.record(z.string(), z.string()).optional(),
  /** Rule or Examples?: where the child is in the rule round, if the level has one. */
  rule: z
    .object({
      stage: z.enum(["pick", "today", "done"]),
      chosen: z.string().max(40).nullable(),
      tested: z.string().max(40).nullable(),
    })
    .optional(),
});
export type NextStepState = z.infer<typeof nextStepStateSchema>;

const round1 = (v: number) => Math.round(v * 10) / 10;
const lineY = (l: Line, x: number) => ("vertical" in l ? NaN : l.slope * x + l.intercept);

/** Which end of the child's line to move, and which way, to approach `target`. */
function nudgeToward(child: { slope: number; intercept: number }, target: Line, xs: number[]): NextStep {
  const x0 = Math.min(...xs);
  const x1 = Math.max(...xs);
  if ("vertical" in target) {
    // A vertical target: steepen toward it — raise the right end if the
    // target sits to the right of where the child's line crosses the middle.
    return { code: "nudgeLine", end: "right", dir: child.slope >= 0 ? "up" : "down" };
  }
  const dLeft = lineY(target, x0) - lineY(child, x0);
  const dRight = lineY(target, x1) - lineY(child, x1);
  if (Math.abs(dLeft) >= Math.abs(dRight)) return { code: "nudgeLine", end: "left", dir: dLeft > 0 ? "up" : "down" };
  return { code: "nudgeLine", end: "right", dir: dRight > 0 ? "up" : "down" };
}

export function computeNextStep(
  activityType: string,
  payload: unknown,
  state: NextStepState,
  passes: PassCheck,
): NextStep {
  switch (activityType) {
    case "BLOCK_CODING":
    case "DEBUGGING": {
      const ws = state.workspaceJson ?? {};
      const check = passes(ws);
      if (check.pass) return { code: "ready", ...(check.top ? {} : { better: true }) };
      const solution = (payload as { solution?: unknown }).solution;
      if (!solution) return { code: "none" };
      return nextBlockEdit(ws, solution);
    }
    case "CREATIVE_PROJECT": {
      const rules = creativeProjectPayload.parse(payload);
      const design = state.design as GridVariantSpec | undefined;
      if (!design) return { code: "none" };
      const fix = nextDesignFix(rules, design);
      if (fix) return fix;
      // Still on the design step: the maze is good, so build the program.
      if (state.workspaceJson === undefined) return { code: "ready" };
      const ws = state.workspaceJson;
      const check = passes({ workspaceJson: ws, design });
      if (check.pass) return { code: "ready", ...(check.top ? {} : { better: true }) };
      const useRepeat = rules.toolbox.some((t) => t.type === "bb_repeat");
      const program = mazeProgram(design, useRepeat);
      return program ? nextBlockEdit(ws, program) : { code: "none" };
    }
    case "CONCEPT_CARDS": {
      const p = conceptCardsPayload.parse(payload);
      if (state.gapBlock === p.faded.missingBlockType) return { code: "ready" };
      return { code: "fillGap", block: p.faded.missingBlockType };
    }
    case "CODE_PREDICTION": {
      const p = codePredictionPayload.parse(payload);
      const out = new Set(state.ruledOut ?? []);
      const wrong = p.options.find((o) => o.id !== p.correctOptionId && !out.has(o.id));
      return wrong ? { code: "ruleOut", optionId: wrong.id } : { code: "answerIs", optionId: p.correctOptionId };
    }
    case "SEQUENCING": {
      const p = sequencingPayload.parse(payload);
      const order = state.order ?? [];
      for (let i = 0; i < p.correctOrder.length; i += 1) {
        if (order[i] !== p.correctOrder[i]) return { code: "moveItem", itemId: p.correctOrder[i]!, position: i + 1 };
      }
      return { code: "ready" };
    }
    case "AI_CLASSIFICATION": {
      const p = aiClassificationPayload.parse(payload);
      // The rule round comes first: find a rule that fits yesterday, see it
      // meet today, then teach. Its buttons are the steps.
      if (p.ruleRound && state.rule && state.rule.stage !== "done") {
        if (state.rule.stage === "today") return { code: "pressButton", button: "teachInstead" };
        const fits = fittingRules(p.ruleRound.rules, p.ruleRound.yesterday).map((rule) => rule.id);
        const chosen = state.rule.chosen;
        if (chosen && fits.includes(chosen)) {
          return state.rule.tested === chosen
            ? { code: "pressButton", button: "seeToday" }
            : { code: "pressButton", button: "testRule" };
        }
        return fits[0] ? { code: "tryRule", ruleId: fits[0] } : { code: "none" };
      }
      const byId = new Map(p.pool.map((s) => [s.id, s]));
      const taught = (state.examples ?? []).filter((e) => byId.has(e.id));
      const held = new Set((state.held ?? []).filter((id) => byId.has(id)));
      const answer = (ids: string[], check: string[]) => ({
        examples: ids.map((id) => ({ ...byId.get(id)!, label: byId.get(id)!.truth })).map(({ id, size, color, label }) => ({ id, size, color, label })),
        ...(p.holdout ? { checkSet: check } : {}),
      });
      const taughtIds = taught.map((e) => e.id);
      if (taughtIds.length > 0 && passes(answer(taughtIds, [...held])).pass) return { code: "ready" };
      const lie = taughtIds.find((id) => p.mislabelled.includes(id));
      if (lie) return { code: "takeBack", specimenId: lie };
      const solution = solveAiClassification(p, (probe) => trueLabel(p.rule, probe)) ?? [];
      const want = solution.map((s) => s.id);
      const missing = want.filter((id) => !taughtIds.includes(id));
      const extras = taughtIds.filter((id) => !want.includes(id));
      const atCap = p.maxExamples !== undefined && taughtIds.length >= p.maxExamples;
      if (missing.length > 0 && !atCap) return { code: "teach", specimenId: missing[0]!, label: byId.get(missing[0]!)!.truth };
      if (extras.length > 0) {
        // The extra whose removal helps most: prefer one that on its own
        // makes the set pass, else the first.
        const helps = extras.find((id) => passes(answer(taughtIds.filter((t) => t !== id), [...held])).pass);
        return { code: "takeBack", specimenId: helps ?? extras[0]! };
      }
      if (missing.length > 0) return { code: "teach", specimenId: missing[0]!, label: byId.get(missing[0]!)!.truth };
      if (p.holdout && held.size < p.holdout.min) {
        const spare = p.pool.find((s) => !taughtIds.includes(s.id) && !held.has(s.id));
        if (spare) return { code: "keepForTesting", specimenId: spare.id };
      }
      return { code: "ready" };
    }
    case "PATTERN_RECOGNITION": {
      const p = patternRecognitionPayload.parse(payload);
      const markers = state.markers ?? [];
      const excluded = new Set(state.excluded ?? []);
      const round = (v: number) => Math.round(Math.min(1, Math.max(0, v)) * 100) / 100;
      const asAnswer = (m: { size: number; color: number }[], ex: Set<string>) => ({
        markers: m.map((x) => ({ size: round(x.size), color: round(x.color) })),
        excluded: [...ex],
      });
      if (markers.length >= p.markers.min && passes(asAnswer(markers, excluded)).pass) return { code: "ready" };
      const ref = p.groundTruth.referencePlacement;
      const dist = (a: { size: number; color: number }, b: { size: number; color: number }) =>
        Math.hypot(a.size - b.size, a.color - b.color);
      // The reading that belongs to no crowd: farthest from every reference flag.
      if (p.maxExclusions > 0) {
        const ranked = [...p.specimens].sort(
          (a, b) => Math.min(...ref.map((r) => dist(b, r))) - Math.min(...ref.map((r) => dist(a, r))),
        );
        const outliers = ranked.slice(0, p.maxExclusions).filter((s) => Math.min(...ref.map((r) => dist(s, r))) > 0.3);
        const wronglyStruck = [...excluded].find((id) => !outliers.some((o) => o.id === id));
        if (wronglyStruck) return { code: "restoreReading", specimenId: wronglyStruck };
        const unstruck = outliers.find((o) => !excluded.has(o.id));
        if (unstruck) return { code: "strikeReading", specimenId: unstruck.id };
      }
      // Each reference point wants a flag near it.
      const NEAR = 0.1;
      const claimed = new Set<number>();
      const covered = ref.map((r) => {
        const idx = markers.findIndex((m, i) => !claimed.has(i) && dist(m, r) <= NEAR);
        if (idx >= 0) claimed.add(idx);
        return idx >= 0;
      });
      const stray = markers.findIndex((_m, i) => !claimed.has(i));
      const firstGap = covered.findIndex((c) => !c);
      if (firstGap >= 0 && markers.length < p.markers.max) {
        const r = ref[firstGap]!;
        return { code: "plantFlag", size: r.size, color: r.color };
      }
      if (stray >= 0) return { code: "liftFlag", index: stray + 1 };
      if (firstGap >= 0) {
        const r = ref[firstGap]!;
        return { code: "plantFlag", size: r.size, color: r.color };
      }
      return { code: "ready" };
    }
    case "AI_ETHICS": {
      const p = aiEthicsPayload.parse(payload);
      const scene = p.scenes.find((s) => s.id === state.sceneId) ?? null;
      const safe = scene?.choices.find((c) => c.safe);
      return safe ? { code: "chooseSafe", choiceId: safe.id } : { code: "ready" };
    }
    case "AI_SIM": {
      const p = aiSimPayload.parse(payload);
      const w = p.widget;
      if (w.widgetId === "boundary-builder") {
        const line = state.line;
        if (!line) return { code: "none" };
        if (passes({ line }).pass) return { code: "ready" };
        const labelIds = [w.labels[0]!.id, w.labels[1]!.id] as [string, string];
        const target = centroidRule(w.points, labelIds).line;
        return nudgeToward(line, target, w.points.map((q) => q.x));
      }
      if (w.widgetId === "trend-line") {
        const best = leastSquares(w.points);
        const line = state.line;
        if (state.phase === "predict") {
          const want = round1(best.slope * w.predictAt + best.intercept);
          if (state.prediction !== null && state.prediction !== undefined && line && passes({ line, prediction: state.prediction }).pass &&
            Math.abs(state.prediction - want) <= 0.5) return { code: "ready" };
          return { code: "setPrediction", value: want };
        }
        if (!line) return { code: "none" };
        if (passes({ line, prediction: round1(line.slope * w.predictAt + line.intercept) }).pass) return { code: "revealComputer" };
        return nudgeToward(line, best, w.points.map((q) => q.x));
      }
      const picked = state.rounds ?? {};
      const wrong = w.rounds.find((r) => picked[r.id] !== r.imageId);
      return wrong ? { code: "pickPicture", roundId: wrong.id, imageId: wrong.imageId } : { code: "ready" };
    }
    default:
      return { code: "none" };
  }
}

