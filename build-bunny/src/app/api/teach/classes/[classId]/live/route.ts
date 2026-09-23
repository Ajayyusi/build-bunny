import { NextResponse } from "next/server";

import { getSessionContext } from "@/modules/auth/server/session";
import { buildLiveSnapshot } from "@/modules/analytics/live";
import { getClassMatrix } from "@/modules/analytics/server/queries";

/**
 * GET /api/teach/classes/[classId]/live — polled every 20s by the projector
 * view (m4 deliverable 7). Read-only, no student PII beyond display names.
 * Reuses the real matrix query — never fake data. Locale and the chosen
 * class-challenge level come from the client's own query string, since this
 * route has no next-intl request context of its own.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ classId: string }> },
) {
  const ctx = await getSessionContext();
  if (!ctx || (ctx.role !== "TEACHER" && ctx.role !== "SCHOOL_ADMIN")) {
    return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  }
  const { classId } = await params;
  const search = new URL(request.url).searchParams;
  const locale = search.get("locale") === "ar" ? "ar" : "en";
  const matrix = await getClassMatrix(ctx, classId);
  if (!matrix) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }
  return NextResponse.json(buildLiveSnapshot(matrix, locale, search.get("challenge")));
}
