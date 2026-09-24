"use client";

import { useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";

import { Button, Dialog, cn, useSound } from "@/ui";
import type { AudioPrefs } from "@/ui";

/**
 * Child-facing audio controls, all driving the one SoundProvider:
 *  - AudioSettingsPanel — the three channels, their volumes, master mute;
 *  - AudioSettingsButton — the sidebar entry that opens the panel;
 *  - PlayerSoundControls — the level player's instant mute + settings;
 *  - ReadAloudButton — replays a piece of authored text through narration.
 *
 * Every control is a 44px+ target, every switch is a real role="switch"
 * with aria-checked, and sliders are native range inputs (keyboard, screen
 * reader and RTL for free).
 */

type ChannelKey = "sfx" | "music" | "voice";

function Switch({
  checked,
  onChange,
  label,
  describedBy,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  describedBy?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      aria-describedby={describedBy}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative inline-flex h-11 w-[4.25rem] shrink-0 items-center rounded-full border-2 transition-colors",
        checked ? "border-brand bg-brand" : "border-border-token bg-surface-sunken",
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "absolute top-1/2 size-8 -translate-y-1/2 rounded-full bg-surface-raised shadow-soft transition-[inset-inline-start]",
          checked ? "start-[calc(100%-2.25rem)]" : "start-1",
        )}
      />
      {/* On/off is not colour-only: the knob position and this glyph say it too. */}
      <span
        aria-hidden="true"
        className={cn(
          "absolute top-1/2 -translate-y-1/2 text-xs font-bold",
          checked ? "start-2 text-on-brand" : "end-2 text-ink-muted",
        )}
      >
        {checked ? "✓" : "—"}
      </span>
    </button>
  );
}

function ChannelRow({
  channel,
  icon,
  title,
  hint,
  children,
}: {
  channel: ChannelKey;
  icon: string;
  title: string;
  hint: string;
  children?: ReactNode;
}) {
  const t = useTranslations("student.sound");
  const { prefs, update, play, narrate } = useSound();
  const state = prefs[channel];
  const hintId = `sound-${channel}-hint`;
  const setChannel = (patch: Partial<AudioPrefs[ChannelKey]>) =>
    update((current) => ({
      ...current,
      // Turning a channel on also lifts a master mute — otherwise the
      // switch would move and nothing would happen.
      muted: patch.on ? false : current.muted,
      [channel]: { ...current[channel], ...patch },
    }));

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-border-token bg-surface-raised p-3">
      <div className="flex items-center gap-3">
        <span aria-hidden="true" className="text-2xl">
          {icon}
        </span>
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="font-display text-base font-bold text-ink">{title}</span>
          <span id={hintId} className="text-sm text-ink-muted">
            {hint}
          </span>
        </div>
        <Switch
          checked={state.on}
          onChange={(on) => setChannel({ on })}
          label={title}
          describedBy={hintId}
        />
      </div>
      {state.on ? (
        <div className="flex items-center gap-3">
          <label className="flex min-h-11 flex-1 items-center gap-3">
            <span className="sr-only">{t("volume", { channel: title })}</span>
            <span aria-hidden="true" className="text-sm">
              🔈
            </span>
            <input
              type="range"
              min={0}
              max={100}
              step={5}
              value={Math.round(state.volume * 100)}
              onChange={(event) => setChannel({ volume: Number(event.target.value) / 100 })}
              className="h-11 min-w-0 flex-1 accent-[var(--color-brand)]"
            />
            <span aria-hidden="true" className="text-sm">
              🔊
            </span>
          </label>
          {channel !== "music" ? (
            <Button
              variant="secondary"
              size="lg"
              onClick={() => (channel === "sfx" ? play("collect") : narrate(t("testSpeech")))}
            >
              {t("test")}
            </Button>
          ) : null}
        </div>
      ) : null}
      {children}
    </div>
  );
}

export function AudioSettingsPanel() {
  const t = useTranslations("student.sound");
  const { prefs, update, narrationAvailable } = useSound();
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-ink-muted">{t("intro")}</p>

      <div className="flex items-center gap-3 rounded-xl border-2 border-border-token bg-surface-sunken p-3">
        <span aria-hidden="true" className="text-2xl">
          🔇
        </span>
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="font-display text-base font-bold text-ink">{t("muteAll")}</span>
          <span id="sound-mute-hint" className="text-sm text-ink-muted">
            {t("muteAllHint")}
          </span>
        </div>
        <Switch
          checked={prefs.muted}
          onChange={(muted) => update((current) => ({ ...current, muted }))}
          label={t("muteAll")}
          describedBy="sound-mute-hint"
        />
      </div>

      <ChannelRow channel="sfx" icon="✨" title={t("sfx")} hint={t("sfxHint")} />
      <ChannelRow channel="music" icon="🎵" title={t("music")} hint={t("musicHint")} />
      <ChannelRow channel="voice" icon="🗣️" title={t("voice")} hint={t("voiceHint")}>
        {prefs.voice.on && !narrationAvailable ? (
          <p role="status" className="rounded-lg bg-warning/10 p-3 text-sm text-ink">
            {t("voiceUnavailable")}
          </p>
        ) : null}
        {prefs.voice.on && narrationAvailable ? (
          <label className="flex min-h-11 items-center gap-3 text-sm text-ink">
            <span className="shrink-0 font-semibold">{t("speed")}</span>
            <span aria-hidden="true">🐢</span>
            <input
              type="range"
              min={70}
              max={120}
              step={5}
              value={Math.round(prefs.voice.rate * 100)}
              onChange={(event) =>
                update((current) => ({
                  ...current,
                  voice: { ...current.voice, rate: Number(event.target.value) / 100 },
                }))
              }
              className="h-11 min-w-0 flex-1 accent-[var(--color-brand)]"
            />
            <span aria-hidden="true">🐇</span>
          </label>
        ) : null}
      </ChannelRow>

      <p className="text-xs text-ink-muted">{t("everythingOnScreen")}</p>
    </div>
  );
}

function SpeakerIcon({ on, className }: { on: boolean; className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className={cn("size-5 shrink-0", className)}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M11 5 6 9H3v6h3l5 4V5Z" />
      {on ? (
        <>
          <path d="M15.5 8.5a5 5 0 0 1 0 7" />
          <path d="M18.5 5.5a9 9 0 0 1 0 13" />
        </>
      ) : (
        <path d="m16 9 5 6m0-6-5 6" />
      )}
    </svg>
  );
}

function SlidersIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="size-5 shrink-0"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    >
      <path d="M4 7h10M18 7h2M4 17h4M12 17h8" />
      <circle cx="16" cy="7" r="2" />
      <circle cx="10" cy="17" r="2" />
    </svg>
  );
}

function SettingsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useTranslations("student.sound");
  if (!open) return null;
  return (
    <Dialog
      open
      onClose={onClose}
      title={t("title")}
      closeLabel={t("close")}
      footer={
        <Button size="lg" onClick={onClose}>
          {t("done")}
        </Button>
      }
    >
      <AudioSettingsPanel />
    </Dialog>
  );
}

/** Sidebar entry: shows the current state, opens the full panel. */
export function AudioSettingsButton({ className }: { className?: string }) {
  const t = useTranslations("student.sound");
  const { audible } = useSound();
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        // It opens settings: say so, with the current state after it.
        aria-label={`${t("settingsButton")}: ${audible ? t("on") : t("off")}`}
        className={cn(
          "inline-flex h-11 items-center gap-2 rounded-lg px-3 text-sm font-semibold text-ink-muted transition-colors hover:bg-surface-sunken hover:text-ink",
          className,
        )}
      >
        <SpeakerIcon on={audible} />
        {audible ? t("on") : t("off")}
      </button>
      <SettingsDialog open={open} onClose={() => setOpen(false)} />
    </>
  );
}

/**
 * The level player's controls: an instant mute (one tap — a teacher asking
 * for quiet should never wait on a menu) and a settings button beside it.
 */
export function PlayerSoundControls() {
  const t = useTranslations("student.sound");
  const { audible, quickToggle } = useSound();
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={quickToggle}
        // The label names the action ("Mute sound" / "Turn sound on");
        // aria-pressed on top of a changing label read as a contradiction.
        aria-label={audible ? t("mute") : t("unmute")}
        title={audible ? t("mute") : t("unmute")}
        className={cn(
          "grid size-11 shrink-0 place-items-center rounded-lg border transition-colors",
          audible
            ? "border-brand/50 bg-brand/10 text-brand-strong hover:bg-brand/15"
            : "border-border-token text-ink-muted hover:bg-surface-sunken hover:text-ink",
        )}
      >
        <SpeakerIcon on={audible} />
      </button>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-label={t("settings")}
        title={t("settings")}
        className="hidden size-11 shrink-0 place-items-center rounded-lg text-ink-muted transition-colors hover:bg-surface-sunken hover:text-ink sm:grid"
      >
        <SlidersIcon />
      </button>
      <SettingsDialog open={open} onClose={() => setOpen(false)} />
    </>
  );
}

/**
 * Speaker button that reads `text` aloud. Rendered only when narration is on
 * and this device has a voice for the language — otherwise it would be a
 * button that does nothing.
 */
export function ReadAloudButton({ text, className }: { text: string; className?: string }) {
  const t = useTranslations("student.sound");
  const { prefs, narrate, narrationAvailable } = useSound();
  if (!prefs.voice.on || prefs.muted || !narrationAvailable || !text.trim()) return null;
  return (
    <button
      type="button"
      onClick={() => narrate(text)}
      aria-label={t("readAloud")}
      title={t("readAloud")}
      className={cn(
        "inline-grid size-11 shrink-0 place-items-center rounded-full border border-border-token bg-surface-raised text-ink transition-colors hover:bg-surface-sunken",
        className,
      )}
    >
      <SpeakerIcon on />
    </button>
  );
}
