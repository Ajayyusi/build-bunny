import { expect, test } from "@playwright/test";

import { provisionStudent, signIn, skipTo, studentName } from "./helpers";

/**
 * Build-your-own maze (Inventor Island → The Fair): the child designs a map
 * by tapping tiles, the checklist refuses an unwinnable one in words, and
 * the program is then built and graded on the child's own map — with the
 * design saved so a reload comes back to the same maze.
 */

const RUN = /^▶?\s*Run$/;

test("design a maze, get refused until it is winnable, then solve it", async ({
  page,
  baseURL,
}, testInfo) => {
  const kid = provisionStudent(studentName(testInfo.project.name, "mz"));
  skipTo("my-first-maze", kid.username);
  await signIn(page, baseURL!, kid.username);

  await page.goto("/en/adventure");
  const scene = page.getByRole("dialog", { name: /the story/ });
  await scene.waitFor({ state: "visible", timeout: 5000 }).catch(() => {});
  if (await scene.isVisible().catch(() => false)) {
    await scene.getByRole("button", { name: "Skip" }).click();
  }
  await page.getByRole("button", { name: /My First Maze/ }).click();
  await page.getByRole("link", { name: "Start level" }).click();

  const briefing = page.getByRole("dialog", { name: "My First Maze" });
  await briefing.getByRole("button", { name: "Let's build!" }).click();

  // The designer: two rocks are required, the build button waits for them.
  const build = page.getByRole("button", { name: "Build my program" });
  await expect(build).toBeDisabled();
  await expect(page.getByText("At least 2 rocks or water (0 so far)")).toBeVisible();

  await page.getByRole("radio", { name: "Rock" }).click();
  // Wall off the burrow at (4,3) — rocks on both its neighbours — and the
  // checklist says so in words while Build stays off.
  const cell = (x: number, y: number) =>
    page.getByRole("gridcell", { name: new RegExp(`^Row ${y + 1}, column ${x + 1}:`) });
  await cell(3, 3).click();
  await cell(4, 2).click();
  await expect(page.getByText("At least 2 rocks or water (2 so far)")).toBeVisible();
  await expect(build).toBeDisabled();
  await expect(page.getByText(/Still to do: Robo Bunny can reach the burrow/)).toBeVisible();

  // Open the way again with Clear, then put two rocks off the planned route
  // (down the left column, along the bottom row).
  await page.getByRole("radio", { name: "Clear" }).click();
  await cell(3, 3).click();
  await cell(4, 2).click();
  await page.getByRole("radio", { name: "Rock" }).click();
  await cell(1, 0).click();
  await cell(2, 1).click();
  await expect(page.getByText(/Done: Robo Bunny can reach the burrow/)).toBeVisible();
  await expect(build).toBeEnabled();
  await build.click();

  // Now the grid player, on the child's own map: down the left column, then
  // along the bottom row to the burrow (start (0,0) facing East).
  await expect(page.getByRole("button", { name: "Change my maze" })).toBeVisible();
  const add = async (block: RegExp) => {
    await page.getByRole("button", { name: "Add block" }).click();
    await page.getByRole("dialog", { name: "Add a block" }).getByRole("button", { name: block }).click();
  };
  await add(/turn right/);
  for (let i = 0; i < 3; i += 1) await add(/move forward/);
  await add(/turn left/);
  // Repeat defaults to 4 times — exactly the bottom row's length. The repeat
  // is selected with an empty mouth, so the next block goes inside it.
  await add(/^repeat/);
  await add(/move forward/);

  await page.getByRole("button", { name: RUN }).filter({ visible: true }).first().click();
  const success = page.getByRole("dialog", { name: "Level complete!" });
  await expect(success).toBeVisible({ timeout: 20_000 });

  // The design survives a reload: back in the builder on the same map,
  // "Change my maze" shows the rocks where they were left.
  await page.reload();
  const again = page.getByRole("dialog", { name: "My First Maze" });
  await again.getByRole("button", { name: /Continue building/ }).click();
  await page.getByRole("button", { name: "Change my maze" }).click();
  await expect(cell(1, 0)).toHaveAccessibleName(/rock/);
  await expect(cell(2, 1)).toHaveAccessibleName(/rock/);
  await expect(cell(3, 3)).toHaveAccessibleName(/empty/);
  await expect(cell(4, 2)).toHaveAccessibleName(/empty/);
});
