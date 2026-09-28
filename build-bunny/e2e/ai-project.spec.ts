import { expect, test, type Page } from "@playwright/test";

import { provisionStudent, signIn, skipTo, studentName } from "./helpers";

/**
 * The AI project capstone: teach, keep a fair test pile, predict, then write
 * the report — one case the robot got wrong or wasn't sure about, and a
 * human safeguard. Each wrong report is played first, then the right one.
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
  // The walkthrough and the level's briefing: close each with its last button.
  for (let i = 0; i < 10 && (await page.getByRole("dialog").count()) === 0; i++) await page.waitForTimeout(500);
  while ((await page.getByRole("dialog").count()) > 0) await page.getByRole("dialog").getByRole("button").last().click();
}

// The berry cards in the tray, by pool id (each card carries its description by id).
const card = (page: Page, id: string) => page.getByRole("listitem").filter({ has: page.locator(`#specimen-${id}`) });

test("My AI Project: teach, test fairly, and report a failure with a human safeguard", async ({ page, baseURL }, testInfo) => {
  const kid = provisionStudent(studentName(testInfo.project.name, "ap"));
  skipTo("my-ai-project", kid.username);
  await signIn(page, baseURL!, kid.username);
  await openLevel(page, /My AI Project/);

  for (const id of ["b2", "b3", "b5", "b6", "b7", "b8", "b10"]) await card(page, id).getByRole("button", { name: "Teach this one" }).click();
  for (const id of ["b1", "b4", "b9"]) await card(page, id).getByRole("button", { name: "Keep for testing" }).click();

  // Predict first: say what the robot will answer for each mystery berry.
  const mysteries = page.getByRole("radiogroup", { name: /^Mystery \d/ });
  await expect(mysteries).toHaveCount(4);
  for (let i = 0; i < 4; i++) await mysteries.nth(i).getByRole("radio").first().click();
  await page.getByRole("button", { name: "Show its guesses" }).click();

  const check = () => page.getByRole("button", { name: "Test the bunny" }).click();

  // The model passes, but a project isn't finished without its report.
  await check();
  await expect(page.getByText("Your AI passed the fair's test! Now finish your project report", { exact: false })).toBeVisible();

  const cases = page.getByRole("radiogroup", { name: /Pick one case from your test pile/ });
  const safeguards = page.getByRole("radiogroup", { name: /How will a person stay in charge/ });
  await expect(cases.getByRole("radio")).toHaveCount(3);

  // A berry it got right and was sure about isn't a failure.
  await cases.getByRole("radio", { name: /Right and sure/ }).first().click();
  await safeguards.getByRole("radio", { name: /A person checks every berry/ }).click();
  await check();
  await expect(page.getByText("Your report names a case your AI got right and was sure about.", { exact: false })).toBeVisible();

  // A real failure, but a plan that leaves the robot on its own.
  await cases.getByRole("radio", { name: /Got it wrong|Not sure|Least sure/ }).first().click();
  await safeguards.getByRole("radio", { name: /Let the robot decide on its own/ }).click();
  await check();
  await expect(page.getByText("That plan leaves the robot on its own.", { exact: false })).toBeVisible();

  // The honest report.
  await safeguards.getByRole("radio", { name: /A person checks every berry/ }).click();
  await expect(page.getByText(/My report: My AI can go wrong on cases like this one:/)).toBeVisible();
  await check();
  await expect(page.getByRole("dialog", { name: /complete/i })).toBeVisible();
});
