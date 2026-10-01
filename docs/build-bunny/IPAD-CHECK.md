# Real iPad check: what to look at

What this checklist is for: a person with a real iPad (Safari, iPadOS 17 or later) can confirm in about 20 minutes what emulation can't. Everything below was emulated first, on 2026-10-01: Playwright's WebKit (Safari's engine) on an emulated iPad Pro 11, against a production build.

## What emulation already shows

- **Every level:** all 106 finish by following "Show me the next step" in WebKit on iPad landscape. That covers the 35 AI-route levels and every Blockly coding, debugging and maze-design level.
- **iPad portrait (WebKit):** no horizontal scrolling on Explore AI (English and Arabic), the AI worlds, or the six Explore AI activities.
- **Fortune Teller:** dragging the line's ends follows the pointer exactly.
  - In landscape, the lower end can sit under the bottom bar.
  - A child scrolls the activity to reach it. The handle has `touch-action: none`, so dragging doesn't scroll the page.

## Check on the real iPad

1. **Arabic marks (most important).** In emulated WebKit, the app's Arabic font gets vowel marks wrong:
   - a kasra (ـِ) can show as a fatha above the letter;
   - kasra-tanween (ـٍ) can disappear;
   - words carrying them are drawn lower than the rest of their line.
   Text without marks is perfect.
   - Example: the first word of the Explore AI card "درّب آلة فرز": "أرِ روبوتًا بعض الأمثلة…".
   - In emulated WebKit it happens only with the app's Arabic webfont (IBM Plex Sans Arabic). The same text in Tahoma, Arial or Segoe UI is fine, and Chromium draws the webfont correctly. It may be the emulator's text stack or a real Safari problem with that font, which is why this check comes first.
   - The shipped font files are sound:
     - every IBM Plex Sans Arabic weight and Baloo Bhaijaan 2 contain the kasra and kasra-tanween glyphs and the mark-positioning features (`mark`, `mkmk`);
     - a standard shaper (fontkit) places the kasra below the letter.
   - So this is very likely the Windows WebKit build, not Safari. Still, check it once on a real iPad.
   - If it shows there, the fix is in the font setup (`src/ui/fonts.ts`), not the copy.
   - To check: open `/ar/explore` and read that card. If the word sits low or is cut off on a real iPad, report it with a photo.
2. **Dragging with a finger:**
   - the Fortune Teller line ends;
   - the You Be the Sorter line;
   - Blockly blocks in First Hop;
   - the flags on Two Piles in the Sand.
3. **Read aloud:**
   - With Settings → Sound → Voice on, the 🔊 button beside the mission line reads it.
   - Check that it reads in Arabic on an Arabic page, which needs an Arabic system voice.
4. **Sign-in stays signed in** over https on the deployed site, including after the iPad sleeps.
5. **Keyboard (with a keyboard attached):** Space plays and pauses an explainer, and the arrow keys move between its parts.
6. **Rotation:** turning the iPad mid-level keeps the child's work.
