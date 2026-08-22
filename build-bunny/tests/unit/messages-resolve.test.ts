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
 * Two checks, because namespace-only was not enough. The school Activity
 * page bound its translator to `platform.auditLog` — a namespace that DOES
 * exist — while every key it then asked for (`time`, `action`, `actorRole`,
 * `outcome`) lives in the sibling `platform.audit`. Namespace present, every
 * column header broken. So static `t("literal")` keys are now resolved too.
 *
 * Computed keys (`flags.${flag.labelKey}.name`, `roles.${row.actorRole}`)
 * are deliberately skipped: they cannot be resolved statically without
 * lying about coverage. They are the residual risk this file does not cover.
 */

const SRC = join(__dirname, "..", "..", "src");
const NAMESPACE_CALL = /(?:useTranslations|getTranslations)\(\s*"([^"]+)"\s*\)/g;

/**
 * `const x = useTranslations("ns")` / `const [a, x] = await Promise.all([...
 * getTranslations("ns")...])` — binds a local translator name to a namespace.
 * Only the simple `const NAME = (get|use)Translations("ns")` form is matched;
 * destructured or conditionally-assigned translators are skipped rather than
 * guessed at.
 */
const BOUND_TRANSLATOR = /const\s+(\w+)\s*=\s*(?:await\s+)?(?:useTranslations|getTranslations)\(\s*"([^"]+)"\s*\)/g;
/** A call on a bound translator with a STATIC key: t("some.key"). */
const staticCall = (name: string) =>
  new RegExp(`\\b${name}\\(\\s*"([^"\`$]+)"`, "g");

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

  it("every static t(\"key\") a component asks for exists in en.json", () => {
    const missing: string[] = [];

    for (const file of files) {
      const source = readFileSync(file, "utf8");

      // A file often holds several components, and each may bind the SAME
      // local name to a DIFFERENT namespace (ProgressMatrix binds `t` to
      // staff.teach.matrix in one component and staff.teach.matrix.legend
      // in another). Matching calls file-wide would then check every key
      // against both namespaces and report half of them as missing. A test
      // that cries wolf gets ignored, so an ambiguous name is skipped and
      // left as known-uncovered rather than guessed at.
      const bindings = new Map<string, Set<string>>();
      for (const bind of source.matchAll(BOUND_TRANSLATOR)) {
        const [, local, namespace] = bind;
        if (!local || !namespace) continue;
        bindings.set(local, (bindings.get(local) ?? new Set()).add(namespace));
      }

      for (const [local, namespaces] of bindings) {
        if (namespaces.size !== 1) continue;
        const namespace = [...namespaces][0]!;
        // Only meaningful when the namespace itself resolves; a missing
        // namespace is already reported by the test below.
        if (typeof resolve(namespace) !== "object") continue;
        for (const call of source.matchAll(staticCall(local))) {
          const key = call[1]!;
          const value = resolve(`${namespace}.${key}`);
          if (value === undefined) {
            missing.push(`${file.replace(SRC, "src")} → ${local}("${key}") = ${namespace}.${key}`);
          }
        }
      }
    }

    expect(missing).toEqual([]);
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
