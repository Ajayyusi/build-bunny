import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * The AI-first visual direction (brief: mostly white, green #2E7D32, teal,
 * text #1F2937) as a theme, checked the way a child's eyes would: every
 * text and control pair at WCAG AA, and the brief's own teal (#2BBBAD) kept
 * to decoration because it can't carry text.
 */

const css = readFileSync("src/app/globals.css", "utf8");
const block = css.match(/\[data-theme="ai"\] \{([^}]*)\}/)![1]!;
const primitives = Object.fromEntries([...css.matchAll(/(--bb-[a-z0-9-]+):\s*(#[0-9a-f]{6})/gi)].map((m) => [m[1]!, m[2]!]));
const tokens = Object.fromEntries(
  [...block.matchAll(/(--[a-z0-9-]+):\s*([^;]+);/gi)].map((m) => {
    const raw = m[2]!.trim();
    const ref = raw.match(/^var\((--bb-[a-z0-9-]+)\)$/);
    return [m[1]!, ref ? primitives[ref[1]!]! : raw];
  }),
);

function luminance(hex: string) {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}
function contrast(a: string, b: string) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi! + 0.05) / (lo! + 0.05);
}

describe("the AI-first theme", () => {
  it("uses the brief's colours: white surfaces, green primary, dark text", () => {
    expect(tokens["--color-surface"]).toBe("#ffffff");
    expect(tokens["--color-brand"]!.toLowerCase()).toBe("#2e7d32");
    expect(tokens["--color-ink"]).toBe("#1f2937");
    expect(tokens["--bb-ai-teal-decor"]!.toLowerCase()).toBe("#2bbbad");
  });

  it("keeps every text and control pair at 4.5:1 or better", () => {
    const pairs: [string, string][] = [
      ["--color-ink", "--color-surface"],
      ["--color-ink", "--color-surface-sunken"],
      ["--color-ink-muted", "--color-surface"],
      ["--color-ink-muted", "--color-surface-sunken"],
      ["--color-brand", "--color-surface"],
      ["--color-on-brand", "--color-brand"],
      ["--color-accent", "--color-surface"],
      ["--color-on-accent", "--color-accent"],
      ["--color-info", "--color-surface"],
    ];
    for (const [fg, bg] of pairs) {
      expect(contrast(tokens[fg]!, tokens[bg]!), `${fg} on ${bg}`).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("the brief's teal can't carry text, so it is only decoration", () => {
    expect(contrast(tokens["--bb-ai-teal-decor"]!, "#ffffff")).toBeLessThan(3);
    expect(Object.entries(tokens).filter(([, v]) => v === tokens["--bb-ai-teal-decor"]).map(([k]) => k)).toEqual(["--bb-ai-teal-decor"]);
  });
});
