import { expect, test, type Page } from "@playwright/test";

import { openMap, provisionStudent, signIn, skipTo, studentName } from "./helpers";

/**
 * Handoff rows the second audit found unbuilt or only partly built:
 *  - leaving an AI lesson goes back to its own route, not the Coding Lab;
 *  - Train a Sorter: "3 to 5 examples";
 *  - "a hint after repeated failure";
 *  - teacher evidence of what the child changed between tries.
 */

async function signInTeacher(page: Page, baseURL: string) {
  // The seeded demo teacher (prisma/seed-data/demo-school.ts).
  const res = await page.request.post("/api/auth/sign-in/email", {
    data: { email: "sara@nitaqdemo.school", password: "TeachDemo-2026" },
    headers: { Origin: baseURL },
  });
  expect(res.ok(), `teacher sign-in ${res.status()}`).toBe(true);
}

const skipWalkthrough = async (page: Page, name: string) => {
  const walkthrough = page.getByRole("dialog", { name });
  await walkthrough.waitFor({ state: "visible", timeout: 5000 }).catch(() => {});
  if (await walkthrough.isVisible().catch(() => false)) await walkthrough.getByRole("button", { name: "Skip" }).click();
};

test("back to the map goes to the lesson's own route", async ({ page, baseURL }, testInfo) => {
  test.skip(testInfo.project.name !== "laptop", "one viewport is enough");
  const kid = provisionStudent(studentName(testInfo.project.name, "bk"));
  await signIn(page, baseURL!, kid.username);
  await page.emulateMedia({ reducedMotion: "reduce" });

  // An Explore AI lesson goes back to Explore AI.
  await page.goto("/en/explore");
  await page.getByRole("dialog").getByRole("button", { name: "Look around first" }).click();
  await page.getByRole("link", { name: /Train a Sorter/ }).click();
  await skipWalkthrough(page, "A robot that knows nothing");
  await expect(page.getByRole("link", { name: "Back to map" }).first()).toHaveAttribute("href", /\/explore$/);

  // A coding level goes back to the Coding Lab.
  await openMap(page);
  await page.goto(`/en/play/${kid.firstLevelId}`);
  await expect(page.getByRole("link", { name: "Back to map" }).first()).toHaveAttribute("href", /\/adventure$/);
});

test("3 to 5 examples, a hint after two misses, and the teacher sees what changed", async ({ browser, page, baseURL }, testInfo) => {
  test.skip(testInfo.project.name !== "laptop", "one viewport is enough");
  test.setTimeout(120_000);
  const kid = provisionStudent(studentName(testInfo.project.name, "tr"));
  await signIn(page, baseURL!, kid.username);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/en/explore");
  await page.getByRole("dialog").getByRole("button", { name: "Look around first" }).click();
  await page.getByRole("link", { name: /Train a Sorter/ }).click();
  await skipWalkthrough(page, "A robot that knows nothing");

  const card = (id: string) => page.getByRole("listitem").filter({ has: page.locator(`#specimen-${id}`) });
  const test3 = async () => {
    const groups = page.locator("[role=radiogroup][aria-labelledby^=predict-]");
    const reveal = page.getByRole("button", { name: "Show its guesses" });
    if (await reveal.isVisible().catch(() => false)) {
      for (let i = 0; i < (await groups.count()); i++) await groups.nth(i).getByRole("radio").first().click();
      await reveal.click();
    }
    await page.getByRole("button", { name: "Test the bunny" }).click();
  };

  // Two examples are not enough; three (one of each kind) are.
  await card("p1").getByRole("button", { name: "Teach this one" }).click();
  await card("p3").getByRole("button", { name: "Teach this one" }).click();
  await expect(page.getByText(/Teach it at least 3 examples/)).toBeVisible();
  await card("p4").getByRole("button", { name: "Teach this one" }).click();
  await expect(page.getByText(/Teach it at least 3 examples/)).toHaveCount(0);
  await test3();
  await expect(page.getByText(/got \d of 4 right|It guessed wrong/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Try a hint" })).toHaveCount(0);

  // A second miss: the hint is offered where the child is looking.
  await card("p2").getByRole("button", { name: "Teach this one" }).click();
  await test3();
  await expect(page.getByRole("button", { name: "Try a hint" })).toBeVisible();

  // Fix it: take one red circle back, add the orange circle and the red square.
  await page.getByRole("button", { name: /^Take this shape back/ }).first().click();
  for (const id of ["p5", "p6"]) await card(id).getByRole("button", { name: "Teach this one" }).click();
  await test3();
  await expect(page.getByRole("dialog", { name: /complete/i })).toBeVisible();

  // The class teacher reads what was taught and what changed.
  const teacherContext = await browser.newContext({ baseURL });
  const teacher = await teacherContext.newPage();
  await signInTeacher(teacher, baseURL!);
  await teacher.goto("/en/teach");
  const classHref = await teacher.locator('a[href*="/teach/classes/"]', { hasText: "3A" }).first().getAttribute("href");
  await teacher.goto(`${classHref!.replace(/\/$/, "")}/students/${kid.userId}`);
  await teacher.locator('a[href*="/teach/attempts/"]').first().click();
  await expect(teacher.getByText("What they taught the bunny")).toBeVisible();
  await expect(teacher.getByText(/Taught as “Circle”/)).toBeVisible();
  await expect(teacher.getByText("What changed since their previous try")).toBeVisible();
  await expect(teacher.getByText(/^Added /).first()).toBeVisible();
  await expect(teacher.getByText(/^Took out /).first()).toBeVisible();
  await teacherContext.close();
});

test("grouping and simulation levels say how real they are", async ({ page, baseURL }, testInfo) => {
  test.skip(testInfo.project.name !== "laptop", "one viewport is enough");
  const kid = provisionStudent(studentName(testInfo.project.name, "hn"));
  await signIn(page, baseURL!, kid.username);
  await page.emulateMedia({ reducedMotion: "reduce" });
  const openFromWorlds = async (title: RegExp) => {
    await page.goto("/en/ai-worlds");
    const story = page.getByRole("dialog", { name: /the story/ });
    await story.waitFor({ state: "visible", timeout: 5000 }).catch(() => {});
    if (await story.isVisible().catch(() => false)) await story.getByRole("button", { name: "Skip" }).click();
    await page.getByRole("button", { name: title }).click();
    await page.getByRole("link", { name: "Start level" }).click();
    await page.waitForURL(/\/play\//);
  };

  skipTo("two-piles", kid.username);
  await openFromWorlds(/Two Piles in the Sand/);
  await expect(page.getByText("Real, but tiny").first()).toBeAttached();
  await expect(page.getByText(/The grouping is real/).first()).toBeAttached();

  skipTo("fortune-teller", kid.username);
  await openFromWorlds(/Fortune Teller/);
  await expect(page.getByText("Real — it actually computes").first()).toBeAttached();
});
