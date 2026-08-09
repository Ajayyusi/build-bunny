# Build Bunny — UX Journeys & Key Screens

Design section: user journeys, screen layouts, gamification rulebook, states inventory, accessibility.
Audience: senior engineers implementing phases A–F (+ J for certificates). Everything here respects the
LOCKED stack: Next.js 15 App Router, Prisma/Postgres row-tenancy, custom sessions, Blockly + pure-TS
grid engine with server-side authoritative grading, next-intl (en/ar, RTL), Tailwind 4 + custom
components, "Play" and "Pro" themes on one token system.

Route convention used throughout: all routes live under `/[locale]/…` (next-intl). Route groups:
`(auth)`, `(student)`, `(teacher)`, `(school)`, `(nitaq)`. I write routes without the locale prefix
for brevity — `/home` means `/[locale]/(student)/home`.

---

## 0. Visual identity foundation ("premium, playful, not babyish")

Every journey below assumes this identity. It is the answer to "why does this not look like MethdAI
or a generic SaaS template."

### 0.1 The two themes, one token system

| | **Play (student)** | **Pro (staff/admin)** |
|---|---|---|
| Mood | Adventure game with craft — think *Monument Valley* / *Alto's Odyssey*, not Nick Jr. | Calm, data-forward, warm-neutral — think Linear/Notion with one playful accent |
| Base surface | Warm off-white `--surface: #FBF8F2` (dark: `#141821`) | Neutral `#F7F8FA` (dark: `#0F1218`) |
| Radius | `--radius-card: 20px`, `--radius-control: 12px` | 12px / 8px |
| Shadow | Soft, coloured ambient shadows (world-tinted) | Flat borders, 1 elevation level |
| Motion | Springy (200–350 ms, ease-out-back ≤ 1.1 overshoot) | 120–180 ms, standard ease |
| Illustration | Full scenes, mascot | Line icons only; mascot appears **only** in empty states, at ≤ 96 px |

Tokens are shared (`--bb-color-*`, `--bb-space-*`, `--bb-type-*`); themes are two token maps applied
via `data-theme="play|pro"` on the route-group layout. Never mix themes on one screen. The teacher
"view as student" preview iframe carries `data-theme="play"` inside a Pro chrome.

### 0.2 Colour

**Brand core (both themes):**
- `--bb-indigo: #4F46E5` (primary actions, links, focus rings in Pro; secondary in Play)
- `--bb-carrot: #F97316` (the universal Build Bunny accent: Run button, streak flame, carrot pickups)
- `--bb-ink: #1E2433` (text), `--bb-cream: #FBF8F2`
- Semantic: success `#16A34A`, warning `#D97706`, danger `#DC2626`, info `#0284C7` — always paired
  with an icon + label, never colour alone.

**World colour families** (each world = a 5-step ramp `50/200/400/600/800` + one accent; stored on the
World record as `themeKey`, not hard-coded in components):

| # | World | Base family | Accent | Terrain feel |
|---|---|---|---|---|
| 1 | Bunny Meadow | Spring green `#4CAF50` ramp | Carrot orange | Rolling hills, daylight |
| 2 | Logic Forest | Deep pine `#166534` ramp | Amber `#F59E0B` | Dappled canopy, fireflies |
| 3 | Robot Lab | Steel cyan `#0891B2` ramp | Signal yellow `#FACC15` | Clean lab tiles, conveyor |
| 4 | Data Desert | Terracotta `#C2703D` ramp | Turquoise `#14B8A6` | Dunes, glyph obelisks |
| 5 | AI Island | Ocean teal `#0D9488` ramp | Coral `#FB7185` | Lagoon, floating lanterns |
| 6 | ML Lab | Violet `#7C3AED` ramp | Lime `#84CC16` | Night lab, glowing charts |
| 7 | Code City | Midnight navy `#1E3A8A` ramp | Neon cyan `#22D3EE` | Skyline, terminal windows |
| 8 | Inventor Island | Sunset magenta `#DB2777` ramp | Gold `#EAB308` | Workshop cliffs, hot-air balloons |

Rule: within a world segment (map, level player chrome, celebration), the world family drives
backgrounds and decorative elements; **interactive controls stay brand-consistent** (Run is always
carrot, primary is always indigo) so children never relearn the UI per world.

### 0.3 Typography

- **Play display:** Baloo 2 (Latin) / Baloo Bhaijaan 2 (Arabic) — rounded but sturdy, not childish
  when tracked normally and used ≥ 600 weight.
- **Play body & all Pro:** Nunito Sans (Latin) / IBM Plex Sans Arabic. Pro headings: Inter.
- Scale (px, 1.25 ratio, `--bb-type-*`): display 36/44 · h1 28/36 · h2 22/30 · h3 18/26 ·
  body 16/24 · small 14/20 · caption 12/16. Student body text never below 16. Numerals: tabular
  lining in Pro tables.
- Arabic: same scale, line-height +2 px on body sizes; verify Baloo Bhaijaan 2 rendering of level
  titles at weight 700 (fallback: IBM Plex Sans Arabic 700).

### 0.4 Spacing & layout

4 px base scale (`--bb-space-1: 4px` … `--bb-space-12: 64px`). Play screens use generous 24/32 gutters;
Pro uses 16/24. Max content width: student 1200 px, staff 1440 px. Cards never touch viewport edges
on tablet (min 16 px inset).

### 0.5 Mascot usage rules (Robo Bunny)

Robo Bunny is a **guide, never a decoration**. Rules:
1. One mascot instance per screen, max.
2. Appears: onboarding, hint drawer (delivers hints), level story intros, celebrations, empty states,
   fail states (encouraging pose). Never on: data tables, forms, settings, error-severity screens
   (500/permission denied use a neutral spot illustration, not the mascot looking sad about your data).
3. Pose library (SVG sprite, 12 poses): `wave`, `point`, `think`, `cheer`, `oops` (ears down, still
   smiling — failure is never shamed), `sleep` (empty states), `build` (hard-hat, "coming soon"),
   `read` (story), `whisper` (hints), `trophy`, `map`, `teach`.
4. Speech is always in a speech bubble component (`<BunnySpeech>`), max 2 sentences, reading level
   ≈ Grade 3, localized.
5. Staff surfaces: mascot only in empty states at small size; never animated in Pro theme.

---

## 1. STUDENT journey

### 1.1 Entry & first login

Students never see a marketing site or an email field. Two entry paths, both landing on the same
session:

**Path A — credential card (primary for Grades 3–5).**
School admin prints per-student credential cards (see §4.2). Card contains: school name, student
display name, username (e.g. `amal.k7`), initial password (three-word format, e.g. `blue-carrot-42`),
class code, and a QR encoding `https://app.buildbunny.ae/join?c=<classCode>`.

**Path B — class code (board/projector flow, Grades 5–7 self-serve).**
Teacher writes the class code on the board.

Flow (`/join`, Play theme, single-column, no header nav):

1. **Class code screen.** One input, 6 characters, format `BBX-XXX` (unambiguous alphabet — no
   `0/O/1/I/L`), auto-uppercased, auto-advancing segmented boxes (2 groups). Robo Bunny `wave` above,
   copy: "Enter your class code to hop in!" QR arrivals skip this step (code from query param,
   validated server-side).
2. **Class confirmation.** Shows class name + school name + grade badge ("Grade 4 — Falcon Class,
   Sharjah Model School") with the school logo. Button: "That's my class". Wrong code → inline error
   "Hmm, that code doesn't match a class. Check with your teacher." (never reveals whether the code
   exists vs. is expired). Codes are rate-limited per IP (10 tries / 10 min).
   Privacy note: the roster is **never** shown — no "pick your name from a list".
3. **Username + password.** Two fields, large (56 px height), password field has a show/hide toggle
   (children mistype; masking-only is a support burden). Username is validated within the class's
   school scope only. Error copy: "Name and password don't match. Ask your teacher for your card."
   after any failure (no user-exists oracle). 5 failures → 60 s cool-down with a friendly countdown.
4. Server creates the standard DB session (httpOnly cookie). If `student.onboardedAt IS NULL` →
   redirect `/welcome`, else `/home`.

Returning students on a shared/school device: `/login` shows a "Student? Enter class code" primary
card and a small "Staff sign in" link (staff email+password form lives at `/login/staff`). No
"remember me" for students on shared devices; session cookie is session-scoped by default, with an
8-hour absolute TTL for students.

### 1.2 First-run onboarding (`/welcome`) — 60-second budget

Three steps, one screen each, progress dots at top, **Skip** link visible from step 1 (skipping picks
a random avatar and marks onboarding complete — nothing downstream depends on completion). No data
collection: no name entry (display name comes from the school import), no DOB, no interests quiz.

- **Step 1 — Meet Robo Bunny (≈15 s).** Full-scene Bunny Meadow backdrop. Robo Bunny `wave` +
  bubble: "Hi {displayName}! I'm Robo Bunny. I follow your instructions — that's what coding is!"
  A single demo: three big buttons (Move, Move, Turn) the child can tap; bunny animates on a 3-tile
  strip. Purely local, no grading, plants the core mental model. Button: "Let's go".
- **Step 2 — Pick your look (≈20 s).** Avatar grid: 12 bunny avatars (varied fur colours, glasses,
  headscarf, cap, robot-plated — inclusive, not gendered pairs) × 6 background colours. Selection is
  the only data written (`student.avatarId`, `student.avatarColor`). Reroll die button for fun.
- **Step 3 — How your adventure works (≈25 s).** Three static illustrated tiles on one screen (not a
  carousel): "Worlds — follow the trail" (mini map thumb), "Stars — solve levels your way, up to 3
  stars" , "Stuck? Tap the lightbulb — I'll help, never judge." Button: "Start my adventure" →
  `/home` with the Continue Learning card pre-highlighted (2 s soft glow).

Server: `student.onboardedAt = now()` set on completion or skip. Onboarding is replayable from
Profile → "Meet Robo Bunny again".

### 1.3 Home (`/home`) — layout contract

Student nav (persistent left rail on desktop, bottom tab bar ≤ 1024 px): HOME, ADVENTURE, AI LAB,
PLAYGROUND, ACHIEVEMENTS, PROFILE. AI LAB and PLAYGROUND render "Robo Bunny is still building this
lab!" (`build` pose) states until their phases ship — visible but honestly marked, per the quality
bar; if the school's licence excludes them they are hidden entirely.

**Exact card list, in DOM/visual order** (12-col grid, desktop; single column stacked on tablet
portrait in the same order):

1. **Greeting header** (full width, not a card): avatar (56 px) + "Good morning, Amal!" (time-of-day
   aware, localized) + two chips only: **streak flame chip** ("🔥 4-day streak") and **XP chip**
   ("⭐ 1,240 XP" with current-level ring). No other numbers in the header.
2. **Continue Learning — hero card** (8 cols): world-tinted scene art of the current world, world
   name + module name, level title ("Carrot Collector"), a thin progress bar "Level 7 of 12 in Bunny
   Meadow", and one big carrot-orange button **"Keep going"** (or "Start your adventure" for level 1;
   see resume logic §1.6). This is the largest tap target on the page.
3. **Daily Challenge card** (4 cols, beside hero): today's challenge title, "+30 XP" pill, state:
   not-done (carrot button "Try it") / done (green check + "Come back tomorrow!"). See §1.7.
4. **My World progress card** (4 cols): current world emblem, stars collected in world
   ("14 ★ of 30"), circular world-completion ring. Tapping opens the map scrolled to current world.
5. **Latest achievement card** (4 cols): most recent badge art + name + "See all" → ACHIEVEMENTS.
   Empty state: greyed badge silhouette + "Your first badge is waiting in Bunny Meadow!"
6. **Recommended next card** (4 cols): one teacher-assigned item if an active assignment exists
   ("Ms. Fatima assigned: Loop Trail — due Thursday"), otherwise the system's next-unlocked bonus
   level or replay-for-3-stars suggestion. Never more than ONE recommendation.

**Deliberately EXCLUDED from Home** (stat-overload guardrail, decided): total time spent, attempt
counts, accuracy/score percentages, XP-over-time graphs, class leaderboard/rank, number of hints
used, comparison to classmates, more than one recommendation, more than one achievement. Children
see *progress and next action*, never analytics. (Leaderboards are excluded from the student product
entirely in MVP — competitive framing harms the bottom half of the class; teachers get the
comparative view instead.)

Data: one server component fetch `getStudentHome(ctx)` returning a `HomeModel` — no client-side
waterfalls; every card has a skeleton.

### 1.4 Opening a level — the core loop

Entry: from map node tap, Continue Learning, daily challenge, or assignment link. Route:
`/play/[levelId]` (full-screen player, student nav hidden; back arrow top-left returns to map,
confirming "Leave level? Your blocks are saved." only when the workspace has unsaved run-state).

**Phase 1 — Story intro (once per level, skippable).** Full-bleed world-tinted panel: level story
(2–3 sentences from `level.story`), scene illustration, Robo Bunny `read` pose. Buttons: "Let's
code!" (primary) / auto-shows only on first open; afterwards accessible via the 📖 book icon in the
player header. Budget: one screen, no multi-page cutscenes.

**Phase 2 — Instructions overlay.** Slides up over the player: `level.instructions` (rich text,
localized), the goal strip ("Collect 3 🥕 and reach the flag"), allowed-blocks preview row, and
estimated time chip. Dismiss = "Got it". Re-open anytime via the ℹ️ goal strip (§1.5).

**Phase 3 — Coding.** The player (§1.5). Workspace pre-loaded from `level.startingWorkspace`
(Blockly JSON). Autosave workspace to `attemptDraft` (debounced 3 s, localStorage + server sync
every 30 s) so a closed tab never loses work.

**Phase 4 — Run.** Run button → client codegen (Blockly → JS) → JS-interpreter steps the pure engine
→ Canvas playback at 1×/2× (speed toggle persists per student). During playback: Run becomes Stop;
workspace read-only-dimmed; the executing block highlights in sync (Blockly `highlightBlock`).
Simulation events (carrot collected, bump) get 150 ms micro-animations + soft SFX (global mute
toggle in player header, persisted).

**Phase 5 — Fail gracefully.** Client-side engine verdict FAIL/PARTIAL → result banner slides into
the simulation panel (never a modal that hides the grid): Robo Bunny `oops` + the grader's
feedback message (from the reusable checks, e.g. "So close! You collected 2 of 3 carrots. Watch
where Robo Bunny stops."). Buttons: **Try again** (resets sim, keeps blocks) / **Watch replay**.
The failed path stays visibly drawn on the grid (dotted trail) for 4 s — the child learns by seeing
*where* it went wrong. After **2 consecutive fails**, the Hint lightbulb gains a gentle pulse +
badge ("Robo Bunny has a hint"); it never auto-opens.

**Phase 6 — Hints.** Lightbulb opens the hint drawer (right side over sim panel, 360 px). Tiered
reveal: tier 1 visible; "Need more?" reveals tier 2 → 3 → 4, each a `whisper` bunny card. Tiers
already unlocked stay visible on reopen. `attempt.hintTierUsed = max(tier)` recorded per level (not
per attempt). Copy discipline per spec: 1 conceptual → 2 specific → 3 locate the problem → 4 strong
help (e.g. shows the block sequence for one sub-goal, never the full solution).

**Phase 7 — Success celebration.** Client PASS → immediately submit to server
(`POST /api/attempts` with workspace JSON + program); **server re-runs the engine and is the only
authority** for stars/XP/unlocks. Client plays the celebration optimistically (§9.1) while the
server confirms (sub-second; on rare mismatch — tampered client — the result screen quietly shows
the server verdict; no accusatory copy). Celebration: 2.5 s star sequence (§9.1).

**Phase 8 — Explanation screen ("What you learned").** After the stars settle, the result card
flips to `level.explanation` — the pedagogical payoff (e.g. Repeat After Me: "`Repeat 4 { Move }`
tells Robo Bunny the same thing as four Move blocks — one instruction, repeated. Loops save work!").
Shows: stars earned, XP gained (+ streak tick if first activity today), "Compare" toggle if the
level defines a model solution (side-by-side block-count comparison, only shown AFTER success).
Buttons: **Next level** (primary, pre-fetched) / "Try for 3 stars" (if < 3) / "Back to map".

**Phase 9 — Next level.** "Next level" transitions directly to the next level's story intro without
returning to the map (map state updates in background). Every 3rd completion routes via the map with
a 1.5 s camera scroll showing the trail advancing — keeps the journey feeling anchored without
making the map a toll gate.

### 1.5 Level Player layout (the coding screen)

LOCKED macro-layout honoured: LEFT toolbox · CENTER workspace · RIGHT simulation. In RTL locales the
whole player mirrors via logical properties (toolbox inline-start, simulation inline-end); the grid
world itself does NOT mirror (coordinates are world truth), but the Blockly workspace uses Blockly's
RTL mode.

**Desktop (≥ 1200 px):**

```
┌──────────────────────────────────────────────────────────────┐
│ ← back · World emblem · "Carrot Collector" · ★★☆ · 📖 ℹ️ 🔊 ⚙️ │ header 56px
├─────────┬─────────────────────────────┬──────────────────────┤
│ Toolbox │  Blockly workspace          │ Goal strip (44px)    │
│ 88px    │  (flex)                     │──────────────────────│
│ category│                             │ Canvas simulation    │
│ rail +  │  [Blocks ⇄ Code] toggle     │ (square, max 480px)  │
│ flyout  │   top-end of workspace      │──────────────────────│
│         │                             │ ▶ Run   ⟳ Reset  1×  │
│         │                             │ 💡 Hint (56px row)   │
└─────────┴─────────────────────────────┴──────────────────────┘
```

- Simulation panel fixed width 420 px (min 360). Workspace gets the remainder.
- **Toolbox:** Blockly category toolbox, icon + label per category (EVENTS, MOVEMENT, CONTROL,
  LOOPS, LOGIC, VARIABLES, FUNCTIONS, SENSORS, ROBOT, AI — only categories the level allows are
  rendered; a level's `allowedBlocks` filters block visibility, never greys them). Category chips
  48 px tall, world-neutral styling.
- **Blocks ⇄ Code toggle:** segmented control, top-end of workspace; Code view is read-only
  generated JavaScript with the same block-colour syntax tinting; toggling never loses workspace
  state.
- **Run** (carrot, 48 px tall, play icon + "Run") and **Reset** (ghost) sit in a fixed control row
  under the canvas; **Hint** lightbulb at the row's end — same position in every level, every
  breakpoint. Run is also bound to `Ctrl/Cmd+Enter`.
- Goal strip above canvas: target icons with live counters ("🥕 2/3 · 🚩 reach the flag"), ℹ️
  reopens instructions.
- Optional divider drag between workspace and sim (persisted); double-click resets.

**Tablet landscape (768–1199 px, iPad primary):**
- Toolbox collapses to a 64 px icon rail; tapping a category opens the flyout **overlaying** the
  workspace (Blockly `autoClose` flyout). Simulation panel narrows to 320 px.
- All touch targets ≥ 48 px; Blockly `zoom.startScale: 1.1`, grid snap on, `touchAction`
  configured so vertical page scroll never fights block drags (player is fixed-viewport,
  no page scroll).

**Tablet portrait:**
- Stacked: simulation on top (40% height, canvas letterboxed), workspace below with icon-rail
  toolbox. Run/Reset/Hint become a fixed bottom bar (64 px, safe-area aware). Goal strip collapses
  to a single-line pill overlaying the canvas top; instructions open as a bottom sheet.
- A "focus sim" toggle expands the simulation to 70% temporarily during playback (auto-returns).

**Phones:** the player is view-only (watch replays, read explanations); a friendly gate — "Coding
works best on a tablet or computer" — per the responsive policy. Never a broken editor.

### 1.6 Returning-user flow — Continue Learning resume logic

Deterministic, server-computed (`getResumeTarget(studentId)`):
1. Active teacher assignment with nearest due date and status ≠ completed → that activity.
2. Else most recent level with status IN_PROGRESS (has draft workspace) → that level, workspace
   restored.
3. Else first unlocked-but-unstarted level in trail order.
4. Else (everything complete): daily challenge if unplayed today, otherwise "Try for 3 stars"
   suggestion (lowest-star completed level), otherwise world-complete rest state ("New worlds are
   coming — Robo Bunny is building!").

The hero card label reflects the branch: "Finish Loop Trail" / "Keep going" / "Assigned by
Ms. Fatima". One tap must always resume meaningfully within 2 s (level route + workspace draft are
prefetched when Home renders).

### 1.7 Daily challenge & streak surfaces

- **Daily challenge:** one short remixed activity per school day (server-selected per student:
  a CODE_PREDICTION, QUIZ, or PATTERN_RECOGNITION item drawn from *already-completed* modules —
  reinforcement, never new material, so it's always solvable). Fixed +30 XP, no stars, one attempt
  ("come back tomorrow" after). 3–5 minutes by design. Route `/play/daily`.
- **Streak:** flame chip in the Home header; tapping opens a small popover calendar (current week,
  school days marked). Full rules in §6.3. The streak surface never shows loss-framing ("about to
  lose your streak!") — only positive framing ("4 school days in a row!").

---

## 2. Adventure Map (`/adventure`)

### 2.1 Chosen pattern: ONE continuous scrollable trail (decided)

Considered: (a) world-select card grid → per-world map, (b) one continuous trail with visually
distinct world segments. **Decision: (b) continuous trail.**

Justification: (1) a single spatial metaphor — "my journey" — matches how 8–13-year-olds think about
progress; a card grid re-introduces abstract navigation and splits the emotional payoff of *seeing*
how far you've come. (2) World boundaries become *moments on the trail* (gates/certificates, §2.5)
instead of a menu transition — this is the platform's signature demo shot on a big screen in a school
sales pitch. (3) One scroll surface is strictly simpler on tablets than nested navigation. (4) The
locked requirement "each world visually distinct" is satisfied by terrain theming per segment, and
"branching paths later" fits a trail naturally (side-spurs), while a card grid would need a second
mechanism.

Mitigation for the card-grid's one advantage (fast travel): a compact **world dock** — a horizontal
rail of world emblems pinned at the top of the map screen; tapping an emblem smooth-scrolls the
camera to that segment (instant with reduced motion). Locked worlds show as fogged emblems.

### 2.2 Map construction

- Vertical scroll (natural on tablets), trail winds in an S-curve, ~6–8 nodes per viewport. World
  segments are stacked bands, each rendered with its world colour family + terrain art layer
  (SVG/CSS layers, parallax ≤ 12 px, disabled under reduced motion).
- The map is data-driven: server component fetches `getMapModel(studentId)` which merges the
  published curriculum (worlds → modules → levels, in `sortOrder`) with the student's progress rows.
  Nothing about worlds/levels is hard-coded client-side.

```json
// MapModel excerpt (server-composed)
{
  "worlds": [{
    "id": "w_meadow", "themeKey": "meadow", "title": {"en": "Bunny Meadow", "ar": "مرج الأرنب"},
    "starsEarned": 14, "starsTotal": 30, "state": "IN_PROGRESS",
    "nodes": [
      {"levelId": "l_first_hop", "kind": "CORE", "state": "COMPLETED", "stars": 3},
      {"levelId": "l_carrot_collector", "kind": "CORE", "state": "CURRENT", "stars": 0},
      {"levelId": "l_hidden_meadow", "kind": "BONUS", "state": "LOCKED"},
      {"levelId": null, "kind": "GATE", "state": "LOCKED", "certificateMilestone": "WORLD_COMPLETION"}
    ]
  }]
}
```

### 2.3 Node states (visual grammar)

| State | Visual | Interaction |
|---|---|---|
| `COMPLETED` | Filled world-accent disc, 1–3 gold stars arced above; 3-star nodes get a subtle shine sweep (once per map visit) | Tap → level card popover: stars, best block count, **Replay** / "Try for 3 stars" |
| `CURRENT` | Larger disc (1.25×), Robo Bunny standing on it, soft radial pulse (2 s loop; static glow ring under reduced motion) | Tap → opens level (story intro if first time) |
| `LOCKED` | Desaturated disc, padlock icon, trail beyond drawn as faint dashes | Tap → tooltip "Finish {prevLevelTitle} to unlock" — never silent |
| `BONUS` | Star-burst-shaped node hanging off a short side-spur, gift icon; unlocks with its anchor core level | Optional; contributes XP + achievements, not required for world completion |
| `GATE` (world boundary) | Archway spanning the trail, world emblem keystone; closed doors until world complete | Tap when open → certificate/ceremony replay (§2.5) |

Exactly one `CURRENT` node exists (the resume target's level). Teacher-assigned levels out of trail
order additionally show a small "assignment" ribbon on their node.

### 2.4 Brand-new student (empty state)

No progress rows yet: camera opens at the trailhead of World 1. Node 1 is `CURRENT` with the pulse +
a one-time coach-mark bubble from Robo Bunny (`map` pose): "This is your trail! Tap the glowing spot
to start." Levels 2+ visible but locked; Worlds 2+ appear as fog-covered terrain with silhouettes
(curiosity, not clutter) and fogged emblems in the world dock. There is no "empty map" — the
curriculum always renders; if a school has NO published curriculum assigned (admin error), the map
shows the `build` bunny + "Your adventure is being prepared — check back soon!" and the event is
alerted to the school admin dashboard.

### 2.5 World boundary — the certificate moment

When the final core level of a world is completed (server confirms world completion):
1. The success flow's "Next level" is replaced by **"Open the gate"**.
2. Map camera scrolls to the gate; doors open (1.5 s); world-complete ceremony plays (§9.2).
3. If the world maps to a certificate milestone (per curriculum config), the certificate is issued
   server-side (PDF/PNG + ID + QR) and presented in the ceremony with **"See my certificate"** →
   `/achievements/certificates/[certId]` (download + "show your teacher" hint; students cannot
   email/share externally from the app).
4. The next world's fog dissolves; its first node becomes `CURRENT`.
Replay: tapping any opened gate replays a 5 s condensed ceremony + re-opens the certificate.

---

## 3. TEACHER journey (Pro theme)

Routes: `/teach` (my classes) · `/teach/classes/[classId]` (class detail, tabs: Progress ·
Assignments · Reports) · `/teach/students/[studentId]` · `/teach/classes/[classId]/assign`.

### 3.1 First login

Teacher receives an invite email (from school-admin action, §4.3): "Sharjah Model School added you
to Build Bunny" → set-password page (token, 72 h expiry) → lands on `/teach` with a 3-step first-run
checklist card (dismissible): ① "View your classes" ② "Open a class and meet the progress matrix"
③ "Preview the student experience" (opens Level 1 in a read-only test-play — teachers should feel
the product before teaching it). No forced tour.

### 3.2 My Classes (`/teach`)

Card per class: class name, grade, student count, curriculum track, three glanceable numbers —
active this week (n/total), median world·level position (e.g. "Meadow 7/12"), **needs-help count**
(amber, from §3.4) — and a "Weekly report" link. Empty state (no classes yet): "Your school admin
hasn't assigned you a class yet" + "Request access" mailto the school admin. Sorted by last activity.

### 3.3 Class detail — the progress matrix

The teacher's home screen for a class. **Rows = students** (sticky first column: avatar, display
name, needs-help flag), **columns = levels grouped by module** under world headers, in trail order.
Virtualized both axes (30 students × 60+ levels).

Cell encoding (colour + glyph, never colour alone):
- empty cell — not started; ▤ grey lock — not yet unlocked for that student;
- ◐ blue dot — in progress (has attempts, no pass);
- ★/★★/★★★ — completed with stars;
- ⚑ amber flag overlay — struggling on this level (per §3.4);
- 📌 ribbon on column header — currently assigned.

Interactions: hover/tap cell → popover (attempts count, best result, time on level, hint tier used,
last active) with "Open detail". Column header click → level summary across the class ("8 of 24
passed; common failure: missed second carrot" — aggregated from grader check results). Row click →
student drill-down. Filters: module, "needs help only", inactive 7+ days. A "class pulse" strip
above the matrix shows: active today, levels completed this week, average stars this week — three
numbers, no charts here.

### 3.4 "Struggling" signal — exact definition

Computed nightly + on-write, stored as `StudentFlag(studentId, levelId?, reason, score, raisedAt)`;
a student is **flagged** if ANY of:

| Reason code | Condition (all server-side) |
|---|---|
| `STUCK_ON_LEVEL` | ≥ 5 failed attempts on one level with no pass, across ≥ 2 distinct days |
| `OVERTIME` | active time on one level > 3× `level.estimatedMinutes` without a pass |
| `STRONG_HINTS` | used tier-4 hint on ≥ 3 of the last 5 completed levels |
| `INACTIVE_BEHIND` | no activity in 14 calendar days AND trail position < class median − 3 levels |
| `LOW_STARS_RUN` | last 5 completions all 1-star (passing but fragile) |

Flags auto-clear when the triggering condition resolves (e.g. level passed, activity resumes).
The matrix shows the flag; the popover shows the *reason in teacher language* ("Amal has tried
Loop Trail 7 times over 2 days — likely stuck on repeat counts") plus the level's teacher notes.
Deliberately NOT a black-box "risk score": every flag names its observable cause.

### 3.5 Student drill-down (`/teach/students/[studentId]`)

Header: avatar, name, class, trail position, stars, streak, flags. Tabs:
- **Timeline** — reverse-chron activity feed: attempts (pass/fail + duration), levels completed,
  badges, certificates, teacher feedback given. Filter by module/date.
- **Attempts & code review** — per level: attempt list; selecting an attempt renders the submitted
  workspace JSON in a **read-only Blockly viewer** plus the generated code and the grader's check
  results (✓ reached flag · ✗ collected 2/3 carrots · ✓ used Repeat). A "Replay run" button plays
  the simulation of that exact attempt (deterministic engine makes this free — same inputs, same
  playback). This is the teacher's superpower screen: see exactly what the child tried.
- **Feedback** — teacher writes a short note attached to a level or attempt
  (`TeacherFeedback(studentId, levelId, attemptId?, body, createdAt)`). Student sees it as a
  Robo Bunny-delivered message on that level's card and Home ("A note from Ms. Fatima 💬") — warm,
  not gradebook-cold. Templates offered ("Great use of loops!", "Try walking through it step by
  step") to lower effort; free text allowed; profanity-list checked; no student replies in MVP.

### 3.6 Assigning work (`/teach/classes/[classId]/assign`)

3-step flow: ① pick scope — world, module, or single level(s) from a curriculum tree picker
(only published content in the class's track) ② pick audience — whole class or selected students
(multi-select with flags visible, enabling remediation assignments) ③ set window — start date,
due date, optional note. Creates `Assignment` + per-student `AssignmentItem` status
(NOT_STARTED/IN_PROGRESS/COMPLETED, derived from progress rows — no double bookkeeping; an
assignment is a *pointer with a deadline*, completion truth stays in progress).
Assignment surfaces: student Home "Recommended next" card + node ribbon (§2.3); teacher sees a
completion bar per assignment on the Assignments tab. Assigning a locked level force-unlocks it for
those students (recorded as `unlockSource: ASSIGNMENT` so the map can render it as an assigned
side-quest without breaking trail logic).

### 3.7 Weekly report

Generated server-side every Monday 07:00 school-local time per class (`ClassWeeklyReport` row +
rendered PDF via the certificate PDF pipeline). Contents: activity summary (active students,
sessions, levels completed vs. previous week), progress movement (levels/stars gained per module),
needs-help list with reasons, celebrations (badges, 3-star runs, certificates), and one suggested
action ("6 students are stuck on Choose the Path — consider a 10-minute demo of If/Else").
Viewable at `/teach/classes/[classId]/reports` (list, in-app render) + "Download PDF". Email
delivery is opt-in per teacher (off by default; no notification pressure).

---

## 4. SCHOOL_ADMIN journey (Pro theme)

Routes: `/school` (dashboard) · `/school/setup` (wizard) · `/school/students` · `/school/import` ·
`/school/classes` · `/school/teachers` · `/school/reports` · `/school/settings`.

### 4.1 Season 1 — Setup

First login (via handoff from NITAQ, §5.1) lands on `/school/setup`: a persistent checklist page
(progress ring, resumable, steps completable in any sane order):
① Confirm school profile (name shown to students, logo, timezone default Asia/Dubai, week structure)
② Create classes ③ Invite teachers ④ Import students ⑤ Assign students to classes (bulk, part of
import) ⑥ Assign curriculum track per grade/class ⑦ Print credential cards. The dashboard stays in
"setup mode" (checklist pinned) until ≥ 1 class has ≥ 1 active student.

### 4.2 CSV import wizard (`/school/import`) — the make-or-break flow

Stepper: **Upload → Map columns → Validate & preview → Confirm → Credentials.**

1. **Upload.** Drop zone; accepts `.csv`/`.xlsx`; template download link ("students-template.csv",
   also offered in Arabic column headers). Max 2,000 rows. Parsed server-side (never trust client
   parsing for the source of truth).
   Template columns: `display_name` (required) · `student_identifier` (required — school's own ID,
   unique within school) · `grade` (required) · `class_name` (required; auto-creates missing classes
   with confirmation) · `preferred_username` (optional). **No DOB/email/phone columns; if the file
   contains extra personal-data columns they are dropped and the wizard says so explicitly**
   ("Column 'date_of_birth' was ignored — Build Bunny doesn't store it").
2. **Map columns.** Auto-detected header mapping with dropdown overrides; remembers mapping per
   school.
3. **Validate & preview.** Full-file validation (Zod row schema); results table: green rows (ready),
   amber (auto-fixes applied: trimmed whitespace, normalized Arabic-digit grades, generated username
   from name + collision suffix), red (blocking: missing name, duplicate `student_identifier` in
   file, identifier already exists in school — offered as "update existing" toggle, class name
   ambiguous). Red rows shown with per-cell error messages; "Download error rows as CSV" to fix
   offline. Import proceeds only when red = 0 OR admin excludes red rows explicitly.
4. **Confirm.** Summary: "84 students → 3 classes (2 new classes will be created). 84 accounts with
   generated passwords." Explicit statement of what will be created. Runs as a background job with
   progress; idempotent via import batch ID (safe re-run).
5. **Credentials.** Success screen → **Credential sheet generator**: per-class PDF, one card per
   student (school name, class + class code, display name, username, initial password, QR — §1.1),
   8 cards per A4, cut lines. Options: regenerate passwords for a subset, per-class or all-classes
   PDF. Passwords are stored only as Argon2id hashes; the PDF is generated once from the plaintext
   held in the import job and **cannot be re-downloaded later** — later resets generate new
   passwords (this is stated on screen; it's a privacy feature, not a bug).

### 4.3 Classes & teachers

- `/school/classes`: table (name, grade, code, students, teachers, curriculum track); create/edit
  drawer; **class code** shown with rotate button (rotating invalidates the old code, confirmation
  required, printed cards note "codes can change — students already signed in are unaffected").
- `/school/teachers`: invite by email (name + email + assigned classes) → invite email (§3.1);
  states: Invited (resend/revoke) / Active / Deactivated. Deactivation keeps historical data,
  removes access.

### 4.4 Season 2 — Monitoring (`/school`)

Dashboard (post-setup mode), cards top-to-bottom:
1. KPI strip: active students this week (n/licensed seats), levels completed this week, certificates
   issued total, teachers active.
2. **Grade comparison** — horizontal bar chart: median trail progress per grade (levels completed,
   normalized per track); toggle to "stars per student".
3. **Class comparison table** — per class: teacher, active %, median position, needs-help count,
   last activity; row click → read-only view of that class's progress matrix (same component as
   teacher's, `readOnly` prop — no feedback/assign actions).
4. Certificates panel — recent certificates (student, milestone, date, verify link).
5. Licence card — seats used/total, term end date, renewal contact.

Exports (`/school/reports`): CSV exports (students + progress snapshot, certificates register,
class summaries) and a monthly school PDF report (same pipeline as §3.7). All exports are
tenant-scoped server-side, audit-logged (`exported_by`, timestamp, filter).

---

## 5. NITAQ_ADMIN journey (Pro theme, `/nitaq/*`)

### 5.1 Onboarding a new school (end-to-end)

`/nitaq/schools` (directory: name, region, licence status, seats, activity sparkline, health dot) →
**"New school"** wizard:
① **School** — name (en/ar), slug, emirate/region, logo upload, default locale + timezone.
② **Licence** — plan, seat count, term start/end, modules enabled (worlds/tracks toggles; AI Lab /
ML Lab flags for later phases), demo-mode flag (demo schools excluded from platform analytics).
③ **Curriculum** — attach published track(s) per grade band (defaults offered).
④ **School admin account** — name + email → creates SCHOOL_ADMIN with set-password invite.
⑤ **Handoff** — preview of the handoff email (checklist link to `/school/setup`, support contact,
credential-card explainer PDF attachment) → "Create school & send handoff". Everything up to ⑤ is a
draft; nothing emails until the final confirm.
School detail page afterwards: licence panel, admins (resend invite / reset), activity, audit log
tab, **impersonate** button (per locked auth spec: separate session recording actor+subject, banner
"Viewing as … — all actions are logged" shown while active, auto-expires 30 min).

### 5.2 Content authoring loop (`/nitaq/content`)

Tree navigator (left rail): Program → Grade band → World → Module → Level, drag-to-reorder
(`sortOrder`), status chips (DRAFT/REVIEW/PUBLISHED/ARCHIVED).

**World editor:** title/description `{en, ar}`, themeKey (picks colour family + terrain set from the
design system — art is component-driven so a new world doesn't require new illustration code),
emblem, certificate milestone mapping, prerequisite world.

**Level builder** (`/nitaq/content/levels/[levelId]`) — two-pane: form tabs left, **live preview
right** (the actual student Level Player component in preview mode — same code, no student session,
theme forced to Play). Tabs:
- **Details** — title, description, story, learning objective, difficulty, recommended grade,
  estimated minutes, XP override, max stars, prerequisite, teacher notes.
- **Blocks** — allowed-blocks picker (by category), max block count, required/prohibited blocks,
  starting workspace (opens the Blockly editor to author it).
- **Grid** — visual grid painter for the simulation: tile brush (ground/obstacle/water), place
  bunny start + direction, carrots, goal flag, movers; grid size. Serializes to the engine's level
  JSON.
- **Grading** — composable check list from the reusable grading checks (reached destination,
  collected N, avoided tiles, used/not-used block, max blocks, variable value, expected output,
  sequence, classifier result) each with its student-facing feedback message `{en, ar}`.
- **Hints** — the 4 tiers, each `{en, ar}`.
- **Localization** — side-by-side en/ar completeness view; publish warns (not blocks) on missing
  `ar`.

**Test-play:** button switches the preview to a full interactive run (author plays as a student;
attempts not recorded). A level cannot leave DRAFT until the author has test-played a passing run —
the builder records `lastAuthorPassAt` and the **Submit for review** button is disabled without it
(machine-enforced quality bar).

**Review → publish:** Submit for review → a second NITAQ_ADMIN (or the same user with an explicit
"self-review" confirm, small team reality) opens a review screen: diff-style summary of fields,
test-play, localization completeness, then **Publish**. Publishing snapshots the level content
version id onto future attempts (attempts reference the content version they were graded against —
prerequisite for the spec's "versioning eventually"). ARCHIVED content stays attached to historical
progress, hidden from new maps.

### 5.3 Platform health (`/nitaq/health`)

Single ops screen: uptime/status of app + DB + object storage (driver ping), server grading p95
latency and failure rate (client-PASS vs server-verdict mismatch rate — the anti-tamper/regression
canary), active sessions by role, sign-ins last 24 h, error-rate sparkline (from the app's error
reporter), per-school last-activity table (schools silent > 7 days flagged — a churn early-warning
for the founder), background job queue depth (imports, reports, certificates). Read-only; deep
links to logs. Also `/nitaq/announcements` (banner messages targeted platform-wide or per school,
per role, with schedule window).

---

## 6. Gamification rulebook (server-authoritative; all values in a `GamificationConfig` table, not code)

### 6.1 XP

| Event | XP |
|---|---|
| Level pass — Easy / Medium / Hard | 50 / 75 / 100 (per-level override allowed) |
| Stars bonus | +10 × (stars − 1) |
| Optional challenge objective met | +25 |
| Daily challenge | +30 flat |
| Replaying an already-passed level | +10 max, once per level per day (improved stars still recalc star bonus delta) |
| Bonus (side-spur) level | same rules, `kind: BONUS` tagged |

XP is only ever computed server-side from the authoritative grading run (locked decision). XP never
decreases. XP feeds a simple student "level ring" (100 XP × current-level curve: `ceil(100 × n^1.15)`
to next) — the ring exists for the Home header chip only; no XP leaderboards.

### 6.2 Stars (per level, max defined by level, default 3)

- ★ — all success conditions PASS.
- ★★ — PASS **and** block count ≤ `level.parBlocks` (efficiency par, authored per level) **or** the
  optional challenge met (whichever the level defines as its 2nd star, authored).
- ★★★ — PASS **and** efficiency par **and** hint tier used ≤ 2 on this level.
  Rationale vs. the "never punish excessively" spec rule: tiers 1–2 (conceptual/specific) are FREE —
  they are learning, not cheating; only tier 3–4 (locate/strong help) cap the run at ★★. The cap
  applies per completion; a student can always replay later, use no strong hints, and earn ★★★ —
  hints never permanently mark a level.
- Stars only go up (best-of stored on progress; attempt history keeps each run's result).

### 6.3 Streak rules (school-week aware — decided)

- **Streak day** = ≥ 1 server-graded activity completion (level pass, daily challenge, or a genuine
  failed attempt session ≥ 5 min — effort counts, per "learning first").
- Counted in **school days, Monday–Friday** (UAE school week). Saturday/Sunday are automatic
  freezes: they never extend and never break a streak. Per-school override of the week structure in
  school settings (some private schools differ), plus a school **holiday calendar** (admin-editable;
  holidays freeze streaks platform-wide for that school).
- Day boundary: **school timezone** (default Asia/Dubai), stored per school; streak computation uses
  the school's local date, not UTC.
- **Forgiveness:** one missed school day per calendar week is auto-repaired ("Robo Bunny kept your
  streak warm!") — max 1 repair/week, applied silently server-side. Two consecutive missed school
  days reset to 0. No paid/earned streak-freeze economy — this is a school product.
- Display: flame chip counts school days; popover calendar marks weekends/holidays as clouds, not
  gaps. Copy never threatens ("come back Monday to keep it going!" not "your streak will die").

### 6.4 Achievement trigger list (DB `Achievement` + `StudentAchievement`; all conditions evaluated in the server grading/progress transaction)

| Achievement | Exact trigger condition |
|---|---|
| First Program | first server-graded PASS of any BLOCK_CODING level |
| Loop Master | 5 distinct levels passed where the submitted program contains `repeat`/`repeat_until` AND the level is tagged `loops` |
| Logic Explorer | 5 distinct passed levels tagged `logic` where the program contains `if`/`if_else` |
| Bug Hunter | 3 distinct DEBUGGING activities passed |
| AI Rookie | first AI_CLASSIFICATION activity passed |
| AI Explorer | all core levels of AI Island completed |
| Pattern Pro | 5 distinct PATTERN_RECOGNITION activities passed with ≥ ★★ |
| Robot Trainer | Robot Lab world completed (all core levels) |
| Data Detective | 5 distinct passed levels tagged `data` (Data Desert modules) |
| ML Beginner | first REAL_ML lab session reaching state `TESTED` (trained + ran a prediction) |
| Seven-Day Streak | streak counter reaches 7 (school-day counting, §6.3) |
| World Champion | any world completed with ★★★ on every core level |

Award UX: never interrupts play mid-level; badges queue and present after the level result screen
(one card, 2 s, skippable), then live in ACHIEVEMENTS (`/achievements`: badge wall with earned
vs. silhouette states + certificates shelf).

### 6.5 Anti-addiction / wellbeing guardrails (decided)

1. No leaderboards, ranks, or peer comparison anywhere in the student product.
2. No loss-aversion mechanics: streak copy is positive-only; no countdown timers to "save" anything;
   no decaying rewards.
3. Session pacing: after 45 min continuous activity, a non-blocking Robo Bunny card: "Great
   building! Stretch break?" (dismissible; never locks anyone out — school lab sessions are
   legitimate long sessions).
4. Daily XP from replays capped (§6.1) so grinding a solved level is pointless.
5. Celebrations are capped in length and frequency (§9); no variable-ratio reward randomness
   (no loot boxes, no mystery chests).
6. No push/email notifications to children, ever. All nudges live inside the app session.
7. Everything above is part of the sales story to schools (wellbeing-by-design), not hidden.

---

## 7. Error / empty / edge-state inventory (per surface)

Global rules: never a blank screen (locked); every async surface has skeleton → content | empty |
error; all error screens offer one retry action + one escape route; Play-theme errors use plain
child language; Pro-theme errors include a correlation ID for support. Offline: a global banner
("No internet — Robo Bunny is waiting for the connection") + the level player keeps working locally
(engine is client-pure) with submissions queued and retried; queued-submission state shown on the
result screen ("Saving your stars when internet returns…").

| Surface | Loading | Empty | Error | Special edge states |
|---|---|---|---|---|
| `/join` | button spinner | — | invalid/expired code; rate-limited cooldown countdown | camera-less QR fallback = type code |
| `/home` | card skeletons | brand-new student: hero says "Start your adventure" | full-page retry card | licence expired → read-only notice "Ask your teacher" (never blames the child) |
| `/adventure` | terrain shimmer | no published curriculum → `build` bunny (§2.4) | retry card | assignment to locked level renders side-quest node; world gate mid-animation refresh-safe (state from server) |
| `/play/[levelId]` | player shell skeleton | — | level load fail → "This level is snoozing" + back-to-map | locked level via URL → friendly lock screen + map link (server-enforced); draft/archived level → 404-style "not on your trail"; sim runtime error → "Robo Bunny got confused — Reset and try again" + auto error report; interpreter step cap hit (infinite loop) → "Your program is running forever! Check your loops" teachable moment card |
| Level result | grading spinner ≤ 1 s | — | server grade fail → retry submit (draft kept) | client-PASS/server-FAIL mismatch → show server verdict neutrally ("Let's double-check — try one more run") |
| `/achievements` | grid skeleton | silhouettes + "Your first badge is waiting" | retry | certificate PDF still generating → "polishing your certificate…" auto-refresh |
| Teacher matrix | virtualized skeleton rows | no students in class → "Ask your school admin to add students" + mailto | retry + correlation ID | student moved class mid-term → history retained, row annotated; > 40 columns → module-collapsed default view |
| Student drill-down | tab skeletons | no attempts yet → "No activity yet — assigned work appears here" | retry | attempt content-version older than current level version → viewer renders against stored version snapshot |
| Assign flow | tree skeleton | no published content for track → contact-admin card | submit retry (idempotent) | due date in past → inline validation |
| CSV wizard | parse progress bar | — | unreadable file / wrong encoding (explicit UTF-8 hint for Arabic Excel exports) | > 2,000 rows → split guidance; job resume on refresh; duplicate re-upload detected via batch hash → "This file was already imported" |
| School dashboard | KPI skeletons | setup mode checklist (§4.1) | retry | seats exceeded on import → wizard blocks with licence contact card |
| NITAQ content builder | form + preview skeletons | empty tree → "Create your first program" | autosave-fail sticky toast (drafts kept locally) | publish with missing `ar` → warning modal; unpublish world with active students → impact summary + require confirm phrase |
| Auth (staff) | — | — | invite token expired → "Ask for a new invite" self-serve resend request | impersonation session expiry mid-action → banner + safe return |
| Public verify page | spinner | — | unknown cert ID → neutral "No certificate found for this ID" (no oracle about formats) | revoked certificate → "No longer valid" state |

---

## 8. Accessibility & reduced motion

- **Keyboard:** full keyboard path for every journey. Level player: Blockly keyboard-navigation
  plugin enabled (arrow/enter block manipulation); `Ctrl/Cmd+Enter` Run, `R` Reset, `H` Hint,
  `Esc` closes drawers. Map: nodes are buttons in trail order (arrow keys walk the trail, world
  dock is a tablist). Focus rings: 3 px brand-indigo outer ring, visible on both themes, never
  `outline: none` without replacement.
- **Touch targets:** ≥ 48 px student surfaces (Run row 56 px), ≥ 44 px Pro.
- **Contrast:** all text ≥ 4.5:1 (body) / 3:1 (large + UI glyphs) on both themes; world colour
  ramps ship with pre-validated text pairings (design tokens include `onColor` values); star gold
  outlined for contrast on light surfaces.
- **Never colour alone:** node states pair colour with glyphs (§2.3), matrix cells with glyphs
  (§3.3), semantic messages with icons + words.
- **Language:** student copy ≈ Grade-3 reading level, sentence case, no idioms that break in
  Arabic; all icons paired with labels (nav shows icon + text).
- **Screen readers:** simulation canvas has an `aria-live="polite"` narration region ("Robo Bunny
  moved forward. Collected a carrot — 2 of 3."), generated from engine events (deterministic engine
  makes narration a pure event-stream transform). Result banners are `role="status"`; celebration
  overlays `role="dialog"` with focus trap + labelled skip.
- **Reduced motion (`prefers-reduced-motion` + in-profile toggle, whichever is stricter):**
  parallax off; node pulse → static glow ring; camera scrolls → instant jumps; celebrations play the
  static composition (final star layout + badge) with sound retained (sound has its own toggle);
  simulation playback keeps *functional* motion (the run IS content) but disables screen-shake,
  confetti particles, and decorative loops; Blockly block-drag animations unaffected (functional).
- **RTL:** full mirror via logical properties; Blockly RTL mode; the grid world does not mirror
  (§1.5); numerals follow locale (Eastern Arabic numerals in `ar` per next-intl formatting);
  PDF pipeline (credentials, reports, certificates) supports RTL text runs — test early, this is
  the classic late-breaking failure.
- **Dyslexia-consideration:** generous letter-spacing on Play body copy, no justified text, no
  all-caps sentences.

---

## 9. Celebration moments (specification)

Global rules: optimistic-start on client verdict, corrected by server (§1.4 P7); every celebration
skippable — **tap/click anywhere or Esc after 0.6 s** skips to the end-state; frequency-capped
(shine sweeps and micro-fanfares don't replay on re-visits); reduced-motion variants per §8; sound
ducked behind the global mute.

### 9.1 Level complete — 2.5 s
0.0 s dim player, result card scales in (spring) · 0.3–1.5 s stars pop in sequence (each: scale +
single particle burst + rising note; earned stars only — unearned shown as sockets, no sad animation)
· 1.5 s XP counter rolls up, streak flame ticks if first activity today · 1.8 s Robo Bunny `cheer`
hops in · 2.5 s settle → card flips to the explanation screen (§1.4 P8). Queued badge cards (if any)
follow, 2 s each, same skip rules.

### 9.2 World complete — ~6 s ceremony
Triggered at the map gate (§2.5): gate doors open (1.5 s) → world emblem forges above the arch with
the world's star tally (2 s) → confetti in world colours + fanfare (1.5 s) → summary card: world
name, stars X/Y, levels n, badges earned in-world, **"See my certificate"** (if milestone) /
**"Enter {next world}"** (1 s in, persists). Fully skippable to the summary card. Replayable
condensed (5 s) from the gate.

### 9.3 Certificate moment
From the ceremony or `/achievements`: certificate renders as a full-screen "paper" with a gentle
sheen sweep (once), student display name, achievement, date, certificate ID + QR (server-generated
asset, locked spec). Actions: Download (PNG/PDF), "Show your teacher" tip. A quiet moment by
design — the ceremony was the party; the certificate is the *proof*, presented with gravitas
(this is also the artefact parents see — it must look premium printed). Teacher and school-admin
dashboards log the issuance the same day (§4.4).

---

## 10. Scope-realism notes for the implementing team

1. The progress matrix (§3.3) and CSV wizard (§4.2) are the two highest-effort Pro surfaces —
   budget them like features, not admin chrome; they carry the school sale.
2. The map's terrain art scales by building **one parametrized segment system** (per-world colour
   ramp + 3 terrain layer variants), not 8 bespoke illustrations.
3. Daily challenge can ship as a thin selector over existing activity types — no new engine.
4. Defer: student password self-change, teacher-student messaging threads, branching trail spurs
   beyond bonus nodes, email report delivery. All have designed seams above.
