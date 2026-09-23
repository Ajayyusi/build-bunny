/**
 * Audio preferences — pure data, no browser APIs, so the rules below are
 * unit-tested directly.
 *
 * Three independent channels (sound effects, music, voice), each with an
 * on/off switch and a volume, plus a master mute that silences everything
 * at once without losing the channel settings (the classroom "instant
 * quiet" button). Everything starts OFF: a room of thirty tablets must be
 * silent until a child — or their teacher — chooses otherwise.
 *
 * Stored per device in localStorage, never on the server: a shared
 * classroom tablet's volume is a property of that tablet, and a child's
 * choice at school should not follow them home.
 */

export type AudioChannel = "sfx" | "music" | "voice";

export interface ChannelPrefs {
  on: boolean;
  /** 0–1, linear slider position (mapped to gain on a perceptual curve). */
  volume: number;
}

export interface AudioPrefs {
  version: 2;
  /** Master mute: overrides every channel, keeps their settings. */
  muted: boolean;
  sfx: ChannelPrefs;
  music: ChannelPrefs;
  voice: ChannelPrefs & {
    /** Speech rate, 0.7–1.2 (1 = the voice's normal pace). */
    rate: number;
  };
}

export const AUDIO_STORAGE_KEY = "bb:audio:v2";
/** The phase-2 single toggle ("on"/"off"), migrated on first read. */
export const LEGACY_SOUND_KEY = "bb:sound";

export const DEFAULT_AUDIO_PREFS: AudioPrefs = {
  version: 2,
  muted: false,
  sfx: { on: false, volume: 0.85 },
  music: { on: false, volume: 0.55 },
  voice: { on: false, volume: 1, rate: 0.95 },
};

function clamp(value: unknown, min: number, max: number, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.min(max, Math.max(min, value))
    : fallback;
}

function channel(raw: unknown, fallback: ChannelPrefs): ChannelPrefs {
  const source = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  return {
    on: typeof source.on === "boolean" ? source.on : fallback.on,
    volume: clamp(source.volume, 0, 1, fallback.volume),
  };
}

/**
 * Stored JSON → preferences. Anything malformed falls back field by field to
 * the (silent) defaults — a corrupt entry must never switch sound ON. When
 * only the legacy key exists, its "on" becomes sound effects on (that toggle
 * only ever controlled effects).
 */
export function parseAudioPrefs(stored: string | null, legacy: string | null): AudioPrefs {
  let raw: Record<string, unknown> | null = null;
  if (stored) {
    try {
      const parsed: unknown = JSON.parse(stored);
      if (parsed && typeof parsed === "object") raw = parsed as Record<string, unknown>;
    } catch {
      raw = null;
    }
  }
  if (!raw) {
    return legacy === "on"
      ? { ...DEFAULT_AUDIO_PREFS, sfx: { ...DEFAULT_AUDIO_PREFS.sfx, on: true } }
      : DEFAULT_AUDIO_PREFS;
  }
  const voice = channel(raw.voice, DEFAULT_AUDIO_PREFS.voice);
  const voiceRaw = (raw.voice && typeof raw.voice === "object" ? raw.voice : {}) as Record<
    string,
    unknown
  >;
  return {
    version: 2,
    muted: typeof raw.muted === "boolean" ? raw.muted : DEFAULT_AUDIO_PREFS.muted,
    sfx: channel(raw.sfx, DEFAULT_AUDIO_PREFS.sfx),
    music: channel(raw.music, DEFAULT_AUDIO_PREFS.music),
    voice: { ...voice, rate: clamp(voiceRaw.rate, 0.7, 1.2, DEFAULT_AUDIO_PREFS.voice.rate) },
  };
}

/** Is anything actually audible right now? (Drives the mute button's icon.) */
export function isAudible(prefs: AudioPrefs): boolean {
  return !prefs.muted && (prefs.sfx.on || prefs.music.on || prefs.voice.on);
}

/**
 * Effective 0–1 level for a channel: 0 when muted or off. Slider position is
 * squared so the bottom of the slider is genuinely quiet — loudness is
 * roughly logarithmic, and a linear slider puts all the change at the top.
 */
export function channelLevel(prefs: AudioPrefs, which: AudioChannel): number {
  if (prefs.muted) return 0;
  const c = prefs[which];
  return c.on ? c.volume * c.volume : 0;
}

/**
 * The player's one-tap sound button. If something is audible, it mutes. If
 * the child has never turned anything on, "unmute" would do nothing — so it
 * switches sound EFFECTS on (never music: music is a deliberate choice, made
 * in the settings panel, so a tap can't surprise a quiet classroom).
 */
export function toggleQuickMute(prefs: AudioPrefs): AudioPrefs {
  if (isAudible(prefs)) return { ...prefs, muted: true };
  const anyOn = prefs.sfx.on || prefs.music.on || prefs.voice.on;
  return anyOn
    ? { ...prefs, muted: false }
    : { ...prefs, muted: false, sfx: { ...prefs.sfx, on: true } };
}
