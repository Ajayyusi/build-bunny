import { expect, test, type Locator } from "@playwright/test";

import { provisionStudent, signIn, studentName } from "./helpers";

/**
 * See Like a Computer's learning loop, per mystery round: guess at the
 * blockiest picture → check → (not yet: add squares, guess again) → the
 * real picture and the clue that gives it away.
 */
test("mystery rounds: guess, check, add squares, reveal the clue", async ({ page, baseURL }, testInfo) => {
  const kid = provisionStudent(studentName(testInfo.project.name, "px"));
  await signIn(page, baseURL!, kid.username);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/en/explore");
  await page.getByRole("dialog").getByRole("button", { name: "Look around first" }).click();
  await page.getByRole("link", { name: /See Like a Computer/ }).click();
  await page.getByRole("button", { name: "Skip" }).click();
  await page.getByRole("button", { name: "Let's build!" }).click();

  // Lighting: the same picture in dimmer light is different numbers.
  const light = page.getByLabel("Light");
  await light.focus();
  await page.keyboard.press("ArrowLeft");
  await page.keyboard.press("ArrowLeft");
  await expect(page.getByRole("img", { name: "The same picture in your light" })).toBeVisible();
  await expect(page.getByText(/Same picture, but every number changed/)).toBeVisible();

  const round1 = page.getByRole("radiogroup", { name: "Your guess for Round 1" });
  const card1 = round1.locator("xpath=ancestor::div[contains(@class,'rounded-xl')][1]");
  const pick = (group: Locator, name: string) => group.getByText(name, { exact: true }).click();

  await expect(card1.getByText("8 × 8 squares")).toBeVisible();
  // Nothing to check until there's a guess.
  await expect(card1.getByRole("button", { name: "Check my guess" })).toBeDisabled();
  await pick(round1, "Rabbit");
  await card1.getByRole("button", { name: "Check my guess" }).click();
  // Wrong with squares still to add: "not yet", and nothing given away.
  await expect(card1.getByText("Not yet! Look again with more squares.")).toBeVisible();
  await expect(card1.getByRole("img", { name: /The real picture/ })).toHaveCount(0);

  await card1.getByRole("button", { name: "Add more squares" }).click();
  await expect(card1.getByText("16 × 16 squares")).toBeVisible();
  await pick(round1, "Carrot");
  await card1.getByRole("button", { name: "Check my guess" }).click();
  await expect(card1.getByText(/Yes, it's the Carrot! You got it with 16 × 16 squares/)).toBeVisible();
  await expect(card1.getByText(/The clue you used:/)).toBeVisible();
  await expect(card1.getByRole("img", { name: "The real picture: Carrot" })).toBeVisible();

  // A one-step round, missed: the answer, the clue missed, and a retry.
  const round2 = page.getByRole("radiogroup", { name: "Your guess for Round 2" });
  const card2 = round2.locator("xpath=ancestor::div[contains(@class,'rounded-xl')][1]");
  await pick(round2, "House");
  await card2.getByRole("button", { name: "Check my guess" }).click();
  await expect(card2.getByText(/It was the Rocket/)).toBeVisible();
  await expect(card2.getByText(/The clue you missed:/)).toBeVisible();
  await card2.getByRole("button", { name: "Try this round again" }).click();
  await expect(card2.getByRole("button", { name: "Check my guess" })).toBeDisabled();

  // The player scrolls inside itself; the page never grows past the screen
  // (hidden radios used to stretch it, leaving a blank band under the bar).
  const { inner, doc } = await page.evaluate(() => ({ inner: innerHeight, doc: document.documentElement.scrollHeight }));
  expect(doc).toBeLessThanOrEqual(inner);
});
