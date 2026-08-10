import { NextResponse } from "next/server";
import {
  appVersion,
  checkDbHealth,
  checkMigrationStatus,
  countPublishedLevels,
} from "@/modules/platform/server/health";

// Unauthenticated by design: load balancers and uptime probes must be able to
// hit this before any session exists. It exposes no tenant data — every
// field here is an aggregate count or a boolean, never a row.
export const dynamic = "force-dynamic";

export async function GET() {
  const { db } = await checkDbHealth();
  // Migrations/content counts only mean anything once the DB itself answers —
  // skip them on a dead connection instead of racking up more failed queries.
  const [migrations, publishedLevels] = db
    ? await Promise.all([checkMigrationStatus(), countPublishedLevels()])
    : [{ applied: 0, expected: null, upToDate: null }, 0];

  const ok = db && migrations.upToDate !== false;
  return NextResponse.json(
    {
      ok,
      db,
      version: appVersion(),
      migrations,
      content: { publishedLevels },
    },
    { status: ok ? 200 : 503 },
  );
}
