import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import en from "../../messages/en.json";

/**
 * Every translation namespace a component asks for must actually exist.
 *
 * The parity suite compares en against ar, so it can only see a key missing
 * from ONE file. A key missing from BOTH is invisible to it — parity is
 * green, `next build` is green (it never resolves keys), and CI is green,
 * because nothing in the suite renders a page as a signed-in school admin.
 * The failure surfaces as next-intl throwing at request time: a white screen
 * on every page that uses the namespace, in both locales.
 *
 * That is not hypothetical. `staff.licenceBanner` shipped to main in exactly
 * this state — an insertion script matched `auth.staff` (the sign-in block)
 * instead of the top-level `staff`, so the keys existed, parity passed, and
 * every SCHOOL_ADMIN page would have white-screened.
 *
 * This checks the namespace, not every individual key: namespaces are static
 * string literals, while `t("...")` calls include computed keys
 * (`flags.${flag.labelKey}.name`, `states.${state}`) that cannot be resolved
 * statically without lying about coverage. A wrong namespace is the failure
 * that actually happened, and it is the one that takes a whole page down.
 */

const SRC = join(__dirname, "..", "..", "src");
const NAMESPACE_CALL = /(?:useTranslations|getTranslations)\(\s*"([^"]+)"\s*\)/g;

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      out.push(...walk(full));
    } else if (/\.(ts|tsx)$/.test(entry)) {
      out.push(full);
    }
  }
  return out;
}

function resolve(namespace: string): unknown {
  let node: unknown = en;
  for (const segment of namespace.split(".")) {
    if (node === null || typeof node !== "object") return undefined;
    node = (node as Record<string, unknown>)[segment];
  }
  return node;
}

describe("translation namespaces", () => {
  const files = walk(SRC);

  it("finds the namespaces to check", () => {
    // Guards the walker itself: a regex or path change that silently matched
    // nothing would make every assertion below vacuously pass.
    expect(files.length).toBeGreaterThan(100);
  });

  it("every namespace a component requests exists in en.json", () => {
    const missing: string[] = [];

    for (const file of files) {
      const source = readFileSync(file, "utf8");
      for (const match of source.matchAll(NAMESPACE_CALL)) {
        const namespace = match[1]!;
        const node = resolve(namespace);
        if (node === undefined || node === null || typeof node !== "object") {
          missing.push(`${file.replace(SRC, "src")} → "${namespace}"`);
        }
      }
    }

    expect(missing).toEqual([]);
  });
});
