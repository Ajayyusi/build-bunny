// Load-time measurements (dev-only; run from build-bunny/ against a local
// PRODUCTION build: npm run build && npm run start, then
// node scripts/perf-tablet.mjs), emulating a
// low-end school tablet: 4x CPU slowdown and a slow school connection
// (1.6 Mbps down, 750 kbps up, 150 ms latency). Cold = empty cache, warm =
// second visit. Reduced motion is on so the level's 1.5 s arrival animation
// is not counted as loading. Prints a JSON table.
import { execSync } from "node:child_process";
import { chromium } from "playwright";

const BASE = process.env.PERF_BASE_URL ?? "http://localhost:3000";
const kid = JSON.parse(
  execSync("npx tsx scripts/dev-new-student.ts perfkid hop-hop-e2e-2027", { encoding: "utf8" })
    .trim()
    .split(/\r?\n/)
    .at(-1),
);

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1024, height: 768 }, hasTouch: true, reducedMotion: "reduce" });
const page = await ctx.newPage();
const cdp = await ctx.newCDPSession(page);
await cdp.send("Network.enable");
await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
await cdp.send("Network.emulateNetworkConditions", {
  offline: false,
  latency: 150,
  downloadThroughput: (1.6 * 1024 * 1024) / 8,
  uploadThroughput: (750 * 1024) / 8,
});
const signIn = await page.request.post(`${BASE}/api/auth/sign-in/username`, {
  data: { username: kid.username, password: "hop-hop-e2e-2027" },
  headers: { Origin: BASE },
});
if (!signIn.ok()) throw new Error("sign-in " + signIn.status());

const transfer = () =>
  page.evaluate(() => {
    const entries = performance.getEntriesByType("resource");
    const js = entries.filter((e) => e.initiatorType === "script" || e.name.endsWith(".js"));
    const nav = performance.getEntriesByType("navigation")[0];
    const lcp = performance.getEntriesByType("largest-contentful-paint").at(-1);
    return {
      jsKB: Math.round(js.reduce((s, e) => s + (e.transferSize || 0), 0) / 1024),
      totalKB: Math.round((entries.reduce((s, e) => s + (e.transferSize || 0), 0) + (nav?.transferSize || 0)) / 1024),
      domContentLoadedMs: Math.round(nav?.domContentLoadedEventEnd ?? 0),
      lcpMs: lcp ? Math.round(lcp.startTime) : null,
    };
  });

async function measure(label, url, ready) {
  const t0 = Date.now();
  await page.goto(url, { waitUntil: "commit" });
  await ready();
  const readyMs = Date.now() - t0;
  await page.waitForLoadState("networkidle").catch(() => {});
  return { page: label, readyMs, ...(await transfer()) };
}

// LCP entries are only buffered when observed; start observing on every page.
await page.addInitScript(() => {
  try {
    new PerformanceObserver(() => {}).observe({ type: "largest-contentful-paint", buffered: true });
  } catch {}
});

const rows = [];
for (const pass of ["cold", "warm"]) {
  if (pass === "cold") await cdp.send("Network.clearBrowserCache");
  rows.push({
    pass,
    ...(await measure("home", `${BASE}/home`, () =>
      page.getByRole("heading").first().waitFor({ timeout: 60_000 }),
    )),
  });
  rows.push({
    pass,
    ...(await measure("level briefing", `${BASE}/play/${kid.firstLevelId}`, () =>
      page.getByRole("button", { name: "Let's build!" }).waitFor({ timeout: 60_000 }),
    )),
  });
  const t0 = Date.now();
  await page.getByRole("button", { name: "Let's build!" }).click();
  await page.locator(".blocklySvg").first().waitFor({ timeout: 60_000 });
  rows.push({ pass, page: "block editor ready after tap", readyMs: Date.now() - t0 });
}
console.log(JSON.stringify(rows, null, 1));
await browser.close();
