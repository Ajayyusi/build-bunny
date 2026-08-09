import { db } from "@/lib/db";

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
