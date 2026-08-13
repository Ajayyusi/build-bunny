# BUILD BUNNY — Master Architecture & Product Plan

**Version 1.1 · Prepared for NITAQ Academy · Status: APPROVED with owner amendments (2026-08-09) — implementation authorized**

This is the consolidated plan covering deliverables A–Q. It was produced from eight deep
domain design documents (in `design/`) plus a cross-document coherence review; every
conflict found in review has been **adjudicated here** — where this document and a design
appendix disagree, **this document wins**. The appendices remain the full-detail reference.

| Appendix | Contents |
|---|---|
| `design/db-architecture.md` | Full Prisma/PostgreSQL schema (~30 models), indexes, retention |
| `design/coding-engine.md` | Blockly + simulation + execution + grading engine, block/check registries |
| `design/security-rbac.md` | Permission matrix, auth, tenancy enforcement, PDPL, audit, licences |
| `design/routes-structure.md` | Route map, folder structure, component architecture |
| `design/ux-journeys.md` | Journeys ×4, screen layouts, gamification rulebook, celebrations |
| `design/curriculum-content.md` | Curriculum model + all seed levels fully authored |
| `design/ai-ml.md` | AI Lab, real ML Lab, Bunny Guide assistant |
| `design/spec-critique.md` | Advisor critique of the original specification |

---

## 0.1 Owner approval & binding amendments (2026-08-09)

The owner approved the architecture and the V1 scope cut with the following amendments.
**These supersede anything below or in the appendices that conflicts.**

1. **Authentication — no home-grown security primitives.** Sessions, cookies, CSRF,
   password hashing, login rate limiting, and session revocation are delegated to a
   mature, well-tested auth framework (**Better Auth** + Prisma adapter: DB-backed
   revocable sessions, secure cookie handling, built-in login throttling, admin plugin
   for account disable/impersonation/session revocation, username plugin). The **custom
   layer is the student identity/provisioning model only**: school-scoped usernames
   (stored namespaced `{schoolCode}__{username}` for global uniqueness; the student login
   form composes school code + username), teacher/admin credential resets, forced
   password change on next login, account disable, and an audit trail of all account
   administration. No student emails, ever. The appendix design for hand-rolled session
   token storage is superseded; its *policies* (per-role lifetimes, lockout behaviour,
   student credential UX) still apply, implemented through the framework's configuration.
2. **Content architecture.** The **database is the permanent source of truth** for
   Program/World/Module/Level/activity payloads/hints/success conditions/rewards/
   translations. JSON files are a seed/import *format* feeding the same publish pipeline —
   never a runtime content source. A future admin editor mounts on the same model with no
   engine redesign.
3. **V1 content bar.** 3 complete worlds, 15 genuinely polished levels forming one
   coherent progression (15 excellent > 25 mediocre). Every level ships the full field
   set: story, objective, instructions, Blockly config, simulation config, success
   conditions, 4 hints, failure feedback, completion explanation, XP, stars, estimated
   time, teacher notes, English content, Arabic-ready fields.
4. **V1 worlds:** W1 Bunny Meadow (coding foundations) · W2 Logic Forest (loops,
   sequencing, conditions **and debugging**) · W3 Robot Lab (**variables**, sensors,
   decision logic, advanced challenges). AI Island may appear as horizon art on the map
   but must not behave like an available area. **No fake AI screens, no empty AI Lab, no
   "coming soon" buttons in the main student experience.**
5. **Student experience is priority #1.** The login → home → map → level → run →
   simulation → feedback → celebration → XP/stars → map-progression journey gets the
   deepest design investment; the first five demo minutes must be impressive.
6. **Engine.** Server-authoritative grading confirmed as non-negotiable; the
   workspace → normalized representation → deterministic execution → grading → progress
   transaction → rewards pipeline stays cleanly separated, and the simulation/grading
   engine stays independent of React.
7. **Activity engines V1:** BLOCK_CODING, CODE_PREDICTION, DEBUGGING, **SEQUENCING**
   (QUIZ moves out of V1). Registry supports clean later registration of QUIZ, PATTERN,
   CLASSIFICATION, ML_EXPERIMENT, CREATIVE_PROJECT — extension points only, no
   half-built engines.
8. **Teacher dashboard is required V1**: per class — started/not started, progress %,
   current world/level, stars, attempts, hint usage, last activity, needs-help flags;
   click-through to per-student detail.
9. **School admin stays lean** (school, academic year, teachers, students, classes,
   memberships, CSV import, credential reset, deactivation, basic reporting). No
   enterprise admin features in V1.
10. **NITAQ admin stays functional and clean** (schools, activation, school admins,
    users, licence info, curriculum publishing, basic analytics, audit visibility).
11. **Tenant isolation is non-negotiable**; automated isolation tests land in
    Milestone 1, not QA.
12. **Database:** smallest strong schema per milestone with hard domain boundaries
    (identity/schools/curriculum/learning/progress/gamification/certificates/analytics)
    and clean migration history. Consequence: the phase-G/H AI-ML tables
    (AIConversation, AIMessage, AIUsageLog, MLExperiment, MLDataset) are **deferred to
    their phases**; V1 keeps only `Level.track` and school-level feature flags.
13. **Progress transactions are idempotent** — replayed completion requests can never
    double-award XP/stars/achievements/certificates.
14. **Analytics event architecture from Milestone 1**: append-only `LearningEvent`
    stream (LEVEL_STARTED, RUN_EXECUTED, RUN_FAILED, RUN_SUCCEEDED, HINT_USED,
    LEVEL_COMPLETED, WORLD_COMPLETED, ACHIEVEMENT_EARNED, STUDENT_LOGIN) with minimal
    payloads — no sensitive workspace/student content in events.
15. **Certificates:** unguessable IDs and minimal public verification info (confirmed
    as designed).
16. **Projector/demo mode approved** — a classroom/projector-friendly display of real
    levels reusing the real engine (no separate fake demo build).
17. **Arabic:** architecture + localization-ready UI from Milestone 1; level content
    finalized in English first, then professionally reviewed in Arabic; never blindly
    auto-translate educational terminology.
18. **Tablet is a core engine requirement** — test drag/drop, toolbox, scrolling,
    touch, orientation, and viewport height on tablet-sized viewports *during* engine
    development.
19. **Responsiveness tiers:** student = desktop/laptop/tablet first-class; staff =
    desktop/laptop first-class, tablet usable; phones = basic account/progress pages
    only (no Blockly optimization for phones in V1).
20. **Feature flags** gate all unfinished future features (AI LAB, ML LAB, BUNNY
    GUIDE, COMPETITIONS, PARENT PORTAL) so nothing appears in production accidentally.
21. **AI/ML privacy:** before any AI/ML feature is implemented, document exactly what
    data would leave the browser; no children's content to any LLM/API implicitly.
22. **Design:** distinctive student product identity (premium, playful, modern,
    simple, adventurous — not preschool); admin may be SaaS-like; restrained use of
    gradients/glass/animation; interaction quality and hierarchy first.
23. **Design system before pages**: typography, spacing, radius, button hierarchy,
    forms, cards, nav, status states, reward components, modal/toast behaviour,
    breakpoints, RTL behaviour — then reuse consistently.
24. **Full state coverage** (loading/empty/error/permission-denied/locked/success/
    failure) for every meaningful feature.
25. **Seed environment:** one excellent demo — **NITAQ Demo School**, classes
    **Grade 3A** and **Grade 4A**, 2 realistic teachers, 10–20 realistic students at
    varied progress points so analytics screens look real in demos.
26. **QA per milestone:** run locally, build, lint, typecheck, tests, browser console,
    server logs, access control, responsive behaviour — verified, not assumed.
27. **Visual QA** of every important screen (student home, map, level, level-complete,
    achievements, teacher dashboard, student detail, school admin).
28. **Milestone rule:** one major milestone at a time; start report (building/files/DB
    changes/risks) and end report (completed/tested/failed-fixed/limitations/next).
29. **V1 success criteria** = the end-to-end principal demo: create school → class →
    student account → student login → adventure map → level → Blockly program → run →
    simulation → useful failure feedback → success → stars/XP → next level unlocks →
    teacher sees updated progress immediately → certificate earned → certificate
    verifies publicly.
30. Plan updated (this section), then **Milestone 1 begins**; Milestone 2 does not
    start until M1 is genuinely complete and tested.

## 0.2 Status addendum (2026-08-14) — superseded scope decisions

The amendments in §0.1 remain the historical decision record; nothing above is
rewritten. The following decisions have since been **superseded by shipped
work** and no longer describe the product:

- **§0.1-4 (AI Island as horizon art only) — superseded.** AI Island, Data
  Desert, and ML Lab shipped as playable worlds (~15 AI/ML levels using the
  AI_CLASSIFICATION, PATTERN_RECOGNITION, AI_SIM, and AI_ETHICS activity
  types). They run through the **ordinary server-authoritative grading
  pipeline** — none of the deferred Phase G/H tables (MLExperiment,
  AIConversation, etc., §0.1-12) were added, and no external AI API is called
  anywhere; every engine is deterministic and local. The as-built data-flow
  record is `build-bunny/docs/ai-data-flow.md` ("Phase G — shipped"), which
  also carries the standing rule that it must be revised before Phase H or
  Bunny Guide ship (§0.1-21 remains in force).
- **`design/ai-ml.md` "design now, build later" — partially superseded.**
  Phase G shipped with a different shape than that design (activity-engine
  registry + widget system rather than the Lab tables). The design doc
  remains the reference for the unbuilt Phase H and Bunny Guide.
- **`LEARN-STEP-SPEC.md` "designed, not built" — superseded.** CONCEPT_CARDS
  Learn steps are implemented (`src/modules/activities/players/LearnPlayer.tsx`)
  and shipped for the five coding concepts.
- **V1 scope "3 worlds / 15 levels" — outgrown.** The curriculum now defines
  6 playable worlds / 37 levels across 11 modules (plus 2 art-only horizon
  worlds). Documents citing 17 or 18 levels predate the AI worlds.
- Ongoing sequencing is tracked in `IMPLEMENTATION-PLAN-2026-08.md` (polish
  and productionization phases); this plan stays authoritative for the
  original architecture decisions and their adjudication.

---

## 0. Executive summary & advisor's verdict

Build Bunny is architected as a **multi-tenant school SaaS** whose heart is a
**server-authoritative coding playground**: children assemble Blockly programs, a
deterministic pure-TypeScript grid-world simulates them on Canvas, and the **server re-runs
the identical engine** to grade, award XP/stars, unlock levels, and issue certificates —
the client is never trusted with learning outcomes. Around that core: an adventure map
driven by real progress, teacher/school-admin/NITAQ analytics, Arabic/RTL from day one at
the architecture level, and honest AI/ML labs (in-browser training, no child data leaving
the device) arriving in later phases behind seams built now.

**Verdict on the spec:** the product vision is right and sellable, but the 20-item "MVP"
list is a 3.5–5 month build, not the vendor proposal's 30–40 days. The single biggest risk
is **not code — it's content**: 15 bilingual, playtested levels with stories, hints, and
explanations are the critical path, and the spec assigns no owner to them. Second biggest:
**iPad Safari** is where UAE school demos happen; it must be a first-class test target from
phase C, not a phase-L checkbox. This plan proposes a **V1 cut** (§15) that preserves the
complete school sales demo while deferring breadth.

---

## 1. Adjudication record (binding decisions)

Design was produced by parallel domain teams; the coherence review found the conflicts
below. Each is decided here — implementers should treat this table as law.

### 1.1 Blockers resolved

| # | Conflict | Decision |
|---|---|---|
| B1 | Carrot collection mechanic (explicit `bb_collect` block vs auto-collect on tile entry) | **Auto-collect in Worlds 1–2** (fewer concepts at once; curriculum's 5×4 Carrot Collector spec is canonical). `bb_collect` debuts in World 3 Robot Lab as a taught mechanic. `curriculum-content.md` **owns all seed-level payloads**; the engine doc's Carrot Collector example is superseded. |
| B2 | Curriculum schema shape (two Prisma designs) | Merged: **PROGRAM → WORLD → MODULE → LEVEL**, worlds reusable across programs via **`ProgramWorld` ordered join** (enables grade-band packaging); Level = typed columns for universal/queryable fields (title, slug, difficulty, xpReward, estimatedMinutes, status, track, tags) **plus one `payload` JSONB** per activity type validated by per-type Zod schemas; versioning = immutable **`LevelVersion`** publish snapshots with `Level.publishedVersionId`; prerequisites = **linear-by-order default** + optional explicit `LevelPrerequisite` edges + `Module.unlockRule` + assignment force-unlock (`unlockSource: ASSIGNMENT`). |
| B3 | Multi-variant maps (seed levels 8–10 need them; engine schema lacked them) | **Ratified into the MVP engine**: `variants[]` in the level definition; the same program must pass **all** variants; check severities evaluate per-variant and aggregate. This is what makes `If` and `Repeat Until` honest instead of memorizable. |
| B4 | Rock bump: run-ending FAIL vs non-fatal bump event | **Bump = run-ending FAIL** with located feedback ("Robo Bunny bumped a rock at step 3") — teaches error-reading. Engine keeps a per-level `nonFatalBumps` flag (default false) for later worlds. |

### 1.2 Major adjudications

| Area | Decision |
|---|---|
| Attempt storage | **Inputs, not frames**: attempt stores submitted workspace JSON, server-regenerated code, compact engine-result summary, `termination`, `blockCount`, `viaImpersonation`, engine + level versions. Replay = deterministic re-run (free). No persisted event logs. |
| Version pinning | Attempt pins `levelVersionId` **at start**; every run of that attempt grades against the frozen snapshot even if a republish lands mid-attempt. |
| Workspace autosave | `StudentProgress.draftWorkspace` JSONB + `draftSavedAt`, written by debounced `saveWorkspaceDraft` action — classroom wifi reality. |
| Server code layout | **Module-local** `src/modules/<domain>/server/{queries,actions,service}.ts` (matches locked structure) with the security doc's rules applied inside it: ctx-first signatures, compound `schoolId` where-clauses, Prisma imports ESLint-fenced to `modules/*/server/**` + `src/lib/db.ts`, tripwire client extension, registry-complete two-school isolation test suite. |
| Route vocabulary | `routes-structure.md` is canonical for paths and group names. Additions from UX: `/welcome` (student onboarding), `/school/setup` (admin checklist). Group names `(public) (auth) (student) (staff) (platform)`. |
| PARTIAL semantics | Core/secondary/quality check severities (engine doc), evaluated per-variant and aggregated. PARTIAL = all core pass, ≥1 secondary fails ⇒ 1 star. **PARTIAL unlocks the next level** (momentum; node nudges "try again") but world certificates require full PASS on every level. |
| Check & block registry | `coding-engine.md` owns one canonical registry: camelCase check ids (`reachedGoal`, `collectedAll`, `avoidedTiles`, `usedBlock`, `notUsedBlock`, `maxBlocks`, `variableEquals`, `expectedOutput`, `expectedSequence`, `classifierResult`) and `bb_*` block ids. All JSON examples elsewhere are regenerated from it. |
| Streaks | **School-day streaks**: Mon–Fri default in school timezone (default Asia/Dubai), weekends/holidays auto-freeze; NITAQ-managed UAE holiday calendar platform-wide + per-school overrides (`School.weekStructure`, `SchoolHoliday`); **one silent repair per month**; positive-only copy. DB streak transaction computes "previous school day", not "yesterday". |
| Roster privacy | **The roster is never displayed at login or join.** Credential cards (QR pre-fills school/class code) are primary; class-code join uses roster-**match** (student types their name; server matches; no list shown). Shared iPads: fast-switch returns to student-login with school code remembered, never names. |
| CSV contract | Columns: `student_identifier` (required — school's own ID, powers dedupe/update), `first_name`, `last_initial`, `grade`, `class_name`, optional `username`. Display name derived "First L.". Files containing **any unrecognized column are rejected** with the columns named — schools must not even transmit DOB/email/phone. |
| Sessions & licences | **Amended by §0.1-1:** auth primitives delegated to Better Auth (DB-backed revocable sessions, secure cookies, built-in throttling, admin plugin). Security doc's *policies* still apply as configuration: student 12 h absolute / 4 h idle; staff per its table. Licence ladder **ACTIVE → GRACE(30d) → READ_ONLY → SUSPENDED (manual)**; automated data loss never. |
| Certificate verify | Public URL/QR uses the **unguessable `verifySlug`**; the printable serial (BB-2026-XXXXXX) is a human reference only, never a lookup key. |
| XP economy | Difficulty-derived defaults (Easy 50 / Medium 75 / Hard 100 XP), per-level override allowed; XP on first PASS; replays award only star-improvement delta (+10/star). Values live in a code constants file, not a config table (V1). |
| Achievements | `Achievement.criteria` JSON is the single trigger source; `Level.tags` added to support tag-based triggers (Loop Master = pass 5 distinct levels tagged `loops`). All 12 seeded badges get one agreed rule each. |
| Hints | Server-held (never in the shipped payload); 4 tiers; tier n>1 unlocks after a failed attempt **or** 60 s (visible countdown in the drawer); tiers 1–2 never affect stars; tiers 3–4 cap that run at 2 stars; stars are high-water-mark across runs. |
| Impersonation | Full impersonation **NITAQ/SUPER only**: 30-min non-renewable dual-identity session, read-mostly allowlist, sandboxed submissions (`viaImpersonation`, excluded from XP/analytics), persistent banner, fully audited. Teachers get **read-only view-as** (session `viewAs.readOnly`; data layer rejects mutations). |
| Grading endpoint | Route handler `POST /api/levels/[levelId]/attempts`; rate limit 30/min/student; budgets: 100k interpreter steps, 1,000 world commands (per-level override), 2 s wall clock; idempotent via client-generated `attemptRunId`. |
| AI/ML seams | **Amended by §0.1-12:** V1 schema keeps only `Level.track` enum (`PROGRAMMING / AI_CONCEPTS / MACHINE_LEARNING`) with the publish-time lint (ML label ⇒ REAL_ML engine only) and school feature flags. The phase-G/H tables (`SchoolAISettings`, `MLDataset`, `MLExperiment`, `AIConversation`+`AIMessage`, `AIUsageLog`) land in their own phase migrations per `ai-ml.md`. |
| Codes | Class/join codes: 8-char Crockford base32, displayed grouped (`BB-XXXX-XXXX`). No word-based codes. |
| Smaller drifts | Single `ClassMembership` table with role; security's AuditLog shape (DB-grant append-only, `requestId`, `outcome`); avatar = `avatarId` + colour from built-in set; `Announcement` gains CLASS scope (teacher class announcements **off** in V1); permission vocabulary = security's `resource:action` catalog extended with `curriculum:translate-review`, `ai:guide`; `withAuth(permission, schema, handler)` three-arg form everywhere. |

### 1.3 Scope adjudications (spec-critique cuts vs designed features)

| Feature | Decision for V1 |
|---|---|
| Daily challenge | **Cut.** Home card becomes "Recommended next" (query-driven). Returns post-launch when the level library can sustain it. |
| AI LAB in student nav | **Hidden until phase G ships.** The adventure map shows AI Island & friends as named, art-complete **horizon islands** (visible roadmap, no dead nav). |
| Playground | **Kept, minimal**: one autosaved free-play sandbox (all blocks, open grid). Multi-project CRUD later. |
| Visual level editor | **Deferred to F2.** V1 content authoring = typed JSON fixtures + admin import with dry-run, **mandatory test-play in a preview harness**, and the machine publish gates (server solution re-run, BFS reachability, star monotonicity, author≠approver). The gates survive the editor deferral. |
| Seed scope | **3 worlds / 15 levels** (Bunny Meadow + Logic Forest + Robot Lab). Per §0.1-4: W2 carries loops/sequencing/conditions **and debugging**; W3 introduces variables, `bb_collect`, sensors, decision logic — the first CODE_PREDICTION / SEQUENCING activities appear across W2–W3 so the demo shows breadth. |
| Activity engines in V1 | **4** (per §0.1-7): BLOCK_CODING, CODE_PREDICTION, DEBUGGING (same player, pre-broken workspace), SEQUENCING. Registry extension points for QUIZ, PATTERN, CLASSIFICATION, ML_EXPERIMENT, CREATIVE_PROJECT — no half-built engines. |
| Certificates | **One polished template**, world-completion trigger. The 4 named certificate types exist as data; only world completion is seeded. |
| Demo strategy | Build the **resettable mid-journey demo school** (demo students with realistic progress; one-click reset) — cheap, decisive for sales. |

---

## 2. (A) Product architecture

**System shape:** one Next.js 15 application (App Router, TypeScript strict, React 19),
one PostgreSQL 16 database (Prisma), Docker-deployed, UAE-region capable, object storage
behind a driver. No microservices — clean in-process module boundaries instead, with the
simulation engine kept pure so it can be extracted later.

```
┌─────────────────────────── Next.js app ───────────────────────────┐
│  (public)  (auth)  (student·Play)  (staff·Pro)  (platform·Pro)    │
│ ───────────────────────────────────────────────────────────────── │
│  src/modules/*  — auth · schools · classes · students · curriculum│
│    learning · blockly · grading · achievements · certificates     │
│    analytics · ai · ml · shared     (each: components + server/)  │
│ ───────────────────────────────────────────────────────────────── │
│  src/engine/  pure deterministic grid-world (no DOM, no deps)     │
│    ── runs in browser (Canvas playback) AND on server (grading)   │
│ ───────────────────────────────────────────────────────────────── │
│  src/ui/ design system (tokens → Play/Pro themes) · src/lib/*     │
└──────────────┬───────────────────────┬────────────────────────────┘
        PostgreSQL 16 (Prisma)   Object storage driver (disk│S3)
```

**The one invariant everything hangs on:** clients submit only Blockly **workspace JSON**.
The server reloads it in headless Blockly, regenerates the JavaScript, executes it in a
sandboxed JS-interpreter against the same `src/engine` build, and only that result awards
anything. Client execution is instant-feedback animation, nothing more.

**Seam owners:** schema → db doc; engine semantics + check/block registries → engine doc;
paths/folders → routes doc; gamification policy values → UX doc; seed payloads →
curriculum doc. All post-adjudication (§1).

## 3. (B) Database architecture

Full schema in `design/db-architecture.md` (as amended by §1). Entity catalog:

- **Identity/auth (via Better Auth + extensions, per §0.1-1):** Better Auth's `User` /
  `Session` / `Account` / `Verification` models, with `User` extended by our columns
  (role enum, STAFF|STUDENT discriminator, schoolId, namespaced school-scoped username,
  displayName, status/disabled, mustChangePassword). Session revocation, cookie
  security, and login throttling are framework-provided; impersonation via the admin
  plugin's `Session.impersonatedBy`.
- **Tenancy:** `School` (branding, timezone, weekStructure, onboarding mode),
  `SchoolHoliday`, `Licence` (seats, term, status ladder), `SchoolProgram` (curriculum
  enablement per school), `SchoolAISettings`.
- **School structure:** `AcademicYear`, `Class` (unique 8-char code), `ClassMembership`
  (role), `StudentProfile` (displayName, studentIdentifier, grade, avatarId, XP/star/streak
  caches, programId, onboardedAt), `TeacherProfile`, `ImportJob`.
- **Curriculum (platform-global):** `Program` (grade-band attrs), `ProgramWorld` (ordered
  join), `World`, `Module`, `Level` (typed columns + per-activity-type `payload` JSONB +
  `track` + `tags`), `LevelVersion` (immutable publish snapshots), `LevelPrerequisite`.
  All content text is `{ en, ar?, arHash }` JSONB with staleness-driven translation tracking.
- **Learning:** `StudentProgress` (per student×level: status, high-water stars, draft
  workspace, unlockSource), `ActivityAttempt` (workspace, regenerated code, result summary,
  grade, stars, xp, duration, hintTierUsed, termination, blockCount, viaImpersonation,
  levelVersionId, engineVersion, gradeMismatch telemetry), `HintUsage`, `Assignment` (+
  per-student status), `TeacherFeedback`, `StudentDailyActivity` (streak + time-series).
- **Gamification:** `XpEvent` append-only ledger (idempotent via partial unique indexes) +
  cached totals; `Achievement` (criteria JSON), `StudentAchievement`.
- **Recognition:** `Certificate` (frozen display fields, serial, unguessable verifySlug,
  revocable).
- **Analytics:** `LearningEvent` append-only stream (per §0.1-14: LEVEL_STARTED,
  RUN_EXECUTED, RUN_FAILED, RUN_SUCCEEDED, HINT_USED, LEVEL_COMPLETED, WORLD_COMPLETED,
  ACHIEVEMENT_EARNED, STUDENT_LOGIN; minimal payloads, no workspace content),
  `StudentDailyActivity`.
- **Platform:** `AuditLog` (append-only via DB grants), `Announcement` (platform/school/class
  scope), `ErasureRequest`, `School.features` JSONB feature flags (§0.1-20).
- **AI/ML (deferred to phases G/H, §0.1-12):** `AIConversation`+`AIMessage`, `AIUsageLog`,
  `MLExperiment`, `MLDataset`, `SchoolAISettings` — designed in `ai-ml.md`, migrated when built.

**Tenancy rule:** every learning-data table carries a denormalized non-null `schoolId`
(join-free school analytics; zero-code-change RLS enablement later — `withTenantTx` already
sets `app.current_school_id` GUC per transaction). Curriculum + achievements are
platform-global. **Children's data:** exact-field inventory (security doc §7.1); erasure =
one User hard-delete with cascades; certificates survive with frozen display name (default —
owner may flip); attempt payloads pruned after a per-school retention window while grades
persist.

## 4. (C) Route map

Canonical map in `design/routes-structure.md` §2. Summary (all under `/[locale]`,
`localePrefix: as-needed` — clean English URLs, `/ar/...` for Arabic):

- **(public):** `/` landing · `/verify/[slug]` certificate verification · `/legal/*`
- **(auth):** `/login` (+ forgot/reset) staff · `/student-login` (school code → username +
  secret) · `/join/[code]` class-code join
- **(student)** — Play theme; shell nav HOME · ADVENTURE · PLAYGROUND · ACHIEVEMENTS ·
  PROFILE (AI LAB appears when phase G ships):
  `/home`, `/welcome` (first-run onboarding), `/adventure`, `/adventure/[worldSlug]`,
  `/achievements`, `/profile`; immersive (no chrome): `/play/[levelId]`, `/playground`,
  later `/ai-lab/[moduleSlug]`
- **(staff)** — Pro theme. Teacher `/teach`: dashboard, `/teach/classes/[classId]`
  (overview · students ProgressMatrix · assignments), `/teach/classes/[classId]/students/[studentId]`
  (attempt timeline, read-only Blockly review, feedback), `/teach/assignments`, `/teach/reports`.
  School admin `/school`: dashboard, `/school/setup` checklist, teachers, students
  (+credential sheets), classes, `/school/imports` (CSV wizard + history + rollback),
  `/school/curriculum`, `/school/reports`, `/school/profile`
- **(platform)** `/nitaq`: dashboard, schools (+licence/admins/usage tabs), licences,
  users (+impersonation), curriculum builder (programs → worlds → levels; JSON import + preview
  harness in V1, visual editor F2), achievements, certificates, announcements, audit log, settings
- **API route handlers:** `POST /api/levels/[levelId]/attempts` (grading), `/api/imports`
  (+status), `/api/certificates/[id]/file`, `/api/verify/[slug]`, `/api/exports/[key]`,
  `/api/files/[...key]`, `/api/health`, reserved `/api/ai/guide` (SSE). Everything else =
  Zod-validated `withAuth` server actions (catalog in routes doc §2.6).

Middleware is optimistic-only (locale + cookie presence); authoritative auth lives in
layout guards + cached `getSessionContext()` + the tenant-scoped data layer.

## 5. (D) Role/permission matrix

Full matrix in `design/security-rbac.md` §1.2 (M=manage, R=read, W=write; scope in
parentheses). Condensed:

| Resource | SUPER | NITAQ | SCHOOL_ADMIN | TEACHER | STUDENT |
|---|---|---|---|---|---|
| Schools & licences | M | M | R+W profile (own) | R name | – |
| Staff users | M | M | M (school) | R directory | – |
| Students | M | M | M (school) | W (own classes: create, reset password, display name) | R+W avatar/prefs (self) |
| Classes | M | M | M (school) | W (own: roster, code rotate) | R membership |
| Curriculum content | M+publish | M+publish | R published | R published + teacher notes | R published+assigned |
| Assignments | R | R | M (school) | M (own classes) | R (self) |
| Attempts/progress | R (support) | R (support) | R (school) | R+feedback (classes) | W submit + R **self only, never peers** |
| Analytics | platform | platform | school | classes | self (XP/stars/streak only) |
| Certificates | issue/revoke | issue/revoke | R (school) | R (classes) | R+download (self) |
| Impersonation | any role | school roles | – | read-only view-as (own students) | – |
| Audit logs | platform | platform | school subset | – | – |
| AI config | M platform+school | M per school | toggle within policy | R | – |

Permissions are a typed `resource:action` catalog; **scope is enforced structurally** by
the tenant-scoped data layer, not encoded in strings.

## 6. (E) Component architecture

Detail in routes doc §6. Highlights:

- **Design system** `src/ui/`: three-layer tokens (primitives → semantic remap per
  `data-theme` → Tailwind 4 `@theme`). One token set, two skins: **Play** (student —
  rounded, saturated world colours, Baloo 2 / Baloo Bhaijaan 2 display type) and **Pro**
  (staff — denser, quieter, Nunito Sans / IBM Plex Sans Arabic). CSS logical properties
  everywhere → RTL is a `dir` flip, not a rewrite.
- **Student composites:** `AdventureMap` (one continuous scrollable trail, themed world
  segments, world-emblem fast-travel dock, 5 node states, horizon islands), `LevelPlayerShell`
  (activity-engine registry keyed by type — new engines plug in without shell changes),
  `BlocklyWorkspace` (SSR-safe dynamic import, Zelos renderer, BunnyTheme, per-level toolbox),
  `SimulationCanvas` (event-log playback, per-world tilesets), `HintPanel`, `CodeView`
  (read-only generated JS with block↔line hover mapping), `StarBurst`/`XPBar`/`StreakChip`,
  celebration overlays (timed, skippable, reduced-motion aware).
- **Staff composites:** `DataTable`, `StatCard`, `ProgressMatrix` (virtualized students ×
  levels heatmap), `AttemptReplay` (re-runs the engine deterministically), `CSVImportWizard`
  (5 steps: upload → mapping → validation preview → dry-run → commit), `CredentialSheet`
  (printable login cards PDF), `CertificatePreview`.
- **Conventions:** server components + module `queries.ts` for reads; mutations =
  server actions returning discriminated `ActionResult<T>`; every route segment ships
  loading/error/empty states (inventory in UX doc §7); Blockly and Canvas are client
  islands, everything else server-first.

## 7. (F–I) User journeys

Full journeys with screen-by-screen layouts in `design/ux-journeys.md`.

**(F) Student.** Printed credential card (QR) → `/student-login` big-target two-step →
`/welcome`: 60-second onboarding, avatar pick only (skippable, zero data) → Home (exactly
six elements: greeting+avatar, Continue Learning hero, world progress, streak chip, latest
badge, recommended next; **excluded platform-wide:** leaderboards, time-spent, attempt
counts, accuracy %) → Adventure trail → level node → story intro → instructions →
build → Run (instant animated verdict; server confirms authoritatively) → on fail: located,
kind feedback + hint drawer → on pass: star celebration → **explanation screen** (the
teaching moment: "You used a loop…") → next node. World gate = certificate moment.
Tablet-portrait player stacks simulation (40%) over workspace with a fixed bottom
Run/Reset/Hint bar; phones get a view-only player.

**(G) Teacher.** `/teach` dashboard: classes + needs-attention list built from **5 named
observable signals** (≥3 consecutive fails on a level; 3× median time; repeated tier-4
hints; inactive ≥5 school days while behind; 1-star world completion) — no black-box risk
scores → class ProgressMatrix → student detail: attempt timeline, deterministic replay,
read-only code review, feedback composer → assign world/module/level (assignment
force-unlocks as a side-quest node) → Monday weekly report.

**(H) School admin.** Setup season: `/school/setup` checklist → create classes → invite
teachers → CSV wizard (validates, **rejects** files with extra personal-data columns,
one-time credential-sheet PDF) → assign curriculum per grade/class. Monitoring season:
licence status + seats, active students, per-grade/class completion, certificates issued,
CSV/PDF exports.

**(I) NITAQ admin.** Onboard a school end-to-end (create school → licence + seats →
first school-admin → handoff email) in under 10 minutes → content loop: author level JSON →
import with dry-run → **mandatory test-play pass** in the preview harness → review
(author≠approver) → publish (machine gates: solution re-run, reachability, star
monotonicity, localization completeness) → platform health: schools, DAU/WAU, attempts/day,
licence expiry pipeline, grade-mismatch telemetry, most-failed levels (content QA signal).

## 8. (J) Curriculum structure

**Hierarchy (adjudicated): PROGRAM → WORLD → MODULE → LEVEL.** Grade band = Program
attributes; worlds reusable across programs (`ProgramWorld`); the spec's LESSON layer is
folded into the Level as optional intro cards + the mandatory post-completion explanation
(a `CONCEPT_CARDS` activity type is reserved if lesson-like units are ever needed).
Rationale: six layers of hierarchy is admin busywork at this age band; every removed layer
is one less place for content to be half-filled.

**Content lifecycle:** DRAFT → REVIEW → PUBLISHED → ARCHIVED; publishing writes an
immutable denormalized `LevelVersion`; attempts pin the version at start; progress keys on
stable `levelId`; assignments reference stable IDs. Localization `{en, ar?, arHash}` —
Arabic never blocks English publishing; a hash-staleness dashboard drives the translation
workflow (batch export/import + native-speaker review).

**Seed content (fully authored in `design/curriculum-content.md` §5):** Worlds 1–2 complete
— every level has objective, story hook, ASCII grid, allowed blocks, verified optimal
solution, success conditions, star criteria, all 4 hint tiers, and ship-ready explanation
copy written for a 9-year-old. Exactly one new idea per level; optimal block counts
*shrink* as levels advance (the 2-block Repeat-Until, the 4-block nested-loop spiral
capstone) to teach abstraction. World 3 Robot Lab (V1 addition) introduces `bb_collect`,
if/else, sensors, and the first DEBUGGING/CODE_PREDICTION/QUIZ activities. Worlds 4–8
outlined with activity-type entry points (patterns/classification W4, ethics W5, real ML
W6, code view W7, creative projects W8). Seed levels double as **permanent CI fixtures**:
recorded solutions must PASS with 3 stars against all variants, forever.

## 9. (K) Coding engine architecture

Full design in `design/coding-engine.md` (as amended by §1). Core:

- **Blockly:** npm `blockly`, Zelos renderer + custom BunnyTheme (tablet-sized targets),
  16 `bb_*` custom blocks across EVENTS/MOVEMENT/LOOPS/LOGIC/SENSORS/ROBOT/AI + restyled
  built-ins for variables/logic/functions; per-level toolbox with optional per-block
  instance limits (used pedagogically, e.g. one `Move` in Repeat After Me); JSON workspace
  serialization; Arabic block text via message catalogs; RTL workspace supported (the grid
  world itself never mirrors).
- **Execution — execute-then-animate:** JS-interpreter runs the generated program
  synchronously to completion under budgets (100k interpreter steps / 1,000 world commands /
  hazard halt), emitting an append-only event log; the Canvas then animates the log with
  block highlighting (`STATEMENT_PREFIX`). Client and server runs are byte-identical.
- **Simulation:** `src/engine/` pure TS, zero deps, no DOM, ESLint-banned `Date`/`Math.random`;
  terrain/entity split with behaviour hooks (`onEnter/onCollect/onActivate`) so new
  mechanics are new entity types, not rewrites; per-world theming lives entirely in the
  rendering layer; golden event-log snapshots + 100-run determinism hash in CI.
- **BLOCKS ⇄ CODE:** read-only display-generator pass (prefix-free) with block↔line
  mapping. Python arrives later as per-block display generators — execution stays JS.
- **AI blocks** (`bb_classify`, `bb_predict`, `bb_checkPattern`): deterministic
  level-payload lookup tables in concept worlds — honest sensors, not fake ML; in phase H
  the same Classify block runs the student's own trained model (still deterministic, still
  server-gradeable).

## 10. (L) Grading engine design

- **Server-authoritative:** `POST /api/levels/[levelId]/attempts` receives workspace JSON
  only → headless Blockly regenerates code (block whitelist re-validated server-side) →
  engine re-runs → checks evaluate → transaction persists attempt, XP ledger, progress,
  unlocks, achievements, certificate triggers. Client verdicts are optimistic UI; a
  `gradeMismatch` flag feeds telemetry.
- **Check registry** (one file per check, Zod-validated params): `reachedGoal`,
  `collectedAll`, `avoidedTiles`, `usedBlock`, `notUsedBlock`, `maxBlocks`,
  `variableEquals`, `expectedOutput`, `expectedSequence`, `classifierResult`.
- **Severities:** core (goal) / secondary (constraints) / quality (block-count elegance) →
  PASS (all core+secondary, all variants) · PARTIAL (core pass, secondary fail ⇒ 1 star,
  unlocks next) · FAIL. Multi-variant levels aggregate per-variant results.
- **Stars:** 3 = pass + quality checks (optimal-ish blocks) + no tier-3/4 hints this run;
  high-water-mark across runs; hints never block completion.
- **Feedback:** rule-based, single message, located ("bumped a rock at step 3"), never
  reveals the answer; tone bank per world.
- **Non-Blockly engines** share the same `ActivityEngine` interface returning a uniform
  `GradeResult`; answer-bearing payload fields are stripped by the student-facing loader.

## 11. (M) AI/ML architecture (phases G/H — seams built in phase A)

Full design in `design/ai-ml.md`.

- **AI Lab:** 10 interactive modules (Data Desert + AI Island) with do-not-read mechanics;
  a lightweight `AI_SIM` engine (widget registry) for free-form concept widgets; an explicit
  REAL-vs-SIMULATED honesty column — three modules secretly run the real ML runtime so the
  bias/data-balance lessons are *true*.
- **Real ML Lab (in-browser, nothing leaves the device):** images = self-hosted MobileNet v2
  (α 0.5) embeddings + hand-rolled cosine-KNN in pure TS (nearest-neighbour evidence strips =
  explainability; deterministic = server-regradeable); text/sentiment = Arabic-aware
  tokenizer + Multinomial Naive Bayes (instant, per-word evidence, bilingual). Curated
  datasets ship with precomputed embeddings (no model download for default labs).
  `MLExperiment` persists config + item-ID selections + metrics — **no server endpoint
  accepts lab media at all**; webcam/own-images requires school toggle + activity flag +
  per-session child consent. Confidence is always frequency-phrased ("7 of the 10 closest
  examples were cats").
- **Track integrity:** `Level.track` chips (PROGRAMMING / AI CONCEPTS / MACHINE LEARNING) +
  publish-time lint: the ML label is only grantable to REAL_ML activities.
- **Bunny Guide:** `LLMProvider` abstraction (anthropic / bedrock-regional / local / none —
  `NoneProvider` ships in MVP so every seam exists), 6-stage safety pipeline (input PII
  scrub → topic fence → pedagogy prompt → output filter that cuts responses enumerating
  ≥80% of the known solution → logging → budgets), help specificity slaved to the 4-tier
  hint ladder, per-school enable + token budgets, graceful degradation to static hints.
  Data-residency posture (cross-border LLM vs regional) is a per-school contractual choice
  surfaced in `SchoolAISettings`.

## 12. (N) Security approach

Full design in `design/security-rbac.md`, **as amended by §0.1-1**: authentication
primitives (sessions, cookies, CSRF, hashing, throttling, revocation) are delegated to
Better Auth rather than hand-rolled; the security doc's policies (per-role session
lifetimes, lockout behaviour, TOTP for platform staff, student credentials with no email
and teacher-resolved lockouts) apply as framework configuration plus our provisioning
layer. Remaining pillars unchanged: **two-layer tenant isolation** (withAuth guard
injecting TenantCtx + fenced data layer with compound `schoolId` queries, GUC-set
transactions for future RLS, registry-complete two-school isolation tests in CI);
restricted audited impersonation; append-only audit log enforced by DB grants; licence
ladder with zero automated data loss; PDPL-readiness (exact child-data inventory,
reject-don't-drop CSV minimization, erasure/anonymization flows, retention schedule,
school offboarding export, DPA checklist); CSP + security headers, origin-pinned server
actions, sharp-re-encoded uploads (SVG rejected), CSV formula-injection neutralization,
Zod env validation, per-endpoint-class rate limits; safeguarding: student free text
limited to three surfaces, private-by-default (student + teacher visibility only),
write-time bilingual profanity/PII filter.

## 13. (O) Development roadmap

Re-sequenced from the spec's A–L (changes: **RTL scaffolding moves into Foundation**;
**JSON content pipeline lands early** (F1) so content production parallelizes with
engineering; **certificates before analytics** for sales value; QA is a per-phase gate,
not a final phase).

| Milestone | Contents | Exit criteria |
|---|---|---|
| **M1 Foundation** (phase A + K1) | Repo scaffold, CI, Docker, Prisma schema v1 (identity + schools domains only, per §0.1-12), Better Auth integration + student provisioning layer + RBAC + tenancy layer + isolation test rig, `AuditLog` + `LearningEvent` streams, feature-flag mechanism, design system (tokens, primitives, status states, Play/Pro themes) + role shells, i18n/RTL scaffolding, seed framework (NITAQ Demo School) | Two-school isolation suite green; all five role shells render EN/AR; build/lint/typecheck/tests green |
| **M2 Learning core** (B + F1) | Curriculum models, publish pipeline + gates, JSON import + preview harness, adventure map driven by real progress, StudentProgress/unlock engine | A JSON-authored level is publishable and appears correctly locked/unlocked per student |
| **M3 Coding engine** (C) | `src/engine`, Blockly integration, block set, level player, execute-then-animate, server-authoritative grading + XP/stars/streaks/achievements, hints | Carrot Collector playable end-to-end on iPad Safari; server grade matches client on 100-run determinism harness |
| **M4 Product surfaces** (D + E + J) | Student home/achievements/profile/playground, teacher dashboard + matrix + replay + feedback + assignments, school admin + CSV wizard + credential sheets, NITAQ admin + impersonation, certificates + verify page, resettable demo school, **projector/demo mode reusing the real engine (§0.1-16)** | Full demo script walkable: import class → student plays 3 levels → teacher sees it → certificate verifies |
| **M5 Launch hardening** (K2 + I + L) | Arabic content for Worlds 1–3, reports/exports, analytics polish, accessibility pass, load test (40 concurrent Runs), security review, backup/restore drill, observability | Pilot-school checklist green |
| **Post-V1** | F2 visual level editor → G AI Lab → H ML Lab → Bunny Guide → daily challenge, parent read-only, SSO, competitions | — |

**Effort reality (from the critique, agent-assisted):** full spec MVP ≈ 59–83 agent-days;
the V1 cut above ≈ **40–50 agent-days** of engineering — *plus content production
(bilingual stories, hints, playtesting), which is the true critical path and needs an
owner on the NITAQ side for Arabic review.*

## 14. (P) Folder structure

Full tree in `design/routes-structure.md` §4. Shape:

```
build-bunny/
  prisma/  (schema, migrations, seed/fixtures/)
  src/
    app/[locale]/(public|auth|student|staff|platform)/...   + app/api/...
    engine/          # pure TS simulation — zero deps, ESLint-fenced
    ui/              # design system: tokens, primitives, Play/Pro themes
    modules/
      auth/ schools/ classes/ students/ curriculum/ learning/
      blockly/ grading/ achievements/ certificates/ analytics/
      ai/ ml/ shared/
        # each: index.ts (public API) · schemas.ts · components/ · server/{queries,actions,service}.ts
    lib/             # db client, i18n, storage driver, env validation, rate limit
    messages/        # en.json, ar.json
  tests/  (unit · integration · e2e/playwright)
```

Boundary rules (ESLint-enforced): `engine` imports nothing app-side; modules expose only
`index.ts`; Prisma importable only in `modules/*/server/**` + `lib/db.ts`; `ui` never
imports modules.

## 15. (Q) Advisor findings — what was missing & what to change

Full critique in `design/spec-critique.md`. The material points:

**Missing from the spec (now designed in):** teacher preview/test-play without polluting
stats (PREVIEW attempt kind); resettable demo school (sales); licence seats + academic-year
rollover; announcements delivery; classroom reality — autosave/resume, idempotent
submissions, engine caps, 40-kids-hit-Run load target; one-click credential reset +
printable login cards; content translation *workflow* (not just UI i18n); observability +
backup/restore drill; school offboarding data export; private-by-default student creations
(zero moderation burden in V1); device matrix with **iPad Safari as the make-or-break
target**; anti-grinding XP rules; minimum content versioning.

**Spec decisions changed (recommend owner accepts):** curriculum flattened to 4 layers;
seed 3 worlds with worlds 4–8 as art-complete horizon islands (no empty shelves in the
demo); daily challenge cut from V1; AI Lab out of nav until it's real; playground reduced
to one sandbox; visual editor deferred behind a JSON-first pipeline that keeps every
publish gate; one certificate template; school-day streaks; explicit no-peer-leaderboards
policy; impersonation split (teacher view-as vs NITAQ impersonation).

**Three things nobody asked for that will sell:** (1) **Projector Mode** — a teacher-driven
live class view for smartboards; (2) auto-generated **teacher guides** per level from the
level payload + solution replay; (3) a **school trust pack** — printable one-pager of the
privacy architecture (data-minimization table, UAE residency, no-ads, no-external-AI
default) for procurement meetings.

**Top risks:** 1) content production capacity (mitigate: JSON pipeline early, I draft
copy, NITAQ reviews Arabic); 2) iPad Safari performance/quirks (mitigate: M3 exit
criterion); 3) Blockly touch UX on small tablets (mitigate: Zelos + big targets + early
device testing); 4) demo-day licence/auth friction (mitigate: demo school + rehearsed
script); 5) scope creep re-inflating V1 (mitigate: this decision record).

---

## 16. Open questions for the owner (defaults I'll proceed with unless overridden)

1. **V1 scope cut** (§1.3, §13): accept 3 worlds / 15 levels / 4 activity engines /
   JSON-first authoring? *Default: yes.*
2. **Arabic bar for first sale:** AR UI at launch; AR *content* for Worlds 1–3 before the
   first paid school (EN-first demos acceptable)? *Default: yes.*
3. **Content ownership:** I author all level copy EN+AR draft; NITAQ provides a native
   Arabic reviewer before publish. *Default: assumed.*
4. **Streak calendar:** Mon–Fri UAE default + NITAQ-managed holiday calendar. *Default: yes.*
5. **Erasure vs certificates:** erased students' certificates stay verifiable with frozen
   display name ("Omar A."). *Default: yes.*
6. **Repo home:** build at `Nitaq/build-bunny/` in this repository (splittable later).
   *Default: yes.*
7. **Bunny Guide data residency** (decision needed before phase G only): regional Bedrock
   vs Anthropic API with disclosed cross-border + redaction. *No default — contractual.*
