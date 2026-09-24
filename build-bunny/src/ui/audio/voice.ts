/**
 * Narration through the browser's built-in speech synthesis.
 *
 * Privacy rule: ONLY voices with `localService === true` are used. Some
 * browsers also offer network voices (Chrome's "Google …" voices send the
 * text to a server to be spoken). What would be sent is our own level copy,
 * never a child's words — but a school product should not make network
 * calls a school has not been told about, so network voices are simply
 * never picked. If a device has no local voice for the page's language,
 * narration reports itself unavailable and the UI says so.
 *
 * The text spoken is always authored content (story, mission, hints,
 * feedback) — nothing a child typed.
 */

export interface NarrationSupport {
  supported: boolean;
  /** A local voice exists for this language. */
  available: boolean;
}

function synth(): SpeechSynthesis | null {
  return typeof window !== "undefined" && "speechSynthesis" in window
    ? window.speechSynthesis
    : null;
}

/**
 * Robo Bunny is a cartoon character, not a newsreader. Lighter, brighter
 * voices sound right when pitched up; deep ones turn into a chipmunk-robot.
 * These are the built-in (on-device) voices known to take a high pitch well,
 * by the name each platform gives them: iPad/Mac, Windows, Android/ChromeOS.
 */
const CHARACTER_VOICES: Record<"en" | "ar", string[]> = {
  en: ["samantha", "karen", "tessa", "moira", "fiona", "victoria", "zira", "hazel", "susan", "libby", "sonia", "aria", "jenny", "ana"],
  ar: ["laila", "hoda", "mariam", "salma", "amira", "zariyah", "fatima"],
};

/**
 * How the character talks: well above a normal speaking pitch (the Web
 * Speech range is 0–2, 1 = normal) and a touch quicker and bouncier than
 * the child's chosen talking speed. Rate stays inside what stays clear for
 * a young listener.
 */
export const CHARACTER_PITCH = 1.75;
export const CHARACTER_RATE_FACTOR = 1.08;

export function characterRate(childRate: number): number {
  return Math.min(1.3, Math.max(0.7, childRate * CHARACTER_RATE_FACTOR));
}

/** Best local voice for `locale` ("en" / "ar"), or null. Pure over the list. */
export function pickVoice(
  voices: readonly Pick<SpeechSynthesisVoice, "lang" | "localService" | "default" | "name">[],
  locale: string,
): (typeof voices)[number] | null {
  const want = locale.toLowerCase().startsWith("ar") ? "ar" : "en";
  const local = voices.filter(
    (v) => v.localService && v.lang.toLowerCase().replace("_", "-").startsWith(want),
  );
  if (local.length === 0) return null;
  // Prefer the Gulf / UAE and US/UK variants a child here will expect;
  // within the chosen variant, a voice that suits a cartoon character; then
  // the platform default, then anything in the language.
  const character = (v: (typeof voices)[number]) =>
    CHARACTER_VOICES[want].some((name) => v.name.toLowerCase().includes(name));
  const preferred = want === "ar" ? ["ar-ae", "ar-sa", "ar-"] : ["en-gb", "en-us", "en-"];
  for (const prefix of preferred) {
    const inVariant = local.filter((v) => v.lang.toLowerCase().replace("_", "-").startsWith(prefix));
    if (inVariant.length > 0) return inVariant.find(character) ?? inVariant[0]!;
  }
  return local.find((v) => v.default) ?? local[0]!;
}

export function narrationSupport(locale: string): NarrationSupport {
  const s = synth();
  if (!s) return { supported: false, available: false };
  return { supported: true, available: pickVoice(s.getVoices(), locale) !== null };
}

/** Voices load asynchronously in Chrome; call back when the list changes. */
export function onVoicesChanged(callback: () => void): () => void {
  const s = synth();
  if (!s) return () => {};
  s.addEventListener?.("voiceschanged", callback);
  return () => s.removeEventListener?.("voiceschanged", callback);
}

/**
 * Speak `text`, cancelling anything already being said (a new briefing or
 * hint replaces the old one — narration never queues up behind itself).
 */
export function speak(
  text: string,
  opts: { locale: string; volume: number; rate: number; onEnd?: () => void },
): boolean {
  const s = synth();
  const clean = text.replace(/\s+/g, " ").trim();
  if (!s || !clean || opts.volume <= 0) return false;
  const voice = pickVoice(s.getVoices(), opts.locale) as SpeechSynthesisVoice | null;
  if (!voice) return false;
  s.cancel();
  const utterance = new SpeechSynthesisUtterance(clean);
  utterance.voice = voice;
  utterance.lang = voice.lang;
  utterance.volume = Math.min(1, Math.max(0, opts.volume));
  utterance.rate = characterRate(opts.rate);
  // A cartoon voice: high and bright (see CHARACTER_PITCH).
  utterance.pitch = CHARACTER_PITCH;
  if (opts.onEnd) {
    utterance.onend = opts.onEnd;
    utterance.onerror = opts.onEnd;
  }
  s.speak(utterance);
  return true;
}

export function stopSpeaking(): void {
  synth()?.cancel();
}

/**
 * iOS Safari only lets speech start inside a user gesture the first time.
 * Speaking an empty utterance from the unlock gesture primes it.
 */
export function primeSpeech(): void {
  const s = synth();
  if (!s) return;
  try {
    const u = new SpeechSynthesisUtterance("");
    u.volume = 0;
    s.speak(u);
  } catch {
    // Not fatal — narration will simply wait for the next tap.
  }
}
