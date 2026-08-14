# Build Bunny — Polish & Productionization Plan (2026-08)

Status: ACTIVE. Grounded in a full-codebase inspection performed 2026-08-14
(12 subsystem reads + cross-check). This plan sequences the "premium product"
brief against the code as it actually exists. It does not restate the master
plan (`BUILD-BUNNY-PLAN.md`); where the two disagree on *current state*, this
document is newer.

## 1. What the inspection established

The platform is substantially built and its engineering posture is strong:

- **6 playable worlds, 37 published levels, 11 modules** authored in
  `build-bunny/content/`, imported/published through an idempotent slug-keyed
  pipeline with 8 publish gates (including engine-verified solvability and
  reachability BFS). Two horizon worlds are art-only.
- **9 activity types with real engines** — BLOCK_CODING, DEBUGGING,
  CODE_PREDICTION, SEQUENCING, CONCEPT_CARDS, AI_CLASSIFICATION (real 1-NN),
  PATTERN_RECOGNITION (real k-means), AI_ETHICS (branching), AI_SIM (3
  widgets: boundary-builder, trend-line, pixel-playground). All grading is
  server-authoritative; answer keys are stripped server-side with `.strict()`
  answer-free mirror schemas as a fail-loud second layer. Zero external AI
  API calls anywhere (deterministic engines only).
- **Three staff consoles** (`/teach`, `/school`, `/nitaq`) that are almost
  entirely real: class matrix with 5 deterministic student flags, attempt
  replay via server re-grading, assignments with force-unlock, CSV import
  with dry-run, erasure, certificates with public QR verify, cross-tenant
  user search + audited impersonation, curriculum import wizard + gated
  publishing, platform audit log. Plus a chrome-less projector view at
  `/teach/classes/[classId]/live` (20s polling).
- **Tenant isolation is structural**: non-null denormalized `schoolId`
  everywhere, session-derived scoping, and a registry-driven isolation test
  suite that fails CI when a query escapes it.
- **i18n is genuinely first-class**: en/ar message parity (1096 leaf keys
  each), authored (not machine) Arabic for all student-facing content,
  logical-CSS discipline, deliberate LTR islands, bilingual RTL Blockly.
- **26 test files / 373+ cases** incl. full-curriculum playthrough gates,
  AI winnability brute-force, answer-leakage assertions, idempotency suites.

The premium-experience layer is where the gaps are:

- The bunny is a raw OS emoji; `BunnyMascot` exists but has **zero importers**;
  no SVG artwork, no personality states, no reactions in the player.
- The adventure map is a card/timeline list, not an illustrated world map;
  no game-entry transition (hard cut into the player); no onboarding; no
  page transitions; celebrations are modest (no confetti/sound/XP count-up
  in the success overlay).
- No sound system, no motion-token scale, no daily missions, no cosmetics,
  no sandboxes, no notifications, no student-detail intervention loop
  beyond flags, feature flags have exactly one implemented key
  (`adventure`) and no admin UI.
- **CI has never run once**: the workflow sits at
  `build-bunny/.github/workflows/ci.yml`; GitHub only discovers workflows at
  the repo root (`Nitaq/.github/workflows/`).
- Doc drift: README claims "Node 20 minimum" vs `engines >=22.12`; master
  plan still forbids AI Island being playable; LEARN-STEP-SPEC says
  "designed, not built"; level counts 17/18 appear where reality is 37.

## 2. Brief-to-codebase mapping for the AI games

| Brief name | Reality in code | Work needed |
|---|---|---|
| Train the Bunny | **Exists**: AI_CLASSIFICATION / `TeachPlayer` (real 1-NN, held-out test set) | Polish, hints wiring, autosave, richer feedback |
| Pattern Detective | **Exists**: PATTERN_RECOGNITION / `GroupPlayer` (real k-means) | Add student-prediction-vs-AI compare beat, hints, autosave |
| Classifier Lab | **Partial**: boundary-builder AI_SIM widget | Add retrain/iterate loop, mistake inspection, more levels |
| Train vs Test | **Partial**: hold-out split logic lives inside AI_CLASSIFICATION grading | New activity presenting the split as the *student's* decision |
| Bias Detective | **Absent** (no code, schema, or content) | New engine + content (fictional characters, per brief §12) |
| Feature Engineer | **Absent** as a game (`FeatureBoard` component exists as a display) | New engine reusing FeatureBoard's click-not-drag pattern |
| Neural Network Visualizer | **Absent** | New AI_SIM widget (signal-flow visualization, no math) |
| AI Ethics expansion | **Exists thinly**: engine supports 8 scenes/2-4 choices; only 1 authored level, no scene art | Author scenarios incl. multiple-reasonable-answer branches |

Every new engine/payload field must simultaneously update: Zod payload schema,
`stripStudentPayload`, the `.strict()` student mirror, the server grader, the
player, and the solvability proof — this four-way sync is the #1 regression
surface in the codebase.

## 3. Phases

**Status at 2026-08-14.** Phases 1–4 are done and pushed; Phase 5 has had its
security fix landed but its new games are not built; Phases 6–10 are not
started. Per-phase status markers below are kept honest on purpose — a plan
that claims more than the code does is worse than no plan.

| Phase | Status | Landed in |
|---|---|---|
| 1 · Infrastructure & critical fixes | **Done** | `4c36fd3`, `d8094d4` |
| 2 · Design system, animation, Bunny | **Done** | `c858ec3` |
| 3 · Home, map, game-entry, onboarding | **Done** | `0601580` |
| 4 · Player polish & success/failure | **Mostly done** | `7ba69ec`, `0c6850a` |
| 5 · AI games & engines | **Started** (security fix only) | `7ba69ec` |
| 6 · Teacher experience | **Mostly done** | `c3d1919` |
| 7 · School & NITAQ admin + security hardening | **Partly done** | `83e6082` |
| 8 · Assignments, notifications, missions, cosmetics | Not started | — |
| 9 · Performance, accessibility, tablets, offline | Not started | — |
| 10 · Production QA & demo | Not started | — |

Phase 4 remainder: AI_CLASSIFICATION / PATTERN_RECOGNITION still never emit
PARTIAL (a near miss reads the same as a wild one); GroupPlayer, AiSimPlayer
and AiEthicsPlayer still have no draft autosave (TeachPlayer now does); the
AST-budget infinite loop still surfaces as a generic `runtimeError` rather
than a kid-readable failure.

Phase 7 remainder — **licences are the commercially important gap**. A
licence is immutable after creation (no renew, extend, seat change or
suspend) and, more seriously, **enforces nothing at runtime**: no code reads
`Licence` outside analytics, so an expired or SUSPENDED licence has zero
effect and students keep playing. Seat counts are reported for display but
never checked, so a school can be provisioned past its limit. `graceDays` is
written by its default and read nowhere. Also still open: school profile
editing, the school-admin audit page (`listSchoolAuditLogs` exists and is
isolation-tested but has no route), curriculum publishWorld/transitionStatus
UI and version rollback, and the security hardening items (forced-password-
change proof, MFA for platform roles, sudo re-auth, verified impersonation
audit fields).

Phase 6 remainder: classroom mode is still the existing projector view with
no launch-a-level flow or on-screen controls. Also noted while working: the
Arabic RTL-mark date bug fixed on the student detail page almost certainly
affects the other staff surfaces that format dates the same way — worth a
sweep in Phase 9 rather than one page at a time.

### Phase 1 — Infrastructure & critical fixes (this change)
1. Move `ci.yml` to repo root with `defaults.run.working-directory:
   build-bunny` and `cache-dependency-path: build-bunny/package-lock.json`;
   pin Node 22.12; push and confirm GitHub actually runs it.
2. Standardize Node 22.12+: README, `.nvmrc`, CI. (Dockerfile `node:22-alpine`
   already satisfies it.)
3. Documentation truth-up (append, never rewrite history):
   - BUILD-BUNNY-PLAN.md: dated status addendum marking §0.1-4 (AI Island
     must not be playable) and the G/H deferral as **superseded**; AI worlds
     shipped through the ordinary grading pipeline without the G/H tables.
   - LEARN-STEP-SPEC.md status header → implemented; stale "17 levels".
   - design/ai-ml.md header → partially superseded, pointer to
     `build-bunny/docs/ai-data-flow.md` (the as-built record).
   - README: architecture tree (15 modules, `src/engine`, `content/`),
     commands table (demo:reset, dev:skip-to, load-check), health shape,
     docs index. operations.md/demo-script.md: stale counts (18 → 37).
   - `prisma/schema.prisma` ActivityType comment ("no V1 engine behind
     these" now false for 6 of 9 listed types).
4. Add the missing en/ar **message-parity test** so every later phase that
   adds UI keys is guarded (currently parity is convention only).
5. Security review pass: documented findings (below), fixes scheduled.
6. Vercel: document required configuration (root dir `build-bunny`, Node 22,
   env vars, `prisma migrate deploy` as a release step, not build step).

**Security findings logged for remediation** (Phase 1 documents; later
phases fix): pixel-playground `rounds[].src` ↔ `images[].src` identity makes
mystery-round answers recoverable in DevTools (fix with engine work, Phase
5); `markPasswordChanged` clears the forced-change flag without proof
(Phase 7); no MFA/sudo for platform admins (Phase 7); impersonation audit
row records client-supplied schoolId unverified (Phase 7); per-process rate
limiters degrade under multi-instance deploys (documented constraint).

### Phase 2 — Design system, animation primitives, Bunny character
- Real SVG bunny with articulated states (idle, thinking, excited,
  celebrating, confused, pointing, jumping, running, waving, sleeping,
  surprised) behind the existing `BunnyMascot` API; replace all raw-emoji
  call sites so there is one upgrade point.
- Motion token scale (durations/easings — the signature
  `cubic-bezier(0.16,1,0.3,1)` is currently copy-pasted); reusable animation
  primitives (XPBurst, StarBurst, AchievementUnlock, PageReveal,
  WorldTransition, MissionIntro); a shared `useReducedMotion` hook replacing
  the per-file matchMedia convention.
- Opt-in sound system (tiny synthesized/short samples, off by default,
  preference persisted; never autoplay).
- Constraints: keep the three-layer token architecture; Blockly `theme.ts`
  duplicates brand hexes literally (generate or document the bridge);
  respect the global reduced-motion clamp layering.

### Phase 3 — Student home, world map, game-entry transitions
- Illustrated layered world map: per-world scenery (meadow/forest/lab/
  island/desert/ml-lab), animated nodes, bunny "you are here" marker (the
  `.hereMarker` CSS is currently orphaned), bunny hops to next node on
  completion, world progress %.
- Game-entry transition (1–2s, skippable, reduced-motion aware): node
  reacts → bunny runs across themed backdrop → level title/objective →
  Start Mission. Builds on the existing IntroOverlay beat.
- Student home: Continue Adventure CTA, daily-mission slot (flag-gated until
  Phase 8), recent achievement, XP count-up.
- First-run onboarding sequence (bunny introduces map/XP/stars/hints).

### Phase 4 — Player polish & success/failure experience
- Level-complete screen: stars, XP count-up, achievements, performance,
  bunny reaction, "what you learned" line, Next Mission / Try Again / Back
  to Map.
- Per-player parity fixes found in inspection: TeachPlayer and GroupPlayer
  have **no hint UI** (hints authored there are unreachable); none of the 4
  AI players autosave drafts (grid levels do); AI_CLASSIFICATION /
  PATTERN_RECOGNITION never emit PARTIAL while AI_SIM does.
- Failure experience: kid-friendly located failure for the AST-budget
  infinite-loop case (currently generic "runtimeError").

### Phase 5 — AI games & engines (see mapping table above)
- New engines: Bias Detective, Feature Engineer, Train vs Test, Neural
  Network Visualizer widget; expansion: Classifier Lab loop, Pattern
  Detective compare beat, AI Ethics scenario pack with scene art.
- Fix the pixel-playground src-identity answer leak.
- Content depth: ML Lab beyond 3 levels; AI-concept CONCEPT_CARDS learn
  steps (currently only the 5 coding concepts have them).
- Sandboxes behind new feature flags: AI Playground + Bunny Code Playground
  (Blockly free-play with save/load).
- Prereq: content tests hard-code `levelCount === 37` and the world list —
  build the "validate whatever exists" mode first, keep explicit counts as
  a separate curriculum-freeze assertion.

### Phase 6 — Teacher experience
- Dashboard analytics (class progress over time, most-difficult level,
  needs-support list — no public child ranking).
- Student detail page with deterministic Suggested Intervention rules built
  on the existing 5-flag engine.
- Classroom mode: extend the existing projector view with launch-a-level
  demo flow and large-UI controls.

### Phase 7 — School & NITAQ administration + security hardening
- Feature-flag admin UI (School.features currently has no surface; flags
  ship disabled otherwise), licence management (renew/extend/seats —
  currently read-only after creation), school profile editing (permission
  exists, unused), school-admin audit page (query exists, no route),
  platform certificate registry + revoke (revokedAt is read, never set).
- Curriculum console: wire existing `publishWorld`/`transitionStatus` to UI;
  version rollback surface.
- Security: forced-password-change proof, MFA for platform roles, sudo
  re-auth for erasure/impersonation, verified impersonation audit fields.

### Phase 8 — Assignments, notifications, missions, cosmetics
- Notification model + in-app center (teacher/school/NITAQ/student events;
  no email infra exists — in-app first).
- Per-assignment progress rollup for teachers; assignments on student home.
- Daily missions (no punitive streak mechanics) + bunny cosmetics unlocked
  by achievements/XP (no microtransactions). `User.avatarId` exists but is
  a dead column — define semantics before building on it.
- DB changes concentrated here: Notification, AssignmentProgress (or
  derived), Mission/MissionProgress, CosmeticItem/StudentCosmetic tables.

### Phase 9 — Performance, accessibility, tablets, offline
- Tablet audit (1024×768, 1180×820, portrait/landscape): Blockly drag,
  AI-widget touch targets, modals, map. (Currently unaudited product-wide;
  one component — FeatureBoard — deliberately chose click-over-drag.)
- Bundle audit, lazy-loading verification, image optimization.
- Offline: queued/persisted unsent attempts (idempotency already makes
  replay safe), connection indicator, autosave for AI players.
- Digit-policy consistency (2 pages render Arabic-Indic numerals against
  the glossary's Western-digits rule); English-only server error strings.

### Phase 10 — Production QA & demo
- Visual QA matrix (desktop/laptop/tablet × en/ar) across all key screens.
- Demo script refresh: it currently never mentions the AI worlds — the
  platform's differentiator is absent from the sales script.
- Production-readiness audit against operations.md; error-page inventory
  (`error.tsx`/`not-found.tsx` per segment — current state unverified).

## 4. Standing constraints (from the inspection — do not violate)

1. Server remains sole authority for verdict/stars/XP/unlocks; client
   verdicts stay telemetry.
2. The strip/mirror/grader/player four-way sync per activity type.
3. Append-only XP ledger semantics and `attemptRunId` idempotency;
   `resultSummary` replay compatibility.
4. LevelVersion snapshots are immutable; never reorder existing curriculum
   (positional seed history), only append.
5. Every new server query registers in `tenantScopedQueries`; every new
   module keeps schoolId session-derived.
6. `ENGINE_VERSION` bumps on any engine semantic change.
7. next-intl middleware stays auth-free; CSP stays in next.config.ts only;
   `nextCookies()` stays last in the Better Auth plugin list.
8. Reduced-motion: every new JS animation joins the matchMedia convention
   (or the shared hook once Phase 2 lands).
9. en/ar parity for every new message key; Arabic authored, not machined;
   Western-digits policy via `-u-nu-latn`.
10. No external AI APIs without explicit approval + ai-data-flow.md
    revision (standing rule §0.1-21).
11. `docs/build-bunny/BUILD-BUNNY-PLAN.md` is a decision record — append
    amendments, never rewrite adjudicated history.
12. Feature-flagged rollout for anything unfinished; no fake features.
