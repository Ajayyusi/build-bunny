import { expect, test } from "@playwright/test";

import { provisionStudent, signIn, skipTo, studentName } from "./helpers";

/**
 * Variables in the player (Code City → Counters and Tricks): a counter
 * program built by tapping, the located feedback when the counter lands on
 * the wrong number, and the pass when it lands on the right one — all graded
 * by the real interpreter reading the variable back.
 */

const RUN = /^▶?\s*Run$/;

test("count the hops: the counter's final value is graded, and the code view shows a real variable", async ({
  page,
  baseURL,
}, testInfo) => {
  test.skip(testInfo.project.name !== "laptop", "one viewport is enough for a grading contract");
  const kid = provisionStudent(studentName(testInfo.project.name, "ct"));
  skipTo("count-the-hops", kid.username);
  await signIn(page, baseURL!, kid.username);

  await page.goto("/en/adventure");
  const scene = page.getByRole("dialog", { name: /the story/ });
  await scene.waitFor({ state: "visible", timeout: 5000 }).catch(() => {});
  if (await scene.isVisible().catch(() => false)) {
    await scene.getByRole("button", { name: "Skip" }).click();
  }
  await page.getByRole("button", { name: /Count the Hops/ }).click();
  await page.getByRole("link", { name: "Start level" }).click();
  await page.getByRole("dialog", { name: "Count the Hops" }).getByRole("button", { name: "Let's build!" }).click();

  const add = async (block: RegExp) => {
    await page.getByRole("button", { name: "Add block" }).click();
    await page.getByRole("dialog", { name: "Add a block" }).getByRole("button", { name: block }).click();
  };
  // Repeat 4 { move; say the counter } — the say is INSIDE the loop, so
  // Robo Bunny says 0, 0, 0, 0 and the counter never grows: a wrong value,
  // explained as such.
  await add(/^repeat/);
  await add(/move forward/);
  await add(/say the counter/);
  const run = page.getByRole("button", { name: RUN }).filter({ visible: true }).first();
  await run.click();
  // Next.js dev tools also mount an alert region: pick the banner by its text.
  const banner = page.getByRole("alert").filter({ hasText: /counter ended/ });
  await expect(banner).toContainText("The counter ended on 0, but it should be 4", { timeout: 20_000 });
  await banner.getByRole("button", { name: "Try again" }).click();
  await expect(banner).toHaveCount(0);

  // Start over and build it right: count inside the loop, say once after it.
  // Reset asks first when there is work to throw away; confirm if it does.
  await page.getByRole("button", { name: "Reset", exact: true }).filter({ visible: true }).first().click();
  const confirm = page.getByRole("dialog", { name: "Start this level again?" });
  await confirm.waitFor({ state: "visible", timeout: 5000 }).catch(() => {});
  if (await confirm.isVisible().catch(() => false)) {
    await confirm.getByRole("button", { name: "Yes, clear my blocks" }).click();
  }
  await expect(page.locator("svg.blocklySvg .blocklyBlockCanvas g.bb_repeat")).toHaveCount(0);
  await add(/^repeat/);
  await add(/move forward/);
  // The hop is selected: the add goes after it, inside the loop.
  await add(/add to counter/);
  // Select the loop itself so the say goes AFTER the loop, not inside it.
  // Its outline's CENTRE is inside the mouth (on the blocks it holds), so tap
  // near its top-left corner, on the "repeat" label — once the canvas has
  // finished scrolling the last block into view.
  const loop = page.locator("svg.blocklySvg .blocklyBlockCanvas g.bb_repeat").first();
  await page.waitForTimeout(600);
  await loop.locator("path.blocklyPath").first().click({ position: { x: 14, y: 14 } });
  await expect(loop).toHaveClass(/blocklySelected/);
  const palette = page.getByRole("dialog", { name: "Add a block" });
  await page.getByRole("button", { name: "Add block" }).click();
  await expect(palette.getByRole("status")).toHaveText(/after “repeat”/);
  await palette.getByRole("button", { name: /say the counter/ }).click();

  // The Code view shows the real variable and loop.
  await page.getByRole("button", { name: "Code" }).click();
  await expect(page.getByText("var counter = 0;")).toBeVisible();
  await expect(page.getByText("counter = counter + 1;")).toBeVisible();
  await expect(page.getByText("say(String(counter));")).toBeVisible();
  await page.getByRole("button", { name: "Blocks" }).click();

  await run.click();
  const success = page.getByRole("dialog", { name: "Level complete!" });
  await expect(success).toBeVisible({ timeout: 20_000 });
  await expect(success).toContainText("3");
});
