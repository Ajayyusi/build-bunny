import { expect, test, type Page } from "@playwright/test";

import { openMap, provisionStudent, signIn, studentName } from "./helpers";

/**
 * Automated accessibility scan (brief §7) with axe-core on the screens a
 * child spends their time on, in English and Arabic. Fails on "serious" and
 * "critical" findings. This is not a substitute for a screen-reader pass by
 * a person (NVDA / VoiceOver) — it catches the mechanical failures: missing
 * names, broken ARIA, contrast, duplicate ids, unlabelled controls.
 */

const AXE_PATH = require.resolve("axe-core/axe.min.js");

interface AxeViolation {
  id: string;
  impact: string | null;
  help: string;
  nodes: {
    target: string[];
    html: string;
    any: { data?: { fgColor?: string; bgColor?: string; contrastRatio?: number; expectedContrastRatio?: string } }[];
  }[];
}

async function scan(page: Page, label: string): Promise<string[]> {
  await page.addScriptTag({ path: AXE_PATH });
  const violations = (await page.evaluate(async () => {
    const axe = (window as unknown as { axe: { run: (ctx: unknown, opts: unknown) => Promise<{ violations: unknown[] }> } }).axe;
    // Blockly's SVG canvas and flyout are a third-party widget with their
    // own accessibility model; our keyboard/tap path to them (the block
    // palette and toolbar) is scanned as part of the page.
    const result = await axe.run(
      { exclude: [[".blocklySvg"], [".blocklyFlyout"], ["nextjs-portal"]] },
      { resultTypes: ["violations"] },
    );
    return result.violations;
  })) as AxeViolation[];
  return violations
    .filter((v) => v.impact === "serious" || v.impact === "critical")
    .map((v) => {
      const nodes = v.nodes.slice(0, 4).map((n) => {
        const d = n.any[0]?.data;
        const contrast = d?.contrastRatio
          ? ` ${d.fgColor} on ${d.bgColor} = ${d.contrastRatio} (need ${d.expectedContrastRatio})`
          : "";
        return `      ${n.html.slice(0, 140)}${contrast}`;
      });
      return [`${label}: [${v.impact}] ${v.id} — ${v.help}`, ...nodes].join("\n");
    });
}

test("child-facing screens have no serious or critical axe findings", async ({ page, baseURL }, testInfo) => {
  test.skip(testInfo.project.name !== "laptop", "one viewport is enough for a structural scan");
  test.setTimeout(180_000);
  // Measure the settled screen, not a frame of an entrance animation.
  await page.emulateMedia({ reducedMotion: "reduce" });
  const kid = provisionStudent(studentName(testInfo.project.name, "ax"));
  await signIn(page, baseURL!, kid.username);
  const findings: string[] = [];

  for (const locale of ["en", "ar"]) {
    await page.goto(`/${locale}/home`);
    await page.waitForLoadState("networkidle");
    const onboarding = page.getByRole("dialog");
    if (await onboarding.isVisible().catch(() => false)) {
      findings.push(...(await scan(page, `${locale}/home (welcome)`)));
      await page.keyboard.press("Escape");
    }
    findings.push(...(await scan(page, `${locale}/home`)));

    if (locale === "en") await openMap(page);
    else {
      await page.goto(`/${locale}/adventure`);
      const scene = page.getByRole("dialog", { name: /القصة/ });
      await scene.waitFor({ state: "visible", timeout: 5000 }).catch(() => {});
      if (await scene.isVisible().catch(() => false)) await scene.getByRole("button").last().click();
    }
    await page.waitForLoadState("networkidle");
    findings.push(...(await scan(page, `${locale}/adventure`)));

    await page.goto(`/${locale}/play/${kid.firstLevelId}`);
    const briefing = page.getByRole("dialog");
    await expect(briefing).toBeVisible();
    findings.push(...(await scan(page, `${locale}/play (briefing)`)));
    await briefing.getByRole("button").last().click();
    await page.waitForTimeout(800);
    findings.push(...(await scan(page, `${locale}/play (editor)`)));
  }

  expect(findings, findings.join("\n")).toEqual([]);
});
