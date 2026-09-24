/**
 * Sound effects — every one synthesized with WebAudio at call time. No audio
 * files: nothing to download on classroom Wi-Fi, nothing to license, nothing
 * the CSP has to allow. Each effect is a few tones or a filtered noise burst
 * with a soft attack and an exponential release, so nothing clicks or
 * startles.
 *
 * Loudness discipline: peaks stay at or below 0.08 BEFORE the channel and
 * master gains, which the provider applies on top. These are feedback, not
 * fanfare.
 */

export type SfxName =
  | "click"
  | "place"
  | "remove"
  | "run"
  | "hop"
  | "turn"
  | "collect"
  | "bump"
  | "splash"
  | "oops"
  | "success"
  | "star"
  | "unlock"
  | "achievement"
  | "hint"
  | "whoosh";

interface ToneStep {
  kind: "tone";
  freq: number;
  /** Glide to this frequency over the note (pitch bend). */
  to?: number;
  at: number;
  dur: number;
  gain: number;
  type?: OscillatorType;
}

interface NoiseStep {
  kind: "noise";
  at: number;
  dur: number;
  gain: number;
  filter: BiquadFilterType;
  freq: number;
  to?: number;
  q?: number;
}

type Step = ToneStep | NoiseStep;

const tone = (
  freq: number,
  at: number,
  dur: number,
  gain: number,
  type: OscillatorType = "sine",
  to?: number,
): ToneStep => ({ kind: "tone", freq, at, dur, gain, type, to });

// Notes (Hz) — C major pentatonic-friendly, so effects that overlap the
// music never clash with it.
const C5 = 523.25, D5 = 587.33, E5 = 659.25, G5 = 783.99, A5 = 880,
  C6 = 1046.5, E6 = 1318.5, G6 = 1568;

export const SFX: Record<SfxName, Step[]> = {
  /** UI tap confirmation. */
  click: [tone(660, 0, 0.05, 0.035, "triangle")],
  /** A block snaps into place — a small wooden "tock". */
  place: [tone(420, 0, 0.07, 0.06, "triangle", 300), tone(840, 0, 0.03, 0.02, "sine")],
  /** A block is dropped in the bin. */
  remove: [tone(360, 0, 0.12, 0.04, "triangle", 180)],
  /** Run pressed — "boop-bip", ready go. */
  run: [tone(G5, 0, 0.08, 0.045, "triangle"), tone(C6, 0.08, 0.12, 0.05, "triangle")],
  /** One hop of movement: very quiet, it repeats every step. */
  hop: [tone(520, 0, 0.06, 0.025, "sine", 700)],
  /** A turn on the spot: a softer, lower swish. */
  turn: [
    { kind: "noise", at: 0, dur: 0.08, gain: 0.05, filter: "bandpass", freq: 1800, to: 900, q: 1.2 },
  ],
  /** Picked something up — a bright sparkle. */
  collect: [tone(E6, 0, 0.08, 0.04, "sine"), tone(G6, 0.06, 0.14, 0.04, "sine")],
  /** Bumped a rock — a round, gentle "bonk", never harsh. */
  bump: [tone(190, 0, 0.16, 0.07, "triangle", 120)],
  /** Fell in water — a short filtered splash. */
  splash: [
    { kind: "noise", at: 0, dur: 0.28, gain: 0.05, filter: "lowpass", freq: 2400, to: 500, q: 0.7 },
    tone(300, 0, 0.12, 0.025, "sine", 160),
  ],
  /** A run that didn't make it — two soft descending notes, "hmm, not yet". */
  oops: [tone(E5, 0, 0.14, 0.04, "triangle"), tone(C5, 0.13, 0.22, 0.04, "triangle")],
  /** Level complete. */
  success: [
    tone(C5, 0, 0.16, 0.05, "triangle"),
    tone(E5, 0.11, 0.16, 0.05, "triangle"),
    tone(G5, 0.22, 0.26, 0.06, "triangle"),
    tone(C6, 0.34, 0.4, 0.045, "sine"),
  ],
  /** One star popping in (the success card plays one per star). */
  star: [tone(E6, 0, 0.18, 0.045, "sine"), tone(G6, 0.02, 0.12, 0.015, "sine")],
  /** Next level / world opened. */
  unlock: [
    tone(G5, 0, 0.1, 0.04, "sine"),
    tone(C6, 0.09, 0.1, 0.04, "sine"),
    tone(E6, 0.18, 0.28, 0.045, "sine"),
  ],
  /** New badge. */
  achievement: [tone(987.77, 0, 0.12, 0.05, "sine"), tone(E6, 0.1, 0.3, 0.05, "sine"), tone(A5, 0.1, 0.3, 0.02, "triangle")],
  /** A hint revealed — a curious "bloop" upward. */
  hint: [tone(D5, 0, 0.09, 0.04, "sine", E5), tone(A5, 0.09, 0.16, 0.035, "sine")],
  /** Scene transition (mission intro). */
  whoosh: [
    { kind: "noise", at: 0, dur: 0.45, gain: 0.08, filter: "bandpass", freq: 400, to: 2600, q: 0.9 },
  ],
};

/**
 * Minimum gap between two plays of the same effect. Movement effects fire
 * once per simulated step; a 60ms floor stops a fast playback turning into
 * a buzz, and repeated taps from double-firing.
 */
const MIN_GAP_MS: Partial<Record<SfxName, number>> = {
  hop: 70,
  turn: 70,
  place: 90,
  click: 50,
  star: 150,
};
const DEFAULT_GAP_MS = 120;
/** No more than this many effects sounding at once — no pile-ups. */
const MAX_CONCURRENT = 6;

let noiseBuffer: AudioBuffer | null = null;
function noise(ctx: BaseAudioContext): AudioBuffer {
  if (noiseBuffer && noiseBuffer.sampleRate === ctx.sampleRate) return noiseBuffer;
  const length = Math.floor(ctx.sampleRate * 0.5);
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  // Deterministic LCG — the same "noise" every time, and no Math.random in
  // a module that is otherwise pure.
  let seed = 12345;
  for (let i = 0; i < length; i += 1) {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    data[i] = (seed / 0x7fffffff) * 2 - 1;
  }
  noiseBuffer = buffer;
  return buffer;
}

/** Schedules effects onto a context, enforcing the gap and voice limits. */
export class SfxPlayer {
  private lastPlayed = new Map<SfxName, number>();
  private active = 0;

  constructor(
    private readonly ctx: BaseAudioContext,
    private readonly output: AudioNode,
  ) {}

  /** Returns false when the effect was skipped by a limit. */
  play(name: SfxName, when = 0, nowMs = Date.now()): boolean {
    const gap = MIN_GAP_MS[name] ?? DEFAULT_GAP_MS;
    const last = this.lastPlayed.get(name);
    if (when === 0 && last !== undefined && nowMs - last < gap) return false;
    if (this.active >= MAX_CONCURRENT) return false;
    this.lastPlayed.set(name, nowMs);

    const start = this.ctx.currentTime + Math.max(0, when);
    let end = start;
    for (const step of SFX[name]) {
      end = Math.max(end, this.schedule(step, start));
    }
    this.active += 1;
    // A zero-gain source whose end event releases the voice slot.
    const marker = this.ctx.createConstantSource();
    marker.offset.value = 0;
    marker.connect(this.output);
    marker.onended = () => {
      this.active = Math.max(0, this.active - 1);
      marker.disconnect();
    };
    marker.start(start);
    marker.stop(end + 0.02);
    return true;
  }

  private schedule(step: Step, base: number): number {
    const t0 = base + step.at;
    const t1 = t0 + step.dur;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0, t0);
    gain.gain.linearRampToValueAtTime(step.gain, t0 + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, t1);
    gain.connect(this.output);

    if (step.kind === "tone") {
      const osc = this.ctx.createOscillator();
      osc.type = step.type ?? "sine";
      osc.frequency.setValueAtTime(step.freq, t0);
      if (step.to) osc.frequency.exponentialRampToValueAtTime(step.to, t1);
      osc.connect(gain);
      osc.start(t0);
      osc.stop(t1 + 0.03);
      osc.onended = () => gain.disconnect();
    } else {
      const src = this.ctx.createBufferSource();
      src.buffer = noise(this.ctx);
      const filter = this.ctx.createBiquadFilter();
      filter.type = step.filter;
      filter.Q.value = step.q ?? 1;
      filter.frequency.setValueAtTime(step.freq, t0);
      if (step.to) filter.frequency.exponentialRampToValueAtTime(step.to, t1);
      src.connect(filter);
      filter.connect(gain);
      src.start(t0);
      src.stop(t1 + 0.03);
      src.onended = () => {
        filter.disconnect();
        gain.disconnect();
      };
    }
    return t1;
  }
}
