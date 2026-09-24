import { describe, expect, it } from "vitest";

import { bundle } from "../../content";
import type { GridVariantSpec } from "@/engine";
import { emptyDesign } from "@/modules/activities/maze";
import { getActivityEngine } from "@/modules/activities/server/registry";
import { parseAttemptBody } from "@/modules/grading/server/attempt-body";
import { resolveNextSceneIndex } from "@/modules/activities/types";
import type { LevelSnapshot } from "@/modules/curriculum/server/publish";
import {
  aiEthicsPayload,
  aiSimPayload,
  codePredictionPayload,
  conceptCardsPayload,
  creativeProjectPayload,
  sequencingPayload,
  validatePayload,
} from "@/modules/curriculum/schemas";
import {
  computeNextStep,
  type BlockPlace,
  type NextStep,
  type NextStepState,
} from "@/modules/hints/server/next-step";

/**
 * The promise behind "Show me the next step": a child who does nothing but
 * follow it, one step at a time, finishes the level. This plays every one
 * of the 100 levels that way — from the level's real starting state, doing
 * exactly what each hint says the way a child would (placing the named
 * block where the hint says, teaching the named berry, planting the flag)
 * — and then grades the result with the level's real engine.
 */

// ── A tiny block editor that does what an addBlock/removeBlock hint says ────

interface Node {
  type: string;
  value: number | null;
  CONDITION: Node[];
  DO: Node[];
  ELSE: Node[];
}
interface Program {
  main: Node[];
  tricks: Node[][];
}
/** A serialized Blockly block, as the workspace JSON holds it. */
interface SBlock {
  type: string;
  id?: string;
  fields?: Record<string, unknown>;
  inputs?: Record<string, { block?: SBlock } | undefined>;
  next?: { block?: SBlock };
}
const FIELD: Record<string, string> = { bb_repeat: "TIMES", bb_changeCounter: "DELTA", bb_setCounter: "VALUE" };
const SENSOR = "bb_pathAhead";

function toProgram(json: unknown): Program {
  const tops = (json as { blocks?: { blocks?: SBlock[] } })?.blocks?.blocks ?? [];
  const chain = (b: SBlock | undefined): Node[] => {
    const out: Node[] = [];
    for (let x = b; x; x = x.next?.block) {
      const f = x.fields ?? {};
      const v = f["TIMES"] ?? f["DELTA"] ?? f["VALUE"];
      out.push({
        type: x.type,
        value: v === undefined ? null : Number(v),
        CONDITION: x.inputs?.CONDITION?.block ? chain(x.inputs.CONDITION.block) : [],
        DO: x.inputs?.DO?.block ? chain(x.inputs.DO.block) : [],
        ELSE: x.inputs?.ELSE?.block ? chain(x.inputs.ELSE.block) : [],
      });
    }
    return out;
  };
  return {
    main: chain(tops.find((t) => t.type === "bb_whenStart")?.next?.block),
    tricks: tops.filter((t) => t.type === "bb_defineTrick").map((t) => chain(t.inputs?.DO?.block)),
  };
}

let nextId = 0;
function toJson(p: Program): unknown {
  const chain = (nodes: Node[]): SBlock | undefined => {
    let next: SBlock | undefined;
    for (let i = nodes.length - 1; i >= 0; i -= 1) {
      const n = nodes[i]!;
      const inputs: Record<string, { block?: SBlock }> = {};
      if (n.CONDITION.length) inputs.CONDITION = { block: chain(n.CONDITION) };
      if (n.DO.length) inputs.DO = { block: chain(n.DO) };
      if (n.ELSE.length) inputs.ELSE = { block: chain(n.ELSE) };
      next = {
        type: n.type,
        id: `b${++nextId}`, // Blockly always gives blocks ids; the counter checks count runs by id
        ...(n.value !== null && FIELD[n.type] ? { fields: { [FIELD[n.type]!]: n.value } } : {}),
        ...(Object.keys(inputs).length ? { inputs } : {}),
        ...(next ? { next: { block: next } } : {}),
      };
    }
    return next;
  };
  const main = chain(p.main);
  return {
    blocks: {
      languageVersion: 0,
      blocks: [
        { type: "bb_whenStart", ...(main ? { next: { block: main } } : {}) },
        ...p.tricks.map((t) => ({ type: "bb_defineTrick", ...(t.length ? { inputs: { DO: { block: chain(t) } } } : {}) })),
      ],
    },
  };
}

/** Statement blocks in the order a child counts them (programBlocks order). */
function located(p: Program): { node: Node; list: Node[]; at: number }[] {
  const out: { node: Node; list: Node[]; at: number }[] = [];
  const walk = (list: Node[]) => {
    list.forEach((node, at) => {
      if (node.type !== SENSOR) out.push({ node, list, at });
      walk(node.CONDITION);
      walk(node.DO);
      walk(node.ELSE);
    });
  };
  walk(p.main);
  p.tricks.forEach(walk);
  return out;
}

/**
 * Only what the tap-to-add palette can do (BlocklyWorkspace.addBlock): fill
 * an EMPTY mouth (do, then else) or question slot, or go after a block. A
 * hint asking for anything else is one a child could not follow by tapping,
 * and fails the test.
 */
function insertAt(p: Program, place: BlockPlace, node: Node): void {
  const blocks = located(p);
  const byIndex = (i: number) => blocks[i - 1]!;
  switch (place.kind) {
    case "start":
      p.main.unshift(node);
      return;
    case "after": {
      const { list, at } = byIndex(place.index);
      list.splice(at + 1, 0, node);
      return;
    }
    case "inside": {
      const host = byIndex(place.index).node;
      const firstEmpty = host.DO.length === 0 ? "DO" : host.ELSE.length === 0 ? "ELSE" : null;
      if (firstEmpty !== place.mouth) throw new Error(`unfollowable: ${place.mouth} of block ${place.index} is not the palette's next empty mouth`);
      host[place.mouth].push(node);
      return;
    }
    case "condition": {
      const host = byIndex(place.index).node;
      if (host.CONDITION.length) throw new Error(`unfollowable: block ${place.index}'s question slot is full`);
      host.CONDITION = [node];
      return;
    }
    case "newTrick":
      p.tricks.push([]);
      return;
    case "insideTrick": {
      const trick = p.tricks[p.tricks.length - 1]!;
      if (trick.length) throw new Error("unfollowable: my trick is not empty");
      trick.push(node);
      return;
    }
  }
}

const blank = (type: string, value?: number): Node => ({ type, value: value ?? null, CONDITION: [], DO: [], ELSE: [] });

function applyBlockStep(json: unknown, step: NextStep): unknown {
  const p = toProgram(json);
  const find = (i: number) => located(p)[i - 1]!;
  switch (step.code) {
    case "addBlock":
      if (step.block === "bb_defineTrick") p.tricks.push([]);
      else insertAt(p, step.place, blank(step.block, step.value ?? defaultValue(step.block)));
      break;
    case "removeBlock": {
      const { list, at } = find(step.index);
      list.splice(at, 1);
      break;
    }
    case "changeBlock": {
      const hit = find(step.index);
      hit.list[hit.at] = blank(step.to, step.value ?? defaultValue(step.to));
      break;
    }
    case "setNumber":
      find(step.index).node.value = step.value;
      break;
    case "moveBlock": {
      const hit = find(step.index);
      const [node] = hit.list.splice(hit.at, 1);
      insertAt(p, step.place, node!);
      break;
    }
    default:
      throw new Error(`not a block step: ${step.code}`);
  }
  return toJson(p);
}
const defaultValue = (type: string) => (type === "bb_repeat" ? 4 : type === "bb_changeCounter" ? 1 : type === "bb_setCounter" ? 0 : undefined);

// ── Every level ─────────────────────────────────────────────────────────────

const levels = bundle.programs[0]!.worlds.flatMap((slug) => {
  const w = bundle.worlds.find((x) => x.slug === slug)!;
  return [...w.modules].sort((a, b) => a.order - b.order).flatMap((m) => [...m.levels].sort((a, b) => a.order - b.order));
});

/**
 * Postgres jsonb does not keep key order: it stores shorter keys first
 * (then byte order). A published payload comes back with a block's "DO"
 * before its "CONDITION", while a child's program arrives from Blockly
 * with CONDITION first — the mismatch that once sent the hints in circles.
 * Reorder exactly as the database would.
 */
function asJsonb(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(asJsonb);
  if (value && typeof value === "object") {
    const keys = Object.keys(value).sort((a, b) => a.length - b.length || (a < b ? -1 : a > b ? 1 : 0));
    return Object.fromEntries(keys.map((k) => [k, asJsonb((value as Record<string, unknown>)[k])]));
  }
  return value;
}

function snapshotOf(level: (typeof levels)[number]): LevelSnapshot {
  const parsed = validatePayload(level.activityType, level.payload);
  if (!parsed.ok) throw new Error(level.slug + ": " + parsed.issues.join("; "));
  const payload = asJsonb(parsed.data);
  return { activityType: level.activityType, payload } as unknown as LevelSnapshot;
}

describe("following 'Show me the next step' finishes every level, through the route's body parse", () => {
  it("covers all 100 levels", () => expect(levels).toHaveLength(100));

  for (const level of levels) {
    it(`${level.slug} (${level.activityType})`, () => {
      const snapshot = snapshotOf(level);
      const payload = snapshot.payload as {
        brokenWorkspace?: unknown;
        startWorkspace?: unknown;
        pool?: { id: string; size: number; color: number }[];
        holdout?: unknown;
      };
      let picked = "";
      const path: { sceneId: string; choiceId: string }[] = [];
      const engine = getActivityEngine(level.activityType)!;
      const grade = (answer: unknown) => engine.grade(snapshot, answer);
      const passes = (answer: unknown) => {
        const g = grade(answer);
        return { pass: g.verdict === "PASS", top: g.verdict === "PASS" && g.qualityPassed };
      };

      const state: NextStepState = {};
      let finalAnswer: () => unknown;
      const type = level.activityType;
      if (type === "BLOCK_CODING" || type === "DEBUGGING") {
        state.workspaceJson = type === "DEBUGGING" ? payload.brokenWorkspace : (payload.startWorkspace ?? toJson({ main: [], tricks: [] }));
        finalAnswer = () => state.workspaceJson;
      } else if (type === "CREATIVE_PROJECT") {
        state.design = emptyDesign(creativeProjectPayload.parse(level.payload).board);
        state.workspaceJson = toJson({ main: [], tricks: [] });
        finalAnswer = () => ({ workspaceJson: state.workspaceJson, design: state.design });
      } else if (type === "CONCEPT_CARDS") {
        state.gapBlock = null;
        finalAnswer = () => ({ blockType: state.gapBlock });
      } else if (type === "CODE_PREDICTION") {
        state.ruledOut = [];
        finalAnswer = () => ({ optionId: picked });
      } else if (type === "SEQUENCING") {
        state.order = [...sequencingPayload.parse(level.payload).items.map((i) => i.id)].reverse();
        finalAnswer = () => ({ order: state.order });
      } else if (type === "AI_CLASSIFICATION") {
        state.examples = [];
        state.held = [];
        finalAnswer = () => ({
          examples: state.examples!.map((e) => {
            const s = payload.pool!.find((x) => x.id === e.id)!;
            return { id: s.id, size: s.size, color: s.color, label: e.label };
          }),
          ...(payload.holdout ? { checkSet: state.held } : {}),
        });
      } else if (type === "PATTERN_RECOGNITION") {
        state.markers = [];
        state.excluded = [];
        finalAnswer = () => ({ markers: state.markers, excluded: state.excluded });
      } else if (type === "AI_ETHICS") {
        const p = aiEthicsPayload.parse(level.payload);
        state.sceneId = p.scenes[0]!.id;
        finalAnswer = () => ({ path });
      } else if (type === "AI_SIM") {
        const w = aiSimPayload.parse(level.payload).widget;
        if (w.widgetId === "pixel-playground") {
          state.rounds = {};
          finalAnswer = () => ({ rounds: state.rounds });
        } else {
          const ys = w.points.map((q: { y: number }) => q.y);
          state.line = { slope: 0, intercept: ys.reduce((a: number, b: number) => a + b, 0) / ys.length };
          if (w.widgetId === "trend-line") {
            state.phase = "fit";
            state.prediction = null;
            finalAnswer = () => ({ line: state.line, prediction: state.prediction });
          } else {
            finalAnswer = () => ({ line: state.line });
          }
        }
      } else {
        throw new Error(`untested type ${type}`);
      }

      const seen: string[] = [];
      let nudge = 1;
      let lastNudge = "";
      for (let guard = 0; guard < 400; guard += 1) {
        const step = computeNextStep(type, snapshot.payload, state, passes);
        seen.push(step.code);
        if (step.code === "ready") break;
        switch (step.code) {
          case "addBlock":
          case "removeBlock":
          case "changeBlock":
          case "setNumber":
          case "moveBlock":
            state.workspaceJson = applyBlockStep(state.workspaceJson, step);
            break;
          case "fillGap":
            state.gapBlock = step.block;
            break;
          case "ruleOut":
            state.ruledOut = [...(state.ruledOut ?? []), step.optionId];
            break;
          case "answerIs":
            picked = step.optionId;
            state.ruledOut = codePredictionPayload.parse(level.payload).options.map((o) => o.id).filter((id) => id !== step.optionId);
            guard = 999; // the child has the answer: submit it
            break;
          case "moveItem": {
            const order = state.order!.filter((id) => id !== step.itemId);
            order.splice(step.position - 1, 0, step.itemId);
            state.order = order;
            break;
          }
          case "teach":
            state.held = state.held!.filter((id) => id !== step.specimenId);
            state.examples = [...state.examples!, { id: step.specimenId, label: step.label }];
            break;
          case "takeBack":
            state.examples = state.examples!.filter((e) => e.id !== step.specimenId);
            break;
          case "keepForTesting":
            state.held = [...state.held!, step.specimenId];
            break;
          case "plantFlag":
            state.markers = [...state.markers!, { size: step.size, color: step.color }];
            break;
          case "liftFlag":
            state.markers = state.markers!.filter((_m, i) => i !== step.index - 1);
            break;
          case "strikeReading":
            state.excluded = [...state.excluded!, step.specimenId];
            break;
          case "restoreReading":
            state.excluded = state.excluded!.filter((id) => id !== step.specimenId);
            break;
          case "chooseSafe": {
            const p = aiEthicsPayload.parse(level.payload);
            path.push({ sceneId: state.sceneId!, choiceId: step.choiceId });
            const scene = p.scenes.find((s) => s.id === state.sceneId)!;
            const choice = scene.choices.find((c) => c.id === step.choiceId)!;
            const index = resolveNextSceneIndex(p.scenes, p.scenes.indexOf(scene), choice.next);
            state.sceneId = p.scenes[index]?.id ?? null;
            break;
          }
          case "nudgeLine": {
            // A child drags one end of the line a little; smaller moves once it overshoots.
            const w = aiSimPayload.parse(level.payload).widget;
            const xs = "points" in w ? w.points.map((q) => q.x) : [0, 1];
            const [x0, x1] = [Math.min(...xs), Math.max(...xs)];
            const key = step.end;
            if (lastNudge && lastNudge.startsWith(key) && lastNudge !== `${key}${step.dir}`) nudge /= 2;
            lastNudge = `${key}${step.dir}`;
            const y0 = state.line!.slope * x0 + state.line!.intercept;
            const y1 = state.line!.slope * x1 + state.line!.intercept;
            const d = (step.dir === "up" ? 1 : -1) * nudge;
            const [ny0, ny1] = key === "left" ? [y0 + d, y1] : [y0, y1 + d];
            const slope = (ny1 - ny0) / (x1 - x0);
            state.line = { slope, intercept: ny0 - slope * x0 };
            break;
          }
          case "revealComputer":
            state.phase = "predict";
            {
              const w = aiSimPayload.parse(level.payload).widget;
              state.prediction = state.line!.slope * ("predictAt" in w ? w.predictAt : 0) + state.line!.intercept;
            }
            break;
          case "setPrediction":
            state.prediction = step.value;
            break;
          case "pickPicture":
            state.rounds = { ...state.rounds, [step.roundId]: step.imageId };
            break;
          case "designAdd":
          case "designGoal":
          case "designRemove": {
            const d = state.design as GridVariantSpec;
            const tile = step.code === "designAdd" ? step.tile : step.code === "designGoal" ? "G" : ".";
            let rows = d.rows;
            if (step.code === "designGoal") rows = rows.map((r) => r.replace(/G/g, "."));
            rows = rows.map((r, y) => (y === step.y ? r.slice(0, step.x) + tile + r.slice(step.x + 1) : r));
            state.design = { ...d, rows };
            break;
          }
          default:
            throw new Error(`${level.slug}: dead end at ${step.code} after ${seen.join(",")}`);
        }
      }
      if (type === "CONCEPT_CARDS") expect(state.gapBlock).toBe(conceptCardsPayload.parse(level.payload).faded.missingBlockType);
      // Through the HTTP route's own body parse first — the layer the
      // Fortune Teller bug lived in, which the old playthrough skipped.
      const answer = finalAnswer!();
      const grid = type === "BLOCK_CODING" || type === "DEBUGGING";
      const body = grid
        ? { attemptRunId: crypto.randomUUID(), workspaceJson: answer }
        : type === "CREATIVE_PROJECT"
          ? { attemptRunId: crypto.randomUUID(), ...(answer as object) }
          : { attemptRunId: crypto.randomUUID(), answer };
      const parsedBody = parseAttemptBody(type, body);
      expect(parsedBody.ok, level.slug + " body rejected by the route").toBe(true);
      const input = (parsedBody as unknown as { input: Record<string, unknown> }).input;
      const routed = grid ? input.workspaceJson : type === "CREATIVE_PROJECT" ? { workspaceJson: input.workspaceJson, design: input.design } : input.answer;
      const verdict = grade(routed).verdict;
      expect({ slug: level.slug, verdict, steps: seen.length }).toMatchObject({ slug: level.slug, verdict: "PASS" });
    });
  }
});
