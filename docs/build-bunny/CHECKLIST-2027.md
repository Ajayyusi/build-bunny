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
| `feat/story-worlds` | §3 story, 8 worlds, cutscenes, finales | ready for review |
| `feat/robo-help` | §5 help tools, adaptive hints | ready for review |
| `feat/curriculum-expansion` | §4 variables/functions, build-your-own maze, age bands, 71 levels | ready for review |
| `feat/classroom-parent` | §6 misconception report, curriculum guide, projector challenge, family view | ready for review |
| `feat/offline-perf-polish` | §7 offline outbox, accessibility scan, privacy review | ready for review |
| `feat/more-levels` | §4 29 more levels → 100 | ready for review |

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
| Connected story across 8 worlds, characters, finales | ✅ | `docs/build-bunny/STORY.md` (the eight Powers for the Inventor's Fair); every world authored with story beats, friend and Power in en + ar (`World.story/character/power`, migration `20260923150000_world_story`); content test enforces it; map shows friend + Power; the finale run awards the Power on the success card |
| Short skippable cutscenes | ✅ | `WorldIntro.tsx` — 3 lines, skippable at every line, shown once per child per device, replayable from the card's Story button; narrated when voice is on. e2e `story.spec.ts` |
| Code City + Inventor Island playable | 🟡 | Code City: 8 levels (3 code-reading, 1 grid, 3 debugging incl. a 3-bug finale, 1 sequencing). Inventor Island: "The Workbench" — 4 open-ended levels with many right answers. All 12 pass the real solvability gates in en + ar. **Not yet:** the maze builder and creative projects that make the island the Fair (`feat/curriculum-expansion`) |
| Better failure feedback / explanations / celebrations / next flow | 🟡 | first-run fixes; Power card on world completion; world-complete + next-level flow unchanged |
| Streak pressure in rewards | ✅ | "Seven-Day Streak" (7 consecutive school days) is now "Seven Days of Coding" — 7 different days, never consecutive (`ACTIVE_DAYS` criterion) |
| Blockly on touch: larger targets, undo/redo, duplicate/delete, reset confirm | ✅ | `BlocklyWorkspace.tsx` (1.15× start scale on coarse pointers, `undo/redo/deleteSelected`), build toolbar in `GridPlayer.tsx`, reset confirmation dialog; duplicate/delete also via Blockly's long-press menu. e2e `tablet-tools.spec.ts` |
| Autosave + exact resume after interruption | ✅ | Per-child device mirror on every change (`shared/local-draft.ts`), keep-alive flush on pagehide/hidden (`api/levels/[levelId]/draft`), "Continue building" briefing. e2e reloads inside the 2 s debounce and the block is still there and runs |
| Accessible alternative to drag-only input | ✅ | Tap-to-add palette (`shared/BlockPalette.tsx`) snaps blocks after the selection / inside an empty loop / at the end, with the placement announced; e2e solves a level with zero drags |
| Run button + feedback usable in tablet landscape and portrait | ✅ | `split` layout + min-width board column; action row wraps at large text; verified 1024×768, 768×1024, 785×500 and XL text |

## §4 Curriculum and activities

| Item | Status | Evidence / files |
|---|---|---|
| Debugging, prediction, sequencing, loops, conditionals | ✅ | every type has a Learn step + puzzles; new practice modules in Bunny Meadow (3), Logic Forest (2), Robot Lab (2); "Off by One" debugging (`content/worlds/code-city-counters.ts`) |
| Variables, functions | ✅ | new blocks `bb_setCounter` / `bb_changeCounter` / `bb_sayCounter` / `bb_defineTrick` / `bb_doTrick` (`src/modules/blockly/{blocks,codegen}.ts`), interpreter reads variables back, `variableEquals` check implemented (`src/engine/checks.ts`); Code City "Counters and Tricks" (7 levels: 2 Learn steps, 4 puzzles, 1 debugging); unit `blockly-variables.test.ts`, e2e `counters.spec.ts` |
| Data sorting/visualisation, AI classification, training/testing, bias/ethics | ✅ | bias lesson "Bias Detective" (typical-only teaching proven to fail: `tests/unit/expansion-content.test.ts`), "Three Waterholes" clustering; existing engines unchanged |
| Cyber-safety decisions | ✅ | AI Island "Safety and Fairness": "Stranger in the Chat", "Is That Real?" (AI-made fakes, chatbot confidence, sharing, AI homework help) + "Secret Keepers" |
| Creative coding, build-your-own maze, final projects | ✅ | CREATIVE_PROJECT engine end to end: designer (tap/keyboard, live checklist, same rule server-side), grader, publish gates on the author sample, teacher replay on the child's map; Inventor Island "The Fair" (3 mazes, last one needs a trick); unit `maze.test.ts`, integration `maze.test.ts`, e2e `maze.spec.ts` (laptop + tablet portrait) |
| Age bands 7–8 / 9–10 / 11–13 | ✅ | band chip from `recommendedGradeMin` on the map sheet and briefing (`src/modules/learning/age-band.ts`); support by the child's grade: Robo Bunny's example opens after 2 failed runs for grade ≤ 3, a stretch idea after a clean pass for grade ≥ 6, warm-up offered sooner for grade ≤ 3 — never shown as a label |
| Adaptive hints/recommendations from observable signals | ✅ | warm-up recommendation (§5) + support level above; signals are failed runs, hint tier, grade — no labels |
| ~100 tested bilingual levels | ✅ | **100** real levels (`feat/more-levels` added 29: 9 practice levels across the first three worlds, AI Island Online Life — kindness online, passwords, adverts/in-app purchases, Seed Sorter; Data Desert More Readings — close clusters, four camps, an outlier to strike out, an off-centre boundary; ML Lab Deciding Well — who should decide, three examples only; Code City City Workshop — countdown, double count, two code-reading levels, a function bug, zigzag trick, ordering code lines; three more build-your-own mazes incl. a 7–8 starter). Every level passes the publish gates and the playthrough integration test plays all 100 in order with full stars; every AI classification level is proven losable. Arabic authored for all, flagged for native review |

## §5 Robo Bunny help

| Item | Status | Evidence / files |
|---|---|---|
| "Explain this block" / "Why did that fail?" / "Smaller hint" / "Similar example" | 🟡 | `players/shared/RoboHelp.tsx` ("Ask Robo Bunny" in the block-coding player; "Why did that fail?" also on the failure banner): block explanations for all 11 blocks (en/ar), failure explained by step + block from the run's own highlights, tier-1 hint with a path to the ladder, a concept example played by the real engine (`concept-examples.ts`, gate-tested). e2e `help.spec.ts`. **Not yet:** the same panel in the non-grid players (they keep the hint drawer) |
| Adaptive help from observable signals | ✅ | `learning/server/recommend.ts` — failed runs + hint tier on the current level → a completed same-concept level offered as a warm-up on home (never replaces the level; no labels/ranks). Integration test + tenant-isolation case. In-level: the failure banner offers "Why did that fail?" every time and "Try a hint" after two fails |
| Optional spoken instructions and hints | ✅ | Narration (feat/audio) reads briefings, hints, feedback and every help answer; read-aloud buttons throughout |
| AI tutor (school-controlled, off by default, non-AI fallback) | ⬜ | Not built. Everything above is deterministic and local; no child text goes to any external model. If a school-controlled LLM tutor is added later it must stay opt-in with this panel as the fallback |

## §6 Classroom and parent

| Item | Status | Evidence / files |
|---|---|---|
| Projector mode improvements, live challenges, pacing | ✅ | projector: pick a class challenge level, the board shows "N of M finished" (a count, never a ranking), "Hide names" switch for shared screens; one shared builder for page + poll (`src/modules/analytics/live.ts`, unit `live-snapshot.test.ts`). Pacing: per-world and per-module minutes and "about N lessons of 40 min" in the guide |
| Lesson objectives, curriculum mapping, teacher guides, printables | 🟡 | new **Curriculum** page for teachers/admins (`/teach/curriculum`): every published level in play order with objective, child-facing mission, concepts, age band, minutes and teacher notes; printable. Published snapshots only; integration `classroom.test.ts`, isolation case. **Not done:** mapping to a named external standard (needs the school's chosen framework), separate worksheets |
| Assignment templates, group missions, reflections | ⬜ | existing assignments (world/module/level, due dates) unchanged; templates, group missions and student reflections not built |
| Misconception reports | ✅ | class page card "Common mistakes to reteach": last 30 days of located feedback grouped into 16 teaching ideas, each with runs, number of children, the levels it shows on and a reteach suggestion; aggregates only, no child named (`src/modules/analytics/misconceptions.ts`, unit + integration + isolation) |
| Read-only parent view + weekly summary | ✅ | teacher creates a private read-only **family link** on the student page (no parent accounts): 32-byte token, only its SHA-256 hash stored, shown once, 90-day expiry, one live link per child, revocable, audited. Public page `/family/[token]`: the week's finished levels, days played, stars, worlds + Powers, what they are learning now; never attempts, hints, flags or teacher notes; unknown/expired/revoked all read "not active"; noindex. Migration `20260924090000_family_links`; integration covers access, hashing, replace, revoke, expiry. A weekly **email** is not sent: no email provider is configured (your choice) |

## §7 Accessibility, language, safety, performance

| Item | Status | Evidence / files |
|---|---|---|
| Keyboard, screen reader, focus, non-colour feedback | 🟡 | Every block reachable by keyboard/tap through the palette + toolbar (44 px, labelled); switches are `role="switch"`, results are `role="alert"`/`status`, dialogs trap focus; on/off never colour-only. **New:** automated axe-core scan (`e2e/a11y.spec.ts`) of home, map, briefing and editor in EN + AR fails the build on serious/critical findings — it found and we fixed low-contrast avatar initials. **Not done:** a person-run screen-reader pass (NVDA/VoiceOver); Blockly's own canvas is excluded from the scan (third-party) |
| Reduced motion, high contrast, text size | ✅ | `src/ui/display/*`, `DisplayControls.tsx`; CSS in `globals.css` (also honours OS `prefers-contrast`/`prefers-reduced-motion`); boot script prevents flash; `useReducedMotion` follows the manual switch. Unit tests + e2e (apply, persist across reload) |
| Arabic content + RTL verified in the game | 🟡 | first-run flow verified in ar; native review flags pending |
| Weak Wi-Fi / offline queue / reconnect / no duplicate submissions | ✅ | **attempt outbox** (`players/shared/attempt-outbox.ts`) used by all 8 players: every graded run is stored on the device before sending and removed only when the server answers; resent on the next level open, on reconnect, and every 10 s while the success card is open; same attemptRunId, so the server never counts it twice; entries tied to the child (never sent under another child on a shared tablet), dropped after 7 days. Success card says "kept on this device…". Offline draft saves no longer throw. Unit `attempt-outbox.test.ts` (5), e2e `offline.spec.ts` (Wi-Fi drops on Run → reconnect → saved, map shows it completed) |
| Telemetry data-minimisation review | ✅ | `build-bunny/docs/privacy-data-inventory.md` §8b–8d: family links, everything kept on the device, and a review of every event/attempt/log field. No third-party analytics; no child text to any model. Open item recorded: `LearningEvent.classId` stays unwritten |
| Performance on school devices | 🟡 | production build: level player 136 kB first-load JS (Blockly loads separately, only on block levels), family page 130 kB. **Not done:** measurements on a real low-end tablet / throttled school network |

---

## Checkpoint log

### Checkpoint 9 — 2026-09-24 (100 levels)

- **Live:** nothing new; nothing merged or deployed. Branches are ready to push once this machine is signed in to GitHub.
- **On branches:** `feat/more-levels` (stacked on `feat/offline-perf-polish`).
- **Tested:** unit 518, integration 264 (playthrough of all 100 levels), full e2e 30 passing; lint and type-check clean; new levels spot-checked in the player in EN and AR.
- **Found and fixed:** a new teach-by-example level (Seed Sorter) could not be lost, so it taught nothing — the repo's AI-level tests caught it; it now has a real trap.
- **Polish noted, not done:** the teach-by-example walkthrough says "berries" in English on non-berry levels (shared player copy).

### Checkpoint 8 — 2026-09-24 (offline, accessibility, privacy)

- **Live:** nothing new; nothing merged, deployed or pushed.
- **On branches:** `feat/offline-perf-polish` (stacked on `feat/classroom-parent`).
- **Tested:** unit + integration 743 passing; full e2e 30 passing (15 intentionally single-viewport skips) including the new `offline.spec.ts` and `a11y.spec.ts`; lint, type-check and production build clean.
- **Also fixed here:** the grid player's local `postAttempt` shadowed the new outbox helper and called itself (caught by the offline e2e before commit); offline draft saves raised unhandled errors.
- **Still open across the brief:** 71 levels, not 100; Arabic native review; physical iPad / Safari; a person-run screen-reader pass; §6 assignment templates, group missions, reflections, standards mapping, weekly email (needs an email provider); real-device performance numbers.

### Checkpoint 7 — 2026-09-24 (classroom + family)

- **Live:** nothing new; nothing merged, deployed or pushed.
- **On branches:** `feat/classroom-parent` (stacked on `feat/curriculum-expansion`).
- **Tested:** unit + integration 738 passing (new: misconceptions, live snapshot, classroom/family integration, three tenant-isolation cases); lint and type-check clean; screenshots of the class page, curriculum guide (EN/AR), family panel, projector challenge, family page at phone width in EN/AR and the "not active" state.
- **Also fixed here:** the new report and family code first read level titles from the draft row; the test fixtures' DRAFT markers caught it, now published snapshots only.
- **Not done in §6:** assignment templates, group missions, reflections, external standards mapping, weekly email.
- **Next step:** `feat/offline-perf-polish` (§7).

### Checkpoint 6 — 2026-09-23 (curriculum expansion)

- **Live:** nothing new. Nothing is merged or deployed; pushing needs a one-time GitHub sign-in on this machine.
- **On branches:** `feat/curriculum-expansion` (stacked on `feat/robo-help`).
- **What it adds:** variables ("the counter") and functions ("my trick") as real blocks, code and grading; build-your-own maze (CREATIVE_PROJECT) from designer to teacher replay; 21 new levels (50 → 71): Code City Counters and Tricks (7), Inventor Island The Fair (3), practice modules (7), AI Island Safety and Fairness (3), Data Desert Three Oases (1); age bands and grade-based support; Robo Bunny examples for variables and functions.
- **Tested:** unit 471 (incl. `blockly-variables`, `maze`, `expansion-content`, Learn steps run for real), integration (maze pipeline, playthrough of all 71 levels by their own solutions, recommendation thresholds), e2e `maze.spec.ts` (laptop + tablet portrait), `counters.spec.ts`, plus the full suite; lint and type-check clean; screenshots of the designer/builder in English and Arabic at laptop and tablet sizes.
- **Also fixed here:** Blockly 13 drops the selection when a dialog steals focus from a tapped block (the block palette itself), so "add after the selected block" fell back to the end of the program; tap-to-add also left stale selection glows on earlier blocks. Both fixed in `BlocklyWorkspace.tsx`.
- **Honest gaps:** 71 levels, not 100; Arabic still needs a native reviewer; no physical iPad; a maze level's replay for teachers is implemented but only unit-tested, not clicked through.
- **Next step:** `feat/classroom-parent` (§6).

### Checkpoint 5 — 2026-09-23 (Robo Bunny's help)

- **Live:** nothing new.
- **On branches:** `feat/robo-help` (stacked on `feat/story-worlds`).
- **Tested:** unit (`programBlocks`, example selection, every example through the real gates), integration (warm-up triggers only when stuck; isolation), e2e `help.spec.ts` on laptop + tablet landscape, full suites.
- **Also fixed here:** Blockly 13 clears its selection whenever focus leaves the canvas, so "delete selected" / "add after the selected block" / "explain this block" silently lost the block on every button tap; the player now remembers the last tapped block until an explicit deselect.
- **Next step:** `feat/curriculum-expansion`.

### Checkpoint 4 — 2026-09-23 (story + eight worlds)

- **Live:** nothing new.
- **On branches:** `feat/story-worlds` (stacked on `feat/tablet-player-a11y`).
- **Tested:** content gates for all 50 levels (solvability, reachability, 3-star solutions), story completeness test, unit + integration suite, e2e `story.spec.ts` (scene once/skip/replay; Power awarded on the finishing run), map + scene screenshots en.
- **Not tested:** Arabic story copy by a native speaker (authored, flagged for review); hardware.
- **Next step:** `feat/robo-help`.

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
