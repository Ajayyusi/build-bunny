import { expect, test } from "@playwright/test";

import { provisionStudent, signIn, studentName } from "./helpers";

/**
 * Weak classroom Wi-Fi (brief §7): a child who solves a level while the
 * connection is down sees their success, is told the run is kept on the
 * device, and the run is saved — once — as soon as the connection returns,
 * without touching anything. The server is the judge of that save.
 */

const RUN = /^▶?\s*Run$/;

test("a run made offline is kept on the device and saved when the connection returns", async ({
  page,
  context,
  baseURL,
}, testInfo) => {
  test.skip(testInfo.project.name !== "laptop", "network behaviour is viewport-independent");
  const kid = provisionStudent(studentName(testInfo.project.name, "off"));
  await signIn(page, baseURL!, kid.username);
  await page.goto(`/en/play/${kid.firstLevelId}`);
  await page.getByRole("dialog", { name: "First Hop" }).getByRole("button", { name: "Let's build!" }).click();

  await page.getByRole("button", { name: "Add block" }).click();
  await page.getByRole("dialog", { name: "Add a block" }).getByRole("button", { name: /move forward/ }).click();

  // The Wi-Fi drops just as the child presses Run.
  await context.setOffline(true);
  await page.getByRole("button", { name: RUN }).filter({ visible: true }).first().click();
  const success = page.getByRole("dialog", { name: "Level complete!" });
  await expect(success).toBeVisible();
  await expect(success.getByText("Your run is kept on this device")).toBeVisible({ timeout: 20_000 });
  const queued = await page.evaluate(() => Object.keys(JSON.parse(localStorage.getItem("bb:outbox:v1") ?? "{}")).length);
  expect(queued).toBe(1);

  // Back online: the run is sent by itself and the XP arrives.
  await context.setOffline(false);
  await expect(success.getByText(/\+\s*\d+\s*XP/)).toBeVisible({ timeout: 20_000 });
  await expect
    .poll(() => page.evaluate(() => localStorage.getItem("bb:outbox:v1")))
    .toBeNull();

  // Saved: the level is completed, and a reload of the map shows it.
  await page.goto("/en/adventure");
  const scene = page.getByRole("dialog", { name: /the story/ });
  await scene.waitFor({ state: "visible", timeout: 5000 }).catch(() => {});
  if (await scene.isVisible().catch(() => false)) await scene.getByRole("button", { name: "Skip" }).click();
  await expect(page.getByRole("button", { name: /First Hop.*Completed|Level 1: First Hop · Completed/ })).toBeVisible();
});
