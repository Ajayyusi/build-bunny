# Build Bunny 2027 — Implementation Checklist & Progress Checkpoint

This file is the single tracked checklist for the 2027 brief (fix the game,
audio, gameplay/story, curriculum, Robo Bunny help, classroom/parent,
accessibility/language/safety/performance). It is updated at every
checkpoint. **Status is only "implemented and tested" when there is code on a
branch AND evidence it works** — plans, mocks and placeholders are marked as
such.

Status legend: **✅ implemented & tested** · **🟡 partial** · **⛔ blocked** ·
**⬜ not started**

## Where the work lives

| Branch (stacked, in order) | Scope | State |
|---|---|---|
| `fix/first-run-core-bugs` | §1 core bugs + first five minutes | ready for review |
| `feat/audio` | §2 sound, music, narration | ready for review |
| `feat/tablet-player-a11y` | §3 Blockly on touch, §7 accessibility | ready for review |
| `feat/story-worlds` | §3 story, 8 worlds, cutscenes, finales | not started |
| `feat/robo-help` | §5 help tools, adaptive hints | not started |
| `feat/curriculum-expansion` | §4 activities, age bands, levels toward 100 | not started |
| `feat/classroom-parent` | §6 classroom + parent | not started |
| `feat/offline-perf-polish` | §7 offline, performance, privacy review | not started |

Nothing is merged or deployed. Each branch is based on the previous one, so
they should be reviewed and merged in the order above.

## Test environment used

- Windows 11, Node 24.19 (engines `>=22.12`), embedded PostgreSQL 16
  (`npm run db:dev`), seeded demo school, curriculum imported + published
  locally (`npm run content:deploy`).
- A brand-new child account for every first-run test:
  `npx tsx scripts/dev-new-student.ts newkid` (dev-only, refuses production).
- Browser checks: Playwright (Chromium) at 1024×768 and 785×500 (landscape),
  768×1024 (portrait), with touch enabled; English and Arabic.
- **Live site limitation:** `build-bunny.vercel.app/play/…` requires a school
  student account that was not provided, so all testing ran against the
  local demo environment built from this repository. Nothing here verifies
  the deployed Vercel build.
- **Not tested on physical hardware:** no real iPad/Safari was available.
  WebKit behaviour (audio unlock, touch drag) is implemented to spec but
  must be confirmed on a device before a pilot.

---

## §1 Fix the current game first

| Item | Status | Evidence / files |
|---|---|---|
| Play-through audit as a new child (desktop + tablet, en + ar) | ✅ | Findings below; replayed after fixes |
| BUG: new child following a direct level link bounced to the map (unlock race) | ✅ | `play/[levelId]/page.tsx` — sequential unlock; verified with fresh account, direct URL lands in level |
| BUG: success card shows "+ XP" with no number, React error in console | ✅ | `SuccessOverlay.tsx`, `messages/*.json` (`<count>` tag); verified "+40 XP", 0 console errors |
| BUG: portrait/RTL — Blockly scrollbar covers the failure banner; "Try again" untappable | ✅ | `BlocklyWorkspace.tsx` (`isolate`); verified tap at 768×1024 ar |
| BUG: short/landscape windows push Run below the fold | ✅ | `globals.css` `split` variant; Grid + Learn players; verified 785×500 |
| BUG: locked worlds on home look identical to open ones | ✅ | `WorldCard.tsx` (animation overrode opacity) |
| BUG: locked world says "finish previous world" above open levels | ✅ | `WorldSegment.tsx` |
| Confusing: empty / unsnapped program reports "Bunny finished away from the burrow" | ✅ | `programShape()` in `serialization.ts`, coach tone in `ResultBanner.tsx`; no attempt spent |
| Confusing: "Your mission" shows teacher jargon | ✅ | New `Level.mission` (migration `20260923120000_level_mission`), 38 missions en+ar, content test |
| Confusing: story shown twice (map sheet + briefing), two taps before play | ✅ | `LevelIntroSheet.tsx`, `IntroOverlay.tsx` (one screen) |
| Mission not visible after the briefing closes | ✅ | `MissionStrip.tsx` in 6 players (Teach/Group show goal inline already) |
| Onboarding ends on a dashboard with no obvious next action | ✅ | `Onboarding.tsx` v2: 3 steps → "Start my first mission" |
| Home CTA goes to map instead of the next level | ✅ | `home/page.tsx` |
| Streak pressure on home ("keep your streak going", 🔥 tile) | ✅ | Replaced with "levels done" |
| Playable tutorial / intro to Robo Bunny / early success / obvious next action | 🟡 | Onboarding + level 1 flow done; interactive in-level tutorial pointer planned in `feat/tablet-player-a11y` |
| Automated end-to-end test of the first-run flow | ✅ | `e2e/first-run.spec.ts` — 3 flows × 3 viewports, en + ar; CI `e2e` job |

## §2 Sound and music

| Item | Status | Evidence / files |
|---|---|---|
| Separate SFX / Music / Voice toggles, volumes, per-device persistence | ✅ | `src/ui/audio/prefs.ts`, `src/modules/audio/AudioControls.tsx`; unit tests (defaults silent, migration, clamping); e2e checks `localStorage` |
| Prominent mute in the level player | ✅ | `PlayerSoundControls` in all 8 players; e2e toggles it and proves music stops |
| Off by default, starts only after a gesture, iPad Safari unlock | 🟡 | Policy implemented + pinned by `e2e/audio.spec.ts` (no context before a tap). **iPad Safari not verified on hardware** |
| Pause on hidden tab, stop on leaving game area, no overlap, smooth ramps | ✅ | `sound.tsx` (visibilitychange suspend/resume, scene stack), `SfxPlayer` gap + 6-voice cap, ramps everywhere; e2e covers hidden/visible and map→profile |
| SFX: block place, run, move, collect, success, star, unlock, achievement, hint, mistake | ✅ | 16 synthesized effects wired: Blockly snap/remove, Run, hop/turn/collect/bump/splash per engine event, coach + hint chime, oops, success + per-star sparkle, unlock, badge, whoosh |
| Voice / narration toggle with spoken briefings, hints, feedback | ✅ | `src/ui/audio/voice.ts` (local voices only), `useNarrateOnShow`, read-aloud buttons; unit tests for voice choice. Unavailable-voice state shown in settings |
| Music: map + per-world loops with crossfades | ✅ | `src/ui/audio/music.ts` — 9 original generated tracks, 1.2 s/1.8 s crossfades; offline loudness test `e2e/audio-levels.spec.ts` |
| Licence/source documented for every asset | ✅ | `build-bunny/docs/audio.md` — everything synthesized in-repo, no third-party assets, no placeholders |

## §3 Gameplay, story, progression, touch

| Item | Status | Evidence / files |
|---|---|---|
| Connected story across 8 worlds, characters, finales | ⬜ | |
| Short skippable cutscenes | ⬜ | |
| Code City + Inventor Island playable | ⬜ | currently horizon art only |
| Better failure feedback / explanations / celebrations / next flow | 🟡 | first-run fixes above |
| Blockly on touch: larger targets, undo/redo, duplicate/delete, reset confirm | ✅ | `BlocklyWorkspace.tsx` (1.15× start scale on coarse pointers, `undo/redo/deleteSelected`), build toolbar in `GridPlayer.tsx`, reset confirmation dialog; duplicate/delete also via Blockly's long-press menu. e2e `tablet-tools.spec.ts` |
| Autosave + exact resume after interruption | ✅ | Per-child device mirror on every change (`shared/local-draft.ts`), keep-alive flush on pagehide/hidden (`api/levels/[levelId]/draft`), "Continue building" briefing. e2e reloads inside the 2 s debounce and the block is still there and runs |
| Accessible alternative to drag-only input | ✅ | Tap-to-add palette (`shared/BlockPalette.tsx`) snaps blocks after the selection / inside an empty loop / at the end, with the placement announced; e2e solves a level with zero drags |
| Run button + feedback usable in tablet landscape and portrait | ✅ | `split` layout + min-width board column; action row wraps at large text; verified 1024×768, 768×1024, 785×500 and XL text |

## §4 Curriculum and activities

| Item | Status | Evidence / files |
|---|---|---|
| Debugging, prediction, sequencing, loops, conditionals | 🟡 | engines exist; content thin |
| Variables, functions | ⬜ | no engine blocks yet |
| Data sorting/visualisation, AI classification, training/testing, bias/ethics | 🟡 | engines exist for most; bias not built |
| Cyber-safety decisions | 🟡 | 1 AI_ETHICS level ("Secret Keepers") |
| Creative coding, build-your-own maze, final projects | ⬜ | |
| Age bands 7–8 / 9–10 / 11–13 | ⬜ | |
| Adaptive hints/recommendations from observable signals | ⬜ | |
| ~100 tested bilingual levels (currently 38) | ⬜ | |

## §5 Robo Bunny help

| Item | Status | Evidence / files |
|---|---|---|
| "Explain this block" / "Why did that fail?" / "Smaller hint" / "Similar example" | ⬜ | |
| Optional spoken instructions and hints | ⬜ | |
| AI tutor (school-controlled, off by default, non-AI fallback) | ⬜ | will not send child text to any external model by default |

## §6 Classroom and parent

| Item | Status | Evidence / files |
|---|---|---|
| Projector mode improvements, live challenges, pacing | ⬜ | |
| Lesson objectives, curriculum mapping, teacher guides, printables | ⬜ | |
| Assignment templates, group missions, reflections | ⬜ | |
| Misconception reports | ⬜ | |
| Read-only parent view + weekly summary | ⬜ | |

## §7 Accessibility, language, safety, performance

| Item | Status | Evidence / files |
|---|---|---|
| Keyboard, screen reader, focus, non-colour feedback | 🟡 | Every block reachable by keyboard/tap through the palette + toolbar (44 px, labelled); switches are `role="switch"`, results are `role="alert"`/`status`, dialogs trap focus; on/off never colour-only. **Not done:** a full screen-reader pass of every player (NVDA/VoiceOver) |
| Reduced motion, high contrast, text size | ✅ | `src/ui/display/*`, `DisplayControls.tsx`; CSS in `globals.css` (also honours OS `prefers-contrast`/`prefers-reduced-motion`); boot script prevents flash; `useReducedMotion` follows the manual switch. Unit tests + e2e (apply, persist across reload) |
| Arabic content + RTL verified in the game | 🟡 | first-run flow verified in ar; native review flags pending |
| Weak Wi-Fi / offline queue / reconnect / no duplicate submissions | ⬜ | idempotent attempts already exist |
| Telemetry data-minimisation review | ⬜ | |

---

## Checkpoint log

### Checkpoint 3 — 2026-09-23 (tablet player + accessibility)

- **Live:** nothing new.
- **On branches:** `feat/tablet-player-a11y` (stacked on `feat/audio`).
- **Tested:** typecheck, lint, unit (display prefs + boot script), full suite, e2e `tablet-tools.spec.ts` (tap-to-add solve, undo/redo, guarded reset, exact resume on 3 viewports, display settings) + first-run regression.
- **Not tested:** real finger input on an iPad (Playwright emulates touch geometry, not a finger); screen-reader pass.
- **Next step:** `feat/story-worlds`.

### Checkpoint 2 — 2026-09-23 (audio)

- **Live:** nothing new.
- **On branches:** `feat/audio` (stacked on `fix/first-run-core-bugs`).
- **Tested:** unit (15 new audio tests), full suite, e2e incl. WebAudio policy test and offline loudness measurement of every track/effect.
- **Not tested:** real iPad Safari; the actual sound has been measured, not listened to.
- **Next step:** `feat/tablet-player-a11y`.

### Checkpoint 1 — 2026-09-23

- **Live:** nothing new (no deploys).
- **On branches:** `fix/first-run-core-bugs` — commit `fa474bc` (first-run fixes, mission field).
- **Tested:** lint, typecheck, 648 unit/integration tests green; first-run flow replayed in Chromium at three viewports, en + ar.
- **Next step:** e2e spec for the first-run flow, then `feat/audio`.
