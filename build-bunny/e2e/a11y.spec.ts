import { expect, test, type Page } from "@playwright/test";

import { openMap, provisionStudent, signIn, skipTo, studentName } from "./helpers";

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
    await page.goto(`/${locale}/explore`);
    await page.waitForLoadState("networkidle");
    const welcome = page.getByRole("dialog");
    if (await welcome.isVisible().catch(() => false)) {
      findings.push(...(await scan(page, `${locale}/explore (welcome)`)));
      await page.keyboard.press("Escape");
    }
    findings.push(...(await scan(page, `${locale}/explore`)));

    await page.goto(`/${locale}/ai-worlds`);
    await page.waitForLoadState("networkidle");
    const aiScene = page.getByRole("dialog");
    await aiScene.waitFor({ state: "visible", timeout: 5000 }).catch(() => {});
    if (await aiScene.isVisible().catch(() => false)) await aiScene.getByRole("button").last().click();
    findings.push(...(await scan(page, `${locale}/ai-worlds`)));

    await page.goto(`/${locale}/home`);
    await page.waitForLoadState("networkidle");
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

    // Robo Bunny's help panel, open over the editor.
    await page.getByRole("button", { name: locale === "en" ? "Ask Robo Bunny" : /اسأل/ }).first().click();
    await expect(page.getByRole("dialog")).toBeVisible();
    findings.push(...(await scan(page, `${locale}/play (help panel)`)));
    await page.keyboard.press("Escape");
  }

  expect(findings, findings.join("\n")).toEqual([]);
});

test("teacher planning screens have no serious or critical axe findings", async ({ page, baseURL }, testInfo) => {
  test.skip(testInfo.project.name !== "laptop", "one viewport is enough for a structural scan");
  test.setTimeout(180_000);
  await page.emulateMedia({ reducedMotion: "reduce" });
  // The seeded demo teacher (prisma/seed-data/demo-school.ts).
  const signedIn = await page.request.post("/api/auth/sign-in/email", {
    data: { email: "sara@nitaqdemo.school", password: "TeachDemo-2026" },
    headers: { Origin: baseURL! },
  });
  expect(signedIn.ok(), `teacher sign-in ${signedIn.status()}`).toBe(true);
  const findings: string[] = [];

  for (const locale of ["en", "ar"]) {
    await page.goto(`/${locale}/teach/curriculum`);
    await page.waitForLoadState("networkidle");
    findings.push(...(await scan(page, `${locale}/teach/curriculum`)));

    const worksheet = await page.locator('a[href*="/teach/curriculum/worksheet/"]').first().getAttribute("href");
    await page.goto(`${worksheet}?answers=1`);
    await page.waitForLoadState("networkidle");
    findings.push(...(await scan(page, `${locale}/worksheet`)));

    await page.goto(`/${locale}/teach`);
    const classHref = await page.locator('a[href*="/teach/classes/"]').first().getAttribute("href");
    await page.goto(classHref!);
    await page.waitForLoadState("networkidle");
    findings.push(...(await scan(page, `${locale}/teach/class`)));
  }

  expect(findings, findings.join("\n")).toEqual([]);
});

test("the AI-first additions have no serious or critical axe findings", async ({ page, baseURL }, testInfo) => {
  test.skip(testInfo.project.name !== "laptop", "one viewport is enough for a structural scan");
  test.setTimeout(180_000);
  const kid = provisionStudent(studentName(testInfo.project.name, "ax2"));
  await signIn(page, baseURL!, kid.username);
  await page.emulateMedia({ reducedMotion: "reduce" });
  const findings: string[] = [];
  const closeDialogs = async () => {
    for (let i = 0; i < 6 && (await page.getByRole("dialog").count()) > 0; i++) {
      await page.keyboard.press("Escape");
      await page.waitForTimeout(200);
    }
  };

  for (const locale of ["en", "ar"]) {
    // The explainer player, open, on Train a Sorter's page.
    await page.goto(`/${locale}/explore`);
    const welcome = page.getByRole("dialog");
    await welcome.waitFor({ state: "visible", timeout: 5000 }).catch(() => {});
    await closeDialogs();
    const sorter = await page.getByTestId("explore-cards").filter({ visible: true }).getByRole("link").first().getAttribute("href");
    await page.goto(sorter!.startsWith(`/${locale}/`) ? sorter! : `/${locale}${sorter}`);
    await page.waitForLoadState("networkidle");
    await closeDialogs();
    await page.locator("button", { hasText: /25/ }).first().click();
    await page.getByRole("dialog").waitFor();
    findings.push(...(await scan(page, `${locale}/explainer`)));
    await closeDialogs();
  }

  // AI worlds: the world story plays first on a new visit (Skip closes it),
  // then the level's own briefing and walkthrough (their last button goes on).
  const openFromWorlds = async (title: RegExp) => {
    await page.goto("/en/ai-worlds");
    const story = page.getByRole("dialog", { name: /the story/ });
    await story.waitFor({ state: "visible", timeout: 5000 }).catch(() => {});
    if (await story.isVisible().catch(() => false)) await story.getByRole("button", { name: "Skip" }).click();
    await page.getByRole("button", { name: title }).click();
    await page.getByRole("link", { name: "Start level" }).click();
    await page.waitForURL(/\/play\//);
    for (let i = 0; i < 10 && (await page.getByRole("dialog").count()) === 0; i++) await page.waitForTimeout(500);
    while ((await page.getByRole("dialog").count()) > 0) await page.getByRole("dialog").getByRole("button").last().click();
  };

  // Ruli in the rule round, and the project report panel.
  skipTo("rule-or-examples", kid.username);
  await openFromWorlds(/Rule or Examples\?/);
  findings.push(...(await scan(page, "en/rule-round")));

  skipTo("my-ai-project", kid.username);
  await openFromWorlds(/My AI Project/);
  const card = (id: string) => page.getByRole("listitem").filter({ has: page.locator(`#specimen-${id}`) });
  for (const id of ["b2", "b3", "b5", "b6", "b7", "b8", "b10"]) await card(id).getByRole("button", { name: "Teach this one" }).click();
  for (const id of ["b1", "b4", "b9"]) await card(id).getByRole("button", { name: "Keep for testing" }).click();
  const mysteries = page.getByRole("radiogroup", { name: /^Mystery \d/ });
  for (let i = 0; i < (await mysteries.count()); i++) await mysteries.nth(i).getByRole("radio").first().click();
  await page.getByRole("button", { name: "Show its guesses" }).click();
  await page.getByRole("radiogroup", { name: /Pick one case from your test pile/ }).waitFor();
  findings.push(...(await scan(page, "en/project-report")));

  expect(findings, findings.join("\n")).toEqual([]);
});

test("the audit additions have no serious or critical axe findings", async ({ browser, page, baseURL }, testInfo) => {
  test.skip(testInfo.project.name !== "laptop", "one viewport is enough for a structural scan");
  test.setTimeout(240_000);
  const kid = provisionStudent(studentName(testInfo.project.name, "ax3"));
  await signIn(page, baseURL!, kid.username);
  await page.emulateMedia({ reducedMotion: "reduce" });
  const findings: string[] = [];
  const skipDialogs = async () => {
    for (let i = 0; i < 10 && (await page.getByRole("dialog").count()) === 0; i++) await page.waitForTimeout(400);
    while ((await page.getByRole("dialog").count()) > 0) await page.getByRole("dialog").getByRole("button").last().click();
  };
  const words = async (mode: "Simpler" | "More detail") => {
    await page.goto("/en/explore");
    const welcome = page.getByRole("dialog").getByRole("button", { name: "Look around first" });
    await welcome.waitFor({ state: "visible", timeout: 5000 }).catch(() => {});
    if (await welcome.isVisible().catch(() => false)) await welcome.click();
    await page.getByRole("radiogroup", { name: "Words:" }).getByRole("radio", { name: mode }).click();
  };

  // More detail: Train a Sorter's mistake grid, then the pass with "defend your model".
  await words("More detail");
  await page.getByRole("link", { name: /Train a Sorter/ }).click();
  await skipDialogs();
  const card = (id: string) => page.getByRole("listitem").filter({ has: page.locator(`#specimen-${id}`) });
  const test3 = async () => {
    const reveal = page.getByRole("button", { name: "Show its guesses" });
    if (await reveal.isVisible().catch(() => false)) {
      const groups = page.locator("[role=radiogroup][aria-labelledby^=predict-]");
      for (let i = 0; i < (await groups.count()); i++) await groups.nth(i).getByRole("radio").first().click();
      await reveal.click();
    }
    await page.getByRole("button", { name: "Test the bunny" }).click();
  };
  for (const id of ["p1", "p2", "p3", "p4"]) await card(id).getByRole("button", { name: "Teach this one" }).click();
  await test3();
  await page.getByTestId("mistake-grid").waitFor();
  findings.push(...(await scan(page, "en/teach (mistake grid)")));
  await page.getByRole("button", { name: /^Take this shape back/ }).first().click();
  for (const id of ["p5", "p6"]) await card(id).getByRole("button", { name: "Teach this one" }).click();
  await test3();
  const defend = page.getByTestId("defend-model");
  await defend.waitFor();
  await defend.getByRole("radio").first().check();
  findings.push(...(await scan(page, "en/teach (defend your model)")));

  // See Like a Computer: the clue questions after a settled round.
  skipTo("see-like-a-computer", kid.username);
  await page.goto("/en/explore");
  await page.getByRole("link", { name: /See Like a Computer/ }).click();
  await skipDialogs();
  const round1 = page.getByRole("radiogroup", { name: "Your guess for Round 1" });
  const card1 = round1.locator("xpath=ancestor::div[contains(@class,'rounded-xl')][1]");
  await round1.getByText("Carrot", { exact: true }).click();
  await card1.getByRole("button", { name: "Check my guess" }).click();
  const notYet = card1.getByRole("button", { name: "Add more squares" });
  if (await notYet.isVisible().catch(() => false)) {
    await notYet.click();
    await round1.getByText("Carrot", { exact: true }).click();
    await card1.getByRole("button", { name: "Check my guess" }).click();
  }
  await card1.getByTestId("name-clues-round-1").waitFor();
  findings.push(...(await scan(page, "en/see-like-a-computer (name the clues)")));

  // Simpler: a grouping level's prediction.
  await words("Simpler");
  skipTo("two-piles", kid.username);
  await page.goto("/en/ai-worlds");
  const story = page.getByRole("dialog", { name: /the story/ });
  await story.waitFor({ state: "visible", timeout: 5000 }).catch(() => {});
  if (await story.isVisible().catch(() => false)) await story.getByRole("button", { name: "Skip" }).click();
  await page.getByRole("button", { name: /Two Piles in the Sand/ }).click();
  await page.getByRole("link", { name: "Start level" }).click();
  await page.waitForURL(/\/play\//);
  await skipDialogs();
  await page.getByRole("group", { name: /how tight do you think your groups are/ }).waitFor();
  findings.push(...(await scan(page, "en/grouping (predict first)")));

  // The teacher's replay of the Train a Sorter attempt, and the principal's page.
  const staff = await browser.newContext({ baseURL });
  const teacher = await staff.newPage();
  await teacher.emulateMedia({ reducedMotion: "reduce" });
  const ok = await teacher.request.post("/api/auth/sign-in/email", {
    data: { email: "sara@nitaqdemo.school", password: "TeachDemo-2026" },
    headers: { Origin: baseURL! },
  });
  expect(ok.ok()).toBe(true);
  await teacher.goto("/en/teach");
  const classHref = await teacher.locator('a[href*="/teach/classes/"]', { hasText: "3A" }).first().getAttribute("href");
  await teacher.goto(`${classHref!.replace(/\/$/, "")}/students/${kid.userId}`);
  await teacher.locator('a[href*="/teach/attempts/"]').first().click();
  await teacher.getByText("What they taught the bunny").waitFor();
  findings.push(...(await scan(teacher, "en/teach/attempt (AI replay)")));
  await staff.close();

  expect(findings, findings.join("\n")).toEqual([]);
});
