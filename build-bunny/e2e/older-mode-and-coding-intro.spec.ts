import { expect, test, type Page } from "@playwright/test";

import { openMap, provisionStudent, signIn, studentName } from "./helpers";

/**
 * Two handoff rows the audit found unbuilt:
 *  - grades 5 to 7: "Show confusion or error counts in a small visual; ask
 *    students to defend their model choice";
 *  - Coding Lab: "add an optional short introduction but remove as a
 *    prerequisite for AI".
 */

async function predictAndTest(page: Page) {
  const reveal = page.getByRole("button", { name: "Show its guesses" });
  if (await reveal.isVisible().catch(() => false)) {
    const groups = page.locator("[role=radiogroup][aria-labelledby^=predict-]");
    for (let i = 0; i < (await groups.count()); i++) await groups.nth(i).getByRole("radio").first().click();
    await reveal.click();
  }
  await page.getByRole("button", { name: "Test the bunny" }).click();
}

test("more detail: the test as a 2×2 grid, then defend the model", async ({ page, baseURL }, testInfo) => {
  test.skip(testInfo.project.name !== "laptop", "one viewport is enough for this flow");
  const kid = provisionStudent(studentName(testInfo.project.name, "og"));
  await signIn(page, baseURL!, kid.username);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/en/explore");
  await page.getByRole("dialog").getByRole("button", { name: "Look around first" }).click();
  await page.getByRole("radiogroup", { name: "Words:" }).getByRole("radio", { name: "More detail" }).click();
  await page.getByRole("link", { name: /Train a Sorter/ }).click();
  const walkthrough = page.getByRole("dialog", { name: "A robot that knows nothing" });
  await walkthrough.waitFor({ state: "visible", timeout: 5000 }).catch(() => {});
  if (await walkthrough.isVisible().catch(() => false)) await walkthrough.getByRole("button", { name: "Skip" }).click();

  // Colour lined up with shape: the robot copies the colour and fails.
  const card = (id: string) => page.getByRole("listitem").filter({ has: page.locator(`#specimen-${id}`) });
  for (const id of ["p1", "p2", "p3", "p4"]) await card(id).getByRole("button", { name: "Teach this one" }).click();
  await predictAndTest(page);
  const grid = page.getByTestId("mistake-grid");
  await expect(grid).toBeVisible();
  await expect(grid.getByRole("columnheader", { name: "It said “Circle”" })).toBeVisible();
  await expect(grid.getByRole("rowheader", { name: "Really “Square”" })).toBeVisible();
  // Some answers are wrong, and each count is read with its meaning.
  await expect(grid.getByRole("cell", { name: /wrong/ }).first()).toBeVisible();
  const cells = await grid.locator("tbody td").allInnerTexts();
  expect(cells.map((c) => Number.parseInt(c, 10)).reduce((a, b) => a + b, 0)).toBe(4);
  await expect(page.getByText(/^Its mistakes:/)).toBeVisible();

  // The counterexamples fix it; the pass shows the grid and asks why to trust it.
  await page.getByRole("button", { name: /^Take this shape back/ }).first().click();
  for (const id of ["p5", "p6"]) await card(id).getByRole("button", { name: "Teach this one" }).click();
  await predictAndTest(page);
  const defend = page.getByTestId("defend-model");
  await expect(defend).toBeVisible();
  // A tall success card scrolls from its top: nothing is cut off above.
  const done = page.locator("[aria-modal=true]").filter({ has: defend });
  await done.evaluate((el) => el.scrollTo(0, 0));
  await expect(done.locator("h1")).toBeInViewport();
  await expect(page.getByTestId("mistake-grid").filter({ visible: true })).toBeVisible();
  await defend.getByRole("radio", { name: "It gets my teaching examples right" }).check();
  await expect(defend.getByRole("status")).toContainText("a fairer test");
  await defend.getByRole("radio", { name: "It got cases right that it never learned from" }).check();
  await expect(defend.getByRole("status")).toContainText("Strong reason");
});

test("simpler words: no grid and no defend question", async ({ page, baseURL }, testInfo) => {
  test.skip(testInfo.project.name !== "laptop", "one viewport is enough for this flow");
  const kid = provisionStudent(studentName(testInfo.project.name, "yg"));
  await signIn(page, baseURL!, kid.username);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/en/explore");
  await page.getByRole("dialog").getByRole("button", { name: "Look around first" }).click();
  await page.getByRole("radiogroup", { name: "Words:" }).getByRole("radio", { name: "Simpler" }).click();
  await page.getByRole("link", { name: /Train a Sorter/ }).click();
  const walkthrough = page.getByRole("dialog", { name: "A robot that knows nothing" });
  await walkthrough.waitFor({ state: "visible", timeout: 5000 }).catch(() => {});
  if (await walkthrough.isVisible().catch(() => false)) await walkthrough.getByRole("button", { name: "Skip" }).click();
  const card = (id: string) => page.getByRole("listitem").filter({ has: page.locator(`#specimen-${id}`) });
  for (const id of ["p1", "p2", "p3", "p4"]) await card(id).getByRole("button", { name: "Teach this one" }).click();
  await predictAndTest(page);
  await expect(page.getByText("It guessed wrong. Which example might help?")).toBeVisible();
  await expect(page.getByTestId("mistake-grid")).toHaveCount(0);
});

test("Coding Lab offers a short, optional introduction", async ({ page, baseURL }, testInfo) => {
  const kid = provisionStudent(studentName(testInfo.project.name, "ci"));
  await signIn(page, baseURL!, kid.username);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await openMap(page);

  // The trail is there without watching anything.
  const intro = page.getByTestId("coding-intro").filter({ visible: true });
  await expect(intro).toContainText("New to coding?");
  await expect(intro).toContainText("Optional.");
  await expect(page.getByRole("button", { name: /^Level 1: First Hop/ }).first()).toBeVisible();

  // Watching it: captioned parts, then the choice.
  await intro.getByRole("button", { name: "Watch a 20-second intro" }).click();
  const player = page.getByRole("dialog", { name: /Robo Bunny does exactly what you say/ });
  await expect(player).toBeVisible();
  await expect(player).toContainText("This is the Coding Lab.");
  for (let i = 0; i < 6 && !(await player.getByRole("radio").first().isVisible().catch(() => false)); i++) {
    await player.getByRole("button", { name: "Next part" }).click();
  }
  await player.getByRole("radio", { name: "Add one more “move forward” block" }).click();
  await expect(player).toContainText("exact steps, in order");
  await page.keyboard.press("Escape");
  await expect(player).toHaveCount(0);

  // And Explore AI never waits for it.
  await page.goto("/en/ai-worlds");
  await expect(page).toHaveURL(/\/ai-worlds/);
});
