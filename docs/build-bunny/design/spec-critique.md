# Build Bunny — Spec Critique & Reality Check

**Role:** independent stress-test of the specification before implementation. All recommendations respect the LOCKED stack (Next.js 15 / React 19 / TS strict, Postgres 16 + Prisma, custom sessions, Blockly + JS-interpreter, pure deterministic engine with server-side authoritative grading, next-intl EN+AR, Tailwind 4 dual-theme, Docker/UAE-region). Nothing below relitigates those; everything below is about what the spec forgot, what it got wrong, and how to sequence it so NITAQ can sell it this school year.

---

## 1. WHAT IS MISSING

These are absent or under-specified. Each entry states the gap, why it bites, and the concrete design to add.

### 1.1 Teacher preview / test-play mode — **missing, blocking for E**

Teachers must be able to play any assigned level without polluting their stats or a student's. Nothing in the spec distinguishes a teacher's run from a graded student attempt.

**Design:** add `kind` to the attempt model and a preview route.

```prisma
enum AttemptKind { STUDENT PREVIEW }   // PREVIEW: graded server-side, never awards XP/stars/unlocks
model Attempt {
  id            String      @id @default(cuid())
  kind          AttemptKind @default(STUDENT)
  userId        String      // teacher id for PREVIEW
  levelId       String
  levelVersion  Int         // see 1.15
  workspaceJson Json
  verdict       Verdict     // PASS | FAIL | PARTIAL
  ...
}
```

- Route: `/teacher/levels/[levelId]/preview` — same coding screen component, `mode="preview"` prop, banner "Preview — progress not saved to any student".
- Grading endpoint accepts `kind: PREVIEW` only for TEACHER/NITAQ roles (Zod + `withAuth('content.preview')`); PREVIEW attempts are excluded from every analytics query by default.
- Same mechanism serves the content editors in phase F (preview an unpublished DRAFT level).

### 1.2 Demo / sales mode — **missing, and this product lives or dies in sales demos**

The seed script gives you a demo school once. A sales team needs it *resettable* and *mid-journey* (an empty adventure map sells nothing; a half-completed one sells the whole roadmap).

**Design:**
- `School.isDemo: Boolean` — demo schools are excluded from platform analytics and billing.
- Seed produces a demo student **mid-World-2** (levels 1–7 completed with 2–3 stars, streak of 4, two badges, one certificate) plus one fresh student for the "first login" moment.
- `POST /api/nitaq/demo/reset` (NITAQ_ADMIN only): truncates the demo school's mutable rows and replays a versioned seed snapshot (`prisma/seed/demo-school.ts`). Target < 10 s. Button in NITAQ admin: "Reset demo school".
- A one-page internal demo script (login codes, which student to show, which teacher view) lives in the repo — the demo is a product surface, treat it like one.

### 1.3 Licence seat model + academic-year rollover — **schema-level gap; causes year-2 churn if bolted on later**

"Annual licences" and "Academic Year" appear in the spec with no model or lifecycle. Two hard questions the spec never answers: what happens when a school imports student #501 on a 500-seat licence, and what happens every September.

**Design (schema in phase A, rollover UI can wait until spring):**

```prisma
model Licence {
  id           String   @id @default(cuid())
  schoolId     String
  plan         String            // display name; pricing lives off-platform
  studentSeats Int
  teacherSeats Int
  startsAt     DateTime
  endsAt       DateTime
  status       LicenceStatus     // ACTIVE | EXPIRED | SUSPENDED
}
model AcademicYear {
  id        String  @id @default(cuid())
  schoolId  String
  label     String   // "2026–2027"
  startsOn  DateTime
  endsOn    DateTime
  isCurrent Boolean
}
// Class belongs to an AcademicYear; enrolment is (studentId, classId) so history survives rollover.
```

- Seat enforcement at the only two doors: CSV import and manual student creation. Over-seat → import preview shows "512 rows, 500 seats — 12 rows will be skipped" (soft-block; NITAQ_ADMIN can override).
- Expiry behaviour: `EXPIRED` → staff see a renewal banner and read-only dashboards; students get a friendly "ask your teacher" screen. Never hard-delete on expiry.
- **Rollover wizard** (SCHOOL_ADMIN, post-MVP but designed now): create next AcademicYear → clone class structure → bulk-promote students to new grade/classes → archive leavers (progress + certificates retained per retention policy). Without this designed in, September of year 2 is a support fire.

### 1.4 Notifications / announcement delivery — **listed as a feature, designed nowhere**

Students have no email (correctly). So what does "announcements" actually mean?

**Design (MVP-cheap, in-app only):**

```prisma
model Announcement {
  id        String   @id @default(cuid())
  scope     AnnScope // PLATFORM | SCHOOL | CLASS
  schoolId  String?  // null for PLATFORM
  classId   String?
  audience  Role[]   // e.g. [STUDENT], [TEACHER, SCHOOL_ADMIN]
  body      Json     // { en: string, ar?: string }
  publishAt DateTime
  expiresAt DateTime?
  createdBy String
}
```

- Rendered as a dismissible banner (staff) or a Bunny-delivered message card on the student HOME (student). Dismissals stored per user.
- No email/push in MVP. Email to *staff* only (they have addresses) can come with I.

### 1.5 Classroom reality: shared devices, flaky wifi, 40 simultaneous Runs — **the spec designs for one child on good wifi**

- **Autosave/resume:** workspace JSON saved to `localStorage` every 10 s and on blur (`bunny:ws:{userId}:{levelId}`), and checkpointed to the server on Run and on level exit (`PUT /api/student/levels/[levelId]/workspace`). Reopening a level restores the latest of local vs server copy (timestamp wins). A child losing 20 minutes of blocks once is a lost customer.
- **Idempotent submission with offline retry:** the client generates `attemptId` (UUID) *before* submitting; submission endpoint upserts on it. Failed POSTs queue in `localStorage` and retry with backoff. Double-tap of Run can never double-award XP.
- **40 concurrent Runs:** the deterministic engine makes server grading cheap, but cap it: engine hard limit of **10,000 steps / 200 ms per grade** (also your infinite-loop defence — `Repeat Until` with a wrong condition is guaranteed day one), per-student rate limit of 1 submission/2 s, queue with fast-fail if grading backlog exceeds ~2 s. Load-test this exact scenario in phase C, not phase L.
- **Shared devices:** student sessions default to 8 h max, an unmissable "Switch bunny" logout on the student HOME, and no persistent "remember me" for STUDENT role. Class-code login lands on a roster picker (name + avatar) so the next child on the same iPad gets in within seconds.

### 1.6 Credential recovery for 8-year-olds + printable credential cards — **missing; this is the #1 teacher support ticket in every sibling product**

Children forget passwords weekly. There is no email to reset against, by design.

**Design:**
- Student credential = school-scoped username + **6-character PIN-style password** (avoid ambiguous chars: no 0/O, 1/l). Or class-code + roster-pick + PIN.
- Teacher one-click reset: `POST /api/teacher/students/[studentId]/reset-credential` regenerates the PIN and flags "must show new card". No old-password prompt, no email loop. Audit-logged.
- **Printable credential cards:** `/teacher/classes/[classId]/credentials.pdf` — server-rendered PDF (same pipeline as certificates), one card per student: display name, avatar, username, PIN, class code, QR to the login URL. Code.org proved this pattern; teachers print, cut, and hand them out on day one. Cheap (you already have a PDF pipeline for certificates) and a genuine sales-demo moment.

### 1.7 Curriculum pacing vs self-paced — **unresolved tension that will hit in the first real classroom**

Self-paced means the fast third of the class finishes World 2 in week one and the teacher's term plan is dead. Code.org's single most-used teacher feature is *lesson locking*. The spec has "assign worlds/modules" but no gating semantics.

**Design:**

```prisma
model ClassCurriculumGate {
  classId     String
  worldId     String
  policy      GatePolicy  // OPEN | LOCKED | OPEN_AFTER   (OPEN_AFTER has openAt: DateTime)
}
```

- Default: everything assigned is OPEN (self-paced) — the spec's spirit survives.
- Teacher toggle per world (later per module): "Lock until I open it". Locked worlds render on the map as "Your teacher will open this soon" — distinct from prerequisite-locked.
- Effective availability = prerequisite chain ∧ class gate. Enforced server-side in the unlock check, not just hidden in UI.

### 1.8 Content translation *workflow* (not just UI i18n) — **`{en, ar?}` is storage, not a process**

Who translates 8 worlds × hints ×4 × instructions, and how does anyone know what's untranslated?

**Design:**
- Every localizable entity carries `arStatus: MISSING | MACHINE_DRAFT | REVIEWED` (derived where possible, stored where not).
- NITAQ admin **Translation dashboard**: `/nitaq/translations` — table of published content with missing/draft Arabic, filterable by world; inline edit.
- Export/import for external translators: `GET /api/nitaq/translations/export?worldId=…` → flat JSON (`entityId.field.lang → string`), matching import with diff preview. No XLIFF ceremony; a bilingual reviewer with a JSON file is the realistic workflow.
- **Runtime fallback rule (decide now):** missing `ar` renders `en` with no error — but a level is only *publishable to an Arabic-default school* when `arStatus=REVIEWED` for all student-facing fields. Publish checklist enforces it.

### 1.9 Observability, monitoring, backups — **entirely absent; you cannot sell "trust us" to schools**

- Structured logging (pino), request ID propagated from middleware to DB logs; grading latency, login failures, and per-tenant activity as first-class metrics.
- Error tracking: Sentry (or GlitchTip self-hosted if data-residency review objects), with PII scrubbing — never log workspace contents or student names in errors.
- `GET /api/health` (DB ping + migrations current + object-store reachable) for the container orchestrator.
- **Backups:** nightly `pg_dump` to versioned object storage in-region, 30-day retention, plus a documented **restore drill** run once before the first school onboards. Certificates/uploads bucket versioned. Put "restore tested on {date}" in the ops runbook — schools' IT ask this in procurement.

### 1.10 Data export for departing schools — **contractual necessity, trivially cheap now, painful later**

`GET /api/school-admin/export` → ZIP of CSVs: students (display name, identifier, class, grade), per-student progress (levels, stars, XP, time-on-task), certificates (with verify URLs). Available to SCHOOL_ADMIN any time — being exportable is a *selling* point ("your data is yours") and defuses the lock-in objection in procurement. Pair with the retention/deletion design the spec already promises: school offboarding = export → 90-day grace → hard delete job, audit-logged.

### 1.11 Moderation / safeguarding for CREATIVE_PROJECT and the `Say` block — **unaddressed child-safety hole**

Free creation + children + any visibility to other children = a moderation queue you cannot staff.

**Design (MVP rule, brutally simple):** student-created content (creative projects, `Say` block strings, playground saves) is visible **only to the student and their teacher**. No cross-student sharing surface exists in MVP — this reduces the moderation burden to zero without limiting learning. When sharing ships later (Inventor Island), it ships *with* a teacher-approval queue (`shareStatus: PRIVATE | PENDING_TEACHER | CLASS_SHARED`) and a profanity screen on text fields. Write this rule into the spec now so nobody "quickly adds" a class gallery in phase D.

### 1.12 Browser/device support matrix for UAE school hardware — **undeclared, and Blockly will make you pay for that**

Declare and test: Chrome/Edge (last 2) on Windows school laptops; **Safari 16.4+ on iPad (the risk item — Blockly touch + Canvas here is the single most important compatibility test in the project)**; Android Chrome tablets best-effort. Coding screen minimum viewport 1024×668 (10" landscape); below that, show a friendly "rotate your tablet / use a bigger screen" state (an *error state* the spec's list forgot). Phones: HOME/ACHIEVEMENTS/map browsing only, coding screen blocked with guidance — matches the spec's "limited student functionality OK". Run the iPad spike in **week one of phase C** (see Risks).

### 1.13 Accessibility testing *plan* (spec has goals, no verification)

- axe-core automated pass wired into Playwright for the six student screens + teacher dashboard; CI-blocking on new criticals.
- Manual keyboard-only pass per release on: login, map, quiz-type activities, achievements.
- **Honest Blockly caveat:** Blockly's keyboard navigation is weak; document it as a known limitation and ensure every *concept* is also assessable via a keyboard-friendly activity type (QUIZ, CODE_PREDICTION) so a motor-impaired child is not locked out of progression entirely.
- Reduced-motion: the map and sim animations honour `prefers-reduced-motion` (instant moves, no confetti) — test it, don't just intend it.

### 1.14 Anti-gaming of XP — **server-authoritative grading stops cheating, not grinding**

- XP awarded **on first PASS only** per level; replays award 0 (star *improvements* award the star delta's XP once).
- Streak counts only days with ≥1 completed activity (not mere login).
- QUIZ / CODE_PREDICTION: after 3 failed submissions in 60 s, a 30 s cooldown with "take a breath, read the hint" — kills answer brute-forcing without punishing thinkers.
- Achievements idempotent by definition (`@@unique([userId, achievementId])`).

### 1.15 Content versioning vs progress integrity — **"versioning eventually" is not a plan when admins can edit published levels**

Minimum viable versioning, phase B, or analytics and fairness both silently corrupt:
- `Level.version: Int`, bumped on any publish of changed grading-relevant fields; `Attempt.levelVersion` records what was graded.
- Editing a PUBLISHED level's grading fields requires re-publish (creating version n+1). Old attempts keep their verdicts; **no retroactive re-grading, ever**.
- Full draft/diff/rollback UI stays "eventually" — this is just two columns and a rule, and it saves you from unanswerable teacher emails ("why did Sara's completed level become failed?").

### 1.16 Lessons from siblings the spec ignores

- **Code.org:** lesson locking (→1.7), printable credential cards + picture-friendly logins (→1.6), and **teacher answer keys** — the spec's `teacherNotes` field is not enough; every level needs a canonical solution the teacher can *watch* (store a reference solution workspace; teacher clicks "Show solution replay" — the deterministic engine animates it). Non-coder teachers will not teach a product they can't answer questions about. This is a renewal driver, not a nicety.
- **Scratch:** community/gallery moderation is a full-time cost — validates 1.11's private-by-default rule.
- **Kodable/Tynker:** parent visibility drives home reinforcement and school renewal pressure — fine as future PARENT role, but design the read-model now (per-student progress summary is already needed for teachers).
- **All of them:** pacing guides — a printable per-world scope-and-sequence PDF for teachers ("World 2 ≈ 4 × 45-min sessions"). Generate it from level metadata (`estimatedTime`, objectives); nearly free, hugely credibility-building in sales.

---

## 2. QUESTIONABLE DECISIONS — challenged, with recommendations

### 2.1 Six-layer hierarchy (PROGRAM → GRADE BAND → WORLD → MODULE → LESSON → ACTIVITY) — **too deep; collapse to four**

Every layer costs: an admin CRUD screen, reorder UI, publish-cascade rules, breadcrumbs, empty states ×2 languages, and a join in every progress query. Six layers is enterprise-LMS cosplay; children navigate a *map*, not a taxonomy. LESSON vs ACTIVITY is a distinction without a difference at this age, and PROGRAM/GRADE BAND are *attributes*, not containers.

**Recommendation:**
```
Track (name, gradeBandMin/Max)  →  World  →  Module  →  Level
```
- `Track` ("AI & Coding Foundations, Grades 3–4") is the assignable curriculum unit; grade band is two integer columns on it, not a tree level.
- LESSON disappears; a Module *is* the lesson-sized grouping (5–8 levels). If a "lesson" ever needs intro text, that's `Module.introContent`, not an entity.
- Migration path: if a real need for a fifth layer emerges (it won't before year 2), Modules can gain a `groupLabel`. Do not build six admin UIs on speculation.

### 2.2 Eight worlds announced, two seeded — **the empty-shelf problem; fix with staging, not more content**

A sales demo that opens a map with 6 empty worlds says "unfinished". A map with 2 worlds says "small".

**Recommendation:** seed **three** worlds (add Robot Lab — conditionals demo brilliantly: "the bunny *decides*"), and render worlds 4–8 as named, art-complete **islands on the horizon**: visible, visually distinct, explicitly "Opening 2027" — with no node counts, no greyed rows, no "0 levels". This sells the roadmap as vision rather than absence. The map already needs locked-world art; this is the same asset with different copy. 15 seeded levels (5×3) is the content bar for launch, not 10.

### 2.3 PLAYGROUND in MVP nav — **keep it; it's nearly free and it demos beautifully**

Once phase C exists, Playground = the same coding screen with the full block toolbox, an open sandbox grid, and no grading. Marginal cost: one route, one config. It's the "look, free creation" beat in every sales demo. **Constraint:** one autosaved sandbox per student (no named/multiple projects, no sharing — see 1.11); multi-project management is where scope creep hides.

### 2.4 Daily challenge in MVP — **cut it**

With 15 levels there is nothing to rotate; a real daily-challenge system needs either content ops (a challenge per calendar day) or seeded procedural generation, which fights your deterministic-grading design and is a project in itself. A stale "daily" challenge is worse than none — it teaches children the product is dead. **Replace** the HOME tile with **"Recommended next"** (next uncompleted level in the current world — a query, not a system). Revisit daily challenges when content depth exists (post-H).

### 2.5 AI LAB in student nav before phase G — **neither dead nav item nor total hiding; make it a map teaser behind a flag**

A top-nav item that dead-ends violates the spec's own quality bar ("everything visible works"). Total hiding wastes the differentiator in demos. **Recommendation:** no AI LAB in the student nav until G ships. Instead, AI Island / ML Lab already exist on the adventure map as horizon islands (2.2) — that *is* the teaser, in the fiction of the product. Nav entries are feature-flagged per school (`school.features: Json`), so the demo school can show G-era modules the day they exist while paying schools see them when stable.

### 2.6 Certificates in MVP — **confirmed correct; scope it to one**

Sales asset, procurement asset ("verifiable"), parent asset — and cheap given the server PDF pipeline. **Constraint:** one template, one trigger (world completion), QR verify page. Course-completion certificates wait until Track completion is a real, tested state. Do not build a certificate template *editor*; templates are code.

### 2.7 Building your own CMS / level editor — **the iceberg in phase F; ship JSON-first authoring, defer the visual editor**

A real level editor = grid painter + block whitelist picker + success-condition builder + 4-tier hint editor ×2 languages + preview + publish workflow. That's a product. Meanwhile your actual content authors in year one are NITAQ staff sitting next to the developer.

**Recommendation:** MVP authoring = **levels as Zod-validated JSON documents** in-repo (`content/worlds/logic-forest/03-choose-the-path.json`), imported via `POST /api/nitaq/content/import` with dry-run diff preview. Admin UI in MVP handles only: reorder, publish/unpublish, edit metadata + translations (1.8), preview (1.1). The visual grid/level editor is F2, post-MVP, built once 30+ levels of authoring experience tell you what it must do. This single decision saves 10+ days and removes the biggest quality risk in the plan.

### 2.8 Blockly on small tablets — **legitimately risky; de-risk in week one of C**

Concrete mitigations: 10" landscape minimum (1.12); collapsible toolbox (icon rail); simulation collapsible to a picture-in-picture corner while dragging blocks; Blockly configured with `zoom: { controls: true, pinch: true }`, grid snap, and enlarged touch targets; "Run" as a fixed floating action never occluded by the keyboard. **Spike on a physical iPad in the first week of phase C** — if drag precision fails there, you want to know before 15 levels of content assume it.

### 2.9 Per-level Python codegen — **defer entirely; JS-only until Code City content exists**

The BLOCKS ⇄ CODE toggle showing clean generated JavaScript delivers the learning value ("blocks are real code"). Dual codegen doubles testing surface for a world (7) that isn't seeded. Keep the codegen behind an interface (`CodeGenerator` with `js` impl) so Python is additive later. No student-visible "Python coming soon" anywhere.

### 2.10 Streaks for 8-year-olds — **keep, but make them school-day streaks with no loss shaming**

Calendar streaks punish weekends, Eid, and term breaks — a child returns from a week's holiday to a broken streak they were proud of. **Recommendation:** streaks count **school days only** (default UAE Mon–Fri week; per-school holiday calendar on `School.settings`, editable by SCHOOL_ADMIN). Weekends/holidays freeze, never break. One free "streak restore" grace per month, framed positively. Copy never shames ("Your streak is waiting for you", never "You lost your streak"). Streak requires a completed activity, not a login (1.14).

### 2.11 XP visible to peers / leaderboards — **spec's omission is correct; make it explicit policy**

Public individual rankings reliably demotivate the bottom third of an 8-year-old class and invite gaming. Write into the spec: **XP/stars/streaks are visible to the student, their teachers, and school staff — never to other students. No individual leaderboards, ever.** If competitive energy is wanted later: opt-in *class vs class* aggregate challenges (whole-class totals, no names). This is also a differentiating safeguarding talking point in sales.

### 2.12 Impersonation powers vs child privacy — **keep, but split into "view-as" (common) and full impersonation (rare)**

- **TEACHER gets read-only "View as student"**: renders the student's HOME/map/level states with a persistent banner; no writes possible (the session context carries `viewAs.readOnly=true` and the DAL rejects mutations). This covers ~90% of "what does the child see?" support needs with minimal privacy surface.
- **Full impersonation** restricted to NITAQ_ADMIN/SUPER_ADMIN: requires a typed reason string, 30-minute TTL, distinct session records `{actorUserId, subjectUserId}` (per the locked auth design), immutable audit entries, and the school's audit view shows that it happened (transparency to the customer). SCHOOL_ADMIN does **not** get impersonation — they get view-as.

---

## 3. SCOPE REALITY CHECK

**Calibration:** the rejected vendor quote was 30–40 solo days for roughly *one quarter* of this MVP (one role UI, no dashboards, no Arabic, no tenant admin, 12–15 levels, no real analytics). The spec's MVP list (items 1–20) is not a 40-day build under any development style.

**Estimate for the spec's full MVP list, agent-assisted solo senior dev (focused agent-days):**

| Slice | Agent-days |
|---|---|
| A: schema, auth/sessions, RBAC/withAuth, tenancy DAL, design tokens, app shells ×2 themes | 9–12 |
| B: curriculum models, progress/unlock, versioning-minimum (1.15), JSON content import (2.7) | 5–7 |
| C: engine + Blockly + block set + animated playback + server grading + tablet layout | 12–16 |
| D: student HOME, adventure map (art-heavy), coding screen polish, achievements, error states | 9–13 |
| E: teacher dashboard + view-as + credentials PDF; school admin + CSV import; class gating | 7–10 |
| NITAQ admin (schools, licences, demo reset, translations dashboard, impersonation) | 4–6 |
| J: certificate PDF + verify page | 2–3 |
| Content: 15 polished levels ×2 languages (human-bound — art, story, hints, playtesting) | 4–6 |
| K1 baked into A; K2 translation pass | 2–3 |
| Hardening: tenancy tests, load test (1.5), a11y pass, backup/restore drill, demo pack | 5–7 |
| **Total** | **≈ 59–83 agent-days ⇒ 3.5–5 calendar months solo** |

The full A–L spec (AI Lab, real ML, assistant, advanced analytics, visual editor) is 2–2.5× that. Anyone promising the full MVP list in 6 weeks is re-selling you the vendor proposal with better adjectives.

**The sellable V1 cut (if 3.5–5 months is too long — target ≈ 40–50 agent-days):**

KEEP (the demo spine): auth + tenancy + all five roles (NITAQ admin *minimal*), 3 seeded worlds / 15 levels, full Blockly→sim→server-grade loop, adventure map with horizon islands, XP/stars/achievements (6 achievements, not 12), school-day streaks, teacher dashboard (roster, progress matrix, attempt viewer with solution replay), school admin (CSV import + classes + credential cards PDF), one certificate + verify, Playground, Arabic UI (K1) with Worlds 1–2 content translated, demo school + reset.

CUT/DEFER, and why the sales demo doesn't miss them:
- **Activity engines: ship 3, not 10** — BLOCK_CODING, DEBUGGING (same screen, pre-broken workspace — nearly free and demos "real skills"), QUIZ (needed for AI-concepts content later, simple to build). Defer CODE_PREDICTION, SEQUENCING, PATTERN_RECOGNITION, AI_CLASSIFICATION, REAL_ML, AI_ETHICS, CREATIVE_PROJECT. The demo shows one glorious coding loop, not ten thin widgets. The `ActivityEngine` interface (registered per `type`) ships in B so the other seven are additive.
- Daily challenge (2.4), visual level editor (2.7), Python codegen (2.9), branching map paths, advanced analytics (teacher dashboard's progress matrix ≈ 80% of demo value), announcements UI (schema only), rollover wizard (schema only), PARENT role, AI Lab/ML Lab/Bunny Guide (as the spec already agrees).
- School-admin *reports/exports*: ship the CSV export (1.10, one endpoint) but no report builder.

The demo flow this V1 supports end-to-end: class-code login → roster pick → map → play a level on an iPad → stars + confetti → teacher dashboard lights up (projector mode, §6) → CSV import → credential cards PDF → Arabic toggle → certificate with QR verify. That is a closing demo. Nothing cut appears in it.

---

## 4. TOP 10 RISKS (ranked)

1. **Content production, not code, is the critical path.** 15 polished bilingual levels with story, 4-tier hints and playtesting is content-designer work agents barely accelerate. *Mitigation:* JSON authoring pipeline in phase B (2.7); name a content owner in week one; depth-first (3 great worlds) over breadth (8 thin ones); playtest with real children by week 6.
2. **Blockly + Canvas on iPad Safari fails or feels bad.** Kills the classroom promise and the tablet demo. *Mitigation:* physical-iPad spike in week one of C (2.8); declared support matrix (1.12); fallback layout decisions made early, not in L.
3. **Cross-tenant data leak.** One School-A-sees-School-B incident ends the company in a market this small. *Mitigation:* every query through the tenant-scoped DAL (locked); CI tenancy suite that logs in as School A and attempts every list/get against School B's ids expecting 404s; schema keeps RLS addable; pen-test pass in L.
4. **Client/server engine divergence** (grading disputes: "it worked on my screen"). *Mitigation:* one engine package consumed by both sides (locked); `engineVersion` stamped on attempts; golden-fixture replay tests (same program + level ⇒ identical event log) in CI; never patch grading behaviour without a version bump.
5. **Solo-dev timeline optimism / bus factor.** The spec is 2–3× the owner's likely mental estimate (§3). *Mitigation:* adopt the V1 cut; phase gates that each end in something demoable; ruthless "does it help a child learn / teacher teach / school understand" test the spec itself prescribes.
6. **Sales-demo fragility** (empty shelves, live bugs, hotel wifi). *Mitigation:* resettable mid-journey demo school (1.2); horizon-island map staging (2.2); scripted demo path tested before every meeting; local-Docker fallback that runs the whole demo offline.
7. **CSV onboarding chaos** — Arabic names in Windows-1256, duplicate identifiers, 700-row files with merged cells. First-day impressions die here. *Mitigation:* import = upload → parse (UTF-8 + Windows-1256 detection) → per-row validation report → dry-run preview → commit; downloadable error CSV; seat check (1.3) at the same gate.
8. **Child-data privacy incident** (leak, over-collection, or a creative-project safeguarding event). *Mitigation:* minimal-data schema (locked), private-by-default student content (1.11), PII-scrubbed logging (1.9), retention + export designed in (1.10), impersonation constraints (2.12).
9. **Infinite-loop / resource-exhaustion grading DoS** — accidental (wrong `Repeat Until`) or deliberate. *Mitigation:* step + wall-clock caps in the engine (1.5), submission rate limits, queue backpressure, load test "40 kids hit Run" as a phase-C exit criterion.
10. **Gamification backfires** — streak anxiety, XP grinding, demotivated bottom third. *Mitigation:* school-day streaks with grace (2.10), first-pass-only XP + cooldowns (1.14), no peer-visible rankings (2.11), copy review for shame-free failure states.

---

## 5. SEQUENCING — corrections to the A–L phase order

The spine A → B → C → D → E is right. Four corrections:

1. **K (Arabic/RTL) must split; K1 belongs inside A.** Retrofitting RTL onto four phases of built UI is the most expensive possible way to do it. K1 (in A): next-intl wired, `dir` switching, CSS logical properties enforced by lint rule, `{en, ar}` JSONB shape, one RTL screenshot test per app shell. K2 (late, cheap): translation pass + Arabic content review via the 1.8 dashboard. Every component is then born RTL-safe for near-zero marginal cost.
2. **J (certificates) moves before I (analytics).** Certificates are 2–3 days and close sales; analytics is weeks and serves schools *after* they've bought. Order: … E → J → I. (The spec's own MVP list already includes certificates — the phase lettering just contradicts it.)
3. **Split F: F1 (JSON import + publish/reorder/translate/preview) lands with B**, because seeding 15 levels *is* content management and you should author them through the real pipeline, not a parallel seed path. F2 (visual editor) drops after I, informed by 30+ levels of authoring experience (2.7).
4. **L (QA/security/polish) is not a phase, it's a gate on every phase.** Error states, tenancy tests, and a11y checks are exit criteria for A–E (the spec's own error-state list implies this). Keep a slim terminal L for pen-testing, load-testing, the restore drill, and demo-pack polish.

**Recommended order:** A(+K1) → B(+F1) → C(iPad spike week 1) → D → E → J → **Demo/Sales pack (1.2, explicit deliverable)** → K2 → I → F2 → G → H → Bunny Guide. G before H stands — AI Lab modules are content-shaped and lower-risk than real ML, and G gives the sales team the "AI" story sooner.

---

## 6. THREE THINGS NOBODY ASKED FOR (build them anyway)

1. **Projector Mode — live class view.** `/teacher/classes/[classId]/live`: full-screen, poll-based (5 s) grid of the class — each student's current level, attempt state, and a celebration pulse when someone passes. Teachers run lessons against it on the classroom big screen; children get communal (not ranked — consistent with 2.11) celebration; and it is *literally the sales demo screen* — a wall display lighting up as fake students progress sells "school understands learning" better than any analytics deck. Cost: ~2 days on existing progress queries.
2. **Solution replay + auto-generated teacher guide PDFs.** Every level stores a canonical solution workspace; the deterministic engine can animate *any* stored program, so teachers get "Show solution" on every level and "Replay this student's attempt" on every submission (debugging superpower, zero extra engine work). From the same level metadata, generate a per-world teacher guide PDF: objectives, estimated session plan, solution imagery, discussion prompts from `teacherNotes`. Non-coder teachers become confident presenters of your product — the strongest renewal lever an EdTech company has, and it falls out of data you already store.
3. **"My data is mine" school trust pack.** One NITAQ-admin button per school generating: current data inventory (what is stored about children — display name, identifier, class, progress; what is *not* — no DOB, no email, no photos), the export archive (1.10), backup/restore posture (1.9), and sub-processor list. UAE school procurement and PDPL-minded parents ask exactly these questions; answering them with a generated document while competitors send a salesperson's promises wins deals. Cost: ~2 days; it is mostly rendering facts the architecture already guarantees.

---

*Bottom line: the spec's product instincts are mostly right — server-authoritative grading, no leaderboards, minimal child data, certificates early. Its three real errors are depth-of-taxonomy (2.1), believing content management and content itself are cheap (2.7, Risk 1), and treating Arabic and demo-readiness as late phases when they are foundation concerns (5.1, 1.2). Adopt the V1 cut in §3 and this is sellable in one school term.*
