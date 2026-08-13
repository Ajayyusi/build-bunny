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

import { cn } from "./cn";

/**
 * Opt-in sound effects. Everything is synthesized with WebAudio at call
 * time — no audio assets, nothing fetched, CSP-clean. OFF by default; the
 * preference persists per device in localStorage (no server column — a
 * shared classroom tablet's volume choice shouldn't follow a child home).
 * Volumes are deliberately quiet: feedback, not fanfare, and never scary
 * in a silent classroom.
 */

export type SoundName = "click" | "star" | "success" | "achievement";

interface SoundContextValue {
  enabled: boolean;
  toggle: () => void;
  play: (name: SoundName) => void;
}

const SoundContext = createContext<SoundContextValue>({
  enabled: false,
  toggle: () => {},
  play: () => {},
});

const STORAGE_KEY = "bb:sound";

/** One quiet note. Times are relative seconds from `at`. */
interface Note {
  freq: number;
  at: number;
  duration: number;
  /** Peak gain — keep ≤ 0.08. */
  gain?: number;
  type?: OscillatorType;
}

const SOUNDS: Record<SoundName, Note[]> = {
  click: [{ freq: 660, at: 0, duration: 0.05, gain: 0.04, type: "triangle" }],
  star: [{ freq: 1318.5, at: 0, duration: 0.18, gain: 0.05, type: "sine" }],
  success: [
    { freq: 523.25, at: 0, duration: 0.16, gain: 0.05, type: "triangle" },
    { freq: 659.25, at: 0.11, duration: 0.16, gain: 0.05, type: "triangle" },
    { freq: 783.99, at: 0.22, duration: 0.26, gain: 0.06, type: "triangle" },
  ],
  achievement: [
    { freq: 987.77, at: 0, duration: 0.12, gain: 0.05, type: "sine" },
    { freq: 1318.5, at: 0.1, duration: 0.24, gain: 0.05, type: "sine" },
  ],
};

export function SoundProvider({ children }: { children: ReactNode }) {
  const [enabled, setEnabled] = useState(false);
  const contextRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    try {
      setEnabled(window.localStorage.getItem(STORAGE_KEY) === "on");
    } catch {
      // Storage unavailable (privacy mode) — stay off.
    }
  }, []);

  const ensureContext = useCallback((): AudioContext | null => {
    if (typeof window === "undefined") return null;
    if (contextRef.current === null) {
      const Ctor: typeof AudioContext | undefined =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;
      if (Ctor === undefined) return null;
      contextRef.current = new Ctor();
    }
    return contextRef.current;
  }, []);

  // WebKit only starts an AudioContext from a user gesture, and the chime's
  // call site is a mount effect — so while sound is on, the student's first
  // tap of each session quietly unlocks audio for everything after it.
  useEffect(() => {
    if (!enabled) return;
    const unlock = () => {
      const audio = ensureContext();
      if (audio !== null && audio.state === "suspended") void audio.resume();
    };
    window.addEventListener("pointerdown", unlock, { passive: true });
    window.addEventListener("keydown", unlock);
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, [enabled, ensureContext]);

  const play = useCallback(
    (name: SoundName) => {
      if (!enabled) return;
      const audio = ensureContext();
      if (audio === null) return;
      const schedule = () => {
        const now = audio.currentTime;
        for (const note of SOUNDS[name]) {
          const osc = audio.createOscillator();
          const gain = audio.createGain();
          osc.type = note.type ?? "sine";
          osc.frequency.value = note.freq;
          const start = now + note.at;
          const peak = note.gain ?? 0.05;
          gain.gain.setValueAtTime(0, start);
          gain.gain.linearRampToValueAtTime(peak, start + 0.012);
          gain.gain.exponentialRampToValueAtTime(0.0001, start + note.duration);
          osc.connect(gain);
          gain.connect(audio.destination);
          osc.start(start);
          osc.stop(start + note.duration + 0.05);
        }
      };
      if (audio.state === "running") {
        schedule();
      } else {
        // Suspended (autoplay policy): try to resume and play late rather
        // than drop the note; if the browser refuses, skip silently.
        void audio
          .resume()
          .then(() => {
            if (audio.state === "running") schedule();
          })
          .catch(() => {});
      }
    },
    [enabled, ensureContext],
  );

  // Side effects live OUT here, not in the setEnabled updater — updaters
  // must stay pure (StrictMode double-invokes them).
  const toggle = useCallback(() => {
    const next = !enabled;
    setEnabled(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next ? "on" : "off");
    } catch {
      // Preference simply won't persist.
    }
    if (next) {
      // The toggle click is a user gesture — the one moment the browser is
      // guaranteed to let an AudioContext start. Confirm with a soft click
      // so the child knows sound now works.
      const audio = ensureContext();
      if (audio !== null) {
        if (audio.state === "running") {
          playConfirmation(audio);
        } else {
          void audio
            .resume()
            .then(() => playConfirmation(audio))
            .catch(() => {});
        }
      }
    }
  }, [enabled, ensureContext]);

  const value = useMemo(
    () => ({ enabled, toggle, play }),
    [enabled, toggle, play],
  );

  return <SoundContext.Provider value={value}>{children}</SoundContext.Provider>;
}

function playConfirmation(audio: AudioContext) {
  const now = audio.currentTime;
  const osc = audio.createOscillator();
  const gain = audio.createGain();
  osc.type = "triangle";
  osc.frequency.value = 660;
  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(0.04, now + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.06);
  osc.connect(gain);
  gain.connect(audio.destination);
  osc.start(now);
  osc.stop(now + 0.1);
}

export function useSound(): SoundContextValue {
  return useContext(SoundContext);
}

export interface SoundToggleProps {
  /** Localized labels — the toggle itself is locale-agnostic. */
  labelOn: string;
  labelOff: string;
  className?: string;
}

/** Speaker toggle for the student shell. aria-pressed reflects the state. */
export function SoundToggle({ labelOn, labelOff, className }: SoundToggleProps) {
  const { enabled, toggle } = useSound();
  const label = enabled ? labelOn : labelOff;
  return (
    <button
      type="button"
      aria-pressed={enabled}
      onClick={toggle}
      className={cn(
        "inline-flex h-11 items-center gap-2 rounded-lg px-3 text-sm font-semibold text-ink-muted transition-colors hover:bg-surface-sunken hover:text-ink",
        className,
      )}
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        className="size-5 shrink-0"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M11 5 6 9H3v6h3l5 4V5Z" />
        {enabled ? (
          <>
            <path d="M15.5 8.5a5 5 0 0 1 0 7" />
            <path d="M18.5 5.5a9 9 0 0 1 0 13" />
          </>
        ) : (
          <path d="m16 9 5 6m0-6-5 6" />
        )}
      </svg>
      {label}
    </button>
  );
}
