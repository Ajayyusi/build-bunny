import { describe, expect, it } from "vitest";

import { bundle } from "../../content";
import { TRACKS, composeMelody, trackForTheme, type TrackId } from "@/ui/audio/music";
import {
  DEFAULT_AUDIO_PREFS,
  channelLevel,
  isAudible,
  parseAudioPrefs,
  toggleQuickMute,
} from "@/ui/audio/prefs";
import { SfxPlayer } from "@/ui/audio/sfx";
import { CHARACTER_PITCH, characterRate, pickVoice } from "@/ui/audio/voice";

describe("audio preferences", () => {
  it("is completely silent by default", () => {
    expect(isAudible(DEFAULT_AUDIO_PREFS)).toBe(false);
    for (const channel of ["sfx", "music", "voice"] as const) {
      expect(channelLevel(DEFAULT_AUDIO_PREFS, channel)).toBe(0);
    }
  });

  it("migrates the old single toggle to sound effects only", () => {
    const migrated = parseAudioPrefs(null, "on");
    expect(migrated.sfx.on).toBe(true);
    expect(migrated.music.on).toBe(false);
    expect(migrated.voice.on).toBe(false);
    expect(parseAudioPrefs(null, "off")).toEqual(DEFAULT_AUDIO_PREFS);
  });

  it("never turns sound on from corrupt or hostile storage", () => {
    expect(parseAudioPrefs("{not json", "on").music.on).toBe(false);
    const weird = parseAudioPrefs(
      JSON.stringify({ sfx: { on: "yes", volume: 99 }, music: null, voice: { rate: 9 } }),
      null,
    );
    expect(weird.sfx.on).toBe(false);
    expect(weird.sfx.volume).toBe(1);
    expect(weird.music).toEqual(DEFAULT_AUDIO_PREFS.music);
    expect(weird.voice.rate).toBe(1.2);
  });

  it("round-trips what it stores", () => {
    const prefs = {
      ...DEFAULT_AUDIO_PREFS,
      muted: true,
      music: { on: true, volume: 0.3 },
      voice: { on: true, volume: 0.8, rate: 0.85 },
    };
    expect(parseAudioPrefs(JSON.stringify(prefs), null)).toEqual(prefs);
  });

  it("master mute silences every channel without forgetting them", () => {
    const on = { ...DEFAULT_AUDIO_PREFS, sfx: { on: true, volume: 1 }, music: { on: true, volume: 1 } };
    const muted = { ...on, muted: true };
    expect(channelLevel(muted, "sfx")).toBe(0);
    expect(channelLevel(muted, "music")).toBe(0);
    expect(muted.sfx.on && muted.music.on).toBe(true);
  });

  it("uses a perceptual volume curve (half slider is a quarter level)", () => {
    const half = { ...DEFAULT_AUDIO_PREFS, sfx: { on: true, volume: 0.5 } };
    expect(channelLevel(half, "sfx")).toBeCloseTo(0.25);
  });

  it("quick mute: mutes when audible, restores, and a first tap enables effects but never music", () => {
    const first = toggleQuickMute(DEFAULT_AUDIO_PREFS);
    expect(first.sfx.on).toBe(true);
    expect(first.music.on).toBe(false);
    expect(isAudible(first)).toBe(true);
    const muted = toggleQuickMute(first);
    expect(muted.muted).toBe(true);
    expect(isAudible(muted)).toBe(false);
    const back = toggleQuickMute(muted);
    expect(back.muted).toBe(false);
    expect(back.sfx.on).toBe(true);
  });
});

describe("music", () => {
  it("gives every world in the curriculum its own track", () => {
    const tracks = new Set<TrackId>();
    for (const world of bundle.worlds) {
      const track = trackForTheme(world.theme);
      expect(track, `${world.slug} (${world.theme})`).not.toBe("map");
      tracks.add(track);
    }
    expect(tracks.size).toBe(bundle.worlds.length);
    expect(trackForTheme("something-new")).toBe("map");
  });

  it("composes the same melody every loop, inside a singable range", () => {
    for (const [id, def] of Object.entries(TRACKS)) {
      expect(def.chords, id).toHaveLength(8);
      if (!def.lead) continue;
      const a = composeMelody(def, def.lead.density);
      const b = composeMelody(def, def.lead.density);
      expect(a, id).toEqual(b);
      const notes = a.flat().filter((n): n is number => n !== null);
      expect(notes.length, `${id} has a melody`).toBeGreaterThan(8);
      expect(Math.min(...notes), id).toBeGreaterThanOrEqual(-1);
      expect(Math.max(...notes), id).toBeLessThanOrEqual(11);
    }
  });

  it("keeps a classroom-quiet mix (no voice louder than the design ceiling)", () => {
    for (const [id, def] of Object.entries(TRACKS)) {
      for (const voice of [def.pad, def.bass, def.lead, def.bell]) {
        if (voice) expect(voice.gain, id).toBeLessThanOrEqual(0.06);
      }
    }
  });
});

describe("narration voice choice", () => {
  const v = (lang: string, localService: boolean, name = lang, isDefault = false) => ({
    lang,
    localService,
    name,
    default: isDefault,
  });

  it("never picks a network voice, even when it is the only match", () => {
    expect(pickVoice([v("en-US", false, "Google US English")], "en")).toBeNull();
    expect(pickVoice([v("ar-SA", false)], "ar")).toBeNull();
  });

  it("prefers a Gulf Arabic voice, then any local Arabic voice", () => {
    const voices = [v("ar-EG", true), v("ar-AE", true), v("en-US", true)];
    expect(pickVoice(voices, "ar")?.lang).toBe("ar-AE");
    expect(pickVoice([v("ar_EG", true), v("en-GB", true)], "ar")?.lang).toBe("ar_EG");
  });

  it("within the preferred variant, picks a voice that suits a cartoon character", () => {
    const voices = [v("en-GB", true, "Daniel"), v("en-GB", true, "Karen"), v("en-US", true, "Samantha")];
    expect(pickVoice(voices, "en")?.name).toBe("Karen");
    // Region still comes first: a character voice in another variant doesn't win.
    expect(pickVoice([v("ar-AE", true, "Naayf"), v("ar-EG", true, "Hoda")], "ar")?.name).toBe("Naayf");
    expect(pickVoice([v("ar-SA", true, "Maged"), v("ar-SA", true, "Laila")], "ar")?.name).toBe("Laila");
  });

  it("talks like a cartoon: high pitch, a little quicker, still clear", () => {
    expect(CHARACTER_PITCH).toBeGreaterThanOrEqual(1.5);
    expect(CHARACTER_PITCH).toBeLessThanOrEqual(2);
    expect(characterRate(1)).toBeGreaterThan(1);
    expect(characterRate(1.2)).toBeLessThanOrEqual(1.3);
    expect(characterRate(0.7)).toBeGreaterThanOrEqual(0.7);
  });

  it("returns null when the device has no voice for the language", () => {
    expect(pickVoice([v("en-US", true)], "ar")).toBeNull();
  });
});

describe("sound effect limits", () => {
  /** Minimal stand-in for the WebAudio nodes SfxPlayer touches. */
  function fakeContext() {
    const param = () => ({
      value: 0,
      setValueAtTime() {},
      linearRampToValueAtTime() {},
      exponentialRampToValueAtTime() {},
    });
    const node = () => ({
      connect() {},
      disconnect() {},
      start() {},
      stop() {},
      onended: null as null | (() => void),
      gain: param(),
      frequency: param(),
      Q: param(),
      offset: param(),
      type: "",
      buffer: null,
    });
    const ended: (() => void)[] = [];
    const ctx = {
      currentTime: 0,
      sampleRate: 8000,
      createGain: node,
      createOscillator: node,
      createBufferSource: node,
      createBiquadFilter: node,
      createConstantSource: () => {
        const n = node();
        queueMicrotask(() => ended.push(() => n.onended?.()));
        return n;
      },
      createBuffer: (_c: number, length: number) => ({
        sampleRate: 8000,
        getChannelData: () => new Float32Array(length),
      }),
    };
    return { ctx: ctx as unknown as BaseAudioContext, ended };
  }

  it("drops a repeat of the same effect inside its minimum gap", () => {
    const { ctx } = fakeContext();
    const player = new SfxPlayer(ctx, {} as AudioNode);
    expect(player.play("hop", 0, 1000)).toBe(true);
    expect(player.play("hop", 0, 1030)).toBe(false);
    expect(player.play("hop", 0, 1100)).toBe(true);
  });

  it("never lets more than six effects sound at once", () => {
    const { ctx } = fakeContext();
    const player = new SfxPlayer(ctx, {} as AudioNode);
    const names = ["run", "collect", "bump", "splash", "oops", "success", "unlock", "hint"] as const;
    const played = names.map((name, i) => player.play(name, 0, 5000 + i * 1000));
    expect(played.filter(Boolean)).toHaveLength(6);
  });
});
