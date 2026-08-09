# Build Bunny — Security, RBAC, Tenancy & Privacy Architecture

Status: DESIGN — implementation-ready. Audience: senior engineer implementing Phase A (Foundation) and Phase L (QA/security).
Scope: authorization model, authentication, tenant isolation, impersonation, audit, licensing, PDPL-readiness, application security controls, child safeguarding.

All code locations below are relative to the repo root of the single Next.js 15 app.

```
src/server/auth/        session.ts, password.ts, withAuth.ts, permissions.ts, rate-limit.ts
src/server/repos/       *.repo.ts  (ONLY place Prisma is imported)
src/server/audit/       audit.ts, events.ts
src/server/licence/     licence.ts
src/server/uploads/     csv-import.ts, image.ts, storage-driver.ts
src/env.ts              zod-validated environment
prisma/schema.prisma
```

---

## 1. Roles, Permissions and the Access Matrix

### 1.1 Model

- **Roles are static enums**, not DB rows: `SUPER_ADMIN | NITAQ_ADMIN | SCHOOL_ADMIN | TEACHER | STUDENT` (+ `PARENT` reserved in the enum from day one, mapped to zero permissions until built).
- **Permissions are string constants** of the form `resource:action`, e.g. `students:manage`, `attempts:read`. A static map `ROLE_PERMISSIONS: Record<Role, Permission[]>` lives in `src/server/auth/permissions.ts`. No per-user permission overrides in MVP — keeps auditing trivial. If a school later needs a "co-teacher" nuance, add a new role, not per-user grants.
- **Scope is not encoded in the permission string.** Scope is enforced structurally by the tenant-scoped repository layer (§3): a TEACHER holding `attempts:read` can physically only query attempts of students in their own classes because the repo forces the join. The matrix below documents the *intended* scope per cell; the repos are the mechanism.

```ts
// permissions.ts (excerpt — shape only)
export const PERMISSIONS = [
  'schools:read', 'schools:manage',
  'licences:read', 'licences:manage',
  'staff:read', 'staff:manage',            // SCHOOL_ADMIN + TEACHER accounts
  'platform-admins:manage',                // NITAQ_ADMIN accounts (SUPER only)
  'students:read', 'students:manage',      // create, edit, reset password, deactivate
  'classes:read', 'classes:manage',
  'curriculum:read', 'curriculum:author', 'curriculum:publish',
  'assignments:read', 'assignments:manage',
  'attempts:read', 'attempts:submit', 'attempts:feedback',
  'analytics:school', 'analytics:platform',
  'certificates:read', 'certificates:issue', 'certificates:revoke',
  'announcements:read', 'announcements:manage-school', 'announcements:manage-platform',
  'impersonation:use',
  'audit:read-school', 'audit:read-platform',
  'branding:manage-school', 'branding:manage-platform',
  'ai-config:manage-school', 'ai-config:manage-platform',
  'exports:school', 'exports:platform',
] as const;
```

### 1.2 Access matrix

Legend: **M** = manage (create/update/delete/lifecycle) · **W** = write (create/update within constraints) · **R** = read · **–** = none.
Scope annotations: `(platform)` all schools · `(school)` own school only · `(classes)` own classes only · `(self)` own records only.

| Resource / action | SUPER_ADMIN | NITAQ_ADMIN | SCHOOL_ADMIN | TEACHER | STUDENT | PARENT (future) |
|---|---|---|---|---|---|---|
| Schools (create/deactivate/settings) | M (platform) | M (platform) | R+W profile (school) | R name only (school) | – | – |
| Licences | M (platform) | M (platform) | R (school) | – | – | – |
| NITAQ_ADMIN accounts | M (platform) | – | – | – | – | – |
| Platform config (env-level toggles, feature flags) | M | R | – | – | – | – |
| Staff users (school admins, teachers) | M (platform) | M (platform) | M (school) | R (school, directory) | – | – |
| Students | M (platform) | M (platform) | M (school) | W (classes: create via class flow, reset password, edit display name) | R+W avatar/display prefs (self) | R (own children) |
| Classes | M (platform) | M (platform) | M (school) | W (own classes: roster, class code rotate) | R membership (self) | – |
| Curriculum content (worlds/modules/lessons/levels) | M + publish | M + publish | R published (school) | R published + teacher notes | R published & assigned (self) | – |
| Assignments (world/module/level → class/student) | R (platform) | R (platform) | M (school) | M (classes) | R (self) | R (own children) |
| Attempts / progress / submitted code | R (platform, support only) | R (platform, support only) | R (school) | R + feedback (classes) | W submit + R (self only, never peers) | R (own children) |
| Analytics | R platform | R platform | R school | R classes | R self (simplified: XP, stars, streak) | R own children |
| Certificates | issue/revoke (platform) | issue/revoke (platform) | R (school) + trigger reissue request | R (classes) | R + download (self) | R (own children) |
| Public certificate verify page | public | public | public | public | public | public |
| Announcements | M platform | M platform | M school | R + M (classes, if enabled) | R targeted (self) | R targeted |
| Impersonation | use (any role) | use (SCHOOL_ADMIN/TEACHER/STUDENT only) | – | – | – | – |
| Audit logs | R platform | R platform | R school-scoped subset | – | – | – |
| Branding (logo, colors) | M platform + M any school | M any school | M school | – | – | – |
| AI assistant config (enable/disable, guardrail level) | M platform + per school | M per school | R + toggle within platform policy (school) | R | – | – |
| Data exports | M platform | M platform (audited) | M school (audited) | – | – | – |

Notes:
- STUDENT can never read another student's attempts, profile, or analytics. There is no student directory UI and no repo method that returns peer students to a STUDENT context.
- TEACHER "own classes" = rows in `ClassTeacher` join table for the current academic year.
- NITAQ_ADMIN cannot impersonate SUPER_ADMIN or NITAQ_ADMIN accounts; SUPER_ADMIN can impersonate anyone (both fully audited, §4).
- `curriculum:publish` is separate from `curriculum:author` so a future content-editor NITAQ role can be split off without schema change.

---

## 2. Authentication

### 2.1 Session store (DB-backed, LOCKED)

```prisma
model Session {
  id            String   @id @default(cuid())
  tokenHash     String   @unique          // sha256(base64url(32 random bytes)); raw token only in cookie
  userId        String
  role          Role                       // snapshot at login; permission changes require re-login
  schoolId      String?                    // null for platform staff
  mode          SessionMode @default(NORMAL) // NORMAL | IMPERSONATION
  actorUserId   String?                    // impersonation: the admin driving the session
  reason        String?                    // impersonation reason / ticket ref
  createdAt     DateTime @default(now())
  expiresAt     DateTime                   // absolute expiry
  idleExpiresAt DateTime                   // sliding expiry, bumped max once/5min
  revokedAt     DateTime?
  ip            String
  userAgent     String
  @@index([userId])
  @@index([expiresAt])
}
```

- The cookie carries the **raw token**; the DB stores only its SHA-256. A DB leak does not yield usable sessions.
- Lookup = hash cookie value → fetch → check `revokedAt IS NULL AND expiresAt > now() AND idleExpiresAt > now()`.
- "Log out everywhere" and admin-forced revocation = set `revokedAt` on all rows for a user (exposed at `POST /api/auth/revoke-all`, permission `students:manage` / `staff:manage` for the target's manager, always allowed for `(self)`).
- Nightly job deletes sessions expired > 7 days (kept briefly for incident forensics).

### 2.2 Cookie settings

| Setting | Value |
|---|---|
| Name | `__Host-bb_session` (prod; `bb_session` in dev over http) |
| Flags | `HttpOnly; Secure; SameSite=Lax; Path=/` — no `Domain` attribute (host-only) |
| Value | 32-byte random base64url token, nothing decodable |
| Locale/theme cookies | separate, non-HttpOnly, never trusted server-side |

`SameSite=Lax` + strict Origin checking (§8.2) is the CSRF posture. No JWTs anywhere; nothing about identity is stored client-side.

### 2.3 Password hashing — Argon2id (node `argon2` package)

| Parameter | Value | Rationale |
|---|---|---|
| type | argon2id | LOCKED |
| memoryCost | 65536 (64 MiB) | OWASP-recommended tier |
| timeCost | 3 | |
| parallelism | 1 | container-friendly; predictable p99 |
| saltLength / hashLength | 16 / 32 bytes | library defaults |

Target ≈ 100–250 ms per hash on the prod container; verify at deploy with a boot-time self-benchmark that logs a warning outside 50–500 ms. Store the full encoded string (`$argon2id$v=19$m=65536,t=3,p=1$...`) so parameters can be raised later; on successful login, rehash-if-parameters-outdated.

### 2.4 Student credential model (no email — LOCKED)

- **Identity:** `Student.username`, unique **per school**, not globally: `@@unique([schoolId, usernameNorm])` where `usernameNorm` = lowercased/trimmed. Login form asks for **school code + username + password** (school code resolves the tenant; also inferable from a per-school login URL `https://app.buildbunny.ae/s/{schoolSlug}/login`).
- **Username generation:** on CSV import or manual creation, generate `firstname` + 2-digit disambiguator (`omar12`), editable by SCHOOL_ADMIN/TEACHER. Never embed surname or grade (data minimization + guessing resistance is handled by rate limits, not obscurity).
- **Passwords:** teacher/admin-set. Minimum policy for students: ≥ 8 chars; the UI offers a "friendly password" generator (`word-word-##`, e.g. `sunny-rocket-42`) from a curated child-safe wordlist. Still Argon2id-hashed — no plaintext storage ever. The generated value is shown **once** on screen and on the printable login-card PDF; only the hash persists.
- **Teacher-managed reset:** `POST /api/classes/{classId}/students/{studentId}/reset-password` (permission `students:manage` for SCHOOL_ADMIN, or TEACHER scoped to that class). Generates a new friendly password, shows once, audit event `student.password_reset`. There is **no** student self-service reset and no email/SMS channel for children.
- **Class-code join flow:** each Class has `joinCode` (8 chars, Crockford base32, no vowels → no words), `joinCodeEnabled` boolean, `joinCodeExpiresAt`. Flow: student visits `/join`, enters code → server validates code + school licence seats → student picks display name from teacher-preapproved roster **or** creates a pending account that lands in the teacher's "Approve joins" queue (school-configurable; default = roster-match only, safest). Teacher can rotate/disable the code any time; rotation is one click and audited.
- **Staff login:** email + password at `/login`. Email verification required before first login for staff. Optional TOTP (RFC 6238) for staff; **mandatory TOTP for SUPER_ADMIN and NITAQ_ADMIN**. Recovery codes (10 × single-use) generated at TOTP enrolment.

### 2.5 Session lifetimes per role

| Role | Absolute lifetime | Idle timeout | Notes |
|---|---|---|---|
| STUDENT | 12 h | 4 h | Covers a school day incl. tablet sleep; devices are shared, so no long-lived sessions |
| TEACHER | 14 days | 24 h | "Keep me signed in" is implicit; classroom usability |
| SCHOOL_ADMIN | 7 days | 12 h | |
| NITAQ_ADMIN | 24 h | 60 min | |
| SUPER_ADMIN | 12 h | 30 min | Sensitive ops (licence change, impersonation start, export) additionally require password re-entry if last auth > 15 min (`sudo mode` timestamp on session) |
| IMPERSONATION session | 30 min | — | Non-renewable (§4) |

### 2.6 Brute-force and login rate limiting

Counter store: Postgres table `AuthThrottle(key, windowStart, count)` in MVP (single region, low volume); interface-compatible swap to Redis later. Keys and limits:

| Key | Limit | On exceed |
|---|---|---|
| `login:acct:{schoolId}:{usernameNorm}` | 5 fails / 15 min | Lock account 15 min; exponential ×2 per repeat window up to 24 h |
| `login:ip:{ip}` | 30 fails / 15 min | 429 + 15 min IP cooldown on login endpoints only |
| `join:ip:{ip}` (class-code guesses) | 10 fails / hour | 429; alert NITAQ if > 100/day platform-wide |
| `reset:staff-email:{email}` | 3 / hour | silent success response (no enumeration) |

- Locked **student** accounts show: "Ask your teacher to help you log in" — the teacher's roster view shows a lock icon and an "Unlock + reset password" action. Never a CAPTCHA for children.
- Failed and locked logins emit audit events (`auth.login_failed`, `auth.lockout`) with IP/UA but **never** the attempted password.
- Login responses are uniform ("Incorrect username or password") and constant-time-ish: always run Argon2 verify against a dummy hash when the user doesn't exist.

---

## 3. Tenant Isolation Enforcement

### 3.1 The two-layer pattern (guard + scoped repos)

**Layer 1 — `withAuth`.** Every server action and route handler is defined through the wrapper; there are no bare handlers.

```ts
// withAuth.ts (shape)
export function withAuth<I, O>(
  permission: Permission,
  schema: z.ZodType<I>,
  handler: (ctx: TenantCtx, input: I) => Promise<O>,
) { /* resolves session → role → permission check → builds ctx → parses input → handler */ }

export type TenantCtx = {
  userId: string;
  role: Role;
  schoolId: string | null;       // null ONLY for SUPER/NITAQ platform context
  teacherClassIds?: string[];    // resolved once per request for TEACHER
  impersonation?: { actorUserId: string; sessionId: string };
  audit: (e: AuditEvent) => void;  // request-scoped, flushed post-commit
  repos: Repos;                  // tenant-scoped repository set (below)
};
```

Failure modes: no session → 401; permission missing → 403 with a typed `PERMISSION_DENIED` payload (the UI has a designed permission-denied state, per spec); Zod failure → 400 with field errors. `ctx` is the **only** way handlers touch the DB — handlers never import Prisma.

**Layer 2 — tenant-scoped repositories** (`src/server/repos/*.repo.ts`). Rules:

1. `import { prisma }` is allowed **only** under `src/server/repos/` and `src/server/{auth,audit,licence}/`. Enforced by ESLint `no-restricted-imports` with per-directory overrides — CI fails otherwise.
2. Every repo method's first parameter is `ctx: TenantCtx`. For tenant-owned models the method **builds the `where` clause itself** from `ctx.schoolId` / `ctx.teacherClassIds` / `ctx.userId`; callers pass business filters only, never `schoolId`.
3. Client-supplied ids are always **compound-checked**: `findFirst({ where: { id, schoolId: ctx.schoolId } })` — never `findUnique({ where: { id } })` on a tenant model. A missing row and a cross-tenant row are indistinguishable (both 404).
4. STUDENT-context methods additionally pin `studentId: ctx.userId` (self scope); TEACHER-context list methods pin `classId: { in: ctx.teacherClassIds }`.
5. Platform-context methods (SUPER/NITAQ operating across schools) live in explicitly named repos (`platform-schools.repo.ts` etc.) that require `ctx.schoolId === null` and permission `*:platform`-class checks — the cross-tenant surface is enumerable in one directory.

**Defense in depth — Prisma client extension.** A `$extends` query hook inspects every query against a hardcoded list of tenant-owned models (`Student, Class, Attempt, Assignment, Certificate, ...`) and throws in dev/test (logs + metrics in prod) if the `where` tree contains no `schoolId` (or reachable relation filter). This is a tripwire, not the mechanism — the repos are the mechanism.

### 3.2 Schema rule that makes this cheap

**Every tenant-owned table carries `schoolId` directly**, even where derivable through a relation (e.g. `Attempt.schoolId` exists although `Attempt → Student → schoolId` would suffice). Denormalizing `schoolId` costs one indexed column and buys: single-hop scoping in every query, trivial `@@index([schoolId, ...])` composite indexes, and — critically — **RLS-upgradeability**.

### 3.3 RLS upgrade path (design now, enable later)

- The repo layer already runs every request inside `prisma.$transaction` via a `withTenantTx(ctx, fn)` helper that first executes `SET LOCAL app.current_school_id = $1` (and `app.current_role`). Today these GUCs are unused; enabling RLS later is *only* `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` + `CREATE POLICY tenant_isolation ON attempt USING (school_id = current_setting('app.current_school_id')::text)` per table, plus a `BYPASSRLS`-free app DB role. No application code changes.
- Migration files for the policies are written and checked in behind a `-- RLS: staged, not applied` marker so the shapes are reviewed now.

### 3.4 What enforces this in practice

- **Code review checklist** (PR template): any new Prisma model → "does it have `schoolId` + composite index? added to the tripwire model list? repo methods take ctx?"; any new server action → "wrapped in `withAuth`? correct permission? no raw ids trusted?"
- **Tests:**
  - `tests/integration/tenant-isolation.spec.ts`: seeds School A + School B (the demo-school seed script parameterized twice). For **every exported repo method** (enumerated via a registry the repos self-register into), calls it with a School-A ctx and School-B resource ids → expects 404/empty, never data. New repo methods fail the registry-completeness assertion until covered.
  - `tests/integration/permission-matrix.spec.ts`: table-driven — the §1.2 matrix encoded as fixtures; every (role, action) pair asserted against representative endpoints.
  - Playwright cross-tenant probe: logged in as School-A teacher, hits School-B object URLs and API routes directly → asserts 404 + permission-denied screens render.

---

## 4. Support Impersonation

### 4.1 Flow

1. NITAQ_ADMIN (or SUPER_ADMIN) opens a user's support page → "Impersonate" button → modal **requires**: free-text reason (min 15 chars) + optional ticket reference; re-auth (password) if sudo-mode timestamp > 15 min old.
2. `POST /api/admin/impersonation/start { targetUserId, reason, ticketRef? }` (permission `impersonation:use`). Server checks: target role is impersonatable by actor (NITAQ_ADMIN → SCHOOL_ADMIN/TEACHER/STUDENT only; SUPER_ADMIN → anyone), target account active, school active.
3. A **new Session row** is created: `mode=IMPERSONATION`, `userId=targetUserId`, `actorUserId=adminId`, `reason`, 30-min absolute expiry, non-renewable. The admin's own session cookie is **replaced** (original session id stashed in `Session.metadata.returnSessionId`), so exactly one identity is active per browser — no ambient dual cookies.
4. On expiry or `POST /api/admin/impersonation/stop`, the impersonation session is revoked and the cookie is restored to the original admin session (if still valid; otherwise → login).

### 4.2 In-product treatment

- Persistent top banner on every page, both themes: "You are viewing as **Omar A. (Student, Al Noor School)** — support session, 22:14 remaining — [End session]". Rendered in the root layout from server session data; not dismissible.
- `TenantCtx.impersonation` is set; the UI also exposes `data-impersonating` on `<body>` for a visual tint in the Pro theme.

### 4.3 Restricted actions during impersonation

Impersonation is **read-mostly by an allowlist**, not "everything the user can do". `withAuth` consults `IMPERSONATION_ALLOWED_PERMISSIONS`; anything else → 403 `IMPERSONATION_RESTRICTED`.

Allowed: all `*:read`, `attempts:submit` **against a sandbox flag** (submissions made under impersonation are stored with `viaImpersonation=true` and excluded from XP/stars/streaks/analytics — needed to reproduce grading bugs without corrupting a child's progress), navigation/UI state.
Blocked always: password changes/resets, user/class management, licence ops, exports, certificate issue/revoke, branding, AI config, announcements, deleting anything, starting nested impersonation.

### 4.4 Audit

Events: `impersonation.start`, `impersonation.stop` (with duration), `impersonation.blocked_action` (what was attempted), and every normal audit event emitted during the session carries both `actorUserId` (admin) and `onBehalfOfUserId` (subject). NITAQ dashboard has an "Impersonation log" view (permission `audit:read-platform`); a weekly digest of all impersonation sessions goes to SUPER_ADMIN.

---

## 5. Audit Log

### 5.1 Schema

```prisma
model AuditLog {
  id               String   @id @default(cuid())
  ts               DateTime @default(now())
  requestId        String                  // correlates multi-event requests
  actorUserId      String?                 // null = system job
  actorRole        Role?
  onBehalfOfUserId String?                 // impersonation subject
  schoolId         String?                 // null = platform-level event
  action           String                  // dot-namespaced, from typed catalog in events.ts
  resourceType     String
  resourceId       String?
  outcome          AuditOutcome            // SUCCESS | DENIED | FAILED
  ip               String?
  userAgent        String?
  metadata         Json                    // changed-field diff {before, after}, REDACTED list applied
  @@index([schoolId, ts])
  @@index([actorUserId, ts])
  @@index([action, ts])
}
```

- **Append-only enforced at the DB**: the application's Postgres role has `INSERT, SELECT` but **no UPDATE/DELETE** grant on `audit_log`. Purging is done by a separate maintenance role used only by the retention job.
- `metadata` diffs pass through a redaction filter (`passwordHash`, `tokenHash`, `joinCode`, TOTP secrets → `"[redacted]"`). Never log request bodies wholesale.
- Writes are collected on `ctx.audit(...)` during the request and flushed **after** the business transaction commits (an audit row for a rolled-back change is a lie); flush failures log to stderr + metric, never fail the user request.

### 5.2 Event catalog (typed constants in `src/server/audit/events.ts`)

| Domain | Events |
|---|---|
| auth | `login_success`, `login_failed`, `logout`, `lockout`, `password_changed`, `totp_enrolled`, `session_revoked` |
| students | `created`, `imported` (with row count + file hash), `updated`, `password_reset`, `deactivated`, `anonymized` |
| staff | `created`, `updated`, `role_changed`, `deactivated` |
| classes | `created`, `updated`, `roster_changed`, `join_code_rotated`, `join_code_disabled`, `join_approved`, `join_rejected` |
| curriculum | `created`, `updated`, `status_changed` (draft→review→published→archived), `deleted_draft` |
| assignments | `created`, `updated`, `removed` |
| licences | `created`, `updated`, `seats_changed`, `expired`, `grace_entered`, `readonly_entered`, `suspended`, `reactivated` |
| certificates | `issued`, `revoked`, `verify_page_hit` (sampled 1:100) |
| impersonation | `start`, `stop`, `blocked_action` |
| exports | `school_export_requested`, `school_export_downloaded`, `platform_export_*` |
| privacy | `deletion_requested`, `deletion_executed`, `retention_purge_run` |
| settings | `branding_changed`, `ai_config_changed`, `school_settings_changed` |

Non-events (deliberate): individual attempt submissions (that's product data in `Attempt`, not audit — logging every attempt would drown the log), page views, read access by permitted users (except exports and impersonation reads, covered by session events).

### 5.3 Retention & access

- Hot in Postgres **24 months**; monthly job archives rows > 24 months to object storage as gzipped NDJSON (same UAE region), then purges; archives kept 5 years then deleted.
- SCHOOL_ADMIN sees a filtered school-scoped subset (their staff/student lifecycle + join-code events) — not platform internals, not other schools, not impersonation reasons (they see that an impersonation of their user occurred, with actor "NITAQ Support" and timestamp, which is the honest-transparency posture for a processor).

---

## 6. Licence Enforcement

### 6.1 Model

```prisma
model Licence {
  id            String   @id @default(cuid())
  schoolId      String
  plan          String                     // display label; entitlements below are the truth
  studentSeats  Int
  staffSeats    Int?                       // null = unlimited staff
  startsAt      DateTime
  expiresAt     DateTime
  graceDays     Int      @default(30)
  status        LicenceStatus              // ACTIVE | GRACE | READ_ONLY | SUSPENDED  (derived nightly + on read)
  notes         String?
}
```

One `ACTIVE`-window licence per school (renewals are new rows → clean history). Status is derived from dates but cached on the row by a nightly job (and recomputed on any licence-gated check, so the job is a convenience, not a correctness dependency).

### 6.2 Seat counting

- A seat = one **non-deactivated, non-anonymized** Student row in the school. Deactivated students free their seat immediately (their data remains).
- Enforcement points (all server-side, in `licence.ts`, called by repos): student create, CSV import (pre-validates: "import needs 34 seats, 20 available" — rejects the whole file with a per-row report rather than partially importing), class-code join. Check is `SELECT count(*) ... FOR UPDATE` on a per-school advisory lock to prevent join-code race overshoot.
- Soft-warning banner to SCHOOL_ADMIN at ≥ 90% seats; NITAQ dashboard shows seat utilization per school (sales signal, not just enforcement).

### 6.3 Expiry ladder — never data loss

| Phase | Trigger | Behaviour |
|---|---|---|
| ACTIVE | within dates | full function |
| GRACE | `expiresAt` passed | full function; persistent banner for SCHOOL_ADMIN + TEACHER ("licence expired, renew by {date}"); NITAQ notified; students see nothing |
| READ_ONLY | grace exhausted | students: can log in, view progress/achievements/certificates, **cannot start or submit attempts** (friendly locked state, per error-state spec); teachers/admins: full read + exports, no writes except user deactivation; join codes disabled |
| SUSPENDED | manual NITAQ action only (e.g. 90 days read-only or contract dispute) | logins blocked except SCHOOL_ADMIN, who retains read + `exports:school`; landing page explains status |

- **No automated deletion ever results from licence state.** Deletion happens only through the offboarding flow (§7.4) with explicit school confirmation, or the retention schedule (§7.5).
- All transitions emit licence audit events; GRACE→READ_ONLY requires no human action (drift-proof), READ_ONLY→SUSPENDED requires one.

---

## 7. Privacy & PDPL-Readiness

Positioning: the architecture **supports** a UAE PDPL (Federal Decree-Law 45/2021) compliance review; we do not claim compliance in-product. School = data controller; NITAQ = processor.

### 7.1 Data-minimization inventory — exact fields stored per child

| Field | Stored | Why | Notes |
|---|---|---|---|
| `displayName` | yes | UI greeting, teacher roster, certificate | Recommended format enforced softly in UI: first name + last initial ("Omar A.") |
| `usernameNorm` | yes | login | school-scoped, no PII required in it |
| `passwordHash` | yes | auth | Argon2id only |
| `schoolId`, `grade`, class memberships | yes | tenancy + curriculum | |
| `avatarId` | yes | picked from built-in set | **no photo upload for students** |
| `localePref` (en/ar) | yes | i18n | |
| Progress: XP, stars, streaks, badges, level completion | yes | product core | |
| Attempts: workspace JSON, generated code, grading result, hint usage, timestamps, duration | yes | learning analytics + teacher review | free-text containment per §9 |
| Certificates: name-as-printed, achievement, date, cert id | yes | verifiable credential | verify page exposes only these + school name |
| DOB, address, phone, personal email, gender, nationality, photos | **never** | — | CSV importer **actively rejects** files containing recognized extra columns rather than silently dropping them — schools must not even transmit them |
| IP/user agent | transient | security only | on Session + AuditLog rows, lifetimes per §2.1/§5.3; never joined to learning analytics |

The importer's accepted CSV schema is exactly: `firstName, lastInitial, grade, className` (+ optional `username`). This is the enforcement of minimization at the boundary, not a policy document.

### 7.2 Analytics rule

All aggregate analytics (school, platform) are computed from pseudonymous ids; platform-level dashboards for NITAQ never display student names for schools they are not actively supporting (name resolution happens only inside school-scoped or impersonation views, which are audited).

### 7.3 Deletion & anonymization flows

- **Single student removal** (SCHOOL_ADMIN, or NITAQ on school's written request): two-step — `deactivate` (reversible, frees seat, hides from rosters) then `anonymize` (irreversible, requires typed confirmation). Anonymization: `displayName → "Former student"`, `usernameNorm → null`, `passwordHash → null`, sessions revoked, certificates revoked-or-reissued-to-paper per school choice, avatar reset; Attempt/progress rows **retained pseudonymously** (schoolId + random pseudonym) for aggregate analytics **unless** the school requests full erasure, in which case attempts are hard-deleted too. Both variants are one function with a flag: `anonymizeStudent(ctx, studentId, { eraseAttempts })`, audit `students.anonymized`.
- **Parental/data-subject requests** arrive via the school (controller); NITAQ provides the mechanism above plus a per-student data export (JSON) so the school can answer access requests.

### 7.4 School offboarding export

`POST /api/school/export` (SCHOOL_ADMIN, sudo-mode re-auth, audited) → async job builds a bundle in object storage: `students.csv`, `classes.csv`, `progress.csv` (per-student per-level stars/XP/completion), `attempts.jsonl` (optional toggle — large), `certificates/` (PDFs), `manifest.json` with row counts + SHA-256. Download link is single-use, expires 72 h, requires an authenticated SCHOOL_ADMIN session. NITAQ can generate the same bundle for a school that has lost admin access (permission `exports:platform`, audited with reason). After contract end + confirmation, `offboardSchool` runs `anonymizeStudent(eraseAttempts: true)` for all students, deletes staff PII, keeps the School row + licence/audit history (legitimate business records).

### 7.5 Retention schedule (enforced by a monthly `retention_purge_run` job)

| Data | Retention |
|---|---|
| Sessions | expiry + 7 days |
| Auth throttle rows | 30 days |
| Audit logs | 24 months hot, 5 years archived (§5.3) |
| Attempts of **active** students | life of licence relationship |
| Deactivated (not anonymized) students | auto-anonymize after 12 months deactivated (school notified 30 days prior) |
| CSV upload originals | deleted immediately after successful import (only the parsed rows persist); failed uploads after 24 h |
| Export bundles | 72 h |
| Backups | 35 days rolling; documented as containing pre-deletion data (standard DPA language) |

### 7.6 DPA contents (checklist for the commercial doc — engineering commitments it encodes)

Roles (school controller / NITAQ processor); processing purposes limited to the service; the §7.1 inventory as the data schedule; UAE-region storage & processing (me-central-1 / UAE North) with no cross-border transfer without controller instruction; subprocessor list (cloud provider, object storage, email provider for **staff** mail only) + change notice; security measures summary (this document's §§2–5, 8); breach notification to controller within 72 h of confirmation; deletion/return on termination via §7.4; audit/inspection cooperation; no advertising/profiling use of children's data; AI-provider clause staged for Phase G (no child free-text leaves the platform without controller opt-in, §9).

---

## 8. Application Security Controls

### 8.1 Input validation

- Zod schema at **every** server boundary — `withAuth(permission, schema, handler)` makes it structurally impossible to add an unvalidated action. Schemas colocated per module (`src/modules/classes/schemas.ts`), shared with client forms for UX parity.
- Never accepted from the client: `userId`, `schoolId`, `role`, XP/star/grading values, licence fields. Grading is authoritative server-side (LOCKED): the client submits **only** `{ levelId, workspaceJson, programAst }`; the server re-runs the deterministic engine and computes stars/XP itself. Workspace JSON is validated against a strict Zod schema of allowed block types (the level's `allowedBlocks`) and a size cap (64 KB) before interpretation.
- ids validated as cuid/uuid format before hitting repos (cheap 400s, cleaner logs).

### 8.2 CSRF posture

- Server Actions: Next.js already enforces same-origin (Origin/Host match) on action POSTs; we additionally pin `serverActions.allowedOrigins` to the canonical host in `next.config.ts`.
- Custom route handlers (uploads, exports, auth): middleware rejects any state-changing method whose `Origin` header is absent or ≠ canonical origin (403, audited if authenticated).
- `SameSite=Lax` cookie blocks cross-site POSTs at the browser layer. No third-party embedding (frame-ancestors 'none'), so no clickjacking path to actions. This three-layer posture replaces token-based CSRF; no hidden-field tokens needed.

### 8.3 File-upload safety

Only two upload surfaces exist in MVP — keep it that way; any new one gets a design review.

**CSV import (`POST /api/school/import`, SCHOOL_ADMIN):**
- Limits: 1 MB, 2,000 rows, `text/csv`/`text/plain` only, extension `.csv`; parsed with a streaming parser (papaparse) — never loaded via spreadsheet libs.
- Strict header allowlist (§7.1); unknown columns → whole-file reject with message naming the offending columns (minimization enforcement).
- Per-cell: trim, length caps (name ≤ 40), strip control chars; values beginning `= + - @ \t` are stored as-is (they're data) but **on any CSV export we prefix `'`** to neutralize formula injection in Excel — export-side, where the risk lives.
- Dry-run first: response is a validation report (row errors, seat check §6.2, duplicate usernames); commit is a second explicit call referencing the server-held parsed payload id. Original file deleted post-commit (§7.5).

**School logo (`POST /api/school/branding/logo`, SCHOOL_ADMIN / NITAQ):**
- PNG/JPEG/WebP only — **SVG rejected** (script/XXE surface). Magic-byte sniff, not extension/MIME trust; ≤ 2 MB; dimensions ≤ 2048².
- Always **re-encoded through sharp** (decode → resize to the two sizes we actually serve → re-encode WebP) — the original bytes are never stored or served; EXIF dies in re-encode.
- Stored via the storage driver under a random key (`logos/{cuid}.webp`), served from `/media/*` with `Content-Type` fixed by us, `X-Content-Type-Options: nosniff`, `Content-Disposition: inline; filename=...`, `Cross-Origin-Resource-Policy: same-origin`, immutable cache headers.

### 8.4 Environment validation & secret handling

- `src/env.ts`: single Zod schema for all env vars, parsed once at boot; the app **crashes on startup** with a named-variable error rather than limping. Exports a typed `env` object; `process.env` access anywhere else is an ESLint error.
- Server secrets (`DATABASE_URL`, `SESSION_PEPPER`, storage keys, future LLM keys) are never `NEXT_PUBLIC_*`; the schema physically separates `server:` and `client:` sections (t3-env pattern). CI greps built client bundles for secret prefixes as a tripwire.
- Secrets live in the platform's secret manager (AWS SSM/Secrets Manager or Azure Key Vault) injected as env at container start; none in the image, none in git (gitleaks in CI). `SESSION_PEPPER` (HMAC'd into token hashing) rotation supported by versioned prefix.

### 8.5 Security headers (set in `middleware.ts` / `next.config.ts`)

| Header | Value |
|---|---|
| Content-Security-Policy | `default-src 'self'; script-src 'self' 'nonce-{req}'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'; object-src 'none'` — nonce-based scripts; Blockly and Canvas work within this (no eval: the JS-interpreter parses without `eval`/`Function`, which is exactly why it was chosen) |
| Strict-Transport-Security | `max-age=63072000; includeSubDomains; preload` |
| X-Content-Type-Options | `nosniff` |
| Referrer-Policy | `strict-origin-when-cross-origin` |
| Permissions-Policy | `camera=(), microphone=(), geolocation=(), payment=()` |
| X-Frame-Options | `DENY` (legacy duplicate of frame-ancestors) |
| Cross-Origin-Opener-Policy | `same-origin` |

Exception: the public certificate **verify page** allows being framed? No — it stays `frame-ancestors 'none'`; schools link to it, they don't embed it.

### 8.6 Rate limits per endpoint class (middleware, same store as §2.6)

| Endpoint class | Limit (per key) |
|---|---|
| `POST /login`, `/s/{school}/login` | §2.6 table |
| `POST /join` (class code) | 10/h/IP |
| Attempt submission (`submitAttempt` action) | 30/min/student (fast-clicking child, not abuse-scale), 6 concurrent grading jobs/student |
| Certificate verify page + API | 30/min/IP, 60/min global burst per cert id |
| CSV import | 5/h/school |
| Exports | 2/day/school (more via NITAQ) |
| Auth-adjacent (password reset, TOTP) | 3/h/actor |
| General authenticated API/actions | 300/min/session (circuit-breaker, generous) |
| Public/unauthenticated pages | CDN/WAF-level, 60/min/IP on dynamic routes |

429 responses include `Retry-After`; student-facing UI translates to a friendly "Whoa, too fast! Try again in a moment."

---

## 9. Safeguarding (children's free-text and AI surfaces)

### 9.1 Inventory of free-text surfaces (MVP)

Children can free-type in exactly three places — everything else is picker/block-based by design:
1. **`Say` block string** in Blockly programs (rendered in the simulation speech bubble).
2. **CREATIVE_PROJECT titles/descriptions** (activity type 10).
3. **Class-code join display name** (only in the non-roster join variant, which is off by default).

Containment principles: (a) smallest possible audience, (b) filter at write, (c) human (teacher) in the loop before any audience widens.

### 9.2 Controls

- **Visibility default = self + teacher.** No student-to-student sharing in MVP. A creative project is visible to its author and their teachers; a future "class showcase" requires explicit teacher approval per item (moderation queue on the teacher dashboard: Approve / Reject-with-kind-message).
- **Write-time filter** (`src/server/safety/text-filter.ts`) applied to all three surfaces, both `en` and `ar` wordlists: profanity/slur blocklist (curated lists + school-extendable), PII pattern detection (email regex, 7+-digit number runs, URL patterns) → rejected with child-friendly copy ("Let's keep personal information private!"); length caps (Say ≤ 120 chars, title ≤ 60, description ≤ 500). Filter events with repeated hits (≥ 3/day/student) surface a quiet flag on the teacher dashboard — signal, not punishment.
- **Rendering**: all student text rendered as text nodes (React default escaping), never `dangerouslySetInnerHTML`, no markdown/HTML interpretation, no link auto-detection (URLs render inert).
- **Server-side too**: the grading engine treats `Say` strings as opaque data; they never reach logs unredacted (`metadata` redaction list includes `sayStrings`).

### 9.3 Bunny Guide (Phase G — designed now, built later)

- Provider abstraction (`src/server/ai/provider.ts`) with the **safety layer platform-owned, not provider-owned**: system prompt (never completes exercises, redirects personal topics, age-appropriate register), input pre-filter (§9.2 filter + PII strip **before** any external call), output post-filter (blocklist + "no full solutions" heuristic: responses containing complete valid programs for the current level are replaced with a hint), provider moderation endpoint where available.
- **No child free-text leaves the platform** unless the school's AI config is enabled (SCHOOL_ADMIN toggle within platform policy, `ai-config:*` permissions) — off by default; the DPA's AI clause (§7.6) is the contractual mirror. When enabled, requests carry a session-scoped pseudonym, never name/username/school-identifying data.
- Full conversation logs stored 90 days, school-scoped, teacher-readable for their classes (transparency to the adult in the room), audit event `ai_config.changed` on any toggle.
- REAL_ML labs (Phase H) use **curated built-in datasets only** for training in MVP-scope; student-uploaded training data (images/text) is a separate future design with its own review — not enabled by a config flag.

---

## 10. Implementation checklist (Phase A slice)

1. `env.ts` + boot validation; secret manager wiring; gitleaks + bundle-grep CI steps.
2. Prisma models: `User`, `Student` (or unified `User` with role — **decision: unified User table** with `kind: STAFF|STUDENT` discriminator, student-specific columns nullable, since sessions/audit/impersonation all want one user id space), `Session`, `AuditLog`, `AuthThrottle`, `Licence`, `School`, `Class`, `ClassTeacher`, `ClassStudent` — every tenant table with `schoolId` + composite indexes.
3. `password.ts` (Argon2id params + self-benchmark), `session.ts` (create/verify/revoke/rotate), cookie helpers.
4. `permissions.ts` matrix + `withAuth` + `TenantCtx` + repo skeletons + ESLint import fences + Prisma tripwire extension + `withTenantTx` GUC helper (RLS-ready).
5. `audit.ts` + event catalog + DB grants migration (append-only).
6. Login routes (staff, student, join), throttling, lockout UX, TOTP for platform staff.
7. `licence.ts` seat/status checks wired into student-creating repos.
8. Security headers middleware + origin-check middleware + rate-limit middleware.
9. Test suites: tenant-isolation registry spec, permission-matrix spec, Playwright cross-tenant probe, auth/lockout integration tests.
10. Impersonation endpoints + banner + allowlist (can land with the NITAQ admin build in Phase E/F, but the Session schema fields exist from day one).
