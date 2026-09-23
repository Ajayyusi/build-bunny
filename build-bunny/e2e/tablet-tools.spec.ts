import { expect, test } from "@playwright/test";

import { dragBlockUnderStack, openMap, provisionStudent, signIn, studentName } from "./helpers";

/**
 * Building without dragging, and never losing work: the tap-to-add palette,
 * undo/redo/delete, the reset confirmation, exact resume after a reload,
 * and the display settings (text size, contrast, motion).
 */

const RUN = /^▶?\s*Run$/;

async function openLevel(page: import("@playwright/test").Page, levelId: string) {
  await page.goto(`/en/play/${levelId}`);
  const briefing = page.getByRole("dialog", { name: "First Hop" });
  await expect(briefing).toBeVisible();
  return briefing;
}

test("a level can be solved by tapping blocks, with undo and a guarded reset", async ({
  page,
  baseURL,
}, testInfo) => {
  const kid = provisionStudent(studentName(testInfo.project.name, "t"));
  await signIn(page, baseURL!, kid.username);
  const briefing = await openLevel(page, kid.firstLevelId);
  await briefing.getByRole("button", { name: "Let's build!" }).click();

  const undo = page.getByRole("button", { name: "Undo" });
  const redo = page.getByRole("button", { name: "Redo" });
  await expect(undo).toBeDisabled();

  // Add a block with a tap — no drag anywhere in this test.
  await page.getByRole("button", { name: "Add block" }).click();
  const palette = page.getByRole("dialog", { name: "Add a block" });
  await expect(palette.getByRole("status")).toHaveText(/end of your program/);
  await palette.getByRole("button", { name: /move forward/ }).click();
  await expect(palette).toHaveCount(0);
  await expect(undo).toBeEnabled();

  // Undo takes it away (Run then coaches about the empty program); redo
  // brings it back.
  await undo.click();
  await expect(redo).toBeEnabled();
  const run = page.getByRole("button", { name: RUN }).filter({ visible: true }).first();
  await run.click();
  await expect(page.getByRole("status").filter({ hasText: "Your program is empty" })).toBeVisible();
  await page.getByRole("button", { name: "Got it" }).click();
  await redo.click();

  // Reset asks first, and "keep" really keeps.
  // exact: Blockly's zoom control is also a "Reset zoom" button.
  await page.getByRole("button", { name: "Reset", exact: true }).filter({ visible: true }).first().click();
  const confirm = page.getByRole("dialog", { name: "Start this level again?" });
  await expect(confirm).toBeVisible();
  await confirm.getByRole("button", { name: "Keep my blocks" }).click();
  await expect(confirm).toHaveCount(0);

  await run.click();
  await expect(page.getByRole("dialog", { name: "Level complete!" })).toBeVisible();
});

test("work survives a reload exactly, even before the server autosave", async ({
  page,
  baseURL,
}, testInfo) => {
  const kid = provisionStudent(studentName(testInfo.project.name, "r"));
  await signIn(page, baseURL!, kid.username);
  const briefing = await openLevel(page, kid.firstLevelId);
  await expect(briefing.getByRole("button", { name: "Let's build!" })).toBeVisible();
  await briefing.getByRole("button", { name: "Let's build!" }).click();

  await dragBlockUnderStack(page, "bb_moveForward");
  // Reload immediately — inside the 2 s autosave debounce. The device
  // mirror (plus the keep-alive flush) must carry the block across.
  await page.reload();
  const again = page.getByRole("dialog", { name: "First Hop" });
  await expect(again.getByText("We saved your blocks")).toBeVisible();
  await again.getByRole("button", { name: "Continue building" }).click();
  await expect(page.locator("svg.blocklySvg .blocklyBlockCanvas .bb_moveForward")).toHaveCount(1);

  // The restored program runs — it is the real block, not a picture of one.
  await page.getByRole("button", { name: RUN }).filter({ visible: true }).first().click();
  await expect(page.getByRole("dialog", { name: "Level complete!" })).toBeVisible();
});

test("display settings apply immediately and persist across reloads", async ({
  page,
  baseURL,
}, testInfo) => {
  test.skip(testInfo.project.name !== "laptop", "settings are viewport-independent");
  const kid = provisionStudent(studentName(testInfo.project.name, "d"));
  await signIn(page, baseURL!, kid.username);
  await openMap(page);
  await page.getByRole("button", { name: "Display" }).click();
  const panel = page.getByRole("dialog", { name: "Display" });
  await panel.getByRole("radio", { name: "Extra large" }).click();
  await panel.getByRole("switch", { name: "High contrast" }).click();
  await panel.getByRole("switch", { name: "Reduce motion" }).click();
  const html = page.locator("html");
  await expect(html).toHaveAttribute("data-text-size", "xl");
  await expect(html).toHaveAttribute("data-contrast", "high");
  await expect(html).toHaveAttribute("data-motion", "reduce");
  const size = await page.evaluate(() => getComputedStyle(document.documentElement).fontSize);
  expect(parseFloat(size)).toBeGreaterThan(19);

  // Reload: the boot script restores the attributes before hydration.
  await page.reload();
  await expect(html).toHaveAttribute("data-text-size", "xl");
  await expect(html).toHaveAttribute("data-contrast", "high");
  await expect(html).toHaveAttribute("data-motion", "reduce");
});
