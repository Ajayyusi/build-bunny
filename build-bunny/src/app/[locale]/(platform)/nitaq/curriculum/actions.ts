"use server";

import { z } from "zod";

import { withAuth, type ActionResult } from "@/modules/auth/server/guard";
import { getBundledContent } from "@/modules/curriculum/server/bundled";
import {
  commitImport,
  dryRunImport,
  type ImportDiff,
} from "@/modules/curriculum/server/import";
import {
  publishLevel,
  type GateResult,
  publishWorld,
  type PublishWorldResult,
} from "@/modules/curriculum/server/publish";

/**
 * Platform curriculum server actions. Import runs under curriculum:author,
 * publish under curriculum:publish — both platform-only grants. Handlers
 * return diffs/gate results as data; JSON parse failures surface as an
 * ImportDiff issue so the wizard renders them in the same report table.
 */

const bundleInput = z.object({ bundleJson: z.string().min(1) });

function parseBundleJson(
  bundleJson: string,
): { ok: true; bundle: unknown } | { ok: false; diff: ImportDiff } {
  try {
    return { ok: true, bundle: JSON.parse(bundleJson) };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      ok: false,
      diff: {
        creates: [],
        updates: [],
        unchanged: [],
        issues: [`bundle: not valid JSON — ${message}`],
      },
    };
  }
}

export async function dryRunImportAction(
  input: unknown,
): Promise<ActionResult<ImportDiff>> {
  return withAuth("curriculum:author", bundleInput, async (_ctx, { bundleJson }) => {
    const parsed = parseBundleJson(bundleJson);
    if (!parsed.ok) return parsed.diff;
    return dryRunImport(parsed.bundle);
  })(input);
}

export async function commitImportAction(
  input: unknown,
): Promise<ActionResult<ImportDiff>> {
  return withAuth("curriculum:author", bundleInput, async (ctx, { bundleJson }) => {
    const parsed = parseBundleJson(bundleJson);
    if (!parsed.ok) return parsed.diff;
    return commitImport({ userId: ctx.userId, role: ctx.role }, parsed.bundle);
  })(input);
}

export async function loadBundledContentAction(
  input: unknown,
): Promise<ActionResult<{ bundleJson: string }>> {
  return withAuth("curriculum:author", z.object({}), async () => ({
    bundleJson: JSON.stringify(getBundledContent(), null, 2),
  }))(input);
}

export interface PublishLevelActionData {
  ok: boolean;
  gates: GateResult[];
  version?: number;
}

export async function publishLevelAction(
  input: unknown,
): Promise<ActionResult<PublishLevelActionData>> {
  return withAuth(
    "curriculum:publish",
    z.object({ levelId: z.string().min(1) }),
    async (ctx, { levelId }) =>
      publishLevel({ userId: ctx.userId, role: ctx.role }, levelId),
  )(input);
}

/**
 * Publish every not-yet-live level in a world in one go.
 *
 * publishWorld has existed in the curriculum module since m2 with no caller,
 * which meant bringing a world live in production was one click per level —
 * fourteen of them after a content import, with no way to tell part-way
 * through whether you had missed one. It is all-or-nothing on the gates, so
 * a world either goes live intact or nothing changes.
 */
export async function publishWorldAction(
  input: unknown,
): Promise<ActionResult<PublishWorldResult>> {
  return withAuth(
    "curriculum:publish",
    z.object({ worldId: z.string().min(1) }),
    async (ctx, { worldId }) => publishWorld({ userId: ctx.userId, role: ctx.role }, worldId),
  )(input);
}
