import { expect, test, type Page } from "@playwright/test";

import { provisionStudent, signIn, studentName } from "./helpers";

/**
 * Activity launch control: the class's teacher launches an Explore AI
 * activity and switches another off; a child in that class sees it pinned
 * as "Today's AI activity", and the switched-off one gone. The class is the
 * shared demo class, so the test puts everything back.
 */

async function signInTeacher(page: Page, baseURL: string) {
  // The seeded demo teacher (prisma/seed-data/demo-school.ts).
  const signedIn = await page.request.post("/api/auth/sign-in/email", {
    data: { email: "sara@nitaqdemo.school", password: "TeachDemo-2026" },
    headers: { Origin: baseURL },
  });
  expect(signedIn.ok()).toBe(true);
}

test("a teacher launches an activity and switches one off; the class sees it", async ({ browser, baseURL }, testInfo) => {
  test.skip(testInfo.project.name !== "laptop", "one viewport is enough");
  test.setTimeout(120_000);
  const kid = provisionStudent(studentName(testInfo.project.name, "lc"));

  const teacherContext = await browser.newContext({ baseURL });
  const teacher = await teacherContext.newPage();
  await signInTeacher(teacher, baseURL!);
  await teacher.goto("/en/teach");
  await teacher.goto((await teacher.locator('a[href*="/teach/classes/"]', { hasText: "3A" }).first().getAttribute("href"))!);
  const panel = teacher.getByRole("heading", { name: "Explore AI for this class" }).locator("xpath=ancestor::*[.//ul][1]");
  // The shared demo class back to its defaults: nothing launched, all on.
  const reset = async () => {
    const stop = panel.getByRole("button", { name: "Stop" });
    if (await stop.isVisible().catch(() => false)) await stop.click();
    const off = panel.getByRole("switch", { name: "Show Who Decides? to this class" });
    if ((await off.getAttribute("aria-checked")) === "false") await off.click();
    await expect(panel.getByText("Nothing is launched.", { exact: false })).toBeVisible();
    await expect(off).toHaveAttribute("aria-checked", "true");
  };
  await reset();

  try {
    await panel.getByRole("button", { name: "Launch Fortune Teller for this class" }).click();
    await expect(panel.getByText("Launched now: Fortune Teller.", { exact: false })).toBeVisible();
    await panel.getByRole("switch", { name: "Show Who Decides? to this class" }).click();
    await expect(panel.getByRole("switch", { name: "Show Who Decides? to this class" })).toHaveAttribute("aria-checked", "false");

    const child = await (await browser.newContext({ baseURL })).newPage();
    await child.emulateMedia({ reducedMotion: "reduce" });
    await signIn(child, baseURL!, kid.username);
    await child.goto("/en/explore");
    // A brand-new child gets the welcome first (it opens a beat after load).
    const welcome = child.getByRole("dialog", { name: "Can you teach a robot to sort shapes?" });
    await welcome.waitFor({ state: "visible", timeout: 5000 }).catch(() => {});
    if (await welcome.isVisible().catch(() => false)) await welcome.getByRole("button", { name: "Look around first" }).click();
    const today = child.getByTestId("todays-activity").filter({ visible: true });
    await expect(today.getByRole("heading", { name: "Today's AI activity" })).toBeVisible();
    await expect(today).toContainText("Fortune Teller");
    await expect(child.getByTestId("explore-cards").getByRole("link", { name: /Who Decides\?/ })).toHaveCount(0);
    // The banner doesn't push the cards below the fold (1280 × 720, a classroom laptop).
    const cards = child.getByTestId("explore-cards").filter({ visible: true }).getByRole("link");
    for (let i = 0; i < (await cards.count()); i++) await expect(cards.nth(i)).toBeInViewport({ ratio: 1 });
    await today.getByRole("link", { name: "Start" }).click();
    await expect(child).toHaveURL(/\/play\//);
    await child.close();
  } finally {
    // Put the shared demo class back.
    if (!teacher.isClosed()) {
      await teacher.reload();
      await reset();
    }
    await teacherContext.close();
  }
});
