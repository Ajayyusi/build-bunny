import "server-only";

import { Prisma, type ContentStatus, type Level, type Module, type World } from "@prisma/client";

import { audit } from "@/lib/audit";
import { db } from "@/lib/db";
import type { Role } from "@/modules/auth/roles";
import {
  hintsSchema,
  localizedText,
  validatePayload,
  XP_BY_DIFFICULTY,
  type LocalizedText,
} from "@/modules/curriculum/schemas";

/**
 * Publish pipeline (plan §1.2): a level goes live only through the gate
 * pipeline, and every publish writes an immutable LevelVersion snapshot so
 * attempts/in-flight play pin a version — a mid-session republish never
 * shifts grading. Engine-dependent gates (solution re-run, reachability BFS)
 * are stubbed as named skipped gates so the pipeline SHAPE is final in M2.
 */

export const CURRICULUM_STATUS_CHANGED_ACTION = "curriculum.status_changed";

export interface GateResult {
  gate: string;
  ok: boolean;
  skipped?: boolean;
  reason?: string;
  issues: string[];
}

export type PublishActor = { userId: string; role: Role | "SYSTEM" };

export interface PublishLevelResult {
  ok: boolean;
  gates: GateResult[];
  version?: number;
}

export interface LevelPublishOutcome {
  levelId: string;
  slug: string;
  ok: boolean;
  gates: GateResult[];
  version?: number;
}

export interface PublishWorldResult {
  ok: boolean;
  worldId: string | null;
  status?: ContentStatus;
  levels: LevelPublishOutcome[];
  issues: string[];
}

export interface TransitionResult {
  ok: boolean;
  issues: string[];
  from?: ContentStatus;
  to?: ContentStatus;
  gates?: GateResult[];
  version?: number;
}

/** Full denormalized level content frozen at publish time. */
export interface LevelSnapshot {
  levelId: string;
  slug: string;
  moduleId: string;
  moduleSlug: string;
  worldId: string;
  worldSlug: string;
  order: number;
  activityType: string;
  track: string;
  title: LocalizedText;
  story: LocalizedText | null;
  objective: LocalizedText | null;
  instructions: LocalizedText | null;
  explanation: LocalizedText | null;
  teacherNotes: LocalizedText | null;
  difficulty: string;
  recommendedGradeMin: number | null;
  recommendedGradeMax: number | null;
  estimatedMinutes: number;
  /** Resolved: explicit xpReward or the difficulty default. */
  xpReward: number;
  maxStars: number;
  tags: string[];
  payload: unknown;
  hints: unknown;
  arComplete: boolean;
}

type LevelWithParents = Level & { module: Module & { world: World } };

// ── Gates ─────────────────────────────────────────────────────────────────

function pass(gate: string): GateResult {
  return { gate, ok: true, issues: [] };
}

function fail(gate: string, issues: string[]): GateResult {
  return { gate, ok: false, issues };
}

function stub(gate: string): GateResult {
  return { gate, ok: true, skipped: true, reason: "engine lands in M3", issues: [] };
}

function gatePayloadValid(level: LevelWithParents): GateResult {
  const result = validatePayload(level.activityType, level.payload);
  return result.ok ? pass("payloadValid") : fail("payloadValid", result.issues);
}

function gateHintsValid(level: LevelWithParents): GateResult {
  const result = hintsSchema.safeParse(level.hints);
  return result.success
    ? pass("hintsValid")
    : fail(
        "hintsValid",
        result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`),
      );
}

function gateEnComplete(level: LevelWithParents): GateResult {
  const fields: Array<[string, unknown]> = [
    ["title", level.title],
    ["objective", level.objective],
    ["instructions", level.instructions],
    ["explanation", level.explanation],
  ];
  const issues: string[] = [];
  for (const [name, value] of fields) {
    const parsed = localizedText.safeParse(value);
    if (!parsed.success || parsed.data.en.trim().length === 0) {
      issues.push(`${name}.en is missing or empty`);
    }
  }
  return issues.length === 0 ? pass("enComplete") : fail("enComplete", issues);
}

function gateOrderIntegrity(
  level: LevelWithParents,
  siblings: { id: string; order: number; slug: string }[],
): GateResult {
  const bySlot = new Map<number, string[]>();
  for (const sibling of siblings) {
    bySlot.set(sibling.order, [...(bySlot.get(sibling.order) ?? []), sibling.slug]);
  }
  const issues = [...bySlot.entries()]
    .filter(([, slugs]) => slugs.length > 1)
    .map(
      ([order, slugs]) =>
        `duplicate order ${order} in module: ${slugs.join(", ")}`,
    );
  return issues.length === 0 ? pass("orderIntegrity") : fail("orderIntegrity", issues);
}

async function gatePrereqAcyclic(level: LevelWithParents): Promise<GateResult> {
  const edges = await db.levelPrerequisite.findMany({
    select: { levelId: true, requiresLevelId: true },
  });
  const requires = new Map<string, string[]>();
  for (const edge of edges) {
    requires.set(edge.levelId, [
      ...(requires.get(edge.levelId) ?? []),
      edge.requiresLevelId,
    ]);
  }
  // DFS along "requires" edges reachable from this level; a node revisited
  // while still on the stack is a cycle.
  const onStack = new Set<string>();
  const done = new Set<string>();
  let cyclic = false;
  const visit = (node: string): void => {
    if (cyclic || done.has(node)) return;
    if (onStack.has(node)) {
      cyclic = true;
      return;
    }
    onStack.add(node);
    for (const next of requires.get(node) ?? []) visit(next);
    onStack.delete(node);
    done.add(node);
  };
  visit(level.id);
  return cyclic
    ? fail("prereqAcyclic", ["prerequisite chain contains a cycle"])
    : pass("prereqAcyclic");
}

function gateParentPublished(
  level: LevelWithParents,
  assumeWorldPublished: boolean,
): GateResult {
  if (assumeWorldPublished || level.module.world.status === "PUBLISHED") {
    return pass("parentPublished");
  }
  return fail("parentPublished", [
    `world "${level.module.world.slug}" is ${level.module.world.status} — publish the world first (or publish them together)`,
  ]);
}

async function runGatesForLevel(
  level: LevelWithParents,
  opts?: { assumeWorldPublished?: boolean },
): Promise<GateResult[]> {
  const siblings = await db.level.findMany({
    where: { moduleId: level.moduleId },
    select: { id: true, order: true, slug: true },
  });
  return [
    gatePayloadValid(level),
    gateHintsValid(level),
    gateEnComplete(level),
    gateOrderIntegrity(level, siblings),
    await gatePrereqAcyclic(level),
    gateParentPublished(level, opts?.assumeWorldPublished ?? false),
    stub("solutionRuns"),
    stub("reachability"),
  ];
}

async function findLevelWithParents(levelId: string): Promise<LevelWithParents | null> {
  return db.level.findUnique({
    where: { id: levelId },
    include: { module: { include: { world: true } } },
  });
}

// ── Public API (pinned cross-agent interface) ─────────────────────────────

export async function runPublishGates(
  levelId: string,
  opts?: { assumeWorldPublished?: boolean },
): Promise<GateResult[]> {
  const level = await findLevelWithParents(levelId);
  if (!level) return [fail("levelExists", ["Level not found"])];
  return runGatesForLevel(level, opts);
}

function asText(value: Prisma.JsonValue | null): LocalizedText | null {
  const parsed = localizedText.safeParse(value);
  return parsed.success ? parsed.data : null;
}

function buildSnapshot(level: LevelWithParents): LevelSnapshot {
  return {
    levelId: level.id,
    slug: level.slug,
    moduleId: level.moduleId,
    moduleSlug: level.module.slug,
    worldId: level.module.worldId,
    worldSlug: level.module.world.slug,
    order: level.order,
    activityType: level.activityType,
    track: level.track,
    title: asText(level.title) ?? { en: "" },
    story: asText(level.story),
    objective: asText(level.objective),
    instructions: asText(level.instructions),
    explanation: asText(level.explanation),
    teacherNotes: asText(level.teacherNotes),
    difficulty: level.difficulty,
    recommendedGradeMin: level.recommendedGradeMin,
    recommendedGradeMax: level.recommendedGradeMax,
    estimatedMinutes: level.estimatedMinutes,
    xpReward: level.xpReward ?? XP_BY_DIFFICULTY[level.difficulty],
    maxStars: level.maxStars,
    tags: level.tags,
    payload: level.payload,
    hints: level.hints,
    arComplete: level.arComplete,
  };
}

export async function publishLevel(
  actor: PublishActor,
  levelId: string,
  opts?: { assumeWorldPublished?: boolean },
): Promise<PublishLevelResult> {
  const level = await findLevelWithParents(levelId);
  if (!level) {
    return { ok: false, gates: [fail("levelExists", ["Level not found"])] };
  }
  const gates = await runGatesForLevel(level, opts);
  if (gates.some((g) => !g.ok)) return { ok: false, gates };

  const version = await db.$transaction(async (tx) => {
    const previous = await tx.levelVersion.findFirst({
      where: { levelId },
      orderBy: { version: "desc" },
      select: { version: true },
    });
    const nextVersion = (previous?.version ?? 0) + 1;
    const row = await tx.levelVersion.create({
      data: {
        levelId,
        version: nextVersion,
        snapshot: buildSnapshot(level) as unknown as Prisma.InputJsonValue,
        publishedById: actor.userId,
      },
    });
    await tx.level.update({
      where: { id: levelId },
      data: { status: "PUBLISHED", publishedVersionId: row.id },
    });
    return nextVersion;
  });

  await audit({
    action: CURRICULUM_STATUS_CHANGED_ACTION,
    actorUserId: actor.userId,
    actorRole: actor.role,
    targetType: "level",
    targetId: levelId,
    meta: { from: level.status, to: "PUBLISHED", version },
  });
  return { ok: true, gates, version };
}

/**
 * Publishes a world together with every level in it that is not yet live.
 * All-or-nothing on gates: if any pending level fails, nothing changes and
 * the per-level gate results come back for the UI. ARCHIVED levels are left
 * alone; already-PUBLISHED levels are not re-versioned (republish a single
 * level explicitly via publishLevel).
 */
export async function publishWorld(
  actor: PublishActor,
  worldId: string,
): Promise<PublishWorldResult> {
  const world = await db.world.findUnique({
    where: { id: worldId },
    include: {
      modules: {
        orderBy: { order: "asc" },
        include: {
          levels: {
            orderBy: { order: "asc" },
            select: { id: true, slug: true, status: true },
          },
        },
      },
    },
  });
  if (!world) {
    return { ok: false, worldId: null, levels: [], issues: ["World not found"] };
  }

  const pending = world.modules
    .flatMap((m) => m.levels)
    .filter((l) => l.status !== "PUBLISHED" && l.status !== "ARCHIVED");

  const gateChecks: LevelPublishOutcome[] = [];
  for (const level of pending) {
    const gates = await runPublishGates(level.id, { assumeWorldPublished: true });
    gateChecks.push({
      levelId: level.id,
      slug: level.slug,
      ok: gates.every((g) => g.ok),
      gates,
    });
  }
  const failing = gateChecks.filter((c) => !c.ok);
  if (failing.length > 0) {
    return {
      ok: false,
      worldId: world.id,
      status: world.status,
      levels: gateChecks,
      issues: failing.map((f) => `level "${f.slug}" failed publish gates`),
    };
  }

  if (world.status !== "PUBLISHED") {
    await db.world.update({ where: { id: world.id }, data: { status: "PUBLISHED" } });
    await audit({
      action: CURRICULUM_STATUS_CHANGED_ACTION,
      actorUserId: actor.userId,
      actorRole: actor.role,
      targetType: "world",
      targetId: world.id,
      meta: { from: world.status, to: "PUBLISHED" },
    });
  }

  const outcomes: LevelPublishOutcome[] = [];
  for (const level of pending) {
    const result = await publishLevel(actor, level.id, { assumeWorldPublished: true });
    outcomes.push({
      levelId: level.id,
      slug: level.slug,
      ok: result.ok,
      gates: result.gates,
      version: result.version,
    });
  }

  return {
    ok: outcomes.every((o) => o.ok),
    worldId: world.id,
    status: "PUBLISHED",
    levels: outcomes,
    issues: [],
  };
}

/**
 * Allowed status moves. Publishing a LEVEL always goes through the gate
 * pipeline (delegated to publishLevel); worlds and programs transition
 * freely along the map. Archiving keeps the published snapshots — status is
 * what hides content from published readers.
 */
const TRANSITIONS: Record<ContentStatus, readonly ContentStatus[]> = {
  DRAFT: ["REVIEW", "PUBLISHED"],
  REVIEW: ["DRAFT", "PUBLISHED"],
  PUBLISHED: ["ARCHIVED"],
  ARCHIVED: ["DRAFT"],
};

export async function transitionStatus(
  actor: PublishActor,
  entity: "program" | "world" | "module" | "level",
  id: string,
  to: ContentStatus,
): Promise<TransitionResult> {
  if (entity === "module") {
    return {
      ok: false,
      issues: ["Modules do not carry a status in M2 — visibility follows their world"],
    };
  }

  const current =
    entity === "program"
      ? await db.program.findUnique({ where: { id }, select: { status: true } })
      : entity === "world"
        ? await db.world.findUnique({ where: { id }, select: { status: true } })
        : await db.level.findUnique({ where: { id }, select: { status: true } });
  if (!current) {
    return { ok: false, to, issues: [`${entity} not found`] };
  }

  const from = current.status;
  if (from === to) return { ok: true, from, to, issues: [] };
  if (!TRANSITIONS[from].includes(to)) {
    return { ok: false, from, to, issues: [`Invalid status transition ${from} → ${to}`] };
  }

  if (entity === "level" && to === "PUBLISHED") {
    const result = await publishLevel(actor, id);
    return {
      ok: result.ok,
      from,
      to,
      gates: result.gates,
      version: result.version,
      issues: result.ok ? [] : ["Publish gates failed"],
    };
  }

  if (entity === "program") {
    await db.program.update({ where: { id }, data: { status: to } });
  } else if (entity === "world") {
    await db.world.update({ where: { id }, data: { status: to } });
  } else {
    await db.level.update({ where: { id }, data: { status: to } });
  }

  await audit({
    action: CURRICULUM_STATUS_CHANGED_ACTION,
    actorUserId: actor.userId,
    actorRole: actor.role,
    targetType: entity,
    targetId: id,
    meta: { from, to },
  });
  return { ok: true, from, to, issues: [] };
}
