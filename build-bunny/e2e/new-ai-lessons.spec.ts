import { expect, test, type Page } from "@playwright/test";

import { provisionStudent, signIn, skipTo, studentName } from "./helpers";

/**
 * The backlog's new AI lessons on the "mark the items" widget: generative
 * AI (Two Answers), AI and privacy (Need to Know), natural language (Say It
 * Clearly). Each is played wrong first, then right.
 */

async function openLevel(page: Page, title: RegExp) {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/en/ai-worlds");
  const scene = page.getByRole("dialog", { name: /the story/ });
  await scene.waitFor({ state: "visible", timeout: 5000 }).catch(() => {});
  if (await scene.isVisible().catch(() => false)) await scene.getByRole("button", { name: "Skip" }).click();
  await page.getByRole("button", { name: title }).click();
  await page.getByRole("link", { name: "Start level" }).click();
  await page.waitForURL(/\/play\//);
  // The level's own briefing: close it with its start button.
  const briefing = page.getByRole("dialog", { name: title });
  await briefing.waitFor({ state: "visible", timeout: 15000 });
  await briefing.getByRole("button").last().click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
}

const check = (page: Page) => page.getByRole("button", { name: "Check my work" }).click();

test("Two Answers: say who you trust, then check every sentence against the notice", async ({ page, baseURL }, testInfo) => {
  const kid = provisionStudent(studentName(testInfo.project.name, "ta"));
  skipTo("two-answers", kid.username);
  await signIn(page, baseURL!, kid.username);
  await openLevel(page, /Two Answers/);

  await page.getByRole("group", { name: "Before you check: which answer do you trust more?" }).getByRole("button", { name: "Pip's" }).click();
  await expect(page.getByText("You said: Pip's.")).toBeVisible();
  const mark = (sentence: string, name: string) =>
    page.getByRole("radiogroup", { name: sentence }).getByRole("radio", { name: new RegExp(name) }).click();
  const says = ["The library opens at 9 am from Monday to Thursday.", "On those days it closes at 5 pm.", "Children can borrow up to 5 books.", "On Friday it closes at 1 pm."];
  const not = ["On Saturday it's open until noon.", "The library is open every day of the week.", "Children can borrow 10 books for a month."];
  for (const s of says) await mark(s, "The notice says so");
  for (const s of not) await mark(s, "doesn't say so");
  // The cafe sounds nice — marked as if the notice said so, it fails.
  await mark("There's a free cafe on the top floor.", "The notice says so");
  await check(page);
  await expect(page.getByText("7 of 8 are right so far.", { exact: false })).toBeVisible();
  await page.getByRole("button", { name: "Try again" }).click();
  await mark("There's a free cafe on the top floor.", "doesn't say so");
  await check(page);
  const done = page.getByRole("dialog", { name: /complete/i });
  await expect(done).toBeVisible();
  await expect(done.getByText("It took 2 checks to get every part right.")).toBeVisible();
});

test("Need to Know: strike out what the helper doesn't need", async ({ page, baseURL }, testInfo) => {
  const kid = provisionStudent(studentName(testInfo.project.name, "nk"));
  skipTo("need-to-know", kid.username);
  await signIn(page, baseURL!, kid.username);
  await openLevel(page, /Need to Know/);

  for (const detail of ["Maya Haddad", "Al Noor School", "12 Palm Street", "055 123 4567"]) {
    await page.getByRole("button", { name: `${detail}, kept. Tap to strike it out.` }).click();
    await expect(page.getByRole("button", { name: `${detail}, struck out. Tap to keep it.` })).toBeVisible();
  }
  await check(page);
  await expect(page.getByRole("dialog", { name: /complete/i })).toBeVisible();
});

test("Say It Clearly: replace every vague word, and hear the difference", async ({ page, baseURL }, testInfo) => {
  const kid = provisionStudent(studentName(testInfo.project.name, "sc"));
  skipTo("say-it-clearly", kid.username);
  await signIn(page, baseURL!, kid.username);
  await openLevel(page, /Say It Clearly/);

  await page.getByRole("button", { name: "No, it's too vague" }).click();
  const pick = (vague: string, clear: string) =>
    page.getByRole("radiogroup", { name: `Instead of “${vague}”:` }).getByRole("radio", { name: clear }).click();
  await pick("the big one", "the big blue table");
  await pick("it", "the window");
  await pick("them", "Ms Sara and the Grade 6 class");
  await pick("soon", "by 3 pm on Thursday");
  await expect(
    page.getByText("Put the big blue table next to the window, and email the plan to Ms Sara and the Grade 6 class by 3 pm on Thursday."),
  ).toBeVisible();
  await check(page);
  await expect(page.getByRole("dialog", { name: /complete/i })).toBeVisible();
});
