import { expect, test } from "@playwright/test";

/**
 * Client navigation and refreshes land in production builds. A loading.tsx
 * boundary around the page segment made some client updates never commit
 * in production (the dev server was fine): the request went out, the new
 * page arrived, and the screen stayed where it was. Going back and forth
 * between a page and its own child page showed it most. CI runs this
 * against a production build, which is where it broke.
 */
test("a teacher can go back and forth between My classes and Curriculum", async ({ page, baseURL }, testInfo) => {
  test.skip(testInfo.project.name !== "laptop", "one viewport is enough");
  test.setTimeout(120_000);
  // The seeded demo teacher (prisma/seed-data/demo-school.ts).
  const signedIn = await page.request.post("/api/auth/sign-in/email", {
    data: { email: "sara@nitaqdemo.school", password: "TeachDemo-2026" },
    headers: { Origin: baseURL! },
  });
  expect(signedIn.ok()).toBe(true);
  await page.goto("/en/teach");
  const nav = page.getByRole("navigation", { name: "Main" });

  for (let round = 1; round <= 5; round++) {
    await nav.getByRole("link", { name: "Curriculum" }).click();
    await expect(page, `round ${round} to Curriculum`).toHaveURL(/\/teach\/curriculum$/, { timeout: 10_000 });
    await nav.getByRole("link", { name: "My classes" }).click();
    await expect(page, `round ${round} back to My classes`).toHaveURL(/\/teach$/, { timeout: 10_000 });
  }
});
