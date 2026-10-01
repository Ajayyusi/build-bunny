import { expect, test } from "@playwright/test";

import { provisionStudent, signIn, studentName } from "./helpers";

/**
 * The Berry That Lied, open from day one: a taught berry's note can be
 * fixed (data-quality repair), not only taken back out.
 */
test("a wrong note can be fixed, from day one", async ({ page, baseURL }, testInfo) => {
  const kid = provisionStudent(studentName(testInfo.project.name, "dq"));
  await signIn(page, baseURL!, kid.username);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/en/explore");
  await page.getByRole("dialog").getByRole("button", { name: "Look around first" }).click();

  await expect(page.getByRole("heading", { name: "Also open now" })).toBeVisible();
  await page.getByRole("link", { name: /The Berry That Lied/ }).click();
  for (let i = 0; i < 6 && (await page.getByRole("dialog").count()) === 0; i++) await page.waitForTimeout(500);
  while ((await page.getByRole("dialog").count()) > 0) await page.getByRole("dialog").getByRole("button").last().click();

  await page.getByRole("button", { name: "Teach this one" }).first().click();
  const fix = page.getByRole("button", { name: /^Fix this note:/ }).first();
  await expect(fix).toBeVisible();
  await fix.click();
  await expect(page.getByText("Note fixed").first()).toBeVisible();
});

test("with the wrong note in, the test fails; fixed, the same examples pass", async ({ page, baseURL }, testInfo) => {
  test.skip(testInfo.project.name !== "laptop", "one viewport is enough");
  const kid = provisionStudent(studentName(testInfo.project.name, "dr"));
  await signIn(page, baseURL!, kid.username);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/en/explore");
  await page.getByRole("dialog").getByRole("button", { name: "Look around first" }).click();
  await page.getByRole("link", { name: /The Berry That Lied/ }).click();
  for (let i = 0; i < 6 && (await page.getByRole("dialog").count()) === 0; i++) await page.waitForTimeout(500);
  while ((await page.getByRole("dialog").count()) > 0) await page.getByRole("dialog").getByRole("button").last().click();

  // Teach every berry, notes as written: the wrong note (L8) misleads it.
  for (const id of ["L1", "L2", "L3", "L4", "L5", "L6", "L7", "L8"]) {
    await page.getByRole("listitem").filter({ has: page.locator(`#specimen-${id}`) }).getByRole("button", { name: "Teach this one" }).click();
  }
  await page.getByRole("button", { name: "Test the bunny" }).click();
  await expect(page.getByText(/got d of 3 right|It guessed wrong/)).toBeVisible();

  // Fix that one note and test the same examples again.
  await page.getByRole("button", { name: /^Fix this note:.*3 out of 10.*8 out of 10/ }).click();
  await page.getByRole("button", { name: "Test the bunny" }).click();
  await expect(page.getByRole("dialog", { name: /complete/i })).toBeVisible();
});
