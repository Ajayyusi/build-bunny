import { NextResponse } from "next/server";
import { checkDbHealth } from "@/modules/platform/server/health";

// Unauthenticated by design: load balancers and uptime probes must be able to
// hit this before any session exists. It exposes no tenant data.
export const dynamic = "force-dynamic";

export async function GET() {
  const { db } = await checkDbHealth();
  return NextResponse.json(
    {
      ok: db,
      db,
      version: process.env.npm_package_version ?? "dev",
    },
    { status: db ? 200 : 503 },
  );
}
