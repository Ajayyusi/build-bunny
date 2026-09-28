import { expect, test } from "@playwright/test";

import { dragBlockUnderStack, provisionStudent, signIn, studentName } from "./helpers";

/**
 * The first five minutes of a brand-new child, as a browser sees them.
 * Each assertion here pins a bug found by playing the product as a new
 * Grade 3 student (see docs/build-bunny/CHECKLIST-2027.md §1).
 */

const RUN = /^▶?\s*Run$/;

test("AI first: a new child lands on Explore AI, and the welcome opens Train a Sorter", async ({
  page,
  baseURL,
}, testInfo) => {
  const kid = provisionStudent(studentName(testInfo.project.name, "d"));
  await signIn(page, baseURL!, kid.username);

  await page.goto("/en");
  await expect(page).toHaveURL(/\/explore$/);
  const welcome = page.getByRole("dialog", { name: "Can you teach a robot to sort shapes?" });
  await expect(welcome).toBeVisible();
  // The welcome ends IN the first AI activity, not on a dashboard.
  await welcome.getByRole("link", { name: "Let's try!" }).click();
  await expect(page).toHaveURL(/\/play\//);
  await expect(page.getByRole("dialog", { name: "A robot that knows nothing" })).toBeVisible();

  // Seen once per child and device: back on Explore AI it stays closed.
  await page.goto("/en/explore");
  await expect(page.getByRole("heading", { name: "Teach it. Test it. Question it." })).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("Explore AI: six activities above the fold on a classroom laptop, and both routes one tap away", async ({
  page,
  baseURL,
}, testInfo) => {
  const kid = provisionStudent(studentName(testInfo.project.name, "e"));
  await signIn(page, baseURL!, kid.username);
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/en/explore");
  await page.getByRole("dialog").getByRole("button", { name: "Look around first" }).click();

  const cards = page.getByTestId("explore-cards").getByRole("link");
  await expect(cards).toHaveCount(6);
  for (const card of await cards.all()) await expect(card).toBeInViewport({ ratio: 1 });

  await page.getByRole("link", { name: /AI worlds/ }).click();
  await expect(page).toHaveURL(/\/ai-worlds$/);
  // The AI worlds belong to Explore AI in the navigation.
  await expect(page.getByRole("link", { name: "Explore AI", exact: true })).toHaveAttribute("aria-current", "page");
  // First visit: AI Island tells its story first.
  await page.getByRole("dialog", { name: /the story/ }).getByRole("button", { name: "Skip" }).click();
  await page.getByRole("link", { name: "Back to Explore AI" }).click();
  await page.getByRole("link", { name: /Coding Lab.*Open Coding Lab/ }).click();
  await expect(page).toHaveURL(/\/adventure$/);
});

test("Coding Lab: first mission → coached mistake → success → next level", async ({
  page,
  baseURL,
}, testInfo) => {
  const kid = provisionStudent(studentName(testInfo.project.name, "a"));
  await signIn(page, baseURL!, kid.username);

  await page.goto(`/en/play/${kid.firstLevelId}`);

  // One-screen briefing with a child-facing mission (not the teacher objective).
  const briefing = page.getByRole("dialog", { name: "First Hop" });
  await expect(briefing.getByText(/Snap one block under/)).toBeVisible();
  await expect(briefing.getByText(/one-instruction program/)).toHaveCount(0);
  await briefing.getByRole("button", { name: "Let's build!" }).click();

  // The mission stays on screen while building.
  await expect(page.getByRole("button", { name: /^Mission: Snap one block/ })).toBeVisible();

  // First steps: a brand-new child is pointed at "Add block" first…
  const pointer = page.getByRole("status").filter({ hasText: /Add block|press ▶ Run/ });
  await expect(pointer).toHaveText(/Add block. and pick a block/);

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
  // …then, once a block is attached, at Run.
  await expect(pointer).toHaveText(/Now press ▶ Run/);
  await run.click();

  const success = page.getByRole("dialog", { name: "Level complete!" });
  await expect(success).toBeVisible();
  // XP shows a real number (it used to render "+ XP").
  await expect(success.getByText("What you learned")).toBeVisible();
  await expect
    .poll(async () => Number((await success.innerText()).match(/\+\s*(\d+)\s*XP/)?.[1] ?? 0))
    .toBeGreaterThan(0);

  // One optional tap: how did that feel? Counts only reach the teacher.
  const feel = success.getByRole("radiogroup", { name: "How did that feel?" });
  await feel.getByRole("radio", { name: /Just right/ }).click();
  await expect(feel.getByRole("radio", { name: /Just right/ })).toHaveAttribute("aria-checked", "true");
  await expect(success.getByText(/Thanks/)).toBeVisible();

  await success.getByRole("link", { name: /Next level/ }).click();
  const next = page.getByRole("dialog", { name: "Two Steps" });
  await expect(next).toBeVisible();
  // A child who has finished a level no longer gets the pointer.
  await next.getByRole("button", { name: "Let's build!" }).click();
  await expect(page.getByRole("status").filter({ hasText: /Add block|press ▶ Run/ })).toHaveCount(0);
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
