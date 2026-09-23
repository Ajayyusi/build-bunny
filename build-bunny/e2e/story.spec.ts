import { expect, test } from "@playwright/test";

import { provisionStudent, signIn, skipTo, studentName } from "./helpers";

/**
 * The story layer (docs/build-bunny/STORY.md): a world's opening scene is
 * shown once when it opens, can be skipped at any line, never comes back
 * uninvited, and can be replayed from the world card; finishing a world's
 * last level awards its Power on the success card.
 */

test("a new world's story plays once, can be skipped, and can be replayed", async ({
  page,
  baseURL,
}, testInfo) => {
  const kid = provisionStudent(studentName(testInfo.project.name, "s"));
  await signIn(page, baseURL!, kid.username);

  await page.goto("/en/adventure");
  const scene = page.getByRole("dialog", { name: "Bunny Meadow — the story" });
  await expect(scene).toBeVisible();
  await expect(scene.getByText(/I'm Robo Bunny/)).toBeVisible();
  await expect(scene.getByText("Grandma Clover")).toBeVisible();
  // Skippable at the first line.
  await scene.getByRole("button", { name: "Skip" }).click();
  await expect(scene).toHaveCount(0);

  // The map shows the friend and the Power to earn, and a Story button.
  await expect(page.getByText("Grandma Clover").first()).toBeVisible();
  await expect(page.getByText("Sequence Power").first()).toBeVisible();

  // Not shown again on the next visit…
  await page.reload();
  await expect(page.getByRole("heading", { name: "My path" })).toBeVisible();
  await expect(page.getByRole("dialog", { name: /the story/ })).toHaveCount(0);

  // …but replayable, all three lines, ending in "Let's go!".
  await page.getByRole("button", { name: "Story", exact: true }).first().click();
  const replay = page.getByRole("dialog", { name: "Bunny Meadow — the story" });
  await expect(replay).toBeVisible();
  await replay.getByRole("button", { name: "Next" }).click();
  await replay.getByRole("button", { name: "Next" }).click();
  await replay.getByRole("button", { name: "Let's go!" }).click();
  await expect(replay).toHaveCount(0);
});

test("finishing a world's last level awards its Power", async ({ page, baseURL }, testInfo) => {
  test.skip(testInfo.project.name !== "laptop", "one viewport is enough for the reward beat");
  const kid = provisionStudent(studentName(testInfo.project.name, "p"));
  // Everything before Bunny Meadow's last level (Clover Loop, in the
  // Practice Paddock) is marked done, so solving it completes the world.
  skipTo("clover-loop", kid.username);
  await signIn(page, baseURL!, kid.username);

  await page.goto("/en/adventure");
  // The newly reached world's story scene opens a beat after the map
  // mounts; wait for it, skip it, and only then touch the map.
  const scene = page.getByRole("dialog", { name: /the story/ });
  await scene.waitFor({ state: "visible", timeout: 5000 }).catch(() => {});
  if (await scene.isVisible().catch(() => false)) {
    await scene.getByRole("button", { name: "Skip" }).click();
    await expect(scene).toHaveCount(0);
  }
  await page.getByRole("button", { name: /Clover Loop/ }).click();
  await page.getByRole("link", { name: "Start level" }).click();

  const briefing = page.getByRole("dialog", { name: "Clover Loop" });
  await briefing.getByRole("button", { name: /Let's build!|Continue building/ }).click();

  // Solve it by tapping: five hops (a pass, if not the three-star loop).
  for (const block of ["move forward", "move forward", "move forward", "move forward", "move forward"]) {
    await page.getByRole("button", { name: "Add block" }).click();
    await page
      .getByRole("dialog", { name: "Add a block" })
      .getByRole("button", { name: new RegExp(block) })
      .click();
  }
  await page.getByRole("button", { name: /^▶?\s*Run$/ }).filter({ visible: true }).first().click();

  const success = page.getByRole("dialog", { name: "Level complete!" });
  await expect(success).toBeVisible();
  await expect(success.getByText("You finished Bunny Meadow!")).toBeVisible();
  await expect(success.getByText("You earned the Sequence Power!")).toBeVisible();
  await expect(success.getByText("One clear instruction after another.")).toBeVisible();
});
