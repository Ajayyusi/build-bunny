import "dotenv/config";

import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { PrismaClient } from "@prisma/client";

/**
 * Classroom load sanity (plan §M5 task 6). Fires N concurrent, REAL attempt
 * submissions at an already-running app and reports latency/error/throughput
 * numbers. This is a pure HTTP client — it does not start or stop the app.
 * The operations doc records the actual numbers from a real run:
 *
 *   npm run build
 *   PORT=3005 NEXT_PUBLIC_APP_URL=http://localhost:3005 \
 *     node .next/standalone/server.js &
 *   npx tsx scripts/load-check.ts --n=40
 *
 * Why real solutions, not empty workspaces: every attempt runs through the
 * SAME shared pipeline regardless of verdict (idempotency check, grading,
 * reward transaction incl. the XP-ledger lookup and achievements
 * evaluation, streak upsert) — only recomputeUnlocks + certificate issuance
 * are skipped on a non-completing run. Submitting the level's own authored
 * `solution` (fetched straight from the published snapshot, not the
 * student-stripped payload) exercises the full PASS path so the numbers
 * reflect the heaviest realistic case, not a shortcut.
 *
 * Login uses the seeded DEMO school students (prisma/seed-output/
 * credentials.md for passwords — gitignored, read at runtime only). Only a
 * handful of DISTINCT logins are performed regardless of --n: better-auth's
 * own sign-in rate limit (10 per 15 min per IP, src/lib/auth.ts) would trip
 * long before a real classroom's 40 students would, since this script's
 * requests all originate from one IP. Concurrency is achieved by replaying
 * the same small set of authenticated sessions in parallel, which still
 * fully exercises the endpoint under test (the attempts route itself has no
 * per-student concurrency limit beyond the 30/min rate limiter, which this
 * stays well under per student).
 */

const DEMO_SCHOOL_CODE = "DEMO";
const MAX_DISTINCT_LOGINS = 8;

interface CliOptions {
  n: number;
  baseUrl: string;
}

function parseArgs(): CliOptions {
  const args = process.argv.slice(2);
  let n = 40;
  let baseUrl = process.env.LOAD_CHECK_BASE_URL ?? "http://localhost:3005";
  for (const arg of args) {
    const nMatch = /^--n=(\d+)$/.exec(arg);
    const urlMatch = /^--base-url=(.+)$/.exec(arg);
    if (nMatch) n = Number(nMatch[1]);
    if (urlMatch) baseUrl = urlMatch[1]!;
  }
  return { n, baseUrl };
}

/** Parses the `| Name | \`username\` | \`password\` | STUDENT-ID |` rows credentials.md prints for students only (staff rows have an unquoted email column, never matching this shape). */
async function loadStudentPasswords(): Promise<Map<string, string>> {
  const file = path.resolve(import.meta.dirname, "..", "prisma", "seed-output", "credentials.md");
  const text = await readFile(file, "utf8");
  const passwordsByUsername = new Map<string, string>();
  const rowPattern = /^\|\s*.+?\s*\|\s*`([a-z0-9_]+)`\s*\|\s*`([^`]+)`\s*\|\s*[A-Z0-9-]+\s*\|$/gm;
  for (const match of text.matchAll(rowPattern)) {
    passwordsByUsername.set(match[1]!, match[2]!);
  }
  return passwordsByUsername;
}

interface AuthedSession {
  username: string;
  cookie: string;
}

async function signIn(baseUrl: string, username: string, password: string): Promise<AuthedSession | null> {
  const res = await fetch(`${baseUrl}/api/auth/sign-in/username`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: baseUrl },
    body: JSON.stringify({ username, password }),
  });
  if (!res.ok) {
    console.error(`[load-check] sign-in failed for ${username}: ${res.status} ${await res.text()}`);
    return null;
  }
  const setCookie = typeof res.headers.getSetCookie === "function" ? res.headers.getSetCookie() : [];
  if (setCookie.length === 0) {
    console.error(`[load-check] sign-in for ${username} returned no session cookie`);
    return null;
  }
  const cookie = setCookie.map((c) => c.split(";")[0]).join("; ");
  return { username, cookie };
}

interface AttemptTiming {
  ok: boolean;
  status: number;
  latencyMs: number;
}

async function submitOne(
  baseUrl: string,
  levelId: string,
  solution: unknown,
  session: AuthedSession,
): Promise<AttemptTiming> {
  const startedAt = performance.now();
  try {
    const res = await fetch(`${baseUrl}/api/levels/${levelId}/attempts`, {
      method: "POST",
      headers: { "content-type": "application/json", origin: baseUrl, cookie: session.cookie },
      body: JSON.stringify({
        attemptRunId: randomUUID(),
        workspaceJson: solution,
        durationMs: 4000,
      }),
    });
    await res.json().catch(() => null);
    return { ok: res.ok, status: res.status, latencyMs: performance.now() - startedAt };
  } catch (err) {
    console.error("[load-check] request failed:", err);
    return { ok: false, status: 0, latencyMs: performance.now() - startedAt };
  }
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[Math.max(0, idx)]!;
}

async function main() {
  const { n, baseUrl } = parseArgs();
  const db = new PrismaClient();

  console.log(`[load-check] target: ${baseUrl}  concurrency: ${n}`);

  const health = await fetch(`${baseUrl}/api/health`).catch(() => null);
  if (!health || !health.ok) {
    console.error(`[load-check] ${baseUrl}/api/health is not reachable/healthy — is the server running?`);
    process.exitCode = 1;
    await db.$disconnect();
    return;
  }

  const school = await db.school.findUnique({ where: { code: DEMO_SCHOOL_CODE }, select: { id: true } });
  if (!school) {
    console.error(`[load-check] no school with code ${DEMO_SCHOOL_CODE} — run npm run db:seed first`);
    process.exitCode = 1;
    await db.$disconnect();
    return;
  }

  const level = await db.level.findFirst({
    where: { slug: "first-hop", status: "PUBLISHED" },
    select: { id: true, publishedVersionId: true },
  });
  if (!level?.publishedVersionId) {
    console.error("[load-check] level 'first-hop' is not published — run the seed/import first");
    process.exitCode = 1;
    await db.$disconnect();
    return;
  }
  const version = await db.levelVersion.findUnique({
    where: { id: level.publishedVersionId },
    select: { snapshot: true },
  });
  const snapshot = version?.snapshot as { payload?: { solution?: unknown } } | undefined;
  const solution = snapshot?.payload?.solution;
  if (!solution) {
    console.error("[load-check] level 'first-hop' snapshot has no payload.solution");
    process.exitCode = 1;
    await db.$disconnect();
    return;
  }

  const students = await db.user.findMany({
    where: { schoolId: school.id, role: "STUDENT" },
    select: { username: true },
    take: MAX_DISTINCT_LOGINS,
  });
  const passwords = await loadStudentPasswords();

  const sessions: AuthedSession[] = [];
  for (const student of students) {
    if (!student.username) continue;
    const local = student.username.split("__").pop()!;
    const password = passwords.get(local);
    if (!password) {
      console.warn(`[load-check] no credentials.md entry for ${student.username} — skipping`);
      continue;
    }
    const session = await signIn(baseUrl, student.username, password);
    if (session) sessions.push(session);
    // Stay well clear of better-auth's own sign-in rate limiter.
    await new Promise((r) => setTimeout(r, 150));
  }
  await db.$disconnect();

  if (sessions.length === 0) {
    console.error("[load-check] could not authenticate any student — aborting");
    process.exitCode = 1;
    return;
  }
  console.log(`[load-check] authenticated ${sessions.length} student session(s), level=${level.id}`);

  const wallStart = performance.now();
  const results = await Promise.all(
    Array.from({ length: n }, (_, i) => submitOne(baseUrl, level.id, solution, sessions[i % sessions.length]!)),
  );
  const wallMs = performance.now() - wallStart;

  const latencies = results.map((r) => r.latencyMs).sort((a, b) => a - b);
  const errors = results.filter((r) => !r.ok);
  const statusCounts = results.reduce<Record<number, number>>((acc, r) => {
    acc[r.status] = (acc[r.status] ?? 0) + 1;
    return acc;
  }, {});

  console.log("");
  console.log(`[load-check] ${n} concurrent submissions in ${(wallMs / 1000).toFixed(2)}s`);
  console.log(`[load-check]   p50: ${percentile(latencies, 50).toFixed(0)}ms`);
  console.log(`[load-check]   p95: ${percentile(latencies, 95).toFixed(0)}ms`);
  console.log(`[load-check]   max: ${latencies[latencies.length - 1]?.toFixed(0) ?? 0}ms`);
  console.log(`[load-check]   errors: ${errors.length}/${n}`);
  console.log(`[load-check]   throughput: ${(n / (wallMs / 1000)).toFixed(1)} req/s`);
  console.log(`[load-check]   status breakdown: ${JSON.stringify(statusCounts)}`);
}

main().catch((err) => {
  console.error("[load-check] failed:", err);
  process.exit(1);
});
