import { expect, test } from "@playwright/test";

import { provisionStudent, signIn, studentName } from "./helpers";

/**
 * At phone width (390 px) no student page scrolls sideways. The level
 * player's top bar used to be wider than the screen (its button labels),
 * and the Explore AI header squeezed its title to a word a line.
 */
test("no sideways scrolling at phone width", async ({ page, baseURL }, testInfo) => {
  test.skip(testInfo.project.name !== "laptop", "one run is enough; the viewport is set here");
  test.setTimeout(120_000);
  const kid = provisionStudent(studentName(testInfo.project.name, "pw"));
  await signIn(page, baseURL!, kid.username);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: "reduce" });

  // A Teach level (Train a Sorter, open to a new child from Explore AI) and
  // the first coding level: two different players' top bars.
  await page.goto("/en/explore");
  const sorter = await page.getByTestId("explore-cards").filter({ visible: true }).getByRole("link", { name: /Train a Sorter/ }).getAttribute("href");
  const paths = ["/en/explore", "/en/home", "/en/adventure", "/ar/explore", `/en/play/${kid.firstLevelId}`, `/en${sorter}`];
  for (const path of paths) {
    await page.goto(path);
    await page.waitForLoadState("networkidle");
    const { scrollWidth, width } = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      width: window.innerWidth,
    }));
    expect(scrollWidth, `${path} scrolls sideways`).toBeLessThanOrEqual(width);
  }
  // The Explore AI title isn't squeezed to a word a line.
  await page.goto("/en/explore");
  const title = page.getByRole("heading", { level: 1, name: "Teach it. Test it. Question it." });
  expect((await title.boundingBox())!.width).toBeGreaterThan(200);
});
