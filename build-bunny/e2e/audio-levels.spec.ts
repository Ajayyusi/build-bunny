import { buildSync } from "esbuild";
import { expect, test } from "@playwright/test";

/**
 * Objective loudness check for every music track and sound effect.
 *
 * Nobody can "listen" in CI, so this renders each one offline in the
 * browser's own WebAudio engine (OfflineAudioContext — the same synthesis
 * code the game runs) and measures the result: no clipping, music quiet
 * enough for a classroom but not silent, effects short and gentle.
 * Numbers are at FULL channel volume, before the master headroom.
 */

const bundle = buildSync({
  stdin: {
    contents: `
      export { MusicEngine, TRACKS } from "./src/ui/audio/music";
      export { SfxPlayer, SFX } from "./src/ui/audio/sfx";
    `,
    resolveDir: process.cwd(),
    loader: "ts",
  },
  bundle: true,
  format: "iife",
  globalName: "BBAudio",
  write: false,
}).outputFiles[0]!.text;

interface Level {
  peak: number;
  rmsDb: number;
  seconds: number;
}

test("every track and effect renders at classroom-safe levels", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "laptop", "measured once");
  await page.setContent("<html><body></body></html>");
  await page.addScriptTag({ content: bundle });

  const levels = await page.evaluate(async () => {
    interface Bundle {
      TRACKS: Record<string, unknown>;
      SFX: Record<string, unknown>;
      MusicEngine: new (ctx: BaseAudioContext, out: AudioNode) => {
        renderOffline(id: string, seconds: number): void;
      };
      SfxPlayer: new (ctx: BaseAudioContext, out: AudioNode) => {
        play(name: string, when: number, nowMs: number): boolean;
      };
    }
    const A = (window as unknown as { BBAudio: Bundle }).BBAudio;
    const RATE = 22050;
    const measure = (buffer: AudioBuffer, skip: number) => {
      const data = buffer.getChannelData(0);
      let peak = 0;
      let sum = 0;
      let n = 0;
      let last = 0;
      for (let i = Math.floor(skip * RATE); i < data.length; i += 1) {
        const v = Math.abs(data[i]!);
        peak = Math.max(peak, v);
        sum += data[i]! * data[i]!;
        n += 1;
        if (v > 0.0005) last = i;
      }
      return { peak, rmsDb: 20 * Math.log10(Math.sqrt(sum / Math.max(1, n)) || 1e-9), seconds: last / RATE };
    };
    const out: Record<string, Level> = {};
    for (const id of Object.keys(A.TRACKS)) {
      const ctx = new OfflineAudioContext(2, RATE * 10, RATE);
      new A.MusicEngine(ctx, ctx.destination).renderOffline(id, 10);
      out[`music:${id}`] = measure(await ctx.startRendering(), 1);
    }
    for (const name of Object.keys(A.SFX)) {
      const ctx = new OfflineAudioContext(1, RATE * 2, RATE);
      new A.SfxPlayer(ctx, ctx.destination).play(name, 0, 0);
      out[`sfx:${name}`] = measure(await ctx.startRendering(), 0);
    }
    return out;
  });

  const report = Object.entries(levels)
    .map(([k, v]) => `${k.padEnd(18)} peak ${v.peak.toFixed(3)}  rms ${v.rmsDb.toFixed(1)} dB  ${v.seconds.toFixed(2)}s`)
    .join("\n");
  testInfo.attach("levels.txt", { body: report, contentType: "text/plain" });
  console.log(report);

  for (const [key, level] of Object.entries(levels)) {
    expect(level.peak, `${key} clips`).toBeLessThan(0.8);
    if (key.startsWith("music:")) {
      // Audible, but background: well under speech level.
      expect(level.rmsDb, `${key} too quiet`).toBeGreaterThan(-48);
      expect(level.rmsDb, `${key} too loud`).toBeLessThan(-18);
    } else {
      expect(level.peak, `${key} silent`).toBeGreaterThan(0.005);
      expect(level.peak, `${key} too loud`).toBeLessThan(0.25);
      // Effects are short: nothing lingers past a second.
      expect(level.seconds, `${key} too long`).toBeLessThan(1.1);
    }
  }
});
