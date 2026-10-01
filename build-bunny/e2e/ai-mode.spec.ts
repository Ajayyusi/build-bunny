import { expect, test } from "@playwright/test";

import { provisionStudent, signIn, studentName } from "./helpers";

/**
 * Grade range modes: a child switches on Explore AI, and the AI activities
 * change how they speak — simpler words and friendly help for grades 3-4,
 * the proper terms (and deeper tests) for grades 5-7. Progress stays.
 */
test("switching between simpler words and more detail", async ({ page, baseURL }, testInfo) => {
  const kid = provisionStudent(studentName(testInfo.project.name, "md"));
  await signIn(page, baseURL!, kid.username);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/en/explore");
  await page.getByRole("dialog").getByRole("button", { name: "Look around first" }).click();

  const modes = page.getByRole("radiogroup", { name: "Words:" });
  const openSorter = async () => {
    await page.goto("/en/explore");
    await page.getByRole("link", { name: /Train a Sorter/ }).click();
    const walkthrough = page.getByRole("dialog", { name: "A robot that knows nothing" });
    await walkthrough.waitFor({ state: "visible", timeout: 5000 }).catch(() => {});
    if (await walkthrough.isVisible().catch(() => false)) await walkthrough.getByRole("button", { name: "Skip" }).click();
  };

  // More detail: the full steps and "What is this called?".
  await modes.getByRole("radio", { name: "More detail" }).click();
  await expect(modes.getByRole("radio", { name: "More detail" })).toHaveAttribute("aria-checked", "true");
  await openSorter();
  await expect(page.getByText("What is this called?")).toBeVisible();
  await expect(page.getByText("Show all the steps")).toHaveCount(0);

  // Simpler: the mission line, the steps one tap away, and terms only if
  // the child asks (the chip stays closed until tapped).
  await page.goto("/en/explore");
  await modes.getByRole("radio", { name: "Simpler" }).click();
  await expect(modes.getByRole("radio", { name: "Simpler" })).toHaveAttribute("aria-checked", "true");
  await openSorter();
  await expect(page.getByText("Show all the steps")).toBeVisible();
  await expect(page.locator("details").filter({ hasText: "What is this called?" })).not.toHaveAttribute("open", "");

  // Back to the grade's own mode.
  await page.goto("/en/explore");
  await page.getByRole("button", { name: "Use my grade" }).click();
  await expect(page.getByRole("button", { name: "Use my grade" })).toHaveCount(0);
});
