import { execSync } from "node:child_process";
import { expect, type Page } from "@playwright/test";

export const E2E_PASSWORD = "hop-hop-e2e-2027";

export interface ProvisionedStudent {
  username: string;
  userId: string;
  firstLevelId: string;
  firstLevelSlug: string;
}

/**
 * A brand-new student with zero progress in the DEMO school, created through
 * the app's own provisioning path. Re-running with the same name deletes and
 * recreates the child, so every run starts from a genuine first visit.
 */
export function provisionStudent(name: string): ProvisionedStudent {
  if (!/^[a-z0-9]+$/.test(name)) throw new Error(`unsafe student name: ${name}`);
  const out = execSync(`npx tsx scripts/dev-new-student.ts ${name} ${E2E_PASSWORD}`, {
    encoding: "utf8",
  });
  const line = out.trim().split(/\r?\n/).at(-1) ?? "";
  const parsed = JSON.parse(line) as ProvisionedStudent;
  if (!parsed.firstLevelId) throw new Error("No published first level — run content:deploy");
  return parsed;
}

/**
 * Fast-forward a provisioned student to a level (dev-only script: every
 * earlier level is marked complete, the target reset to its first beat).
 */
export function skipTo(levelSlug: string, username: string): void {
  const bare = username.replace(/^demo__/, "");
  if (!/^[a-z0-9-]+$/.test(levelSlug) || !/^[a-z0-9]+$/.test(bare)) {
    throw new Error(`unsafe skipTo arguments: ${levelSlug} ${username}`);
  }
  execSync(`npm run dev:skip-to -- ${levelSlug} ${bare}`, { encoding: "utf8", stdio: "ignore" });
}

/**
 * Signs in through the auth API (the same endpoint the student login form
 * calls). The session cookie lands in the page's browser context.
 */
export async function signIn(
  page: Page,
  baseURL: string,
  username: string,
): Promise<void> {
  const response = await page.request.post("/api/auth/sign-in/username", {
    data: { username, password: E2E_PASSWORD },
    headers: { Origin: baseURL },
  });
  expect(response.ok(), `sign-in ${response.status()}`).toBe(true);
}

/** Short, filesystem-safe per-project username so projects never collide. */
export function studentName(project: string, suffix: string): string {
  const tag = project
    .split("-")
    .map((part) => part[0])
    .join("");
  return `e2e${tag}${suffix}`.toLowerCase();
}

/**
 * Drag a block out of the toolbox flyout and snap it under the lowest block
 * on the canvas, with real pointer moves (Blockly ignores teleporting drags).
 */
export async function dragBlockUnderStack(page: Page, blockType: string): Promise<void> {
  const source = page
    .locator(`svg.blocklyFlyout:not(.blocklyTrashcanFlyout) .${blockType}`)
    .first();
  await source.waitFor();
  const box = (await source.boundingBox())!;
  const target = await page.evaluate(() => {
    let best: { x: number; bottom: number } | null = null;
    for (const g of document.querySelectorAll(
      "svg.blocklySvg .blocklyBlockCanvas .blocklyBlock",
    )) {
      const path = g.querySelector(":scope > .blocklyPath") ?? g;
      const r = path.getBoundingClientRect();
      if (!best || r.bottom > best.bottom) best = { x: r.left, bottom: r.bottom };
    }
    return best;
  });
  if (!target) throw new Error("no block on the canvas to snap under");
  const sx = box.x + 12;
  const sy = box.y + 12;
  await page.mouse.move(sx, sy);
  await page.mouse.down();
  await page.mouse.move(sx + 30, sy + 10, { steps: 5 });
  await page.mouse.move(target.x + 14, target.bottom + 10, { steps: 15 });
  await page.mouse.up();
}

/**
 * Open the adventure map and dismiss the world's story scene if it opens
 * (a newly reached world plays its scene once, a beat after the map
 * mounts). For specs that are not about the story.
 */
export async function openMap(page: Page): Promise<void> {
  await page.goto("/en/adventure");
  const scene = page.getByRole("dialog", { name: /the story/ });
  await scene.waitFor({ state: "visible", timeout: 5000 }).catch(() => {});
  if (await scene.isVisible().catch(() => false)) {
    await scene.getByRole("button", { name: "Skip" }).click();
    await expect(scene).toHaveCount(0);
  }
}
