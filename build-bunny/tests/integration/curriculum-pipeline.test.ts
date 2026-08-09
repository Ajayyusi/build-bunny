import { beforeAll, describe, expect, it } from "vitest";

import { db } from "@/lib/db";
import {
  commitImport,
  dryRunImport,
  type ImportBundle,
} from "@/modules/curriculum/server/import";
import {
  publishLevel,
  publishWorld,
  runPublishGates,
  transitionStatus,
} from "@/modules/curriculum/server/publish";
import {
  getPublishedLevelSnapshot,
  stripStudentPayload,
} from "@/modules/curriculum/server/queries";
import { SYSTEM_ACTOR, wipeDatabase } from "../helpers/fixtures";

/**
 * Import → gates → publish pipeline. Uses a tiny inline fixture bundle (the
 * real bundled content has its own owner); asserts the pinned contract:
 * slug-path upserts that never delete, idempotent re-import, gate failures
 * blocking publish, immutable LevelVersion snapshots, and ARCHIVED hiding
 * content from published readers.
 */

// The recorded solution must survive the REAL solutionRuns gate: two hops
// east land on the goal, 2 statement blocks ≤ the 3-star budget.
const VALID_PAYLOAD = {
  toolbox: [{ type: "bb_whenStart" }, { type: "bb_moveForward" }, { type: "bb_turnRight" }],
  variants: [{ rows: ["..G", "..."], start: { x: 0, y: 0, dir: "E" } }],
  checks: [{ id: "reachedGoal", severity: "core" }],
  starCriteria: { threeStarMaxBlocks: 3 },
  solution: {
    blocks: {
      languageVersion: 0,
      blocks: [
        {
          type: "bb_whenStart",
          id: "start",
          next: {
            block: {
              type: "bb_moveForward",
              id: "m1",
              next: { block: { type: "bb_moveForward", id: "m2" } },
            },
          },
        },
      ],
    },
  },
};

const HINTS = [1, 2, 3, 4].map((tier) => ({
  tier,
  text: { en: `Hint tier ${tier}`, ar: `تلميح ${tier}` },
}));

function makeBundle(): ImportBundle {
  return {
    programs: [
      {
        slug: "pipe-foundations",
        name: { en: "Pipeline Foundations" },
        gradeMin: 3,
        gradeMax: 7,
        worlds: ["pipe-meadow"],
      },
    ],
    worlds: [
      {
        slug: "pipe-meadow",
        name: { en: "Pipeline Meadow", ar: "مرج الاختبار" },
        tagline: { en: "Testing grounds" },
        theme: "meadow",
        horizon: false,
        modules: [
          {
            slug: "pipe-basics",
            order: 1,
            name: { en: "Pipeline Basics" },
            levels: [
              {
                slug: "pipe-first-hop",
                order: 1,
                activityType: "BLOCK_CODING",
                track: "PROGRAMMING",
                title: { en: "First Hop" },
                story: { en: "Bunny wakes up hungry." },
                objective: { en: "Reach the goal." },
                instructions: { en: "Use move blocks to hop to the burrow." },
                explanation: { en: "Programs run one block at a time, in order." },
                difficulty: "EASY",
                estimatedMinutes: 5,
                tags: ["sequence"],
                payload: VALID_PAYLOAD,
                hints: HINTS,
                requires: [],
              },
            ],
          },
        ],
      },
    ],
  } as unknown as ImportBundle;
}

const LEVEL_LABEL = "world:pipe-meadow/module:pipe-basics/level:pipe-first-hop";

async function findLevel() {
  const level = await db.level.findFirst({
    where: { slug: "pipe-first-hop" },
    include: { module: { include: { world: true } } },
  });
  expect(level).not.toBeNull();
  return level!;
}

beforeAll(async () => {
  await wipeDatabase();
});

describe("import service", () => {
  it("dry-run on an empty database reports pure creates and writes nothing", async () => {
    const diff = await dryRunImport(makeBundle());
    expect(diff.issues).toEqual([]);
    expect(diff.updates).toEqual([]);
    expect(diff.unchanged).toEqual([]);
    expect(diff.creates).toContain("program:pipe-foundations");
    expect(diff.creates).toContain("world:pipe-meadow");
    expect(diff.creates).toContain("world:pipe-meadow/module:pipe-basics");
    expect(diff.creates).toContain(LEVEL_LABEL);

    expect(await db.world.count()).toBe(0);
    expect(await db.program.count()).toBe(0);
    expect(await db.level.count()).toBe(0);
  });

  it("rejects a malformed bundle as issues without throwing", async () => {
    const diff = await dryRunImport({ programs: "nope" });
    expect(diff.creates).toEqual([]);
    expect(diff.issues.length).toBeGreaterThan(0);
  });

  it("commit creates the slug-path tree, audits, and starts everything DRAFT", async () => {
    const diff = await commitImport(SYSTEM_ACTOR, makeBundle());
    expect(diff.issues).toEqual([]);
    expect(diff.creates).toHaveLength(4);

    const level = await findLevel();
    expect(level.status).toBe("DRAFT");
    expect(level.module.world.status).toBe("DRAFT");
    expect(level.xpReward).toBeNull(); // difficulty default applies at read time
    expect(level.arComplete).toBe(false); // EN-only prose fields

    const auditRow = await db.auditLog.findFirst({
      where: { action: "curriculum.imported" },
    });
    expect(auditRow).not.toBeNull();
  });

  it("re-committing identical content is idempotent — everything unchanged", async () => {
    const before = await db.level.findFirst({ where: { slug: "pipe-first-hop" } });
    const diff = await commitImport(SYSTEM_ACTOR, makeBundle());
    expect(diff.creates).toEqual([]);
    expect(diff.updates).toEqual([]);
    expect(diff.issues).toEqual([]);
    expect(diff.unchanged).toHaveLength(4);

    const after = await db.level.findFirst({ where: { slug: "pipe-first-hop" } });
    expect(after?.updatedAt.getTime()).toBe(before?.updatedAt.getTime());
  });
});

describe("publish gates", () => {
  it("fail on a missing EN explanation and a bad payload", async () => {
    const level = await findLevel();
    await db.level.update({
      where: { id: level.id },
      data: { explanation: { en: "" }, payload: { toolbox: [] } },
    });

    const gates = await runPublishGates(level.id);
    const byName = new Map(gates.map((g) => [g.gate, g]));
    expect(byName.get("enComplete")?.ok).toBe(false);
    expect(byName.get("payloadValid")?.ok).toBe(false);
    // World is still DRAFT, so standalone level publish is blocked too.
    expect(byName.get("parentPublished")?.ok).toBe(false);
    // The engine gates run for real now: an unparseable payload fails both
    // (they cannot grade or BFS a payload that doesn't validate).
    expect(byName.get("solutionRuns")?.ok).toBe(false);
    expect(byName.get("reachability")?.ok).toBe(false);

    const result = await publishLevel(SYSTEM_ACTOR, level.id);
    expect(result.ok).toBe(false);
    expect(result.version).toBeUndefined();
    expect(await db.levelVersion.count({ where: { levelId: level.id } })).toBe(0);
  });

  it("re-import repairs the corrupted draft fields (reported as an update)", async () => {
    const diff = await commitImport(SYSTEM_ACTOR, makeBundle());
    expect(diff.updates).toContain(LEVEL_LABEL);
    expect(diff.creates).toEqual([]);

    const level = await findLevel();
    const gates = await runPublishGates(level.id);
    const failing = gates.filter((g) => !g.ok).map((g) => g.gate);
    expect(failing).toEqual(["parentPublished"]);
  });
});

describe("publish + status transitions", () => {
  it("walks the level DRAFT → REVIEW and the world DRAFT → REVIEW → PUBLISHED", async () => {
    const level = await findLevel();
    const worldId = level.module.worldId;

    const levelToReview = await transitionStatus(SYSTEM_ACTOR, "level", level.id, "REVIEW");
    expect(levelToReview.ok).toBe(true);

    const toReview = await transitionStatus(SYSTEM_ACTOR, "world", worldId, "REVIEW");
    expect(toReview.ok).toBe(true);
    const toPublished = await transitionStatus(SYSTEM_ACTOR, "world", worldId, "PUBLISHED");
    expect(toPublished.ok).toBe(true);

    const world = await db.world.findUnique({ where: { id: worldId } });
    expect(world?.status).toBe("PUBLISHED");
  });

  it("rejects an invalid transition", async () => {
    const level = await findLevel();
    // REVIEW → ARCHIVED is not on the transition map.
    const result = await transitionStatus(SYSTEM_ACTOR, "level", level.id, "ARCHIVED");
    expect(result.ok).toBe(false);
    expect(result.issues.join(" ")).toContain("Invalid status transition");
  });

  it("publishLevel writes LevelVersion v1, sets PUBLISHED, and audits", async () => {
    const level = await findLevel();
    const result = await publishLevel(SYSTEM_ACTOR, level.id);
    expect(result.ok).toBe(true);
    expect(result.version).toBe(1);

    const updated = await findLevel();
    expect(updated.status).toBe("PUBLISHED");
    expect(updated.publishedVersionId).not.toBeNull();

    const version = await db.levelVersion.findUnique({
      where: { levelId_version: { levelId: level.id, version: 1 } },
    });
    expect(version).not.toBeNull();
    expect(version?.id).toBe(updated.publishedVersionId);
    const snapshot = version?.snapshot as Record<string, unknown>;
    expect(snapshot["title"]).toEqual({ en: "First Hop" });
    expect(snapshot["worldSlug"]).toBe("pipe-meadow");
    expect(snapshot["xpReward"]).toBe(50); // EASY default resolved into the snapshot

    const auditRow = await db.auditLog.findFirst({
      where: { action: "curriculum.status_changed", targetId: level.id },
    });
    expect(auditRow).not.toBeNull();
  });

  it("published readers serve the snapshot; stripStudentPayload removes answers", async () => {
    const level = await findLevel();
    const published = await getPublishedLevelSnapshot(level.id);
    expect(published).not.toBeNull();
    expect(published?.version).toBe(1);
    expect(published?.snapshot.title).toEqual({ en: "First Hop" });
    // Server-internal snapshot still carries the solution...
    const payload = published?.snapshot.payload as Record<string, unknown>;
    expect(payload["solution"]).toBeDefined();
    // ...which the student-facing strip removes (hints live outside payload).
    const stripped = stripStudentPayload(
      "BLOCK_CODING",
      payload,
    ) as Record<string, unknown>;
    expect(stripped["solution"]).toBeUndefined();
    expect(stripped["toolbox"]).toBeDefined();
    expect(stripped["variants"]).toBeDefined();
  });

  it("republish after an edit writes v2 and leaves the v1 snapshot pinned", async () => {
    const level = await findLevel();
    await db.level.update({
      where: { id: level.id },
      data: { title: { en: "First Hop (revised)" } },
    });

    const result = await publishLevel(SYSTEM_ACTOR, level.id);
    expect(result.ok).toBe(true);
    expect(result.version).toBe(2);

    const v1 = await db.levelVersion.findUnique({
      where: { levelId_version: { levelId: level.id, version: 1 } },
    });
    const v2 = await db.levelVersion.findUnique({
      where: { levelId_version: { levelId: level.id, version: 2 } },
    });
    // Pinning: the old snapshot is untouched; the pointer moved to v2.
    expect((v1?.snapshot as Record<string, unknown>)["title"]).toEqual({
      en: "First Hop",
    });
    expect((v2?.snapshot as Record<string, unknown>)["title"]).toEqual({
      en: "First Hop (revised)",
    });
    const updated = await findLevel();
    expect(updated.publishedVersionId).toBe(v2?.id);

    const published = await getPublishedLevelSnapshot(level.id);
    expect(published?.version).toBe(2);
  });

  it("import never touches the published snapshot — draft fields only", async () => {
    // The DB title was edited after the last import; re-importing the bundle
    // restores the draft field (an update) but v2 stays exactly as published.
    const diff = await commitImport(SYSTEM_ACTOR, makeBundle());
    expect(diff.updates).toContain(LEVEL_LABEL);

    const level = await findLevel();
    expect(level.status).toBe("PUBLISHED");
    expect(level.title).toEqual({ en: "First Hop" });
    const published = await getPublishedLevelSnapshot(level.id);
    expect(published?.version).toBe(2);
    expect(published?.snapshot.title).toEqual({ en: "First Hop (revised)" });
  });

  it("ARCHIVED hides the level from published readers but keeps history", async () => {
    const level = await findLevel();
    const result = await transitionStatus(SYSTEM_ACTOR, "level", level.id, "ARCHIVED");
    expect(result.ok).toBe(true);

    expect(await getPublishedLevelSnapshot(level.id)).toBeNull();
    expect(await db.levelVersion.count({ where: { levelId: level.id } })).toBe(2);

    // ARCHIVED → DRAFT restores editability (still hidden until republished).
    const restore = await transitionStatus(SYSTEM_ACTOR, "level", level.id, "DRAFT");
    expect(restore.ok).toBe(true);
    expect(await getPublishedLevelSnapshot(level.id)).toBeNull();
  });

  it("publishWorld publishes the world and its pending levels together", async () => {
    const bundle = makeBundle();
    const world = bundle.worlds[0]!;
    world.slug = "pipe-forest";
    world.name = { en: "Pipeline Forest" };
    world.modules[0]!.slug = "pipe-loops";
    world.modules[0]!.levels[0]!.slug = "pipe-loop-hop";
    bundle.programs = [];
    const diff = await commitImport(SYSTEM_ACTOR, bundle);
    expect(diff.issues).toEqual([]);

    const worldRow = await db.world.findUnique({ where: { slug: "pipe-forest" } });
    expect(worldRow?.status).toBe("DRAFT");

    const result = await publishWorld(SYSTEM_ACTOR, worldRow!.id);
    expect(result.ok).toBe(true);
    expect(result.status).toBe("PUBLISHED");
    expect(result.levels).toHaveLength(1);
    expect(result.levels[0]?.version).toBe(1);

    const level = await db.level.findFirst({ where: { slug: "pipe-loop-hop" } });
    expect(level?.status).toBe("PUBLISHED");
    expect(await getPublishedLevelSnapshot(level!.id)).not.toBeNull();
  });
});
