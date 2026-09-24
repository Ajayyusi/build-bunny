import { expect, test } from "@playwright/test";

import { provisionStudent, signIn, studentName } from "./helpers";

/**
 * "Ask Robo Bunny": the four help tools that are not the answer — explain
 * the selected block, explain why the last run failed (in terms of the
 * child's own program), the smallest hint, and a similar example that
 * plays through the real engine.
 */

const RUN = /^▶?\s*Run$/;

async function addBlock(page: import("@playwright/test").Page, name: RegExp) {
  await page.getByRole("button", { name: "Add block" }).click();
  await page.getByRole("dialog", { name: "Add a block" }).getByRole("button", { name }).click();
}

test("Robo Bunny explains a block, a failure, gives the smallest hint and a similar example", async ({
  page,
  baseURL,
}, testInfo) => {
  test.skip(testInfo.project.name === "tablet-portrait", "same panel; two shapes are enough");
  const kid = provisionStudent(studentName(testInfo.project.name, "h"));
  await signIn(page, baseURL!, kid.username);
  await page.goto(`/en/play/${kid.firstLevelId}`);
  await page.getByRole("dialog", { name: "First Hop" }).getByRole("button", { name: "Let's build!" }).click();

  // Two hops on a one-hop level: the run finishes past the burrow.
  await addBlock(page, /move forward/);
  await addBlock(page, /move forward/);
  await page.getByRole("button", { name: RUN }).filter({ visible: true }).first().click();
  await expect(page.getByRole("alert").filter({ hasText: "finished away from the burrow" })).toBeVisible();
  await page.getByRole("button", { name: "Try again" }).click();

  await page.getByRole("button", { name: "Ask Robo Bunny" }).click();
  const help = page.getByRole("dialog", { name: "Ask Robo Bunny" });
  await expect(help).toBeVisible();

  // Explain this block — the block just added is still selected.
  await help.getByRole("button", { name: "Explain this block" }).click();
  await expect(help.getByText(/One hop in the direction Robo Bunny is facing/)).toBeVisible();

  // Why did that fail? — in terms of the run, not a generic shrug.
  await help.getByRole("button", { name: "Why did that fail?" }).click();
  await expect(help.getByText(/ran all the way to the end, but the goal wasn't reached/)).toBeVisible();
  await expect(help.getByText(/Count the tiles to the goal/)).toBeVisible();

  // Give me a smaller hint — tier 1 of the authored ladder.
  await help.getByRole("button", { name: "Give me a smaller hint" }).click();
  await expect(help.getByText(/Robo Bunny only moves when a block tells it to/)).toBeVisible();
  await expect(help.getByRole("button", { name: "I need a bigger hint" })).toBeVisible();

  // Show a similar example — a different, smaller puzzle that plays.
  await help.getByRole("button", { name: "Show a similar example" }).click();
  await expect(help.getByText(/smaller puzzle that uses the same idea/)).toBeVisible();
  await expect(help.getByText("moveForward();").first()).toBeVisible();
  await help.getByRole("button", { name: "Watch it run" }).click();
  await expect(help.getByRole("button", { name: "Watch it run" })).toBeEnabled({ timeout: 15000 });

  await help.getByRole("button", { name: "Back to my puzzle" }).click();
  await expect(help).toHaveCount(0);
});
