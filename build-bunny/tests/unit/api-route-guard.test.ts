import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * No API route may hand-roll its permission check.
 *
 * `requirePermission` is where licence entitlement is enforced, but route
 * handlers cannot use it — it throws an AuthError that only the withAuth
 * wrapper understands — so every route wrote its own
 * `getSessionContext` + `hasPermission` pair instead. Those pairs predate
 * entitlement, so when licence enforcement arrived they silently skipped it:
 * a SUSPENDED or EXPIRED school could still export its full student roster
 * through /api/school/reports/* while every other surface refused.
 *
 * `requireApiPermission` applies the identical rules, and this test is what
 * stops the next route from quietly diverging again. The hole was found by
 * audit rather than by any test, which is the argument for having one.
 *
 * Attempt submission is exempt: it is not permission-gated at the route at
 * all, and `submitAttempt` carries its own `entitlement.canWrite` check
 * because grading awards XP, stars and certificates.
 */

const API = join(__dirname, "..", "..", "src", "app", "api");

const EXEMPT = new Set(["src/app/api/levels/[levelId]/attempts/route.ts"]);

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else if (entry === "route.ts") out.push(full);
  }
  return out;
}

describe("API route permission guards", () => {
  const routes = walk(API);

  it("finds the route handlers", () => {
    expect(routes.length).toBeGreaterThan(3);
  });

  it("gate permissions through requireApiPermission, not a hand-rolled pair", () => {
    const offenders: string[] = [];

    for (const route of routes) {
      const rel = route
        .slice(route.indexOf(join("src", "app", "api")))
        .split("\\")
        .join("/");
      if (EXEMPT.has(rel)) continue;

      const source = readFileSync(route, "utf8");
      // A route that consults hasPermission itself has, by construction,
      // skipped the entitlement rules requireApiPermission applies.
      if (source.includes("hasPermission(")) {
        offenders.push(rel);
      }
    }

    expect(offenders).toEqual([]);
  });
});
