import { timingSafeEqual } from "node:crypto";

import { NextResponse, type NextRequest } from "next/server";

import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import { sendWeeklyFamilyEmails } from "@/modules/family/server/email";

/**
 * The weekly family email run, called by Vercel Cron (vercel.json) with
 * `Authorization: Bearer $CRON_SECRET`. Without CRON_SECRET set, the route
 * refuses everything. The response carries counts only, never an address.
 */
export const dynamic = "force-dynamic";
export const maxDuration = 300;

function authorized(request: NextRequest): boolean {
  if (!env.CRON_SECRET) return false;
  const given = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${env.CRON_SECRET}`);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

export async function GET(request: NextRequest) {
  if (!authorized(request)) return NextResponse.json({ ok: false }, { status: 401 });
  const result = await sendWeeklyFamilyEmails();
  logger.info("family_email.weekly_run", { ...result });
  return NextResponse.json({ ok: true, ...result });
}
