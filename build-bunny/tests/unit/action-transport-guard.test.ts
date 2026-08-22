import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Every server-action call from a Client Component must go through
 * `runAction`.
 *
 * Client handlers here are written as `try { ... } finally { setLoading(false) }`
 * with no catch. That is fine for a DOMAIN failure — the action returns
 * `{ ok: false }` and the handler shows the message. A TRANSPORT failure
 * REJECTS: dropped classroom wifi, a server restart mid-deploy, a tab woken
 * from sleep. The spinner stops, no error appears, and an optimistic UI is
 * left showing a change the server never made. `runAction` converts that
 * rejection into the ordinary `{ ok: false }` shape every handler already
 * knows how to display.
 *
 * This test exists because the first sweep of that fix worked from a
 * hand-curated list of files, and two components were missed — the per-school
 * feature toggle and the curriculum picker, both of which would sit there
 * claiming a school had a setting it did not. A list cannot be kept correct
 * by hand as the app grows; this check is what keeps it correct.
 *
 * Only `*Action(` calls are matched, which is the naming convention every
 * server action in this codebase follows.
 *
 * A file that handles rejections with its own `catch` is equally safe and is
 * not flagged — the hint drawer does exactly that, and rewriting working
 * error handling to satisfy a lint rule would be churn, not safety. That
 * makes this check deliberately conservative: it can miss a file that has a
 * catch somewhere unrelated, but it will not cry wolf. A test people learn
 * to ignore protects nothing.
 */

const SRC = join(__dirname, "..", "..", "src");

/** `await someNameAction(` NOT already inside a runAction wrapper. */
const ACTION_CALL = /await\s+(\w+Action)\s*\(/g;

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else if (/\.tsx?$/.test(entry)) out.push(full);
  }
  return out;
}

describe("server-action transport guard", () => {
  const clientFiles = walk(SRC).filter((file) =>
    readFileSync(file, "utf8").startsWith('"use client"'),
  );

  it("finds client components to check", () => {
    // Without this, a changed detection rule would make the check below
    // vacuously pass while covering nothing.
    expect(clientFiles.length).toBeGreaterThan(20);
  });

  it("wraps every server-action call so a dropped connection cannot pass as success", () => {
    const unguarded: string[] = [];

    for (const file of clientFiles) {
      const source = readFileSync(file, "utf8");
      // Its own rejection handling is just as good; see the note above.
      if (source.includes("catch")) continue;
      for (const match of source.matchAll(ACTION_CALL)) {
        // `await runAction(() => fooAction(...))` — the call is guarded when
        // runAction immediately precedes it.
        const before = source.slice(Math.max(0, match.index - 30), match.index);
        if (/runAction\(\s*\(\)\s*=>\s*$/.test(before + "")) continue;
        if (match[1] === "runAction") continue;
        unguarded.push(`${file.replace(SRC, "src")} → ${match[1]}()`);
      }
    }

    expect(unguarded).toEqual([]);
  });
});
