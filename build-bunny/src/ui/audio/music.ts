/**
 * Background music — original, generated in the browser by this file.
 *
 * Each world has a short looping piece: a chord progression, a pad, a bass
 * line, a melody and (for some worlds) bells or a soft shaker. The melody is
 * composed by a seeded random walk over the world's scale, so it is the same
 * every loop (it is a piece of music, not noise) and costs nothing to
 * download. Licence: part of this repository's source; no third-party
 * samples, loops or recordings are used anywhere.
 *
 * Design rules for a classroom:
 *  - quiet by default, gentle timbres (sine/triangle, low-passed), no drums
 *    louder than a whisper, no sudden accents;
 *  - every start, stop and track change is a gain RAMP, never a jump;
 *  - scheduling uses the standard lookahead pattern (a timer queues notes a
 *    little ahead on the audio clock), so a busy main thread cannot make the
 *    rhythm stutter.
 */

export type TrackId =
  | "map"
  | "meadow"
  | "forest"
  | "lab"
  | "island"
  | "desert"
  | "ml"
  | "city"
  | "workshop";

interface Voice {
  type: OscillatorType;
  gain: number;
  octave: number;
  cutoff: number;
}

interface TrackDef {
  bpm: number;
  /** MIDI note of the tonic. */
  root: number;
  /** Scale as semitone offsets from the root (one octave). */
  scale: number[];
  /** Chord per bar, as a scale degree (0 = tonic). 8 bars loop. */
  chords: number[];
  pad: Voice | null;
  bass: (Voice & { pattern: number[] }) | null;
  lead: (Voice & { density: number }) | null;
  bell: (Voice & { density: number }) | null;
  /** Eighth-note positions (0–7) in each bar for a very soft shaker. */
  shaker: number[] | null;
  seed: number;
}

const MAJOR = [0, 2, 4, 5, 7, 9, 11];
const DORIAN = [0, 2, 3, 5, 7, 9, 10];
const MINOR = [0, 2, 3, 5, 7, 8, 10];
const LYDIAN = [0, 2, 4, 6, 7, 9, 11];
// Phrygian dominant — the colour of much Gulf and Levantine music; kept on
// a tonic drone so it reads warm rather than tense.
const HIJAZ = [0, 1, 4, 5, 7, 8, 10];

export const TRACKS: Record<TrackId, TrackDef> = {
  map: {
    bpm: 84, root: 60, scale: MAJOR, chords: [0, 5, 3, 4, 0, 5, 3, 4],
    pad: { type: "sine", gain: 0.035, octave: 0, cutoff: 1400 },
    bass: { type: "sine", gain: 0.05, octave: -2, cutoff: 600, pattern: [0, 4] },
    lead: { type: "sine", gain: 0.03, octave: 1, cutoff: 3000, density: 0.25 },
    bell: { type: "sine", gain: 0.012, octave: 2, cutoff: 6000, density: 0.08 },
    shaker: null, seed: 11,
  },
  meadow: {
    bpm: 100, root: 67, scale: MAJOR, chords: [0, 3, 0, 4, 0, 3, 5, 4],
    pad: { type: "triangle", gain: 0.022, octave: -1, cutoff: 1300 },
    bass: { type: "sine", gain: 0.055, octave: -2, cutoff: 500, pattern: [0, 3, 4] },
    lead: { type: "triangle", gain: 0.03, octave: 0, cutoff: 2800, density: 0.45 },
    bell: null,
    shaker: [2, 6], seed: 23,
  },
  forest: {
    bpm: 88, root: 62, scale: DORIAN, chords: [0, 3, 0, 6, 0, 3, 4, 6],
    pad: { type: "triangle", gain: 0.024, octave: -1, cutoff: 900 },
    bass: { type: "sine", gain: 0.05, octave: -2, cutoff: 500, pattern: [0, 5] },
    lead: { type: "sine", gain: 0.032, octave: 1, cutoff: 2400, density: 0.35 },
    bell: { type: "sine", gain: 0.01, octave: 2, cutoff: 5000, density: 0.06 },
    shaker: null, seed: 37,
  },
  lab: {
    bpm: 108, root: 57, scale: MINOR, chords: [0, 5, 2, 6, 0, 5, 3, 4],
    pad: { type: "sawtooth", gain: 0.016, octave: 0, cutoff: 800 },
    bass: { type: "square", gain: 0.034, octave: -2, cutoff: 400, pattern: [0, 2, 4, 6] },
    lead: { type: "square", gain: 0.02, octave: 1, cutoff: 1600, density: 0.6 },
    bell: null,
    shaker: [1, 3, 5, 7], seed: 41,
  },
  island: {
    bpm: 92, root: 65, scale: LYDIAN, chords: [0, 1, 0, 4, 0, 1, 5, 4],
    pad: { type: "sine", gain: 0.03, octave: -1, cutoff: 1500 },
    bass: { type: "sine", gain: 0.045, octave: -2, cutoff: 500, pattern: [0] },
    lead: { type: "sine", gain: 0.026, octave: 1, cutoff: 3000, density: 0.3 },
    bell: { type: "sine", gain: 0.018, octave: 2, cutoff: 7000, density: 0.18 },
    shaker: null, seed: 53,
  },
  desert: {
    bpm: 90, root: 64, scale: HIJAZ, chords: [0, 0, 1, 0, 0, 6, 1, 0],
    pad: { type: "triangle", gain: 0.02, octave: -1, cutoff: 1000 },
    bass: { type: "sine", gain: 0.055, octave: -2, cutoff: 500, pattern: [0, 3, 5] },
    lead: { type: "triangle", gain: 0.03, octave: 0, cutoff: 2600, density: 0.42 },
    bell: null,
    shaker: [2, 3, 6], seed: 67,
  },
  ml: {
    bpm: 96, root: 60, scale: MINOR, chords: [0, 3, 5, 4, 0, 3, 6, 4],
    pad: { type: "sine", gain: 0.034, octave: -1, cutoff: 1200 },
    bass: { type: "sine", gain: 0.045, octave: -2, cutoff: 500, pattern: [0, 2, 4, 6] },
    lead: { type: "sine", gain: 0.026, octave: 1, cutoff: 2600, density: 0.5 },
    bell: { type: "sine", gain: 0.01, octave: 2, cutoff: 6000, density: 0.08 },
    shaker: null, seed: 71,
  },
  city: {
    bpm: 112, root: 58, scale: MAJOR, chords: [0, 5, 1, 4, 0, 5, 3, 4],
    pad: { type: "triangle", gain: 0.018, octave: 0, cutoff: 1200 },
    bass: { type: "triangle", gain: 0.045, octave: -2, cutoff: 700, pattern: [0, 3, 5, 6] },
    lead: { type: "triangle", gain: 0.028, octave: 1, cutoff: 2600, density: 0.55 },
    bell: null,
    shaker: [1, 3, 5, 7], seed: 83,
  },
  workshop: {
    bpm: 104, root: 62, scale: MAJOR, chords: [0, 4, 5, 3, 0, 4, 3, 4],
    pad: { type: "sine", gain: 0.026, octave: -1, cutoff: 1400 },
    bass: { type: "sine", gain: 0.05, octave: -2, cutoff: 500, pattern: [0, 4, 6] },
    lead: { type: "triangle", gain: 0.03, octave: 1, cutoff: 2800, density: 0.5 },
    bell: { type: "sine", gain: 0.014, octave: 2, cutoff: 6500, density: 0.12 },
    shaker: [2, 6], seed: 97,
  },
};

/** World theme string (authored content) → track. Unknown themes → map. */
export function trackForTheme(theme: string | null | undefined): TrackId {
  const t = (theme ?? "").toLowerCase();
  if (t.includes("meadow")) return "meadow";
  if (t.includes("forest")) return "forest";
  if (t.includes("ml")) return "ml";
  if (t.includes("robot") || t.includes("lab")) return "lab";
  if (t.includes("island")) return "island";
  if (t.includes("desert")) return "desert";
  if (t.includes("city")) return "city";
  if (t.includes("workshop") || t.includes("inventor")) return "workshop";
  return "map";
}

const midiToHz = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

/** Deterministic 0–1 hash of (seed, a, b) — mulberry-style mixing. */
function rand(seed: number, a: number, b: number): number {
  let h = (seed * 374761393 + a * 668265263 + b * 2246822519) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0;
  h = (h ^ (h >>> 16)) >>> 0;
  return h / 4294967296;
}

/** MIDI note for a scale degree (can exceed one octave either way). */
function degreeToMidi(def: TrackDef, degree: number, octave: number): number {
  const n = def.scale.length;
  const oct = Math.floor(degree / n);
  const idx = ((degree % n) + n) % n;
  return def.root + 12 * (octave + oct) + def.scale[idx]!;
}

/**
 * Melody for one 8-bar loop: per bar, eight eighth-note slots, each either a
 * scale degree or a rest. Strong beats favour chord tones; motion is
 * mostly stepwise, occasionally leaping a third. Pure — tested for
 * determinism and range.
 */
export function composeMelody(def: TrackDef, density: number): (number | null)[][] {
  const bars: (number | null)[][] = [];
  let current = 4; // start on the fifth, a friendly opening
  for (let bar = 0; bar < def.chords.length; bar += 1) {
    const chord = def.chords[bar]!;
    const slots: (number | null)[] = [];
    for (let slot = 0; slot < 8; slot += 1) {
      const strong = slot === 0 || slot === 4;
      const chance = strong ? Math.min(1, density + 0.35) : density * (slot % 2 === 0 ? 1 : 0.6);
      if (rand(def.seed, bar, slot) >= chance) {
        slots.push(null);
        continue;
      }
      if (strong) {
        // Land on the nearest chord tone.
        const tones = [chord, chord + 2, chord + 4, chord + 7];
        current = tones.reduce((best, t) =>
          Math.abs(t - current) < Math.abs(best - current) ? t : best,
        );
      } else {
        const r = rand(def.seed + 1, bar, slot);
        const step = r < 0.4 ? 1 : r < 0.8 ? -1 : r < 0.9 ? 2 : -2;
        current += step;
      }
      // Keep the melody inside a comfortable 1.5 octaves.
      if (current > 9) current -= 2;
      if (current < -1) current += 2;
      slots.push(current);
    }
    bars.push(slots);
  }
  return bars;
}

const LOOKAHEAD_S = 0.25;
const TICK_MS = 60;

/** One running instance of a track, with its own fade gain. */
class TrackPlayer {
  private readonly gain: GainNode;
  private readonly melody: (number | null)[][];
  private readonly bells: (number | null)[][];
  private step = 0;
  private nextTime: number;
  private timer: ReturnType<typeof setInterval> | null = null;
  private stopped = false;

  constructor(
    private readonly ctx: BaseAudioContext,
    output: AudioNode,
    private readonly def: TrackDef,
    fadeInS: number,
    /** Offline render: schedule everything up to this time, no timer. */
    renderUntilS?: number,
  ) {
    this.gain = ctx.createGain();
    this.gain.gain.setValueAtTime(0, ctx.currentTime);
    this.gain.gain.linearRampToValueAtTime(1, ctx.currentTime + fadeInS);
    this.gain.connect(output);
    this.melody = def.lead ? composeMelody(def, def.lead.density) : [];
    this.bells = def.bell ? composeMelody({ ...def, seed: def.seed + 7 }, def.bell.density) : [];
    this.nextTime = ctx.currentTime + 0.08;
    if (renderUntilS !== undefined) {
      while (this.nextTime < renderUntilS) {
        this.scheduleSlot(this.step, this.nextTime);
        this.step += 1;
        this.nextTime += this.eighth;
      }
      return;
    }
    this.timer = setInterval(() => this.tick(), TICK_MS);
    this.tick();
  }

  private get eighth(): number {
    return 60 / this.def.bpm / 2;
  }

  private tick() {
    if (this.stopped) return;
    while (this.nextTime < this.ctx.currentTime + LOOKAHEAD_S) {
      this.scheduleSlot(this.step, this.nextTime);
      this.step += 1;
      this.nextTime += this.eighth;
    }
  }

  private scheduleSlot(step: number, time: number) {
    const def = this.def;
    const bar = Math.floor(step / 8) % def.chords.length;
    const slot = step % 8;
    const chord = def.chords[bar]!;
    const beat = this.eighth * 2;

    if (def.pad && slot === 0) {
      for (const offset of [0, 2, 4]) {
        this.note(def.pad, degreeToMidi(def, chord + offset, def.pad.octave), time, beat * 4, 0.35, 0.6, offset * 0.003);
      }
    }
    if (def.bass && def.bass.pattern.includes(slot)) {
      this.note(def.bass, degreeToMidi(def, chord, def.bass.octave), time, beat * 0.9, 0.01, 0.2);
    }
    const lead = def.lead ? this.melody[bar]?.[slot] : null;
    if (def.lead && lead !== null && lead !== undefined) {
      this.note(def.lead, degreeToMidi(def, lead, def.lead.octave), time, this.eighth * 1.6, 0.012, 0.35);
    }
    const bell = def.bell ? this.bells[bar]?.[slot] : null;
    if (def.bell && bell !== null && bell !== undefined && slot % 2 === 0) {
      this.bellNote(def.bell, degreeToMidi(def, bell, def.bell.octave), time);
    }
    if (def.shaker && def.shaker.includes(slot)) this.shake(time);
  }

  private note(v: Voice, midi: number, t: number, dur: number, attack: number, release: number, detune = 0) {
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    osc.type = v.type;
    osc.frequency.setValueAtTime(midiToHz(midi) * (1 + detune), t);
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = v.cutoff;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(v.gain, t + attack);
    g.gain.setTargetAtTime(0, t + dur, release / 4);
    osc.connect(filter);
    filter.connect(g);
    g.connect(this.gain);
    osc.start(t);
    osc.stop(t + dur + release + 0.1);
    osc.onended = () => {
      filter.disconnect();
      g.disconnect();
    };
  }

  /** Simple two-operator FM bell: bright attack, long soft decay. */
  private bellNote(v: Voice, midi: number, t: number) {
    const ctx = this.ctx;
    const f = midiToHz(midi);
    const carrier = ctx.createOscillator();
    carrier.frequency.value = f;
    const mod = ctx.createOscillator();
    mod.frequency.value = f * 3.5;
    const modGain = ctx.createGain();
    modGain.gain.setValueAtTime(f * 1.2, t);
    modGain.gain.exponentialRampToValueAtTime(1, t + 1.2);
    mod.connect(modGain);
    modGain.connect(carrier.frequency);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(v.gain, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 1.6);
    carrier.connect(g);
    g.connect(this.gain);
    carrier.start(t);
    mod.start(t);
    carrier.stop(t + 1.7);
    mod.stop(t + 1.7);
    carrier.onended = () => {
      modGain.disconnect();
      g.disconnect();
    };
  }

  private shake(t: number) {
    const ctx = this.ctx;
    const len = Math.floor(ctx.sampleRate * 0.05);
    const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i += 1) data[i] = (rand(3, i, 1) * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const hp = ctx.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = 6500;
    const g = ctx.createGain();
    g.gain.value = 0.012;
    src.connect(hp);
    hp.connect(g);
    g.connect(this.gain);
    src.start(t);
    src.onended = () => {
      hp.disconnect();
      g.disconnect();
    };
  }

  /** Fade out, then stop scheduling and release the nodes. */
  stop(fadeOutS: number) {
    if (this.stopped) return;
    this.stopped = true;
    const now = this.ctx.currentTime;
    this.gain.gain.cancelScheduledValues(now);
    this.gain.gain.setValueAtTime(this.gain.gain.value, now);
    this.gain.gain.linearRampToValueAtTime(0, now + fadeOutS);
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    setTimeout(() => this.gain.disconnect(), (fadeOutS + 2) * 1000);
  }
}

/** Generated reverb tail — a short decaying noise impulse (no asset). */
function makeImpulse(ctx: BaseAudioContext, seconds: number): AudioBuffer {
  const length = Math.floor(ctx.sampleRate * seconds);
  const buffer = ctx.createBuffer(2, length, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch += 1) {
    const data = buffer.getChannelData(ch);
    for (let i = 0; i < length; i += 1) {
      data[i] = (rand(ch + 5, i, 9) * 2 - 1) * Math.pow(1 - i / length, 2.5);
    }
  }
  return buffer;
}

/**
 * Owns the current track and crossfades between tracks. The provider feeds
 * it the output node (whose gain is the music channel level) and tells it
 * which track the current screen wants.
 */
export class MusicEngine {
  private readonly bus: GainNode;
  private current: { id: TrackId; player: TrackPlayer } | null = null;

  constructor(private readonly ctx: BaseAudioContext, output: AudioNode) {
    this.bus = ctx.createGain();
    const dry = ctx.createGain();
    dry.gain.value = 0.8;
    const wet = ctx.createGain();
    wet.gain.value = 0.28;
    const reverb = ctx.createConvolver();
    reverb.buffer = makeImpulse(ctx, 1.8);
    this.bus.connect(dry);
    this.bus.connect(reverb);
    reverb.connect(wet);
    dry.connect(output);
    wet.connect(output);
  }

  get playing(): TrackId | null {
    return this.current?.id ?? null;
  }

  /** Switch to `id` (or silence with null), crossfading. Idempotent. */
  play(id: TrackId | null) {
    if (this.current?.id === id) return;
    this.current?.player.stop(1.2);
    this.current = id ? { id, player: new TrackPlayer(this.ctx, this.bus, TRACKS[id], 1.8) } : null;
  }

  stop() {
    this.play(null);
  }

  /**
   * Schedule `seconds` of a track in one go on an OfflineAudioContext —
   * used by the loudness check (e2e/audio-levels.spec.ts) to measure what
   * each track actually sounds like, not what we hope it does.
   */
  renderOffline(id: TrackId, seconds: number) {
    new TrackPlayer(this.ctx, this.bus, TRACKS[id], 0.01, seconds);
  }
}
