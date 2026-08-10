# Privacy & data inventory — the school trust pack (m5 §35)

This is the exact answer to "what do you store about my students, why, for
how long, and who can see it" — written for a school's IT/data-protection
lead to read before signing a contract, and for NITAQ staff to hand over
verbatim. Every field below is a real column in `prisma/schema.prisma`
(migration `m1_identity_schools_audit_events` through
`m4_teaching_certificates`); nothing here is aspirational.

## 1. What we store about a child (Student role)

| Field | Table | Why we need it |
|---|---|---|
| Display name | `User.displayName` | Shown to the student, their teachers, and their school admin; printed on certificates. |
| Username | `User.username` (namespaced `{schoolCode}__{username}`), `User.displayUsername` (the plain form the student types) | Sign-in identity. Not an email — students never provide one; a synthetic, unreachable placeholder email is generated internally only because the auth framework's schema requires the column (see §3). |
| Password | `Account.password` | Sign-in. Stored as a scrypt hash (Better Auth's default), never plaintext, never logged. |
| Student ID (school's own) | `StudentProfile.studentIdentifier` | The school's own roster identifier (e.g. a SIS id) — the CSV importer's dedupe key. Never a login secret. |
| Grade | `StudentProfile.grade` | Curriculum/program eligibility, class rostering, analytics grouping. |
| School, class memberships | `User.schoolId`, `ClassMembership` | Every tenant-scoped query derives from this — it's the isolation boundary itself. |
| Locale, avatar choice | `User.locale`, `User.avatarId` | UI preference (English/Arabic; a small in-app avatar icon — no photo upload exists anywhere in the product). |
| XP, stars, streak | `StudentProfile.xpTotal/starsTotal/streakCurrent/streakBest/lastActiveDate` | The gamification the product is built on — cached totals, recomputed transactionally on every graded attempt. |
| Per-level progress | `StudentProgress` (status, stars, attempt count, autosaved workspace) | Resuming a level, unlocking the next one, the teacher progress matrix. `draftWorkspace` is the student's in-progress Blockly program, autosaved every 2s so a dropped classroom wifi connection doesn't lose work. |
| Attempt history | `ActivityAttempt` (workspace JSON, generated code, verdict, timing) | Grading is server-authoritative and replayable — a teacher can re-run exactly what the student submitted (`/teach/attempts/[id]`). This is the one table that stores actual *work product*, not just outcomes. |
| XP ledger | `XpEvent` | Append-only, idempotent award history (why a student has the XP total they have). |
| Hints used | `HintUsage` | Which hint tiers were revealed, and when — powers the "heavy hints" teacher flag and the star-cap rule. |
| Daily activity | `StudentDailyActivity` (date, run/completion/xp counts) | Streak computation and the "active this week" analytics figure. Date-level granularity only — no timestamps of exactly when in the day. |
| Achievements earned | `StudentAchievement` | Badge display. |
| Certificates | `Certificate` | See §4 — deliberately **frozen**, decoupled from the live account after issuance. |
| Teacher feedback received | `TeacherFeedback.body` | Free-text notes a teacher writes about the student's work, attached to a level. |
| Sessions | `Session` (token, expiry, IP, user agent) | Sign-in state. IP/user-agent are Better Auth's own security fields (anomaly detection, session listing), not analytics. |
| Learning events | `LearningEvent` (login, level started/completed, hint used, achievement earned) | The append-only analytics stream behind every dashboard number. Payloads are minimal by design — **never** workspace content or free text (schema comment: "Minimal payloads only"). |

**What we deliberately do not collect, anywhere in the schema:** email
address (synthetic placeholder only, see §3), phone number, home address,
date of birth, a real photo, biometric data, precise location, or any
payment/financial detail from a student. There is no student-facing free-text
field at all except the Blockly `say(...)` block's author-authored dialogue
(part of level content, not student input) — the only student-authored
"content" the platform stores is a Blockly program (blocks + generated code),
not prose.

## 2. What we store about a teacher / school admin (Staff roles)

Name, a real email address (staff sign in by email, unlike students),
password hash, role, an optional title (`TeacherProfile.title`), their class
memberships, and the audit trail of actions they perform (§5). Staff accounts
are provisioned by NITAQ or a school admin — there is no public sign-up
anywhere in the product (`emailAndPassword.disableSignUp: true` in
`src/lib/auth.ts`).

## 3. The synthetic student email, explained

Better Auth's `emailAndPassword` provider requires a unique `email` column
on `User`. Students don't have one, so `provisioning.ts` generates an
internal, unreachable placeholder (`syntheticStudentEmail(namespacedUsername)`)
that is never displayed, never emailed, and never usable to contact anyone —
it exists purely to satisfy the auth framework's schema, not as a real
identifier. This is a deliberate design choice for a product whose entire
audience is children too young to be expected to have an email address.

## 4. Certificates are a deliberate exception — frozen, not live

A `Certificate` row freezes `studentName`, `schoolName`, `title`,
`starsEarned`, and `levelsCount` **at the moment it is issued** — it does
not join back to the live student record for its display fields. The FK
(`Certificate.studentUserId`) is `onDelete: SetNull`, not `Cascade`, and is
the *only* SetNull relation on `User` in the whole schema (every other
child table cascades). This means:

- A student's certificate keeps showing their name and stars **exactly as
  they were at issuance**, even if the account is later renamed, disabled,
  or fully erased (§6).
- The public verify page (`/verify/[verifySlug]`) reads only the frozen
  fields — it never re-derives anything from the live student row, so it
  keeps resolving after erasure. `verifySlug` is a 22-character unguessable
  key (never the human-readable printed `serial`), so a leaked class roster
  can't be used to enumerate certificates.

## 5. Audit trail

Every provisioning action (student/staff created, password reset, account
disabled/enabled, CSV import, class roster change, join-code rotation,
school/licence change, impersonation start/stop, curriculum publish, student
erasure, data export) writes an `AuditLog` row: who did it (`actorUserId`,
`actorRole`), when, on whose behalf (`onBehalfOfUserId` for
impersonation), and a small `meta` JSON blob — never a student's actual
work product. `AuditLog` has **no foreign key to `User`** — a deliberate
design choice (schema comment: "audit records must survive account
erasure") so the trail of *who erased what, and when* survives the erasure
itself. Retained indefinitely (see §7 — this is the one table erasure never
touches).

## 6. Who can see what

| Role | Can see |
|---|---|
| **Student** | Their own profile, progress, attempts, achievements, certificates. Nothing about any other student (`SessionContext.schoolId` + compound `(id, schoolId)` lookups everywhere — proven by the tenant-isolation test suite, which asserts cross-school leakage is impossible for every registered query). |
| **Teacher** | Their own classes' students only — progress matrix, attempt replay (including the actual workspace/generated code, since staff may legitimately review a student's solution), feedback they've written. Not another teacher's class, even within the same school (asserted explicitly in the isolation suite). |
| **School admin** | Every student/teacher/class in their own school; the school-wide analytics dashboard, CSV exports, the full data-export bundle (§8), and can reset credentials, disable accounts, and erase a student (§6 below is this section — see the erasure workflow at §6.1). Never another school's data. |
| **NITAQ platform staff** (`SUPER_ADMIN`/`NITAQ_ADMIN`) | Cross-school by design — they operate the platform. Every access is impersonation-audited; impersonated sessions never write real progress/XP/rewards (`kind: PREVIEW` attempts, m3 contract) so a support engineer looking at a student's account can't accidentally change their stats. |
| **NITAQ (outside the app)** | Nothing beyond what platform staff can already see in-app — there is no separate data pipeline, warehouse, or analytics export outside this database. |

### 6.1 Student erasure

A school admin can permanently erase a student
(`src/modules/schools/server/management.ts`'s `eraseStudent`, wired to the
Students page). This is a genuine hard delete: `db.user.delete()` cascades
through **every** child table listed in §1 except `Certificate` (§4, frozen
and kept for public verification) and `AuditLog` (§5, kept for the audit
trail of the erasure itself). It is scoped to the calling admin's own school
(a compound lookup — another school's admin gets `NOT_FOUND`, not a
cross-tenant delete) and is itself audited (`students.erased`, with a
snapshot of the erased student's name/identifier captured *before* the
delete, since the row won't exist to look up afterward). There is no soft
delete, undo, or recycle bin — the confirmation dialog requires typing the
student's exact name before the button enables, specifically because this
cannot be reversed.

## 7. Retention

- **Active accounts**: kept for as long as the school's licence is active
  and the account isn't erased.
- **Sessions**: expire on their own schedule (7 days staff, enforced
  stricter for students per `getSessionContext`'s shared-classroom-device
  policy) and are wiped immediately on password reset or account erasure.
- **Attempts/progress/XP/hints/daily-activity/achievements**: live as long
  as the student account does; removed entirely on erasure (§6.1). No
  separate backup/archive of a specific student's data is kept once erased
  — see `docs/operations.md` for the whole-database backup/restore
  procedure, which is a disaster-recovery tool, not a way to selectively
  resurrect one erased student.
- **Certificates**: retained indefinitely with frozen fields (§4) — a
  certificate is a permanent credential a student earned; it outlives the
  account on purpose.
- **AuditLog**: retained indefinitely, by design (§5) — this is the
  accountability record, not personal data about the child themself.

## 8. School data export

A school admin can download a full export of their own school's data
(`/school/privacy`, `GET /api/school/privacy/export?format=json|csv`,
behind the `exports:school` permission) — school profile, every teacher,
every student (the same fields as §1's roster-level columns: name,
username, student ID, grade, classes, XP/stars/streaks, active status), every
class, and every certificate issued. It deliberately **excludes**
`verifySlug` (the public certificate lookup secret — see §4) and it never
includes attempt-level work product (Blockly programs, generated code) or
teacher feedback text, since the export's purpose is a roster-level
portability/audit snapshot, not a full attempt-log dump — a school that
needs a specific student's attempt history already has it in
`/teach/classes/[id]/students/[id]`. Every download is itself audited
(`privacy.data_exported`, with the row counts). Available as JSON (machine-
readable, one file) or CSV (one file with `### SECTION` markers per table —
see the route's code comment for why this ships as one bundled file rather
than a `.zip`: avoiding a new dependency for a file-format nicety, the same
call the certificate QR encoder already made).

## 9. Where this is enforced in code (for an auditor who wants to verify, not just read)

- Tenant scoping: every data-layer query lives in `src/modules/*/server/**`,
  takes the caller's `SessionContext` first, and derives `schoolId` from it
  — never from client input (`src/modules/schools/server/queries.ts`'s
  `requireSchool` helper is the pattern every module repeats). Proven, not
  just asserted: `tests/integration/tenant-isolation.test.ts` auto-discovers
  every such query and fails the build if a new one ships without an
  explicit cross-school leakage assertion.
- Answer-bearing content (correct answers, solutions, hint text) is
  stripped before it ever reaches a student response —
  `stripStudentPayload` in `src/modules/curriculum/server/queries.ts`.
- Erasure + export: `tests/integration/privacy.test.ts` — erasure removes
  the student and every learning row, the certificate survives with its
  frozen name and still verifies publicly, and the export contains the
  expected school-scoped data and nothing from another school.
