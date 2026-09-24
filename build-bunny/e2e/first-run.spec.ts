import { expect, test } from "@playwright/test";

import { dragBlockUnderStack, provisionStudent, signIn, studentName } from "./helpers";

/**
 * The first five minutes of a brand-new child, as a browser sees them.
 * Each assertion here pins a bug found by playing the product as a new
 * Grade 3 student (see docs/build-bunny/CHECKLIST-2027.md §1).
 */

const RUN = /^▶?\s*Run$/;

test("welcome → first mission → coached mistake → success → next level", async ({
  page,
  baseURL,
}, testInfo) => {
  const kid = provisionStudent(studentName(testInfo.project.name, "a"));
  await signIn(page, baseURL!, kid.username);

  await page.goto("/en/home");
  const welcome = page.getByRole("dialog", { name: "Meet Robo Bunny" });
  await expect(welcome).toBeVisible();
  await welcome.getByRole("button", { name: "Next" }).click();
  await welcome.getByRole("button", { name: "Next" }).click();
  // The welcome ends IN the first mission, not on a dashboard.
  await welcome.getByRole("link", { name: "Start my first mission" }).click();
  await expect(page).toHaveURL(new RegExp(`/play/${kid.firstLevelId}`));

  // One-screen briefing with a child-facing mission (not the teacher objective).
  const briefing = page.getByRole("dialog", { name: "First Hop" });
  await expect(briefing.getByText(/Snap one block under/)).toBeVisible();
  await expect(briefing.getByText(/one-instruction program/)).toHaveCount(0);
  await briefing.getByRole("button", { name: "Let's build!" }).click();

  // The mission stays on screen while building.
  await expect(page.getByRole("button", { name: /^Mission: Snap one block/ })).toBeVisible();

  // Run must be reachable without scrolling on every screen shape.
  const run = page.getByRole("button", { name: RUN }).filter({ visible: true }).first();
  await expect(run).toBeInViewport();

  // Empty program → a coaching nudge, not a confusing failure.
  await run.click();
  const coach = page.getByRole("status").filter({ hasText: "Your program is empty" });
  await expect(coach).toBeVisible();
  await coach.getByRole("button", { name: "Got it" }).click();
  await expect(coach).toHaveCount(0);

  await dragBlockUnderStack(page, "bb_moveForward");
  await run.click();

  const success = page.getByRole("dialog", { name: "Level complete!" });
  await expect(success).toBeVisible();
  // XP shows a real number (it used to render "+ XP").
  await expect(success.getByText("What you learned")).toBeVisible();
  await expect
    .poll(async () => Number((await success.innerText()).match(/\+\s*(\d+)\s*XP/)?.[1] ?? 0))
    .toBeGreaterThan(0);

  await success.getByRole("link", { name: /Next level/ }).click();
  await expect(page.getByRole("dialog", { name: "Two Steps" })).toBeVisible();
});

test("a brand-new child can open a level straight from a link", async ({
  page,
  baseURL,
}, testInfo) => {
  const kid = provisionStudent(studentName(testInfo.project.name, "b"));
  await signIn(page, baseURL!, kid.username);
  // No visit to home or the map first: the level must unlock on arrival.
  await page.goto(`/en/play/${kid.firstLevelId}`);
  await expect(page).toHaveURL(new RegExp(`/play/${kid.firstLevelId}`));
  await expect(page.getByRole("dialog", { name: "First Hop" })).toBeVisible();
});

test("Arabic: RTL player, Arabic mission, feedback button stays tappable", async ({
  page,
  baseURL,
}, testInfo) => {
  const kid = provisionStudent(studentName(testInfo.project.name, "c"));
  await signIn(page, baseURL!, kid.username);
  await page.goto(`/ar/play/${kid.firstLevelId}`);
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");

  const briefing = page.getByRole("dialog", { name: "القفزة الأولى" });
  await expect(briefing.getByText(/ألصِق لبنة واحدة/)).toBeVisible();
  await briefing.getByRole("button", { name: "هيا نبني!" }).click();

  await page
    .getByRole("button", { name: /^▶?\s*تشغيل$/ })
    .filter({ visible: true })
    .first()
    .click();
  // On a portrait tablet Blockly's scrollbar used to sit on top of this
  // button and swallow the tap; a real click (no force) proves it doesn't.
  const gotIt = page.getByRole("button", { name: "فهمت" });
  await gotIt.click();
  await expect(gotIt).toHaveCount(0);
});
