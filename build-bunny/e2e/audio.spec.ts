import { expect, test, type Page } from "@playwright/test";

import { openMap, provisionStudent, signIn, studentName } from "./helpers";

/**
 * Audio behaviour, verified by instrumenting WebAudio in the page: the
 * browser tells us when a context exists, whether it is running, and how
 * many oscillators (notes) have been scheduled. Audible output itself can't
 * be asserted headlessly — what's pinned here is the policy: silent by
 * default, gesture-started, and stopped on mute / hidden tab / leaving.
 */


async function instrument(page: Page) {
  await page.addInitScript(() => {
    const w = window as unknown as {
      __audio: { contexts: AudioContext[]; oscillators: number; lastRequest: string | null };
      AudioContext: typeof AudioContext;
    };
    w.__audio = { contexts: [], oscillators: 0, lastRequest: null };
    const Original = window.AudioContext;
    class Counted extends Original {
      constructor(options?: AudioContextOptions) {
        super(options);
        w.__audio.contexts.push(this);
      }
      override createOscillator() {
        w.__audio.oscillators += 1;
        return super.createOscillator();
      }
      // What the app ASKED for. The context's own state follows the
      // browser's audio device, which on a headless CI runner can lag
      // behind by seconds; the policy under test is the request.
      override suspend() {
        w.__audio.lastRequest = "suspend";
        return super.suspend();
      }
      override resume() {
        w.__audio.lastRequest = "resume";
        return super.resume();
      }
    }
    w.AudioContext = Counted;
  });
}

const audio = (page: Page) =>
  page.evaluate(() => {
    const a = (
      window as unknown as {
        __audio: { contexts: AudioContext[]; oscillators: number; lastRequest: string | null };
      }
    ).__audio;
    return {
      contexts: a.contexts.length,
      state: a.contexts[0]?.state ?? null,
      oscillators: a.oscillators,
      lastRequest: a.lastRequest,
    };
  });

test("silent by default, starts on a tap, music stops on mute / hidden tab / leaving", async ({
  page,
  baseURL,
}, testInfo) => {
  test.skip(testInfo.project.name !== "laptop", "audio policy is viewport-independent");
  const kid = provisionStudent(studentName("laptop", "snd"));
  await signIn(page, baseURL!, kid.username);
  await instrument(page);

  // Nothing is created, let alone played, on arrival — even after clicks.
  await openMap(page);
  await page.getByRole("heading", { name: "My path" }).click();
  expect(await audio(page)).toMatchObject({ contexts: 0, oscillators: 0 });

  // Turn effects + music on from the sidebar.
  await page.getByRole("button", { name: "Sound settings: Sound off" }).click();
  const panel = page.getByRole("dialog", { name: "Sound" });
  await panel.getByRole("switch", { name: "Sound effects" }).click();
  await panel.getByRole("switch", { name: "Music" }).click();
  await expect(panel.getByRole("switch", { name: "Music" })).toHaveAttribute("aria-checked", "true");
  await panel.getByRole("button", { name: "Done" }).first().click();
  await expect(page.getByRole("button", { name: "Sound settings: Sound on" })).toBeVisible();

  // Music is scheduling notes on a running context.
  await expect.poll(async () => (await audio(page)).state).toBe("running");
  const before = (await audio(page)).oscillators;
  await page.waitForTimeout(2500);
  expect((await audio(page)).oscillators).toBeGreaterThan(before);

  // Preference is saved on this device.
  const stored = await page.evaluate(() => localStorage.getItem("bb:audio:v2"));
  expect(JSON.parse(stored!)).toMatchObject({ sfx: { on: true }, music: { on: true } });

  // In a level: the instant mute stops the music scheduling.
  await page.goto(`/en/play/${kid.firstLevelId}`);
  await page.getByRole("dialog", { name: "First Hop" }).getByRole("button", { name: "Let's build!" }).click();
  const mute = page.getByRole("button", { name: "Mute sound" });
  await expect(mute).toBeVisible();
  await expect.poll(async () => (await audio(page)).state).toBe("running");
  await mute.click();
  await expect(page.getByRole("button", { name: "Turn sound on" })).toBeVisible();
  await page.waitForTimeout(1500); // let the fade finish
  const afterMute = (await audio(page)).oscillators;
  await page.waitForTimeout(2000);
  expect((await audio(page)).oscillators).toBe(afterMute);

  // Unmute, then hide the tab: the context suspends; show it again: resumes.
  await page.getByRole("button", { name: "Turn sound on" }).click();
  await expect.poll(async () => (await audio(page)).state).toBe("running");
  const setVisibility = (state: "hidden" | "visible") =>
    page.evaluate((value) => {
      Object.defineProperty(document, "visibilityState", { value, configurable: true });
      document.dispatchEvent(new Event("visibilitychange"));
    }, state);
  await setVisibility("hidden");
  await expect.poll(async () => (await audio(page)).lastRequest).toBe("suspend");
  await setVisibility("visible");
  await expect.poll(async () => (await audio(page)).lastRequest).toBe("resume");

  // Leave the game area (map → profile, client-side): the music fades out
  // and stops scheduling notes.
  await page.getByRole("link", { name: "Back to map" }).click();
  await expect(page.getByRole("heading", { name: "My path" })).toBeVisible();
  await page.getByRole("link", { name: "My profile" }).click();
  await expect(page).toHaveURL(/\/profile/);
  await page.waitForTimeout(1800);
  const leaving = (await audio(page)).oscillators;
  await page.waitForTimeout(2000);
  expect((await audio(page)).oscillators).toBe(leaving);
});
