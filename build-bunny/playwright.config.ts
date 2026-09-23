import { defineConfig } from "@playwright/test";

/**
 * Child-facing end-to-end flows, driven in a real browser at the three
 * screen shapes Build Bunny is sold on: a school laptop, a tablet held
 * landscape, and a tablet held portrait (touch enabled on both tablets).
 *
 * Runs against E2E_BASE_URL when set (CI starts `next start` itself);
 * otherwise reuses a dev server already on :3000, or starts `npm run start`
 * after a build. The suite provisions its own brand-new students through
 * scripts/dev-new-student.ts, so it needs the seeded DEMO school and a
 * published curriculum in DATABASE_URL — never point it at production.
 */
export default defineConfig({
  testDir: "e2e",
  timeout: 120_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "laptop", use: { viewport: { width: 1280, height: 800 } } },
    {
      name: "tablet-landscape",
      use: { viewport: { width: 1024, height: 768 }, hasTouch: true },
    },
    {
      name: "tablet-portrait",
      use: { viewport: { width: 768, height: 1024 }, hasTouch: true },
    },
  ],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: "npm run start",
        url: "http://localhost:3000/api/health",
        reuseExistingServer: true,
        timeout: 180_000,
      },
});
