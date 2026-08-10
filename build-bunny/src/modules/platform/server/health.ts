import { readdir } from "node:fs/promises";
import path from "node:path";

import { db } from "@/lib/db";
// Resolved at BUILD time (webpack inlines the JSON) — reads the same version
// string in dev, `next start`, and the standalone server, with no runtime
// dependency on npm_package_version (only set when a process is launched via
// `npm run <script>`, which the standalone server usually isn't).
import packageJson from "../../../../package.json";

// Liveness-level DB check: a raw SELECT 1 avoids touching any tenant data and
// never throws — the health route maps { db: false } to a 503.
export async function checkDbHealth(): Promise<{ db: boolean }> {
  try {
    await db.$queryRaw`SELECT 1`;
    return { db: true };
  } catch {
    return { db: false };
  }
}

export interface MigrationStatus {
  /** Migrations Prisma recorded as fully applied. */
  applied: number;
  /**
   * Migrations present in the shipped prisma/migrations directory. Null when
   * that directory isn't reachable from process.cwd() at runtime (a
   * standalone bundle that didn't carry prisma/ along) — `migrate deploy`
   * needs the same directory anyway, so any real deployment has it.
   */
  expected: number | null;
  upToDate: boolean | null;
}

/**
 * Cheap by construction: COUNT(*) on a table that only ever holds a handful
 * of rows (one per migration ever applied), plus a directory listing —
 * neither touches tenant data or a large table.
 */
export async function checkMigrationStatus(): Promise<MigrationStatus> {
  let applied = 0;
  try {
    const rows = await db.$queryRaw<{ count: bigint }[]>`
      SELECT COUNT(*)::bigint AS count FROM "_prisma_migrations" WHERE finished_at IS NOT NULL
    `;
    applied = Number(rows[0]?.count ?? 0);
  } catch {
    // Table missing (never migrated) or DB unreachable — checkDbHealth
    // already reports connectivity; this just degrades to 0.
  }

  let expected: number | null = null;
  try {
    const entries = await readdir(path.join(process.cwd(), "prisma", "migrations"), {
      withFileTypes: true,
    });
    expected = entries.filter((e) => e.isDirectory()).length;
  } catch {
    expected = null;
  }

  return {
    applied,
    expected,
    upToDate: expected === null ? null : applied === expected,
  };
}

/** PUBLISHED, non-archived levels with a live snapshot — the content the app can actually serve. */
export async function countPublishedLevels(): Promise<number> {
  try {
    return await db.level.count({
      where: { status: "PUBLISHED", publishedVersionId: { not: null } },
    });
  } catch {
    return 0;
  }
}

/** App version — inlined from package.json at build time (see import above). */
export function appVersion(): string {
  return packageJson.version ?? "dev";
}
