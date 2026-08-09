/**
 * World theme string → decorative emoji. Themes are authored content data, so
 * match by substring and always fall back — an unknown theme must render, just
 * without a bespoke glyph. Purely decorative (always aria-hidden).
 */
const THEME_EMOJI: ReadonlyArray<readonly [string, string]> = [
  ["meadow", "🌿"],
  ["forest", "🌲"],
  ["robot", "🤖"],
  ["desert", "🏜️"],
  ["island", "🏝️"],
  ["ml", "🧠"],
  ["lab", "🧪"],
  ["city", "🏙️"],
  ["workshop", "🛠️"],
  ["space", "🚀"],
  ["sky", "☁️"],
];

export function themeEmoji(theme: string): string {
  const needle = theme.toLowerCase();
  for (const [key, emoji] of THEME_EMOJI) {
    if (needle.includes(key)) return emoji;
  }
  return "✨";
}
