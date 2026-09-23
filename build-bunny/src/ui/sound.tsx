"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { MusicEngine, type TrackId } from "./audio/music";
import {
  AUDIO_STORAGE_KEY,
  DEFAULT_AUDIO_PREFS,
  LEGACY_SOUND_KEY,
  channelLevel,
  isAudible,
  parseAudioPrefs,
  toggleQuickMute,
  type AudioPrefs,
} from "./audio/prefs";
import { SfxPlayer, type SfxName } from "./audio/sfx";
import {
  narrationSupport,
  onVoicesChanged,
  primeSpeech,
  speak,
  stopSpeaking,
} from "./audio/voice";

/**
 * The student area's ONE audio system: sound effects, background music and
 * narration, each with its own switch and volume, plus a master mute.
 *
 * Everything is OFF by default and nothing makes a sound until a child (or
 * teacher) turns it on — then audio starts only from a user gesture, which
 * is also what iPad Safari requires before an AudioContext may run.
 * Preferences persist per device (see audio/prefs.ts for why not per user).
 *
 * Music only plays while a screen asks for it (`useMusicScene`): the map and
 * the level player do; profile/achievements don't, and leaving the student
 * area unmounts this provider and closes the audio context entirely. Music
 * pauses whenever the tab is hidden. Every level change is a gain ramp.
 *
 * No audio files exist: effects and music are synthesized (audio/sfx.ts,
 * audio/music.ts) and narration uses the device's own local voices
 * (audio/voice.ts) — nothing to download, license, or send anywhere.
 */

export type SoundName = SfxName;
export type { AudioPrefs, TrackId };

interface SoundContextValue {
  prefs: AudioPrefs;
  update: (change: (prefs: AudioPrefs) => AudioPrefs) => void;
  /** One-tap mute / unmute (the player's speaker button). */
  quickToggle: () => void;
  /** Sound effects audible right now. */
  enabled: boolean;
  /** Anything audible right now (drives speaker icons). */
  audible: boolean;
  play: (name: SfxName, opts?: { delayMs?: number }) => void;
  /** Read authored text aloud when narration is on; otherwise a no-op. */
  narrate: (text: string) => void;
  stopNarration: () => void;
  /** A local voice exists for the current language on this device. */
  narrationAvailable: boolean;
  /** Registers the track a screen wants; returns an unregister function. */
  requestMusic: (track: TrackId) => () => void;
  /** Which track is currently playing (for the settings panel). */
  nowPlaying: TrackId | null;
}

const noop = () => {};
const SoundContext = createContext<SoundContextValue>({
  prefs: DEFAULT_AUDIO_PREFS,
  update: noop,
  quickToggle: noop,
  enabled: false,
  audible: false,
  play: noop,
  narrate: noop,
  stopNarration: noop,
  narrationAvailable: false,
  requestMusic: () => noop,
  nowPlaying: null,
});

interface Graph {
  ctx: AudioContext;
  master: GainNode;
  sfxGain: GainNode;
  musicGain: GainNode;
  sfx: SfxPlayer;
  music: MusicEngine | null;
}

/** Master headroom: everything is mixed under this so nothing ever blares. */
const MASTER_LEVEL = 0.9;

export function SoundProvider({
  children,
  locale = "en",
}: {
  children: ReactNode;
  locale?: string;
}) {
  const [prefs, setPrefs] = useState<AudioPrefs>(DEFAULT_AUDIO_PREFS);
  const [loaded, setLoaded] = useState(false);
  const [narrationAvailable, setNarrationAvailable] = useState(false);
  const [musicStack, setMusicStack] = useState<{ token: number; track: TrackId }[]>([]);
  const [nowPlaying, setNowPlaying] = useState<TrackId | null>(null);
  const graphRef = useRef<Graph | null>(null);
  const prefsRef = useRef(prefs);
  prefsRef.current = prefs;
  const tokenRef = useRef(0);

  // ── Load / persist ──────────────────────────────────────────────────────
  useEffect(() => {
    let stored: string | null = null;
    let legacy: string | null = null;
    try {
      stored = window.localStorage.getItem(AUDIO_STORAGE_KEY);
      legacy = window.localStorage.getItem(LEGACY_SOUND_KEY);
    } catch {
      // Storage unavailable (private mode) — stay on the silent defaults.
    }
    setPrefs(parseAudioPrefs(stored, legacy));
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    try {
      window.localStorage.setItem(AUDIO_STORAGE_KEY, JSON.stringify(prefs));
    } catch {
      // Won't persist; still applies for this visit.
    }
  }, [prefs, loaded]);

  // ── Narration availability (voices load asynchronously) ────────────────
  useEffect(() => {
    const check = () => setNarrationAvailable(narrationSupport(locale).available);
    check();
    return onVoicesChanged(check);
  }, [locale]);

  // ── Audio graph ─────────────────────────────────────────────────────────
  /** Create (once) and return the graph. Only ever called from a gesture or
   * while sound is already on, so iOS allows the context to start. */
  const ensureGraph = useCallback((): Graph | null => {
    if (typeof window === "undefined") return null;
    if (graphRef.current) return graphRef.current;
    const Ctor: typeof AudioContext | undefined =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    const ctx = new Ctor();
    const master = ctx.createGain();
    master.gain.value = MASTER_LEVEL;
    master.connect(ctx.destination);
    const sfxGain = ctx.createGain();
    sfxGain.gain.value = channelLevel(prefsRef.current, "sfx");
    sfxGain.connect(master);
    const musicGain = ctx.createGain();
    musicGain.gain.value = channelLevel(prefsRef.current, "music");
    musicGain.connect(master);
    graphRef.current = { ctx, master, sfxGain, musicGain, sfx: new SfxPlayer(ctx, sfxGain), music: null };
    return graphRef.current;
  }, []);

  // Close the context when the student area is left (sign-out, staff view).
  useEffect(
    () => () => {
      stopSpeaking();
      const graph = graphRef.current;
      graphRef.current = null;
      void graph?.ctx.close().catch(() => {});
    },
    [],
  );

  // Smoothly follow channel levels (never a jump — setTargetAtTime ramps).
  useEffect(() => {
    const graph = graphRef.current;
    if (!graph) return;
    const now = graph.ctx.currentTime;
    graph.sfxGain.gain.setTargetAtTime(channelLevel(prefs, "sfx"), now, 0.05);
    graph.musicGain.gain.setTargetAtTime(channelLevel(prefs, "music"), now, 0.25);
    if (channelLevel(prefs, "voice") === 0) stopSpeaking();
  }, [prefs]);

  // The first tap/key of a visit unlocks audio (WebKit autoplay policy) —
  // only while something is actually switched on.
  const audible = isAudible(prefs);
  useEffect(() => {
    if (!audible) return;
    const unlock = () => {
      const graph = ensureGraph();
      if (graph && graph.ctx.state === "suspended" && document.visibilityState === "visible") {
        void graph.ctx.resume().catch(() => {});
      }
      if (prefsRef.current.voice.on) primeSpeech();
    };
    window.addEventListener("pointerdown", unlock, { passive: true });
    window.addEventListener("keydown", unlock);
    window.addEventListener("touchend", unlock, { passive: true });
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
      window.removeEventListener("touchend", unlock);
    };
  }, [audible, ensureGraph]);

  // Hidden tab → suspend everything; visible again → resume if audible.
  useEffect(() => {
    const onVisibility = () => {
      const graph = graphRef.current;
      if (document.visibilityState === "hidden") {
        stopSpeaking();
        void graph?.ctx.suspend().catch(() => {});
      } else if (graph && isAudible(prefsRef.current)) {
        void graph.ctx.resume().catch(() => {});
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  // ── Music scene ─────────────────────────────────────────────────────────
  const wantedTrack = musicStack.length > 0 ? musicStack[musicStack.length - 1]!.track : null;
  const musicOn = channelLevel(prefs, "music") > 0;
  useEffect(() => {
    const target = musicOn ? wantedTrack : null;
    const graph = target ? ensureGraph() : graphRef.current;
    if (!graph) return;
    if (target && !graph.music) graph.music = new MusicEngine(graph.ctx, graph.musicGain);
    graph.music?.play(target);
    setNowPlaying(graph.music?.playing ?? null);
    if (target && graph.ctx.state === "suspended" && document.visibilityState === "visible") {
      void graph.ctx.resume().catch(() => {});
    }
  }, [wantedTrack, musicOn, ensureGraph]);

  const requestMusic = useCallback((track: TrackId) => {
    tokenRef.current += 1;
    const token = tokenRef.current;
    setMusicStack((stack) => [...stack, { token, track }]);
    return () => setMusicStack((stack) => stack.filter((entry) => entry.token !== token));
  }, []);

  // ── Effects / narration ─────────────────────────────────────────────────
  const play = useCallback(
    (name: SfxName, opts?: { delayMs?: number }) => {
      if (channelLevel(prefsRef.current, "sfx") === 0) return;
      const graph = ensureGraph();
      if (!graph) return;
      const go = () => graph.sfx.play(name, (opts?.delayMs ?? 0) / 1000);
      if (graph.ctx.state === "running") go();
      else if (document.visibilityState === "visible") {
        // Suspended (autoplay policy): resume and play late rather than
        // drop it; if the browser refuses, stay silent.
        void graph.ctx.resume().then(() => {
          if (graph.ctx.state === "running") go();
        }).catch(() => {});
      }
    },
    [ensureGraph],
  );

  const narrate = useCallback(
    (text: string) => {
      const level = channelLevel(prefsRef.current, "voice");
      if (level === 0) return;
      speak(text, { locale, volume: Math.sqrt(level), rate: prefsRef.current.voice.rate });
    },
    [locale],
  );

  const update = useCallback(
    (change: (current: AudioPrefs) => AudioPrefs) => {
      const next = change(prefsRef.current);
      prefsRef.current = next;
      setPrefs(next);
      // Settings are changed by a tap — the moment iOS lets audio start.
      if (isAudible(next)) {
        const graph = ensureGraph();
        if (graph && graph.ctx.state === "suspended") void graph.ctx.resume().catch(() => {});
        if (next.voice.on) primeSpeech();
      }
    },
    [ensureGraph],
  );

  const quickToggle = useCallback(() => {
    update(toggleQuickMute);
    // Confirm that sound is now on with a soft click (after the ramp).
    if (!isAudible(prefsRef.current)) return;
    window.setTimeout(() => play("click"), 60);
  }, [update, play]);

  const value = useMemo<SoundContextValue>(
    () => ({
      prefs,
      update,
      quickToggle,
      enabled: channelLevel(prefs, "sfx") > 0,
      audible,
      play,
      narrate,
      stopNarration: stopSpeaking,
      narrationAvailable,
      requestMusic,
      nowPlaying,
    }),
    [prefs, update, quickToggle, audible, play, narrate, narrationAvailable, requestMusic, nowPlaying],
  );

  return <SoundContext.Provider value={value}>{children}</SoundContext.Provider>;
}

export function useSound(): SoundContextValue {
  return useContext(SoundContext);
}

/**
 * Declare the music a screen wants while it is mounted. The most recently
 * mounted request wins (the player over the map behind it); unmounting
 * fades back to the previous request, or to silence.
 */
export function useMusicScene(track: TrackId | null): void {
  const { requestMusic } = useSound();
  useEffect(() => {
    if (!track) return;
    return requestMusic(track);
  }, [track, requestMusic]);
}
