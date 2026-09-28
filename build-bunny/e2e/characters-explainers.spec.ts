import { expect, test, type Page } from "@playwright/test";

import { provisionStudent, signIn, skipTo, studentName } from "./helpers";

/**
 * The supporting cast and the explainers (handoff P2): each character says
 * its own short line at its own teaching moment; an explainer is optional,
 * captioned, keyboard-driven, holds still under reduced motion, plays by
 * itself otherwise, and ends on a choice that leads into the activity.
 */

async function openTrainASorter(page: Page, reduced: boolean) {
  await page.emulateMedia({ reducedMotion: reduced ? "reduce" : "no-preference" });
  await page.goto("/en/explore");
  await page.getByRole("dialog").getByRole("link", { name: "Let's try!" }).click();
  await page.waitForURL(/\/play\//);
  const walk = page.getByRole("dialog", { name: "A robot that knows nothing" });
  await expect(walk).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
}

async function openFromWorlds(page: Page, title: RegExp) {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/en/ai-worlds");
  const scene = page.getByRole("dialog", { name: /the story/ });
  await scene.waitFor({ state: "visible", timeout: 5000 }).catch(() => {});
  if (await scene.isVisible().catch(() => false)) await scene.getByRole("button", { name: "Skip" }).click();
  await page.getByRole("button", { name: title }).click();
  await page.getByRole("link", { name: "Start level" }).click();
  await page.waitForURL(/\/play\//);
  for (let i = 0; i < 10 && (await page.getByRole("dialog").count()) === 0; i++) await page.waitForTimeout(500);
  while ((await page.getByRole("dialog").count()) > 0) await page.getByRole("dialog").getByRole("button").last().click();
}

test("an explainer is optional, captioned, keyboard-driven, and still under reduced motion", async ({ page, baseURL }, testInfo) => {
  const kid = provisionStudent(studentName(testInfo.project.name, "xa"));
  await signIn(page, baseURL!, kid.username);
  await openTrainASorter(page, true);

  // Offered, labelled optional; the activity is already usable without it.
  await expect(page.getByText("Optional. The activity works without it.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Teach this one" }).first()).toBeVisible();

  await page.getByRole("button", { name: "Watch a 25-second intro" }).click();
  const player = page.getByRole("dialog", { name: "Ruli copies the colour" });
  await expect(player.getByText("Ruli is learning to sort shapes.", { exact: false })).toBeVisible();
  await expect(player.getByText("Part 1 of 5")).toBeVisible();
  // Reduced motion: nothing advances by itself.
  await page.waitForTimeout(1500);
  await expect(player.getByText("Part 1 of 5")).toBeVisible();

  await player.getByRole("button", { name: "Next part" }).click();
  await expect(player.getByText("Ruli: I've got it. Red means circle!")).toBeVisible();
  // Keyboard: the arrow keys move between parts.
  await player.getByText("Part 2 of 5").click();
  await page.keyboard.press("ArrowRight");
  await expect(player.getByText("Part 3 of 5")).toBeVisible();
  await expect(player.getByText("Tessa: What happens on a new example?", { exact: false })).toBeVisible();

  // Captions can be turned off and on (the caption stays for screen readers).
  await player.getByRole("button", { name: "Captions on" }).click();
  await expect(player.getByRole("button", { name: "Captions off" })).toHaveAttribute("aria-pressed", "false");
  await player.getByRole("button", { name: "Captions off" }).click();

  for (let i = 0; i < 3; i++) await player.getByRole("button", { name: "Next part" }).click();
  // The ending is a choice, not a lecture.
  const choice = player.getByRole("radiogroup", { name: "What should Ruli look at instead?" });
  await choice.getByRole("radio", { name: "The colour" }).click();
  await expect(player.getByText("Colour is what fooled it.", { exact: false })).toBeVisible();
  await choice.getByRole("radio", { name: "The shape" }).click();
  await expect(player.getByText("Yes! Show it circles in different colours", { exact: false })).toBeVisible();
  await player.getByRole("button", { name: "Start the activity" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Teach this one" }).first()).toBeVisible();
});

test("with motion allowed an explainer plays by itself, pauses, and can be skipped", async ({ page, baseURL }, testInfo) => {
  const kid = provisionStudent(studentName(testInfo.project.name, "xb"));
  await signIn(page, baseURL!, kid.username);
  await openTrainASorter(page, false);

  await page.getByRole("button", { name: "Watch a 25-second intro" }).click();
  const player = page.getByRole("dialog", { name: "Ruli copies the colour" });
  await expect(player.getByText("Part 2 of 5")).toBeVisible({ timeout: 8000 });
  await player.getByRole("button", { name: "Pause" }).click();
  const part = await player.getByText(/Part \d of 5/).textContent();
  await page.waitForTimeout(5500);
  await expect(player.getByText(part!)).toBeVisible();
  await player.getByRole("button", { name: "Skip to the activity" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("Ruli says his line in the rule round, and admits the rule can't change itself", async ({ page, baseURL }, testInfo) => {
  const kid = provisionStudent(studentName(testInfo.project.name, "xr"));
  skipTo("rule-or-examples", kid.username);
  await signIn(page, baseURL!, kid.username);
  await openFromWorlds(page, /Rule or Examples\?/);

  await expect(page.getByText("I follow the rule exactly. Nothing more, nothing less.")).toBeVisible();
  await page.getByRole("radio", { name: "Red shapes are circles" }).click();
  await page.getByRole("button", { name: "Test the rule" }).click();
  await page.getByRole("button", { name: "See today's shapes" }).click();
  await expect(page.getByText("My rule never mentioned that. I can't change it by myself.")).toBeVisible();
});

test("Tessa asks about new examples before the guesses; Noura asks about evidence in a story", async ({ page, baseURL }, testInfo) => {
  const kid = provisionStudent(studentName(testInfo.project.name, "xt"));
  await signIn(page, baseURL!, kid.username);
  await openTrainASorter(page, true);
  for (let i = 0; i < 4; i++) await page.getByRole("button", { name: "Teach this one" }).first().click();
  await expect(page.getByText("What happens on a new example?")).toBeVisible();

  skipTo("is-that-real", kid.username);
  await openFromWorlds(page, /Is That Real\?/);
  await expect(page.getByText(/Is there enough evidence yet\?|Who should make the final decision\?/).first()).toBeVisible();
});
