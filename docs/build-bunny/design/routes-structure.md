# Build Bunny — Route Map, Folder Structure & Component Architecture

Design section owner: Next.js architecture. Respects all LOCKED decisions in `bunny-context.md`
(Next.js 15 App Router, React 19, TS strict, Prisma/Postgres row-tenancy, custom DB sessions,
Zod + `withAuth`, Blockly + pure-TS engine in `src/engine/`, next-intl EN/AR, Tailwind 4 dual-theme,
Docker, storage driver abstraction).

---

## 1. Routing conventions (read first)

- **Locale segment at the root.** Everything user-facing lives under `src/app/[locale]/`.
  next-intl runs with `localePrefix: 'as-needed'`: English URLs have **no** prefix
  (`/home`), Arabic URLs are prefixed (`/ar/home`). API route handlers live *outside* the
  locale segment at `src/app/api/` (locale is irrelevant to JSON/binary endpoints; error
  messages returned by APIs are message-catalog keys resolved client-side).
- **One route group per audience**, each with its own layout shell and theme:
  `(public)`, `(auth)`, `(student)`, `(staff)`, `(platform)`. Route groups add no URL
  segment, so audience separation in URLs comes from path prefixes: student routes get
  short friendly top-level paths (`/home`, `/adventure`), teacher routes live under
  `/teach`, school-admin under `/school`, NITAQ platform under `/nitaq`.
- **Two sub-groups inside `(student)`**: `(shell)` (pages with the student nav chrome) and
  `(immersive)` (full-bleed screens with no nav: the level player, the playground editor,
  AI-Lab module player). Both inherit the student auth guard + Play theme from
  `(student)/layout.tsx`; only `(shell)/layout.tsx` renders navigation.
- **Dynamic params**: content routes use human-readable slugs (`[worldSlug]`) for things
  children see in a URL bar; entity admin routes use cuid ids (`[classId]`). Certificate
  verification uses the printable certificate ID (`BB-2026-8F3KQ2`), not a DB id.
- Route files stay thin: a `page.tsx` composes module components and calls module
  queries — no business logic in `src/app/`.

---

## 2. Route map

### 2.1 `(public)` — no auth, Pro theme (marketing variant), SSG/ISR where possible

| Route | Page | Notes |
|---|---|---|
| `/` | Landing | Marketing page. If a valid session cookie exists, server-redirects by role → `/home`, `/teach`, `/school`, `/nitaq`. Static for anonymous users. |
| `/verify/[certificateId]` | Certificate verification | Public. Server component queries certificate registry; shows ONLY safe fields (student display name, achievement, date, school, status incl. `REVOKED`). Valid/invalid/revoked states. ISR with tag `cert:{id}`. |
| `/legal/privacy` | Privacy policy | Static, localized. |
| `/legal/terms` | Terms of service | Static, localized. |

### 2.2 `(auth)` — no session required, redirects authed users away

| Route | Page | Notes |
|---|---|---|
| `/login` | Staff login | Email + password (TEACHER, SCHOOL_ADMIN, NITAQ_ADMIN, SUPER_ADMIN). One form; post-login redirect by role. |
| `/login/forgot` | Request password reset | Staff only (students have no email). Always responds "if the account exists…". |
| `/login/reset/[token]` | Set new password | Single-use token, Argon2id re-hash. |
| `/student-login` | Student login | Two-step: school code → school-scoped username + secret (picture-password or short PIN-style secret per school policy). Big targets, no email field anywhere. |
| `/join` | Class-code entry | Student types class code (e.g. `MEADOW-4B`). |
| `/join/[code]` | Class-code deep link | Same flow with code prefilled (QR-code printable by teacher). On valid code: roster-claim or credential entry depending on school onboarding mode. |

Logout is a server action (`auth.signOut()`), callable from every shell; no page.

### 2.3 `(student)` — role STUDENT, Play theme

`(student)/layout.tsx`: authoritative session check (`requireRole('STUDENT')`), sets
`data-theme="play"`, loads student context (displayName, avatar, XP, streak) once.

**`(shell)` sub-group** — left/bottom nav: HOME · ADVENTURE · AI LAB · PLAYGROUND · ACHIEVEMENTS · PROFILE

| Route | Page | Notes |
|---|---|---|
| `/home` | Student home | Greeting + avatar, Continue Learning CTA, current world/level, XPBar, StreakChip, stars, latest badge, daily challenge card, recommended next activity. Deliberately sparse. |
| `/adventure` | Adventure map | All worlds as a scrolling map; per-world completion %, locked/current states. |
| `/adventure/[worldSlug]` | World map | Zoomed world; level nodes Completed/Current/Locked/Bonus wired to real progress; node click → `/play/[levelId]` or locked explainer. |
| `/ai-lab` | AI Lab index | Card grid of interactive modules + ML labs (phase G/H; pre-launch renders a designed "coming soon" state, never a dead grid). |
| `/playground` | My projects | Saved sandbox projects list + "New project". |
| `/achievements` | Achievements | Earned + locked (silhouetted) badges, certificates earned with download links. |
| `/profile` | Profile | Avatar picker, display settings (language EN/AR, reduced motion, sound), progress summary. No personal-data fields. |

**`(immersive)` sub-group** — no nav chrome, `dvh`-locked, own exit affordance

| Route | Page | Notes |
|---|---|---|
| `/play/[levelId]` | Level player | Hosts ALL activity types via the pluggable engine registry (BLOCK_CODING three-pane, QUIZ, SEQUENCING, DEBUGGING, AI_CLASSIFICATION, REAL_ML, AI_ETHICS, CODE_PREDICTION, PATTERN_RECOGNITION, CREATIVE_PROJECT). Server component loads the published level spec + student's prior attempt state, renders the matching client engine. Locked level → friendly locked screen with the prerequisite named. `?ctx=daily|assignment:{id}` records attempt provenance. |
| `/playground/[projectId]` | Sandbox editor | Free Blockly + simulation, no grading; autosave. |
| `/ai-lab/[moduleSlug]` | AI-Lab module player | Interactive module runtime (phase G). |

### 2.4 `(staff)` — Pro theme, roles TEACHER / SCHOOL_ADMIN

`(staff)/layout.tsx`: requires staff role, sets `data-theme="pro"`, renders top bar
(school name, locale switch, user menu, impersonation banner when active). Sub-layouts
provide the sidebars.

**Teacher — `/teach/*`** (`requireRole('TEACHER')`; SCHOOL_ADMIN may also view)

| Route | Page | Notes |
|---|---|---|
| `/teach` | Teacher dashboard | My classes cards, needs-attention list (struggling students: repeated fails, high hint usage, inactivity), recent submissions feed. |
| `/teach/classes` | Class list | |
| `/teach/classes/[classId]` | Class overview | Header + tab nav (nested routes below). Overview tab: completion ring, active-this-week, average stars, class code + printable QR. |
| `/teach/classes/[classId]/students` | Roster + ProgressMatrix | Students × levels heatmap (stars/attempts/hints), sortable. |
| `/teach/classes/[classId]/students/[studentId]` | Student detail | Timeline of attempts; per-attempt: workspace snapshot (read-only Blockly render), generated code, grading verdict, hints used, time spent; teacher feedback composer. |
| `/teach/classes/[classId]/assignments` | Class assignments | Assign world/module/lesson/level with due date; open/close. |
| `/teach/assignments` | All my assignments | Cross-class list. |
| `/teach/assignments/[assignmentId]` | Assignment detail | Per-student completion, quick links to attempts. |
| `/teach/reports` | Class reports | Time-spent, completion, mastery-by-concept; CSV/PDF export via export endpoint. |

**School admin — `/school/*`** (`requireRole('SCHOOL_ADMIN')`)

| Route | Page | Notes |
|---|---|---|
| `/school` | School dashboard | Licence status (seats used/total, expiry), active students this week, per-grade completion, teacher activity. |
| `/school/teachers` | Teacher list | Invite/create teacher, deactivate. |
| `/school/teachers/[teacherId]` | Teacher detail | Classes taught, activity, reset password. |
| `/school/students` | Student directory | Search/filter by grade/class/status; bulk credential-sheet generation (printable PDF of login cards). |
| `/school/students/[studentId]` | Student detail | Profile, classes, progress summary, reset credential, deactivate, data-deletion request flow. |
| `/school/classes` | Class list | Create class, assign teacher(s), academic year + grade. |
| `/school/classes/[classId]` | Class detail | Roster management (add/remove students), teacher assignment, class code regenerate. |
| `/school/imports` | Import history | Past CSV imports with status + error reports. |
| `/school/imports/new` | CSVImportWizard | Upload → column mapping → validation preview (row-level errors) → dry-run summary → commit. |
| `/school/imports/[importId]` | Import detail | Row results, downloadable error CSV, rollback within window. |
| `/school/curriculum` | Curriculum assignment | Assign published program/grade-band tracks to grades/classes; shows what NITAQ has licensed to this school. |
| `/school/reports` | School reports | Cross-class analytics, exports. |
| `/school/profile` | School profile | Name, logo (safe upload via storage driver), academic years, default locale, onboarding mode (roster-claim vs issued credentials). |

### 2.5 `(platform)` — `/nitaq/*`, Pro theme, roles NITAQ_ADMIN / SUPER_ADMIN

| Route | Page | Notes |
|---|---|---|
| `/nitaq` | Platform dashboard | Active schools, licences expiring ≤60d, DAU/WAU students, attempts/day, platform health (queue depth, error rate). |
| `/nitaq/schools` | School list | Create school (+ first SCHOOL_ADMIN), status filters. |
| `/nitaq/schools/[schoolId]` | School overview | Tabs as nested routes: `/licence` (seats, term, renew/suspend), `/admins`, `/usage`. |
| `/nitaq/licences` | Licence registry | All licences, expiry pipeline. |
| `/nitaq/users` | User search | Cross-tenant search; per-user: sessions, status, **Impersonate** (guarded action → separate session recording actor+subject, audit-logged, banner in target shell, hard 30-min TTL). |
| `/nitaq/curriculum` | Program list | PROGRAM → GRADE BAND tree entry point. Content statuses DRAFT/REVIEW/PUBLISHED/ARCHIVED throughout. |
| `/nitaq/curriculum/[programId]` | Program editor | Grade bands, world ordering, publish state. |
| `/nitaq/curriculum/worlds/[worldId]` | World editor | Module/lesson tree with drag reorder, prerequisites, world art/theme fields (localized JSONB `{en, ar}`). |
| `/nitaq/curriculum/levels/[levelId]` | Level editor | Tabbed: **Details** (title/story/objective/difficulty/grade/time/instructions/teacher notes — all localizable) · **Workspace** (activity type picker; for BLOCK_CODING: allowed-block toolbox config, starting workspace via embedded Blockly, grid-world designer for tiles/obstacles/carrots/goal) · **Grading** (success-condition composer from the reusable check library, max stars, XP, star thresholds, hint tiers ×4) · **Preview**. |
| `/nitaq/curriculum/levels/[levelId]/preview` | Level preview | Renders the real student LevelPlayer against the draft spec (immersive, no progress writes). |
| `/nitaq/achievements` | Achievement definitions | DB-stored defs (First Program, Loop Master, …): trigger rule, icon, localized copy. |
| `/nitaq/certificates` | Certificates | Template management + issued-certificate registry, revoke with reason. |
| `/nitaq/announcements` | Announcements | Author/publish to audiences (all schools / school subset / staff only). |
| `/nitaq/audit-log` | Audit log | Filterable by actor, school, action type, date; impersonation events highlighted. |
| `/nitaq/settings` | Platform settings | SUPER_ADMIN only: NITAQ_ADMIN accounts, feature flags (AI Lab, Bunny Guide per school), platform config. |

### 2.6 API surface — server actions vs route handlers

**Rule of thumb:** UI-coupled CRUD mutations = **server actions** (typed, Zod-validated,
`withAuth`-wrapped, `revalidatePath`/`revalidateTag` on success). Anything **binary,
multipart, high-frequency, polled, streamed, or called by non-browser clients** =
**route handler** under `src/app/api/`.

**Route handlers** (all wrapped in the same `withAuth` + Zod + rate-limit stack):

| Endpoint | Method | Auth | Purpose |
|---|---|---|---|
| `/api/levels/[levelId]/attempts` | POST | STUDENT | **Grading submit.** Body: `{ workspaceJson, clientResult }`. Server loads workspace into headless Blockly, regenerates JS (never trusts client code), executes via JS-interpreter with step/op budget against `src/engine`, evaluates success conditions, persists attempt, awards XP/stars, unlocks, triggers achievement + certificate checks. Returns `{ verdict: 'PASS'\|'FAIL'\|'PARTIAL', feedback, stars, xpAwarded, unlockedLevelIds, newAchievements }`. Rate-limited per student. |
| `/api/imports` | POST | SCHOOL_ADMIN | Multipart CSV upload → creates import job, returns `importId`. Size/type validated, stored via storage driver. |
| `/api/imports/[importId]` | GET | SCHOOL_ADMIN | JSON status for wizard polling (`parsing → validated → committing → done/failed`, row error list). |
| `/api/certificates/[certificateId]/file` | GET | owner student, their staff, or platform | Streams rendered PDF/PNG (`?format=`). Render on first request, cache in object storage. |
| `/api/verify/[certificateId]` | GET | public | Safe-fields JSON for QR scanners / third parties (page at `/verify/…` queries the DB directly). |
| `/api/exports/[reportKey]` | GET | staff | CSV/PDF report downloads (streamed). |
| `/api/files/[...key]` | GET | varies | Storage-driver passthrough in dev; issues signed URL redirect in prod (S3-compatible). |
| `/api/ai/guide` | POST | STUDENT (flag-gated) | Bunny Guide chat, SSE streaming, provider abstraction. Phase G — path reserved now. |
| `/api/health` | GET | none | Liveness/readiness for Docker orchestration. |

**Server actions** (each lives in its module's `server/actions.ts`; representative, not exhaustive):

- `auth`: `staffLogin`, `studentLogin`, `joinWithClassCode`, `signOut`, `requestPasswordReset`, `resetPassword`, `startImpersonation`, `stopImpersonation`
- `schools` (platform): `createSchool`, `updateSchool`, `setLicence`, `suspendSchool`, `createSchoolAdmin`
- `schools` (school-admin): `updateSchoolProfile`, `createTeacher`, `deactivateTeacher`
- `classes`: `createClass`, `updateClass`, `archiveClass`, `assignTeacher`, `addStudentsToClass`, `removeStudentFromClass`, `regenerateClassCode`
- `students`: `createStudent`, `updateStudent`, `deactivateStudent`, `resetStudentCredential`, `generateCredentialSheet`, `requestStudentDeletion`
- `imports`: `mapImportColumns`, `commitImport`, `rollbackImport` (upload itself is the route handler)
- `curriculum`: `createProgram/World/Module/Lesson/Level`, `updateLevelDetails`, `updateLevelWorkspace`, `updateLevelGrading`, `reorderChildren`, `setPrerequisite`, `transitionStatus` (draft→review→published→archived), `assignCurriculumToClass`
- `learning`: `saveWorkspaceDraft` (debounced autosave), `revealHint` (server-authoritative tier tracking), `markLessonRead`, `completeAiLabModule`
- `assignments`: `createAssignment`, `updateAssignment`, `closeAssignment`, `giveAttemptFeedback`
- `achievements` (platform): `createAchievementDef`, `updateAchievementDef` (awarding is engine-side in the grading pipeline, never an action)
- `certificates`: `issueCertificateManually`, `revokeCertificate`, `updateCertificateTemplate` (milestone issuance is automatic in grading pipeline)
- `announcements`: `createAnnouncement`, `publishAnnouncement`, `archiveAnnouncement`
- `playground`: `createProject`, `saveProject`, `renameProject`, `deleteProject`
- `profile`: `updateAvatar`, `updateDisplaySettings`

Every action returns a discriminated `ActionResult<T> = { ok: true; data: T } | { ok: false; error: ErrorCode; fieldErrors? }` — no thrown errors across the wire, so client forms can render localized field messages.

---

## 3. Middleware & guard strategy

Single `src/middleware.ts` doing **cheap, optimistic** work only — the authoritative
checks are server-side (Prisma is not edge-safe, and middleware must never be the only
auth wall):

1. **Locale (next-intl).** `createMiddleware(routing)` with `locales: ['en','ar']`,
   `defaultLocale: 'en'`, `localePrefix: 'as-needed'`, locale persisted in the
   `NEXT_LOCALE` cookie so a child who picked Arabic in `/profile` keeps it. The root
   layout reads the resolved locale and renders `<html lang={locale} dir={locale === 'ar' ? 'rtl' : 'ltr'}>`;
   all styling uses CSS logical properties, so RTL needs no middleware involvement.
2. **Session presence routing (no DB).** Reads the opaque `bb_session` cookie
   (httpOnly, Secure, SameSite=Lax). Path-prefix table: `/teach|/school|/nitaq|/home|/adventure|/play|/playground|/ai-lab|/achievements|/profile`
   require a cookie → missing cookie redirects to `/login` (staff paths) or
   `/student-login` (student paths) with `?next=`. `(auth)` pages with a cookie present
   redirect to `/` (which role-routes). This is UX-only.
3. **Matcher** excludes `/api`, `_next`, static assets: `matcher: ['/((?!api|_next|.*\\..*).*)']`.

**Authoritative layer (defense in depth):**

- `getSessionContext()` in `modules/auth/server/session.ts`, wrapped in React `cache()`:
  validates the session token against the DB once per request; returns
  `{ userId, role, schoolId, studentId?, permissions, impersonation?: { actorUserId } }`.
- Each audience layout calls `requireRole(...)` → renders `ForbiddenScreen` (403, not a
  redirect) for authenticated-but-wrong-role, redirects to login when unauthenticated.
- Every query/action goes through `withAuth(requiredPermission, handler)` which injects
  the tenant-scoped context; all Prisma reads/writes for tenant entities go through the
  data-access layer that forces `where: { schoolId: ctx.schoolId }`. Route params like
  `[classId]` are always re-verified to belong to `ctx.schoolId` — never trusted.

---

## 4. Folder structure

```
src/
├─ middleware.ts
├─ i18n/                        # next-intl config: routing.ts, request.ts
├─ messages/                    # en.json, ar.json (UI strings only; content i18n is JSONB in DB)
│
├─ app/
│  ├─ [locale]/
│  │  ├─ layout.tsx             # root: <html lang dir>, fonts, NextIntlClientProvider, Toaster
│  │  ├─ (public)/
│  │  │  ├─ page.tsx            # landing
│  │  │  ├─ verify/[certificateId]/page.tsx
│  │  │  └─ legal/{privacy,terms}/page.tsx
│  │  ├─ (auth)/
│  │  │  ├─ layout.tsx          # centered card shell
│  │  │  ├─ login/{page.tsx, forgot/page.tsx, reset/[token]/page.tsx}
│  │  │  ├─ student-login/page.tsx
│  │  │  └─ join/{page.tsx, [code]/page.tsx}
│  │  ├─ (student)/
│  │  │  ├─ layout.tsx          # requireRole(STUDENT), data-theme="play"
│  │  │  ├─ (shell)/
│  │  │  │  ├─ layout.tsx       # StudentNav + OfflineBanner
│  │  │  │  ├─ home/page.tsx
│  │  │  │  ├─ adventure/{page.tsx, [worldSlug]/page.tsx}
│  │  │  │  ├─ ai-lab/page.tsx
│  │  │  │  ├─ playground/page.tsx
│  │  │  │  ├─ achievements/page.tsx
│  │  │  │  └─ profile/page.tsx
│  │  │  └─ (immersive)/
│  │  │     ├─ layout.tsx       # full-dvh, no nav
│  │  │     ├─ play/[levelId]/page.tsx
│  │  │     ├─ playground/[projectId]/page.tsx
│  │  │     └─ ai-lab/[moduleSlug]/page.tsx
│  │  ├─ (staff)/
│  │  │  ├─ layout.tsx          # requireStaff, data-theme="pro", TopBar + ImpersonationBanner
│  │  │  ├─ teach/
│  │  │  │  ├─ layout.tsx       # teacher sidebar
│  │  │  │  ├─ page.tsx
│  │  │  │  ├─ classes/{page.tsx, [classId]/{layout.tsx, page.tsx,
│  │  │  │  │   students/{page.tsx, [studentId]/page.tsx},
│  │  │  │  │   assignments/page.tsx}}
│  │  │  │  ├─ assignments/{page.tsx, [assignmentId]/page.tsx}
│  │  │  │  └─ reports/page.tsx
│  │  │  └─ school/
│  │  │     ├─ layout.tsx       # school-admin sidebar
│  │  │     ├─ page.tsx
│  │  │     ├─ teachers/{page.tsx, [teacherId]/page.tsx}
│  │  │     ├─ students/{page.tsx, [studentId]/page.tsx}
│  │  │     ├─ classes/{page.tsx, [classId]/page.tsx}
│  │  │     ├─ imports/{page.tsx, new/page.tsx, [importId]/page.tsx}
│  │  │     ├─ curriculum/page.tsx
│  │  │     ├─ reports/page.tsx
│  │  │     └─ profile/page.tsx
│  │  └─ (platform)/
│  │     └─ nitaq/
│  │        ├─ layout.tsx       # requireRole(NITAQ_ADMIN|SUPER_ADMIN), platform sidebar
│  │        ├─ page.tsx
│  │        ├─ schools/{page.tsx, [schoolId]/{layout.tsx, page.tsx, licence/page.tsx,
│  │        │   admins/page.tsx, usage/page.tsx}}
│  │        ├─ licences/page.tsx
│  │        ├─ users/page.tsx
│  │        ├─ curriculum/{page.tsx, [programId]/page.tsx,
│  │        │   worlds/[worldId]/page.tsx,
│  │        │   levels/[levelId]/{page.tsx, preview/page.tsx}}
│  │        ├─ achievements/page.tsx
│  │        ├─ certificates/page.tsx
│  │        ├─ announcements/page.tsx
│  │        ├─ audit-log/page.tsx
│  │        └─ settings/page.tsx
│  └─ api/
│     ├─ levels/[levelId]/attempts/route.ts
│     ├─ imports/{route.ts, [importId]/route.ts}
│     ├─ certificates/[certificateId]/file/route.ts
│     ├─ verify/[certificateId]/route.ts
│     ├─ exports/[reportKey]/route.ts
│     ├─ files/[...key]/route.ts
│     ├─ ai/guide/route.ts      # reserved, phase G
│     └─ health/route.ts
│
├─ engine/                      # LOCKED: pure TS, ZERO imports from app/modules/ui, no DOM
│  ├─ index.ts                  # public API of the engine
│  ├─ types.ts                  # GridWorld, Tile, EntityState, Command, StepEvent, RunResult
│  ├─ world.ts                  # world construction from LevelSpec grid JSON
│  ├─ simulate.ts               # deterministic step reducer: (state, command) -> state + events
│  ├─ run.ts                    # execute a command/program stream with step & op budgets → StepTrace
│  ├─ checks/                   # reusable grading checks, one file each, pure functions
│  │  ├─ reachedDestination.ts, collectedItems.ts, avoidedTiles.ts,
│  │  ├─ usedBlock.ts, prohibitedBlock.ts, maxBlockCount.ts,
│  │  └─ variableValue.ts, expectedOutput.ts, expectedSequence.ts, classifierResult.ts
│  └─ __tests__/
│
├─ modules/
│  ├─ auth/          # sessions, login flows, withAuth, impersonation, rate limiting
│  ├─ schools/       # school entity, licences, school profile, academic years
│  ├─ classes/       # classes, rosters, class codes, teacher assignment, assignments-to-students
│  ├─ students/      # student accounts, credentials, deletion/retention flows
│  ├─ imports/       # CSV import jobs: parse, map, validate, commit, rollback
│  ├─ curriculum/    # program/grade-band/world/module/lesson/level content, statuses, publishing
│  ├─ learning/      # student progress, attempts, unlocks, hints, XP/stars, daily challenge
│  ├─ blockly/       # block definitions, toolbox config, codegen, workspace (de)serialization, headless server codegen
│  ├─ simulation/    # CLIENT rendering of engine: Canvas renderer, sprites, playback controls
│  ├─ grading/       # SERVER orchestration: regenerate code → run engine → evaluate checks → persist + award
│  ├─ achievements/  # achievement defs, award evaluation, badge display
│  ├─ certificates/  # milestones, issuance, PDF/PNG render, registry, verification queries
│  ├─ analytics/     # aggregate queries: class/school/platform dashboards, reports, exports
│  ├─ announcements/ # platform → school messaging
│  ├─ audit/         # audit log write API (append-only) + platform read UI queries
│  ├─ ai/            # phase G: Bunny Guide provider abstraction, safety policy, AI-Lab modules
│  ├─ ml/            # phase H: in-browser ML labs (curated datasets, train/eval loop, confidence)
│  └─ shared/        # cross-domain domain helpers ONLY (LocalizedText type + resolver, pagination, date/period utils)
│
├─ ui/                          # design system — imports NOTHING from modules/engine
│  ├─ tokens.css                # layer 1+2+3 tokens (see §6.1)
│  ├─ primitives/               # Button, Input, Select, Checkbox, Switch, Dialog, Drawer, Tabs,
│  │                            # Tooltip, Toast, Card, Badge, Chip, Avatar, Progress, Skeleton,
│  │                            # Table, Pagination, Breadcrumbs, Stepper, FormField, EmptyState,
│  │                            # ErrorState, Spinner, VisuallyHidden
│  ├─ composites/               # audience-neutral: DataTable, StatCard, PageHeader, ConfirmDialog,
│  │                            # SearchInput, FilterBar, LocaleSwitcher
│  └─ hooks/                    # useReducedMotion, useDirection, useMediaQuery, useOnline
│
├─ lib/                         # infrastructure, no domain knowledge
│  ├─ db.ts                     # Prisma client singleton
│  ├─ storage/                  # driver abstraction: local.ts, s3.ts, index.ts
│  ├─ rate-limit.ts
│  ├─ env.ts                    # Zod-validated process.env, fails fast at boot
│  ├─ crypto.ts                 # Argon2id, token generation
│  └─ result.ts                 # ActionResult helpers
│
└─ styles/globals.css           # Tailwind 4 entry, @theme mapping, font-face

prisma/  {schema.prisma, migrations/, seed.ts}        # seed = demo school per spec §seed
tests/   (Vitest unit+integration, mirrors src/)      # engine tests colocated in src/engine/__tests__
e2e/     (Playwright: auth.spec, student-play.spec, teacher.spec, import.spec, verify.spec)
```

### 4.1 Module anatomy (uniform across all `src/modules/*`)

```
modules/classes/
├─ index.ts            # PUBLIC API — the only file other modules may import
├─ schemas.ts          # Zod schemas + z.infer types (CreateClassInput, …); safe for client import
├─ components/         # React components for this domain (server + client mixed, 'use client' per file)
└─ server/             # every file imports 'server-only'
   ├─ queries.ts       # reads; every fn takes ctx: TenantCtx first, wrapped in React cache()
   ├─ actions.ts       # 'use server'; withAuth(permission, schema, handler); revalidates on success
   └─ service.ts       # multi-step business logic shared by actions/route handlers (optional)
```

### 4.2 Import boundary rules (enforced with eslint-plugin-boundaries + `import/no-restricted-paths`)

| Layer | May import | Must never import |
|---|---|---|
| `src/engine` | TS stdlib only | anything else (React, Prisma, modules, DOM types) — keeps it extractable as a package |
| `src/ui` | `lib` utils, its own files | `modules/*`, `engine`, Prisma |
| `src/lib` | node stdlib, npm infra deps | `modules/*`, `ui`, `app` |
| `src/modules/X` | `ui`, `lib`, `engine`, `modules/shared`, and **other modules only via their `index.ts`** | deep paths like `modules/Y/server/queries` — cross-module deep imports are a lint error |
| `src/app` | modules' public APIs, `ui`, `i18n` | `engine` directly, any module `server/` internals except via module index re-exports |

Known intended cross-module edges (documented, via public APIs): `grading → blockly (headless codegen), engine wrapper, learning, achievements, certificates` · `learning → curriculum (published specs)` · `analytics → read-models of learning/classes/schools` · everything → `auth (withAuth, session)`. Anything else appearing in lint output is a design smell to review.

---

## 5. Data-fetching & mutation conventions

- **Server components by default.** Pages/layouts call `modules/*/server/queries.ts`.
  All authed pages are dynamic (they read cookies); no fighting the cache for per-user data.
- **Per-request dedupe** with React `cache()` on every query (`getClass(ctx, id)` called
  by layout + page = one DB hit).
- **Cross-request caching only for global content:** published curriculum specs
  (worlds/levels) are tenant-independent → wrapped in `unstable_cache` with tags
  `curriculum:published` and `level:{id}`, revalidated by `transitionStatus` on publish.
  Certificates verify page uses tag `cert:{id}`. Tenant data is never cross-request cached in MVP.
- **Mutations:** server actions validate (Zod) → authorize (`withAuth`) → write →
  `revalidatePath`/`revalidateTag` → return `ActionResult`. Forms use
  `useActionState`; optimistic UI only where harmless (e.g. avatar pick), never for
  grading/XP (server-authoritative per LOCKED decisions).
- **The grading hot path** returns its payload directly from the route handler (no
  revalidation round-trip); the client updates player state from the response, and the
  student shell re-fetches header stats on next navigation.

## 5.1 Loading / error / empty conventions (per route segment)

- Every list/detail segment ships `loading.tsx` with **layout-matched skeletons**
  (Skeleton primitives; no spinners-on-white). Immersive player shows a themed
  "preparing your level" loader with the world's art.
- `error.tsx` per audience group minimum + per high-risk segment (player, imports,
  level editor): friendly copy, retry button, error ref id; student version uses the
  lost-bunny illustration, staff version shows technical ref for support.
- `not-found.tsx` per audience group; `ForbiddenScreen` (403) rendered by guards —
  wrong-role users are told, not silently redirected.
- Empty states are **designed CTAs, never blank**: no classes yet → "Create your first
  class"; no assignments → assign CTA; student with no progress → Continue Learning
  pointing at level 1; locked level → prerequisite named with a link; import history
  empty → "Import your students" wizard link.
- Offline: `useOnline` in both shells renders a non-blocking banner; the player
  additionally autosaves workspace JSON to localStorage keyed by `attempt:{levelId}`
  and offers resume-on-reconnect.

---

## 6. Component architecture

### 6.1 Token system — one system, two themes

Three CSS layers in `src/ui/tokens.css`; Tailwind 4 maps utilities onto layer 2 via
`@theme inline`, so the same utility classes restyle per audience:

```css
:root {            /* L1: primitives — raw scales, never used directly in components */
  --bb-carrot-500: oklch(0.72 0.17 55);  --bb-sky-500: …;  --bb-ink-900: …;
  --bb-space-*: …; --bb-font-display: "Baloo 2"; --bb-font-ui: "Nunito"; --bb-font-pro: "Inter";
}
[data-theme="play"] {   /* L2 semantic remap — student */
  --surface: var(--bb-cream-50); --accent: var(--bb-carrot-500);
  --radius-md: 1rem; --font-heading: var(--bb-font-display); /* chunky, warm, high-radius */
}
[data-theme="pro"] {    /* L2 semantic remap — staff/platform */
  --surface: #fff; --accent: var(--bb-sky-600);
  --radius-md: 0.5rem; --font-heading: var(--bb-font-pro);   /* dense, neutral, compact */
}
```

`data-theme` is set on the top wrapper `<div>` of `(student)` vs `(staff)`/`(platform)`
layouts (root `<html>` is shared across groups, so theming hangs off the group wrapper).
Rules: components consume **semantic tokens only**; all spacing/positioning uses
**logical properties** (`ms-4`, `pe-6`, `text-start`) so Arabic RTL is automatic;
`prefers-reduced-motion` + the profile toggle gate every animation through
`useReducedMotion`.

### 6.2 Key composite components (owning module in brackets)

**Student / learning**

- `AdventureMap` [learning] — client; scrollable/pannable SVG map composed of `WorldZone`
  sections (each world's distinct art via themed background layers), `WorldNode` /
  `LevelNode` (states: `completed{stars}` / `current` (pulse, reduced-motion aware) /
  `locked` / `bonus`), `PathConnector` (draws progress fill along the path). Data: one
  server query `getAdventureState(ctx)` merging published curriculum + student unlocks.
- `LevelPlayerShell` [learning] — client orchestrator for `/play/[levelId]`. Grid:
  header (title, exit, StarBurst target, attempt count) + activity engine slot + footer
  (Run/Reset/Submit, HintPanel trigger). Selects the engine component from an
  `activityEngineRegistry: Record<ActivityType, React.ComponentType<EngineProps>>` —
  adding activity type #11 means registering one component, no shell changes.
- `BlockCodingEngine` [blockly+simulation] — the three-pane LOCKED layout: left toolbox
  (from level's allowed blocks), center `BlocklyWorkspace`, right `SimulationCanvas`.
  Tablet (<lg): vertical split with workspace/simulation tab toggle.
- `BlocklyWorkspace` [blockly] — SSR-safe wrapper: a client component that
  `next/dynamic`-imports the real Blockly mount with `ssr: false`; props
  `{ toolbox, initialJson, rtl, readOnly, onChange(json) }`. Handles resize observer,
  RTL flip (`rtl: locale==='ar'`), JSON (de)serialization, and the BLOCKS ⇄ CODE toggle
  (read-only generated-code view with syntax highlight). Also used read-only in the
  teacher attempt viewer and the level editor.
- `SimulationCanvas` [simulation] — client Canvas 2D renderer over `engine` types:
  renders `GridWorld` + entities from a `StepTrace`, plays it back with rAF tweening
  (instant-jump mode under reduced motion), success/failure end-states. Pure renderer:
  props in, no engine mutation.
- `HintPanel` [learning] — drawer showing tiers 1→4 progressively; "Reveal next hint"
  calls `revealHint` action (server tracks usage; later tiers only after earlier ones).
- `StarBurst` [learning] — success celebration (stars fly to header slots); skipped
  under reduced motion, replaced by static result card.
- `XPBar`, `StreakChip`, `BadgeTile`, `DailyChallengeCard`, `ContinueLearningCard` [learning/achievements] — home/header widgets, server-rendered where static.

**Staff / platform**

- `DataTable` [ui/composites] — generic server-driven table: URL-state pagination/sort/
  filter (searchParams as source of truth → server component re-queries), row actions
  slot, CSV export hook, built-in loading skeleton + empty-state slot. Used for every
  staff/platform list.
- `StatCard`, `TrendStat` [ui/composites] — dashboard tiles (value, delta, sparkline).
- `ProgressMatrix` [analytics] — client virtualized students × levels heatmap; cell =
  stars/attempts/hint-usage glyph (color + icon, never color alone); click-through to
  attempt detail; column groups per module.
- `AttemptViewer` [grading] — teacher-side: read-only `BlocklyWorkspace` + generated
  code + grading verdict breakdown (which checks passed/failed) + feedback thread.
- `CSVImportWizard` [imports] — client Stepper flow: Upload (drag-drop, route-handler
  POST) → MapColumns (auto-guess, per-column selects) → Validate (server dry-run, row
  error table, downloadable error CSV) → Commit (progress via `/api/imports/[id]`
  polling) → Done (credential-sheet CTA).
- `LevelEditor` composites [curriculum] — `GridWorldDesigner` (paint tiles/obstacles/
  carrots/goal on canvas), `SuccessConditionComposer` (add/configure checks from the
  reusable check library with live Zod validation), `HintTierEditor`, `LocalizedField`
  (EN/AR tabbed inputs writing `{en, ar}` JSONB), `ToolboxPicker` (allowed blocks).
- `CertificatePreview` [certificates] — renders the certificate template with live data
  server-side to an image for the platform template editor and the student
  achievements page; download buttons hit `/api/certificates/[id]/file`.
- `ImpersonationBanner` [auth] — fixed banner in every shell when
  `ctx.impersonation` is set: "Viewing as {name} — Stop" (stop action).

### 6.3 Client/server split conventions

- Default is a **server component**; add `'use client'` only for interactivity. The big
  client islands are: LevelPlayerShell subtree, BlocklyWorkspace, SimulationCanvas,
  AdventureMap, CSVImportWizard, ProgressMatrix, GridWorldDesigner, dialogs/forms.
- Server components never pass class instances/functions to islands — only serializable
  props (level spec JSON, trace JSON).
- `server-only` package imported at the top of every `modules/*/server/*` file;
  `schemas.ts` deliberately isomorphic (client forms reuse the same Zod schema for
  instant validation, server re-validates always).
- Blockly, canvas, and chart code must never be imported by a server component —
  enforced by keeping them behind client-component wrappers with dynamic import.

---

## 7. Scope & phasing notes

- Route groups `(public)`, `(auth)`, `(student)`, `(staff)`, `(platform)` and the module
  skeleton all land in **Phase A** — empty pages with real layouts/guards beat retrofitted
  auth. `/api/ai/guide`, `modules/ai`, `modules/ml`, `/ai-lab/*` player are **reserved
  paths** (G/H): the AI Lab index ships a designed coming-soon state until then, honoring
  the "everything visible works or is clearly marked as coming later" quality bar.
- The vendor-proposal gap is mostly in `(staff)` and `(platform)` surfaces; this design
  keeps each of those pages thin (DataTable + StatCard + module queries), which is what
  makes the ambitious surface count buildable by a small team.
