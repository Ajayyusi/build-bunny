import { expect, test, type Page } from "@playwright/test";

import { provisionStudent, signIn, skipTo, studentName } from "./helpers";

/**
 * Grade modes outside the Teach levels, and predict first on grouping
 * levels:
 *  - grades 5 to 7: a deeper question after a pass (here, Who Decides?);
 *  - grades 3 to 4: a friendly one-line message on a failed check;
 *  - grouping: the tightness meter waits for the child's guess.
 */

async function setWords(page: Page, mode: "Simpler" | "More detail") {
  await page.goto("/en/explore");
  // The welcome opens a moment after the page (first visit only).
  const welcome = page.getByRole("dialog").getByRole("button", { name: "Look around first" });
  await welcome.waitFor({ state: "visible", timeout: 5000 }).catch(() => {});
  if (await welcome.isVisible().catch(() => false)) await welcome.click();
  await page.getByRole("radiogroup", { name: "Words:" }).getByRole("radio", { name: mode }).click();
}

test("more detail: a deeper question after Who Decides?", async ({ page, baseURL }, testInfo) => {
  test.skip(testInfo.project.name !== "laptop", "one viewport is enough");
  const kid = provisionStudent(studentName(testInfo.project.name, "dq"));
  await signIn(page, baseURL!, kid.username);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await setWords(page, "More detail");
  await page.getByRole("link", { name: /Who Decides\?/ }).click();
  await page.getByRole("dialog").getByRole("button").last().click();

  const scene = async (verdict: string, choice: RegExp) => {
    await page.getByRole("button", { name: verdict }).click();
    await page.getByRole("button", { name: choice }).click();
    await page.getByRole("button", { name: "Continue" }).click();
  };
  await scene("Probably right", /Ask it for more reasons first/);
  await scene("Can't tell from this", /Ask for more: an expert checks/);
  await scene("Probably wrong", /Override it — people choose/);
  await page.getByRole("button", { name: "Finish" }).click();

  const deeper = page.getByRole("dialog", { name: /complete/i }).getByTestId("deeper-question");
  await expect(deeper).toContainText("80% sure");
  await deeper.getByRole("radio", { name: "None" }).click();
  await expect(deeper.getByRole("status")).toContainText("isn't 100%");
  await deeper.getByRole("radio", { name: "About 2" }).click();
  await expect(deeper.getByRole("status")).toContainText("a person checks");
});

test("simpler words on a grouping level: guess first, then a friendly line", async ({ page, baseURL }, testInfo) => {
  test.skip(testInfo.project.name !== "laptop", "one viewport is enough");
  const kid = provisionStudent(studentName(testInfo.project.name, "gm"));
  await signIn(page, baseURL!, kid.username);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await setWords(page, "Simpler");

  skipTo("two-piles", kid.username);
  await page.goto("/en/ai-worlds");
  const story = page.getByRole("dialog", { name: /the story/ });
  await story.waitFor({ state: "visible", timeout: 5000 }).catch(() => {});
  if (await story.isVisible().catch(() => false)) await story.getByRole("button", { name: "Skip" }).click();
  await page.getByRole("button", { name: /Two Piles in the Sand/ }).click();
  await page.getByRole("link", { name: "Start level" }).click();
  await page.waitForURL(/\/play\//);
  for (let i = 0; i < 10 && (await page.getByRole("dialog").count()) === 0; i++) await page.waitForTimeout(500);
  while ((await page.getByRole("dialog").count()) > 0) await page.getByRole("dialog").getByRole("button").last().click();

  // Predict first: no meter yet, and nothing to check.
  const question = page.getByRole("group", { name: /how tight do you think your groups are/ });
  await expect(question).toBeVisible();
  await expect(page.getByRole("meter")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Test my groups" })).toBeDisabled();

  // One flag beside each crowd, but far from it: loose groups.
  const board = page.locator("div.aspect-square").first();
  const box = (await board.boundingBox())!;
  await board.click({ position: { x: box.width * 0.22, y: box.height * 0.42 } });
  await board.click({ position: { x: box.width * 0.95, y: box.height * 0.55 } });
  await question.getByRole("button", { name: "Very tight" }).click();
  await expect(page.getByRole("meter")).toBeVisible();
  await expect(page.getByText(/You said “Very tight”, but the meter reads/)).toBeVisible();

  await page.getByRole("button", { name: "Test my groups" }).click();
  await expect(page.getByText("The groups aren't tight yet. Which flag could move closer to its dots?")).toBeVisible();
});
