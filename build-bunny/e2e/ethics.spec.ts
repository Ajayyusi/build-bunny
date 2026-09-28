import { expect, test, type Page } from "@playwright/test";

import { provisionStudent, signIn, studentName } from "./helpers";

/**
 * The ethics loop as a child plays it: choose, read what happens, try a
 * different choice, go on — and, in Who Decides?, review a machine's
 * suggestion (its reason and how sure it is) before approving, asking for
 * more, or overriding it. Each level ends on its own checklist.
 */

async function openFromExplore(page: Page, title: RegExp) {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/en/explore");
  await page.getByRole("dialog").getByRole("button", { name: "Look around first" }).click();
  await page.getByRole("link", { name: title }).click();
  await page.getByRole("dialog").getByRole("button").last().click();
}

test("Who Decides?: review the machine's suggestion, try another choice, own checklist", async ({ page, baseURL }, testInfo) => {
  const kid = provisionStudent(studentName(testInfo.project.name, "wd"));
  await signIn(page, baseURL!, kid.username);
  await openFromExplore(page, /Who Decides\?/);

  // Honest about what this is: a made-up story, no real AI.
  await expect(page.getByText("Made-up story")).toBeVisible();

  const suggestion = page.getByRole("region", { name: "The machine suggests" });
  await expect(suggestion.getByText("Play “Happy Hop” next.")).toBeVisible();
  await expect(suggestion.getByText("People skipped the slow songs today.")).toBeVisible();
  await expect(suggestion.getByText("How sure it says it is: 85%")).toBeVisible();

  // PREDICT: the choices wait until the child says what they think.
  await expect(page.getByRole("button", { name: /Ask it for more reasons first/ })).toHaveCount(0);
  await page.getByRole("group", { name: "Is the machine's suggestion right?" }).getByRole("button", { name: "Probably right" }).click();
  await expect(page.getByText("You said: Probably right.").first()).toBeVisible();
  await page.getByRole("button", { name: /Ask it for more reasons first/ }).click();
  await expect(page.getByRole("status")).toContainText("a lot of checking");
  // The verdict is talked about after the outcome.
  await expect(page.getByText("Probably, and if not, it's only a song.")).toBeVisible();
  await page.getByRole("button", { name: "Try a different choice" }).click();
  await expect(page.getByRole("button", { name: /Ask it for more reasons first.*You tried this/ })).toBeVisible();
  await page.getByRole("button", { name: /Approve it — let the machine choose/ }).click();
  await page.getByRole("button", { name: "Continue" }).click();

  await page.getByRole("button", { name: "Can't tell from this" }).click();
  await page.getByRole("button", { name: /Ask for more: an expert checks/ }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  // Very sure isn't the same as right.
  await expect(page.getByText("How sure it says it is: 90%")).toBeVisible();
  await page.getByRole("button", { name: "Probably wrong" }).click();
  await page.getByRole("button", { name: /Override it — people choose/ }).click();
  await page.getByRole("button", { name: "Continue" }).click();

  await expect(page.getByRole("heading", { name: "Your Who-Decides Checklist" })).toBeVisible();
  await page.getByRole("button", { name: "Finish" }).click();
  const done = page.getByRole("dialog", { name: /complete/i });
  await expect(done).toBeVisible();
  // What you tried, what changed, one more to test — from this run.
  await expect(done.getByText("You made 3 choices, and looked at 1 other choice to see what would happen.")).toBeVisible();
  await expect(done.getByText("Once you went with a different choice from your first one.")).toBeVisible();
  await expect(done.getByText(/Think of an app you use that makes a choice for you/)).toBeVisible();
  // One short explanation first; the longer one waits behind "Tell me more".
  await expect(done.getByRole("heading", { name: "The big idea" })).toBeVisible();
  await expect(done.getByText("The more a mistake could hurt someone, the more a person should check the machine.")).toBeVisible();
  await expect(done.getByText(/That rule is how responsible teams use AI/)).toBeHidden();
  await done.getByText("Tell me more").click();
  await expect(done.getByText(/That rule is how responsible teams use AI/)).toBeVisible();
});

test("Is That Real?: say 'not enough evidence yet', then check the source", async ({ page, baseURL }, testInfo) => {
  const kid = provisionStudent(studentName(testInfo.project.name, "ir"));
  await signIn(page, baseURL!, kid.username);
  await openFromExplore(page, /Is That Real?/);

  await page.getByRole("group", { name: "Is this video real?" }).getByRole("button", { name: "Not enough evidence yet" }).click();
  await page.getByRole("button", { name: /Not enough evidence yet — find where it first came from/ }).click();
  await expect(page.getByRole("status")).toContainText("isn't evidence");
  await expect(page.getByText(/a video can't prove itself/)).toBeVisible();
});

test("Train a Sorter says what its robot really is", async ({ page, baseURL }, testInfo) => {
  const kid = provisionStudent(studentName(testInfo.project.name, "ts"));
  await signIn(page, baseURL!, kid.username);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/en/explore");
  await page.getByRole("dialog").getByRole("link", { name: "Let's try!" }).click();
  await page.getByRole("dialog", { name: "A robot that knows nothing" }).getByRole("button", { name: "Skip" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByText("Real, but tiny")).toBeVisible();
  await page.getByText("What is this?").click();
  await expect(page.getByText(/a real learning program, just a very small one/)).toBeVisible();
});
