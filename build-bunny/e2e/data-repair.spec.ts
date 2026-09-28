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
