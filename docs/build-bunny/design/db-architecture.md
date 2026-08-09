# Build Bunny — Database Architecture

**Scope:** complete PostgreSQL 16 + Prisma data model for Build Bunny, honouring every LOCKED decision in the shared context: single shared-schema database, row-level tenancy via `schoolId` enforced in the server-side data-access layer (DAL), custom DB-backed sessions, deterministic server-side grading, JSONB-localized content (`{ en, ar? }`), and RLS-readiness without RLS on day one.

---

## 1. Conventions

- **IDs:** `String @id @default(cuid())` on all business tables. Exception: append-only high-volume logs (`AuditLog`, `AIUsageLog`) use `BigInt @id @default(autoincrement())` — cheaper index churn, natural insertion order.
- **Table naming:** Prisma models are PascalCase; every model carries `@@map("snake_case_plural")` (e.g. `@@map("activity_attempts")`). Omitted from excerpts below for readability — the implementer applies it uniformly.
- **Timestamps:** `createdAt DateTime @default(now())`, `updatedAt DateTime @updatedAt` on every mutable table. Soft-delete via nullable `deletedAt`/`archivedAt` where noted; hard deletion is the job of the erasure pipeline (§10), never ad-hoc.
- **Localized content fields** are `Json` shaped `{ "en": string, "ar"?: string }` (or rich variants documented per field). A shared Zod schema `LocalizedText` validates all of them. UI strings live in next-intl catalogs, **not** the DB.
- **Case-insensitive uniqueness** (email, username): values are lowercased in the DAL before write; the DB column stores the canonical lowercase form. (Alternative `citext` rejected: Prisma support is awkward and lowercase-at-boundary is sufficient.)
- **Foreign keys:** real FKs, `relationMode = "foreignKeys"`. Defaults: `onDelete: Restrict` for content/tenancy references, `onDelete: Cascade` for student-owned learning data (makes the erasure pipeline a set of simple deletes on `User`).
- **RLS-readiness:** every tenant-scoped table carries a **non-nullable `schoolId`** (denormalized where reachable via joins). If RLS is enabled later, policies compare `schoolId` to a session GUC (`SET app.school_id = ...`) — no schema change needed. Until then the DAL's `withAuth()` context injects `schoolId` into every query.

---

## 2. Domain map (ER overview)

```mermaid
erDiagram
  School ||--o{ User : "staff & students"
  School ||--o{ Licence : has
  School ||--o{ AcademicYear : has
  AcademicYear ||--o{ Class : has
  Class ||--o{ ClassMembership : has
  User ||--o| StudentProfile : "1:1 (students)"
  User ||--o| TeacherProfile : "1:1 (teachers)"
  User ||--o{ Session : has
  Program ||--o{ World : contains
  World ||--o{ Module : contains
  Module ||--o{ Level : contains
  Level ||--o{ LevelSnapshot : "published versions"
  Level ||--o{ LevelPrerequisite : requires
  User ||--o{ StudentProgress : "per level"
  User ||--o{ ActivityAttempt : submits
  ActivityAttempt }o--|| Level : "pins levelVersion"
  User ||--o{ StudentAchievement : earns
  Achievement ||--o{ StudentAchievement : awarded
  User ||--o{ Certificate : holds
  Class ||--o{ Assignment : receives
```

**Platform-global (no `schoolId`):** `Program`, `World`, `Module`, `Level`, `LevelSnapshot`, `LevelPrerequisite`, `Achievement`, platform-staff `User` rows, platform `Announcement` rows. Curriculum is NITAQ-authored and shared by all schools — this is the single biggest simplifier in the schema and matches the business model (annual licences to the same product). Per-school custom content is **not** supported in v1 (flagged in §11).

---

## 3. Enums (complete)

```prisma
enum UserRole        { SUPER_ADMIN NITAQ_ADMIN SCHOOL_ADMIN TEACHER STUDENT PARENT }
enum UserStatus      { INVITED ACTIVE SUSPENDED DELETED }
enum SchoolStatus    { TRIAL ACTIVE SUSPENDED ARCHIVED }
enum LicencePlan     { TRIAL STANDARD PREMIUM }
enum LicenceStatus   { ACTIVE EXPIRED SUSPENDED CANCELLED }
enum ClassRole       { STUDENT TEACHER }
enum ContentStatus   { DRAFT REVIEW PUBLISHED ARCHIVED }
enum ActivityType    { BLOCK_CODING CODE_PREDICTION DEBUGGING SEQUENCING
                       PATTERN_RECOGNITION AI_CLASSIFICATION REAL_ML AI_ETHICS
                       QUIZ CREATIVE_PROJECT }
enum ProgressStatus  { LOCKED AVAILABLE IN_PROGRESS COMPLETED }
enum AttemptGrade    { PASS PARTIAL FAIL }
enum AssignTarget    { WORLD MODULE LEVEL }
enum XpSource        { LEVEL_PASS STAR_BONUS ACHIEVEMENT STREAK_BONUS
                       DAILY_CHALLENGE MANUAL_ADJUST }
enum CertificateType { WORLD_COMPLETION COURSE_COMPLETION AI_EXPLORER CODING_FOUNDATIONS }
enum ImportStatus    { PENDING PROCESSING COMPLETED FAILED }
enum ErasureScope    { STUDENT_FULL SCHOOL_FULL ATTEMPT_PAYLOAD_PRUNE }
enum MLExperimentKind { IMAGE_CLASSIFIER TEXT_CLASSIFIER SENTIMENT }
```

`AuditLog.action` is deliberately a namespaced `String` ("user.impersonate.start", "level.publish") rather than an enum — audit actions grow weekly and enum migrations for an append-only log are pure friction.

---

## 4. Identity, auth, tenancy

### 4.1 User

One table for all humans. **Decision:** role + `schoolId` live directly on `User` (no `SchoolMembership` join table). The spec locks "Student: one school" and the sales model is school-scoped staff; a membership table would buy multi-school teachers at the cost of every auth check joining an extra table. If multi-school staff ever arrives, migrate by extracting (`userId`, `schoolId`, `role`) into a membership table — mechanical, not architectural. See §11-T1.

```prisma
model User {
  id               String     @id @default(cuid())
  role             UserRole
  schoolId         String?    // NULL only for SUPER_ADMIN / NITAQ_ADMIN
  school           School?    @relation(fields: [schoolId], references: [id], onDelete: Restrict)

  // Staff identity (email login). Students: NULL.
  email            String?    @unique            // canonical lowercase
  // Student identity (school-scoped username login). Staff: NULL.
  username         String?                       // canonical lowercase, e.g. "amina.k"

  displayName      String                        // the ONLY name we store for children
  passwordHash     String?                       // Argon2id; NULL while INVITED
  passwordUpdatedAt DateTime?
  mustChangePassword Boolean  @default(false)    // true for school-generated credentials

  status           UserStatus @default(ACTIVE)
  locale           String     @default("en")     // "en" | "ar"
  failedLoginCount Int        @default(0)        // lockout support
  lockedUntil      DateTime?
  lastLoginAt      DateTime?

  createdAt        DateTime   @default(now())
  updatedAt        DateTime   @updatedAt
  deletedAt        DateTime?                     // soft delete
  anonymizedAt     DateTime?                     // erasure pipeline marker

  // 1:1 profiles
  studentProfile   StudentProfile?
  teacherProfile   TeacherProfile?

  // Back-relations (sessions, memberships, progress, attempts, hints, xpEvents,
  // achievements, certificates, aiConversations, mlExperiments, dailyActivity,
  // auditActor, auditImpersonator, assignmentsCreated, importsCreated,
  // announcementsCreated, snapshotsPublished, erasureRequests) — declared in
  // full schema; elided here for readability.

  @@unique([schoolId, username])   // usernames are school-scoped
  @@index([schoolId, role, status])
}
```

DB-level invariants added in a raw migration (Prisma can't express CHECKs):

```sql
ALTER TABLE users ADD CONSTRAINT chk_role_school CHECK (
  (role IN ('SUPER_ADMIN','NITAQ_ADMIN') AND school_id IS NULL)
  OR (role NOT IN ('SUPER_ADMIN','NITAQ_ADMIN') AND school_id IS NOT NULL));
ALTER TABLE users ADD CONSTRAINT chk_login_identity CHECK (
  (role = 'STUDENT' AND username IS NOT NULL AND email IS NULL)
  OR (role <> 'STUDENT' AND email IS NOT NULL));
```

Children's data minimization is structural: a STUDENT row holds `displayName`, `username`, hash, locale — nothing else. No DOB/address/phone/personal-email columns exist anywhere.

### 4.2 Session (with impersonation)

Sessions store a **SHA-256 hash** of the random 256-bit token; the raw token lives only in the httpOnly cookie. Impersonation is a *separate session row* whose `userId` is the subject and `impersonatorId` the platform staffer — per the locked auth decision.

```prisma
model Session {
  id             String    @id @default(cuid())
  tokenHash      String    @unique
  userId         String                       // the SUBJECT (whose permissions apply)
  user           User      @relation("sessions", fields: [userId], references: [id], onDelete: Cascade)
  impersonatorId String?                      // set ⇒ impersonated session
  impersonator   User?     @relation("impersonations", fields: [impersonatorId], references: [id], onDelete: Cascade)
  schoolId       String?                      // denormalized from subject; RLS-ready
  createdAt      DateTime  @default(now())
  expiresAt      DateTime                     // students 12h; staff 7d sliding; impersonation 30min hard
  lastSeenAt     DateTime  @default(now())
  revokedAt      DateTime?
  ip             String?
  userAgent      String?

  @@index([userId, expiresAt])
  @@index([impersonatorId])
}
```

Rules enforced in the DAL: creating an impersonated session requires `NITAQ_ADMIN`+ and writes `AuditLog("user.impersonate.start")`; **every mutation performed under one** logs both actor and subject; impersonated sessions cannot open further impersonations; UI shows a persistent banner.

### 4.3 School and Licence

```prisma
model School {
  id             String       @id @default(cuid())
  slug           String       @unique          // "al-noor-international"
  name           String
  nameAr         String?
  status         SchoolStatus @default(TRIAL)
  emirate        String?                       // "Sharjah", "Dubai" — sales reporting
  contactName    String?                       // adult admin contact only
  contactEmail   String?
  timezone       String       @default("Asia/Dubai")  // streak day-boundary source
  defaultLocale  String       @default("en")
  logoKey        String?                       // object-storage key (driver abstraction)
  branding       Json?                         // { primaryColor?, certificateNote? }
  retentionMonthsAttemptPayload Int @default(12) // §10 pruning window
  createdAt      DateTime     @default(now())
  updatedAt      DateTime     @updatedAt
  archivedAt     DateTime?
  // back-relations: users, licences, academicYears, classes, and every
  // tenant-scoped table below.
}

model Licence {
  id              String        @id @default(cuid())
  schoolId        String
  school          School        @relation(fields: [schoolId], references: [id], onDelete: Restrict)
  plan            LicencePlan
  status          LicenceStatus @default(ACTIVE)
  studentSeats    Int                           // hard cap enforced at student creation/import
  staffSeats      Int?                          // NULL = unlimited
  startsAt        DateTime
  endsAt          DateTime
  graceDays       Int           @default(14)    // read-only access after expiry
  notes           String?
  createdByUserId String
  createdBy       User          @relation(fields: [createdByUserId], references: [id], onDelete: Restrict)
  createdAt       DateTime      @default(now())
  updatedAt       DateTime      @updatedAt

  @@index([schoolId, status, endsAt])
}
```

Licences are rows, not columns on School, so renewals are history (sales wants "when did they renew, at what seat count"). The DAL resolves "the active licence" as `status=ACTIVE AND now() BETWEEN startsAt AND endsAt + graceDays`, newest `endsAt` wins. **Seat enforcement:** on student create/CSV import, count `User WHERE schoolId=? AND role=STUDENT AND status=ACTIVE AND deletedAt IS NULL` inside the same transaction; hard-block over cap with an actionable error (§11-T8: hard block chosen over soft warn — a licence dispute mid-year is worse than an import error at onboarding).

---

## 5. School structure

```prisma
model AcademicYear {
  id        String   @id @default(cuid())
  schoolId  String
  school    School   @relation(fields: [schoolId], references: [id], onDelete: Cascade)
  name      String                         // "2026–2027"
  startsOn  DateTime @db.Date
  endsOn    DateTime @db.Date
  isCurrent Boolean  @default(false)       // partial unique index below
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@unique([schoolId, name])
}
// raw migration: CREATE UNIQUE INDEX one_current_year_per_school
//   ON academic_years (school_id) WHERE is_current;

model Class {
  id             String    @id @default(cuid())
  schoolId       String
  school         School    @relation(fields: [schoolId], references: [id], onDelete: Cascade)
  academicYearId String
  academicYear   AcademicYear @relation(fields: [academicYearId], references: [id], onDelete: Restrict)
  name           String                    // "Grade 4 – Falcon"
  gradeLevel     Int       @db.SmallInt    // 3..7
  classCode      String    @unique         // globally unique join code "BB-7K3M9Q"
  classCodeRotatedAt DateTime?
  joinEnabled    Boolean   @default(true)  // teacher can close the door
  archivedAt     DateTime?
  createdAt      DateTime  @default(now())
  updatedAt      DateTime  @updatedAt

  @@unique([schoolId, academicYearId, name])
  @@index([schoolId, gradeLevel])
}

model ClassMembership {
  id        String    @id @default(cuid())
  classId   String
  class     Class     @relation(fields: [classId], references: [id], onDelete: Cascade)
  userId    String
  user      User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  schoolId  String                          // denormalized; RLS-ready + cheap class lists
  role      ClassRole                       // STUDENT | TEACHER (co-teaching = 2 TEACHER rows)
  createdAt DateTime  @default(now())
  removedAt DateTime?                       // soft removal preserves attempt context

  @@unique([classId, userId])
  @@index([userId, role])
  @@index([schoolId, classId, role])
}
```

`classCode` is **globally** unique (students type only the code — no school selector), generated from an unambiguous alphabet (no 0/O/1/I), rotatable by the teacher; rotation kills the old code (single column, old value overwritten, rotation audit-logged).

### Profiles

```prisma
model StudentProfile {
  userId            String   @id            // 1:1, PK = FK
  user              User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  schoolId          String
  studentIdentifier String?                 // school's own ID from CSV; not used for login
  gradeLevel        Int      @db.SmallInt
  programId         String?                 // enrolled curriculum track ("one per student")
  program           Program? @relation(fields: [programId], references: [id], onDelete: SetNull)
  avatarConfig      Json     @default("{}") // { body, ears, accessory, color } — picker parts, no uploads
  // ── Gamification cache (authoritative ledgers in §8; these are read-model) ──
  totalXp           Int      @default(0)
  totalStars        Int      @default(0)
  currentStreak     Int      @default(0)
  longestStreak     Int      @default(0)
  lastActiveDate    DateTime? @db.Date      // local date in school timezone
  lastLevelId       String?                 // "Continue Learning" fast path
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt

  @@unique([schoolId, studentIdentifier])
  @@index([schoolId, gradeLevel])
}

model TeacherProfile {
  userId    String   @id
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  schoolId  String
  title     Json?                            // { en: "Ms.", ar?: "..." }
  subjects  String[] @default([])
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  @@index([schoolId])
}
```

### CSV import

```prisma
model ImportJob {
  id           String       @id @default(cuid())
  schoolId     String
  school       School       @relation(fields: [schoolId], references: [id], onDelete: Cascade)
  createdByUserId String
  createdBy    User         @relation(fields: [createdByUserId], references: [id], onDelete: Restrict)
  kind         String                        // "students" | "teachers"
  fileKey      String                        // object storage; deleted after processing (§10)
  status       ImportStatus @default(PENDING)
  totalRows    Int?
  successRows  Int?
  errorRows    Int?
  errors       Json?                         // [{ row: 14, message: "duplicate username" }]
  createdAt    DateTime     @default(now())
  completedAt  DateTime?
  @@index([schoolId, createdAt])
}
```

Import is transactional per chunk, generates usernames (`first.lastInitial`, dedup suffix) and one-time passwords, and produces a downloadable credential-cards PDF; the source CSV file is purged from object storage on completion (it may contain more columns than we store — we never persist them).

---

## 6. Curriculum

### 6.1 Hierarchy decision

Spec proposes PROGRAM → GRADE BAND → WORLD → MODULE → LESSON → ACTIVITY. **Chosen shape: `Program` (carries grade band) → `World` → `Module` → `Level`.** Two collapses, both deliberate (§11-T2):

- **Grade band → attributes on Program** (`gradeMin`/`gradeMax`). A grade band with no other data is a filter, not an entity. "AI & Coding Foundations (G3–4)" and "(G5–7)" are two Programs sharing nothing structurally.
- **Lesson → collapsed into Module.** Six levels of hierarchy is authoring hell and adventure-map hell. A Module *is* the lesson-sized unit ("Loops"); an optional cosmetic `sectionLabel` on Level restores visual grouping if an author wants it. Revisit only if real content outgrows it.

All four tables are **platform-global** (no `schoolId`): NITAQ authors once, every school consumes. Ordering uses spaced integers (`sortOrder` 1024, 2048, …) — reorder = renumber the moved item, no unique constraint on sortOrder (reorder transactions would fight it).

```prisma
model Program {
  id          String        @id @default(cuid())
  slug        String        @unique          // "ai-coding-foundations-g3-4"
  name        Json                            // { en, ar? }
  description Json
  gradeMin    Int           @db.SmallInt
  gradeMax    Int           @db.SmallInt
  status      ContentStatus @default(DRAFT)
  sortOrder   Int           @default(1024)
  coverKey    String?
  createdAt   DateTime      @default(now())
  updatedAt   DateTime      @updatedAt
  worlds      World[]
}

model World {
  id            String        @id @default(cuid())
  programId     String
  program       Program       @relation(fields: [programId], references: [id], onDelete: Restrict)
  slug          String                         // "bunny-meadow"
  name          Json
  tagline       Json?
  themeKey      String                         // frontend theme registry: "meadow" | "forest" | ...
  status        ContentStatus @default(DRAFT)
  sortOrder     Int           @default(1024)
  artKey        String?                        // map art asset
  prerequisiteWorldId String?                  // simple linear gate; NULL = always open
  prerequisiteWorld   World?  @relation("worldPrereq", fields: [prerequisiteWorldId], references: [id], onDelete: SetNull)
  createdAt     DateTime      @default(now())
  updatedAt     DateTime      @updatedAt
  modules       Module[]
  @@unique([programId, slug])
}

model Module {
  id        String        @id @default(cuid())
  worldId   String
  world     World         @relation(fields: [worldId], references: [id], onDelete: Restrict)
  slug      String
  name      Json                               // { en: "Loops", ar: "الحلقات" }
  description Json?
  status    ContentStatus @default(DRAFT)
  sortOrder Int           @default(1024)
  createdAt DateTime      @default(now())
  updatedAt DateTime      @updatedAt
  levels    Level[]
  @@unique([worldId, slug])
}
```

### 6.2 Level (= Activity) with pluggable payloads

Common pedagogical fields are **columns** (queryable, form-editable); the activity-type-specific machinery is one `config Json` validated by a per-type Zod schema selected on `activityType`. This is the pluggability seam: a new activity type = new Zod schema + new client engine module + new grader module. **No new tables.** (§11-T3.)

```prisma
model Level {
  id                String        @id @default(cuid())
  moduleId          String
  module            Module        @relation(fields: [moduleId], references: [id], onDelete: Restrict)
  slug              String                     // "carrot-collector"
  activityType      ActivityType
  status            ContentStatus @default(DRAFT)
  sortOrder         Int           @default(1024)
  sectionLabel      Json?                      // optional cosmetic lesson grouping

  // Pedagogy (all LocalizedText Json unless noted)
  title             Json
  story             Json?
  description       Json
  learningObjective Json
  instructions      Json
  postSuccessExplanation Json?                 // "why Repeat 4 beats four Moves"
  teacherNotes      Json?
  hints             Json                       // exactly 4 tiers: [{tier:1, text:{en,ar?}}, ...]

  difficulty        Int           @db.SmallInt // 1..5
  recommendedGradeMin Int?        @db.SmallInt
  recommendedGradeMax Int?        @db.SmallInt
  estimatedMinutes  Int           @db.SmallInt
  maxStars          Int           @default(3) @db.SmallInt
  xpReward          Int                        // base XP on first PASS
  isBonus           Boolean       @default(false) // map renders as Bonus node

  config            Json                       // activity-type payload, Zod-validated (below)
  challenge         Json?                      // optional bonus objective {text, successConditions[], xpBonus}

  currentVersion    Int           @default(0)  // last published version; 0 = never published
  createdByUserId   String
  createdBy         User          @relation("levelsCreated", fields: [createdByUserId], references: [id], onDelete: Restrict)
  updatedByUserId   String?
  createdAt         DateTime      @default(now())
  updatedAt         DateTime      @updatedAt

  snapshots         LevelSnapshot[]
  prerequisites     LevelPrerequisite[] @relation("target")
  requiredBy        LevelPrerequisite[] @relation("requirement")

  @@unique([moduleId, slug])
  @@index([activityType, status])
}
```

`config` for `BLOCK_CODING` (illustrative excerpt, the Zod schema is the contract):

```json
{
  "grid": { "cols": 8, "rows": 6, "start": {"x":0,"y":3,"dir":"E"},
            "tiles": [{"x":3,"y":3,"type":"ROCK"}, {"x":5,"y":3,"type":"CARROT"}],
            "goal": {"x":7,"y":3} },
  "allowedBlocks": ["when_start","move_forward","turn_left","turn_right","repeat"],
  "startingWorkspace": { "blocks": { "languageVersion": 0, "blocks": [] } },
  "maxBlocks": 12,
  "successConditions": [
    { "check": "REACHED_DESTINATION" },
    { "check": "COLLECTED_ALL", "itemType": "CARROT" },
    { "check": "USED_BLOCK", "blockType": "repeat" }
  ],
  "starRules": { "3": { "maxBlocks": 6, "maxHintTier": 1 }, "2": { "maxBlocks": 9 } }
}
```

`QUIZ` config holds `questions[]`; `SEQUENCING` holds `items[]` + `correctOrder`; `REAL_ML` holds `datasetKey` (curated built-in), `categories[]`, `minExamplesPerClass` — each with its own Zod schema, all with localized text at the leaves.

### 6.3 Prerequisites

Join table from day one — the spec promises branching paths later, and single-FK prerequisites can't express "requires A **and** B". Cost is negligible now.

```prisma
model LevelPrerequisite {
  id             String @id @default(cuid())
  levelId        String                       // the gated level
  level          Level  @relation("target", fields: [levelId], references: [id], onDelete: Cascade)
  requiresLevelId String                      // must be COMPLETED first
  requires       Level  @relation("requirement", fields: [requiresLevelId], references: [id], onDelete: Cascade)
  @@unique([levelId, requiresLevelId])
  @@index([requiresLevelId])
}
```

The DAL validates acyclicity on write (DFS over the module/world's prerequisite edges — the graph is tiny). Default authoring behaviour: the level editor auto-adds "previous level in module" as a prerequisite; authors may delete/add edges.

### 6.4 Versioning: published snapshots

**Chosen strategy (§11-T4): draft-in-place + immutable publish snapshots, at Level granularity.**

- Authors edit the live `Level` row freely (DRAFT/REVIEW).
- **Publish** = Zod-validate the whole level (including config and all 4 hints; Arabic optional — see open questions), then in one transaction: write a `LevelSnapshot` with `version = currentVersion + 1` containing the *frozen full payload* (every pedagogical field + config + hints + xpReward + maxStars + starRules), set `Level.currentVersion += 1`, `status = PUBLISHED`.
- **Students always play the latest snapshot**, never the draft row. `ActivityAttempt` pins `(levelId, levelVersion)` so grades stay interpretable after re-publishes ("she got 2 stars on v3 whose 3-star rule was ≤6 blocks").
- Structural fields (`sortOrder`, `moduleId`, prerequisites, status) stay live — moving a level on the map is not a content change and must not fork versions.
- Unpublish = set status ARCHIVED; snapshots remain (attempts reference them forever).

```prisma
model LevelSnapshot {
  id                String   @id @default(cuid())
  levelId           String
  level             Level    @relation(fields: [levelId], references: [id], onDelete: Cascade)
  version           Int
  content           Json                       // frozen full level payload
  publishedAt       DateTime @default(now())
  publishedByUserId String
  publishedBy       User     @relation(fields: [publishedByUserId], references: [id], onDelete: Restrict)
  @@unique([levelId, version])
}
```

Rejected: full temporal/history tables on every content row (heavy, no user need) and Git-style content repos (over-engineering for a 100-level catalogue). Worlds/Modules/Programs don't snapshot — their text fields are display-only; if that ever matters, the same pattern extends.

---

## 7. Learning: assignments, progress, attempts, hints

### 7.1 Assignment

Teachers assign a world, module, or level to a class or an individual student. Polymorphism via one target-type discriminator + three nullable FKs with a CHECK (exactly one set), same pattern for assignee.

```prisma
model Assignment {
  id              String       @id @default(cuid())
  schoolId        String
  school          School       @relation(fields: [schoolId], references: [id], onDelete: Cascade)
  assignedByUserId String
  assignedBy      User         @relation(fields: [assignedByUserId], references: [id], onDelete: Restrict)
  // assignee: exactly one
  classId         String?
  class           Class?       @relation(fields: [classId], references: [id], onDelete: Cascade)
  studentId       String?
  student         User?        @relation("assignmentsReceived", fields: [studentId], references: [id], onDelete: Cascade)
  // target: exactly one, matching targetType
  targetType      AssignTarget
  worldId         String?
  world           World?       @relation(fields: [worldId], references: [id], onDelete: Cascade)
  moduleId        String?
  module          Module?      @relation(fields: [moduleId], references: [id], onDelete: Cascade)
  levelId         String?
  level           Level?       @relation(fields: [levelId], references: [id], onDelete: Cascade)

  note            Json?                        // teacher instructions {en, ar?}
  assignedAt      DateTime     @default(now())
  dueAt           DateTime?
  archivedAt      DateTime?

  @@index([schoolId, classId, archivedAt])
  @@index([studentId, dueAt])
}
-- raw migration:
-- CHECK (num_nonnulls(class_id, student_id) = 1)
-- CHECK (num_nonnulls(world_id, module_id, level_id) = 1)
```

### 7.2 StudentProgress — the per-level read model

One row per (student, level) once the level becomes reachable. This is the table the adventure map, teacher matrix, and Continue-Learning all read — it is a **maintained read model**, updated transactionally on every graded attempt; `ActivityAttempt` is the source of truth if it ever needs rebuilding.

```prisma
model StudentProgress {
  id            String         @id @default(cuid())
  studentId     String
  student       User           @relation(fields: [studentId], references: [id], onDelete: Cascade)
  schoolId      String
  levelId       String
  level         Level          @relation(fields: [levelId], references: [id], onDelete: Cascade)
  status        ProgressStatus @default(LOCKED)
  bestStars     Int            @default(0) @db.SmallInt   // monotonic: never decreases
  bestScore     Int?           @db.SmallInt               // 0..100
  attemptCount  Int            @default(0)
  failStreak    Int            @default(0)                // consecutive non-PASS; struggling signal
  maxHintTier   Int            @default(0) @db.SmallInt   // deepest hint ever revealed here
  xpEarned      Int            @default(0)                // total XP from this level
  totalTimeSeconds Int         @default(0)
  unlockedAt    DateTime?
  firstPassedAt DateTime?
  lastAttemptAt DateTime?
  createdAt     DateTime       @default(now())
  updatedAt     DateTime       @updatedAt

  @@unique([studentId, levelId])
  @@index([schoolId, levelId, status])          // class × level matrix
  @@index([studentId, status])                  // map render, continue-learning
  @@index([schoolId, status, failStreak])       // struggling-students scan
}
```

Unlock propagation: when an attempt flips a level to COMPLETED, the DAL finds levels whose prerequisites are now all satisfied (`LevelPrerequisite` join against the student's COMPLETED set) and upserts their progress rows to AVAILABLE — done in the grading transaction so the map is instantly correct.

### 7.3 ActivityAttempt — deterministic grading record

```prisma
model ActivityAttempt {
  id             String       @id @default(cuid())
  studentId      String
  student        User         @relation(fields: [studentId], references: [id], onDelete: Cascade)
  schoolId       String
  levelId        String
  level          Level        @relation(fields: [levelId], references: [id], onDelete: Cascade)
  levelVersion   Int                          // pins the LevelSnapshot graded against
  attemptNumber  Int                          // 1-based per (student, level)

  workspaceJson  Json?                        // Blockly JSON serialization as submitted (≤64KB, Zod-capped)
  generatedCode  String?      @db.Text        // server-side codegen output (JS now) — stored for teacher review
  engineResult   Json?                        // summary, see below (≤32KB)

  grade          AttemptGrade
  score          Int          @db.SmallInt    // 0..100 weighted check score
  starsAwarded   Int          @db.SmallInt    // stars THIS attempt earned (0 if < best)
  xpAwarded      Int                          // XP THIS attempt granted (0 on repeats unless improvement)
  hintTierUsed   Int          @default(0) @db.SmallInt // deepest tier revealed before submit
  durationSeconds Int                         // client-reported, server-capped at 2h
  clientGrade    AttemptGrade?                // what the client engine claimed (advisory)
  gradeMismatch  Boolean      @default(false) // server != client ⇒ telemetry / anti-cheat signal
  payloadPrunedAt DateTime?                   // §10: workspace/code/result nulled after retention

  createdAt      DateTime     @default(now())

  @@unique([studentId, levelId, attemptNumber])
  @@index([studentId, levelId, createdAt(sort: Desc)])  // teacher attempt review
  @@index([schoolId, createdAt])                        // school activity feeds/rollups
  @@index([levelId, grade, createdAt])                  // level difficulty tuning (platform)
}
```

`workspaceJson`/`engineResult` nullable **only** for non-workspace activity types (QUIZ stores answers in `engineResult.answers`) and for pruned rows.

### 7.4 The deterministic-grading data flow

1. **Client**: student presses Run → local engine animates via JS-interpreter playback; result shown instantly (*advisory*). On Submit, client POSTs `{ levelId, workspaceJson, durationSeconds, clientGrade }`. It never sends XP, stars, score, or generated code as truth.
2. **Server (`withAuth(STUDENT)` route handler)**, one transaction:
   a. Zod-validate payload; size-cap workspace (64KB).
   b. Load latest `LevelSnapshot` for `levelId` (reject if not PUBLISHED or prerequisites unmet — recheck server-side).
   c. **Codegen server-side** from `workspaceJson` (never trust client code), producing `generatedCode`.
   d. Run `src/engine/` (pure, deterministic, DOM-free) against the snapshot's grid config with a step budget (e.g. 10,000 steps) and wall-clock guard — infinite loops terminate as FAIL with feedback "your bunny never stopped hopping".
   e. Run the grading checks from `successConditions` + `starRules` + `hintTierUsed` (read from `HintUsage`) → `grade, score, starsAwarded, feedback[]`.
   f. Write `ActivityAttempt`; upsert `StudentProgress` (bestStars = GREATEST, status transitions, failStreak, unlock propagation §7.2); write `XpEvent` rows (§8) and bump profile caches; upsert `StudentDailyActivity` + streak fields (§8.3); evaluate achievement rules; set `gradeMismatch` if `clientGrade != grade`.
3. **Response**: grade, score, stars, XP delta, feedback lines (non-answer-revealing), newly unlocked levels, newly earned achievements — the client animates from this authoritative payload.

`engineResult` stored summary (not the full tick-by-tick trace — replay is cheap because the engine is deterministic, so we store inputs, not frames):

```json
{
  "engineVersion": "1.3.0",
  "steps": 214, "terminated": "GOAL_REACHED",
  "finalState": { "pos": {"x":7,"y":3}, "collected": {"CARROT": 3} },
  "checks": [
    { "check": "REACHED_DESTINATION", "pass": true },
    { "check": "USED_BLOCK", "blockType": "repeat", "pass": false,
      "feedbackKey": "grading.try_using_repeat" }
  ],
  "blockCount": 9
}
```

`engineVersion` matters: if engine semantics ever change, old attempts remain explainable ("graded under 1.3.0"). Teacher "view student's code" renders `workspaceJson` read-only in Blockly plus the stored `generatedCode` — no re-execution needed.

### 7.5 HintUsage

```prisma
model HintUsage {
  id         String   @id @default(cuid())
  studentId  String
  student    User     @relation(fields: [studentId], references: [id], onDelete: Cascade)
  schoolId   String
  levelId    String
  level      Level    @relation(fields: [levelId], references: [id], onDelete: Cascade)
  tier       Int      @db.SmallInt          // 1..4
  revealedAt DateTime @default(now())
  @@unique([studentId, levelId, tier])      // first reveal per tier; re-viewing is free
  @@index([levelId, tier])                  // "which hints does this level burn?"
}
```

Hints are revealed via a server action (so tracking can't be skipped by the client); the grading step reads `MAX(tier)` for the (student, level) pair. Star rules may cap stars by hint tier (per level `starRules`) but XP is never reduced below the base pass reward — "never punish excessively", enforced in the grader, not the schema.

---

## 8. Gamification

### 8.1 XP ledger + cached totals

XP is written as an append-only **ledger** with cached totals on `StudentProfile` (§11-T5: ledger chosen for auditability, idempotent re-award protection, and "where did my XP come from" support tickets; cache maintained in the same transaction, rebuildable by summation).

```prisma
model XpEvent {
  id            String   @id @default(cuid())
  studentId     String
  student       User     @relation(fields: [studentId], references: [id], onDelete: Cascade)
  schoolId      String
  amount        Int                            // positive; MANUAL_ADJUST may be negative
  source        XpSource
  levelId       String?
  attemptId     String?
  achievementId String?
  note          String?                        // for MANUAL_ADJUST audit context
  createdAt     DateTime @default(now())
  @@index([studentId, createdAt])
  @@index([schoolId, createdAt])
}
-- raw migration (idempotency guards):
-- CREATE UNIQUE INDEX one_pass_award_per_attempt ON xp_events (attempt_id, source)
--   WHERE attempt_id IS NOT NULL;
-- CREATE UNIQUE INDEX one_award_per_achievement ON xp_events (student_id, achievement_id)
--   WHERE achievement_id IS NOT NULL;
```

Award policy (grader-enforced): full `xpReward` on first PASS; on later attempts XP only for *improvement* (e.g. star upgrade grants `STAR_BONUS`), so replaying level 1 forever cannot farm XP.

### 8.2 Achievements

```prisma
model Achievement {
  id          String  @id @default(cuid())
  code        String  @unique        // "FIRST_PROGRAM", "LOOP_MASTER", "SEVEN_DAY_STREAK", ...
  name        Json                    // { en, ar? }
  description Json
  iconKey     String
  category    String                  // "coding" | "ai" | "consistency" | "worlds"
  criteria    Json                    // declarative rule, e.g. {"type":"BLOCK_USED_PASSES","blockType":"repeat","count":5}
  xpBonus     Int     @default(0)
  isActive    Boolean @default(true)
  sortOrder   Int     @default(1024)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}

model StudentAchievement {
  id            String      @id @default(cuid())
  studentId     String
  student       User        @relation(fields: [studentId], references: [id], onDelete: Cascade)
  schoolId      String
  achievementId String
  achievement   Achievement @relation(fields: [achievementId], references: [id], onDelete: Restrict)
  earnedAt      DateTime    @default(now())
  seenAt        DateTime?                    // "new badge!" toast shown once
  @@unique([studentId, achievementId])
  @@index([schoolId, earnedAt])
}
```

`criteria` is evaluated by a typed rule engine in application code (a `switch` over `criteria.type` reading the grading transaction's context + cheap counters) — achievements are **data**, so NITAQ admins can add "Bug Hunter II" without a deploy, but rule *types* are code. The 12 spec achievements seed as rows.

### 8.3 Streaks

**Strategy:** transactional maintenance on write + one derived table; no cron needed for correctness.

- `StudentDailyActivity` is upserted on every graded attempt (and on AI-Lab/ML-Lab meaningful activity later), keyed on the **local date in the school's timezone** (`School.timezone`, default Asia/Dubai) computed server-side.
- In the same transaction, streak fields on `StudentProfile` update: if `lastActiveDate == today` → no-op; if `== yesterday` → `currentStreak += 1`; else → `currentStreak = 1`; `longestStreak = GREATEST(longestStreak, currentStreak)`; `lastActiveDate = today`. Row is locked by the upsert, so concurrent submits are safe.
- **Display** of a lapsed streak needs no writer: the Home API computes `effectiveStreak = (lastActiveDate >= yesterday) ? currentStreak : 0` — the stored value only resets lazily on the next activity. No midnight cron, no timezone-fan-out job.
- `SEVEN_DAY_STREAK` achievement checks fire inside the same transaction when `currentStreak` crosses 7.

```prisma
model StudentDailyActivity {
  id              String   @id @default(cuid())
  studentId       String
  student         User     @relation(fields: [studentId], references: [id], onDelete: Cascade)
  schoolId        String
  date            DateTime @db.Date            // school-local date
  xpEarned        Int      @default(0)
  attemptCount    Int      @default(0)
  passCount       Int      @default(0)
  timeSpentSeconds Int     @default(0)
  @@unique([studentId, date])
  @@index([schoolId, date])                    // school engagement time-series
}
```

This table doubles as the analytics backbone for "time spent this week / active students per day" without scanning attempts.

---

## 9. Certificates, audit, announcements, future stubs

### 9.1 Certificate + verification

```prisma
model Certificate {
  id                 String          @id @default(cuid())
  serial             String          @unique   // human-readable "BB-2026-004217", printed on cert
  verifySlug         String          @unique   // 22-char random URL token in the QR: /verify/{verifySlug}
  studentId          String?                   // SetNull on erasure (§10)
  student            User?           @relation(fields: [studentId], references: [id], onDelete: SetNull)
  schoolId           String
  school             School          @relation(fields: [schoolId], references: [id], onDelete: Restrict)
  type               CertificateType
  title              Json                       // { en: "Bunny Meadow Champion", ar? }
  // Frozen display fields — verify page reads ONLY these, never joins User:
  studentDisplayName String
  schoolName         String
  worldId            String?                    // provenance for WORLD_COMPLETION
  programId          String?
  issuedAt           DateTime        @default(now())
  pdfKey             String
  pngKey             String
  revokedAt          DateTime?
  revokedReason      String?
  @@index([studentId])
  @@index([schoolId, issuedAt])
}
```

Issuance is idempotent per (student, type, worldId) — enforced by a partial unique index in a raw migration. The **public verify page** is the only unauthenticated read in the system and returns exactly: `studentDisplayName`, `title`, `type`, `issuedAt`, `schoolName`, and revoked status — served from the frozen columns so it keeps working (or is redacted, §10) independently of the User row. `verifySlug` is unguessable so certificates can't be enumerated; `serial` is sequential-ish for human reference but is **not** a valid lookup key on the public endpoint.

### 9.2 AuditLog

```prisma
model AuditLog {
  id                 BigInt   @id @default(autoincrement())
  schoolId           String?                   // NULL for platform-level actions
  actorUserId        String?                   // NULL for system jobs
  actor              User?    @relation("auditActor", fields: [actorUserId], references: [id], onDelete: SetNull)
  impersonatorUserId String?                   // set when action ran under impersonation
  impersonator       User?    @relation("auditImpersonator", fields: [impersonatorUserId], references: [id], onDelete: SetNull)
  action             String                    // "user.create", "level.publish", "user.impersonate.start"
  entityType         String                    // "User" | "Level" | "Licence" | ...
  entityId           String?
  metadata           Json?                     // diff/context; POLICY: no child PII beyond IDs
  ip                 String?
  userAgent          String?
  createdAt          DateTime @default(now())
  @@index([schoolId, createdAt])
  @@index([actorUserId, createdAt])
  @@index([entityType, entityId])
}
```

Written by the DAL (an `audit()` helper inside `withAuth`-wrapped mutations), append-only — no update/delete paths in application code. The `metadata`-no-PII policy is what lets audit logs survive student erasure. Volume plan: fine as a plain table for years at school-SaaS scale; if it grows, switch to monthly range partitions (id BigInt + createdAt make this drop-in).

### 9.3 Announcement

```prisma
model Announcement {
  id             String     @id @default(cuid())
  schoolId       String?                       // NULL = platform-wide (NITAQ → all schools)
  school         School?    @relation(fields: [schoolId], references: [id], onDelete: Cascade)
  createdByUserId String
  createdBy      User       @relation(fields: [createdByUserId], references: [id], onDelete: Restrict)
  audienceRoles  UserRole[]                    // e.g. [TEACHER, SCHOOL_ADMIN] or [STUDENT]
  title          Json
  body           Json                          // localized markdown-lite
  pinned         Boolean    @default(false)
  publishAt      DateTime   @default(now())
  expiresAt      DateTime?
  createdAt      DateTime   @default(now())
  updatedAt      DateTime   @updatedAt
  @@index([schoolId, publishAt])
}

model AnnouncementDismissal {
  userId         String
  announcementId String
  announcement   Announcement @relation(fields: [announcementId], references: [id], onDelete: Cascade)
  user           User         @relation(fields: [userId], references: [id], onDelete: Cascade)
  dismissedAt    DateTime     @default(now())
  @@id([userId, announcementId])
}
```

Student-audience announcements render in the child UI as a single gentle banner (never a feed) — a product rule, but the schema supports it via `audienceRoles`.

### 9.4 Future-proofing stubs (Phases G/H — tables exist, features don't)

```prisma
model AIConversation {
  id           String    @id @default(cuid())
  studentId    String
  student      User      @relation(fields: [studentId], references: [id], onDelete: Cascade)
  schoolId     String
  levelId      String?                         // context: which level Bunny Guide was helping with
  feature      String                          // "bunny_guide"
  transcript   Json                            // [{role, content, at}] — replace with child table if volume demands
  messageCount Int       @default(0)
  startedAt    DateTime  @default(now())
  endedAt      DateTime?
  @@index([studentId, startedAt])
  @@index([schoolId, startedAt])
}

model AIUsageLog {
  id        BigInt   @id @default(autoincrement())
  schoolId  String?
  userId    String?
  provider  String                             // "anthropic" | ... (behind provider abstraction)
  model     String
  feature   String                             // "bunny_guide" | "hint_rewrite"
  tokensIn  Int
  tokensOut Int
  costMicroUsd Int                             // integer micro-dollars; no floats for money
  latencyMs Int?
  createdAt DateTime @default(now())
  @@index([schoolId, createdAt])
}

model MLExperiment {
  id          String           @id @default(cuid())
  studentId   String
  student     User             @relation(fields: [studentId], references: [id], onDelete: Cascade)
  schoolId    String
  levelId     String?
  kind        MLExperimentKind
  datasetKey  String                           // curated BUILT-IN dataset only ("animals-v1") — never child uploads in v1
  config      Json                             // labels chosen, examples selected, hyperparams shown
  metrics     Json?                            // { accuracy, perClass: {...}, confusion: [[...]] }
  artifactKey String?                          // serialized tiny model in object storage, if persisted
  createdAt   DateTime         @default(now())
  updatedAt   DateTime         @updatedAt
  @@index([studentId, createdAt])
}

model ErasureRequest {                          // §10 workflow record — PDPL-review support
  id              String       @id @default(cuid())
  schoolId        String
  targetUserId    String?                      // NULL for SCHOOL_FULL
  scope           ErasureScope
  requestedByUserId String
  requestedAt     DateTime     @default(now())
  executedAt      DateTime?
  summary         Json?                        // counts of rows deleted/anonymized per table
  @@index([schoolId, requestedAt])
}
```

`AIConversation.transcript` retention is short by policy (30 days, §10). `datasetKey` pointing only at curated datasets is the schema-level enforcement of "never send children's personal content to external AI services".

---

## 10. Tenancy scoping matrix & children's-data retention

### 10.1 Scoping matrix

| Table | `schoolId` | Notes |
|---|---|---|
| School, Licence, AcademicYear, Class, ClassMembership, ImportJob | required | core tenancy |
| User | required except SUPER/NITAQ_ADMIN (NULL) | CHECK constraint §4.1 |
| StudentProfile, TeacherProfile | required (denormalized) | avoids User join in analytics |
| Session | nullable (denorm from subject) | platform staff sessions NULL |
| StudentProgress, ActivityAttempt, HintUsage, StudentDailyActivity, XpEvent, StudentAchievement, Certificate, Assignment, AIConversation, MLExperiment, ErasureRequest | **required, denormalized** | every learning-data row is directly RLS-filterable without joins; also makes school-level analytics single-table scans |
| Program, World, Module, Level, LevelSnapshot, LevelPrerequisite, Achievement | none — platform-global | NITAQ-authored shared catalogue |
| Announcement | nullable | NULL = platform-wide |
| AuditLog, AIUsageLog | nullable | platform actions have no school |

DAL rule: `withAuth()` derives `schoolId` from the **session**, never from the request body; every Prisma call for a school-scoped role goes through repository functions that inject `where: { schoolId: ctx.schoolId }`. Platform roles pass an explicit school filter or none. A lint rule + integration tests assert no raw `prisma.` access from route handlers.

### 10.2 Retention & deletion (children's data)

Data tiers and their lifecycle:

1. **Identity (User/StudentProfile):** already minimal (displayName, username, grade). **Student erasure** (school admin or NITAQ action, recorded as `ErasureRequest`): hard-`DELETE` the User row → FK cascades remove Sessions, ClassMemberships, StudentProgress, ActivityAttempts (with workspaces/code), HintUsage, XpEvents, DailyActivity, StudentAchievements, AIConversations, MLExperiments. One delete, complete by construction — this is why student-owned tables use `onDelete: Cascade`.
2. **Certificates:** survive erasure as `studentId = NULL` (SetNull) with frozen `studentDisplayName` — a certificate is an artifact the family may still hold. The erasure flow asks the school to choose: *keep verifiable* (default) or *redact* (sets `studentDisplayName = "—"`, effectively voiding public verification). Owner decision flagged below.
3. **Attempt payload pruning (working-data minimization):** a scheduled job nulls `workspaceJson`, `generatedCode`, `engineResult` on attempts older than `School.retentionMonthsAttemptPayload` (default 12), stamping `payloadPrunedAt`. Grades/stars/XP columns remain — progress history is pedagogical record; the child's *work product* is the sensitive bulk. Teachers are told review is available for the retention window.
4. **AIConversation.transcript:** nulled after 30 days platform-wide (usage metadata stays in AIUsageLog, which contains no content).
5. **Import CSVs:** deleted from object storage at job completion (§5).
6. **School offboarding (`SCHOOL_FULL`):** licence lapses → grace → school ARCHIVED (read-only) → after a contractual window (e.g. 90 days), erasure job deletes all student Users (cascades as above), then classes/years, leaving School + Licence + AuditLog skeleton for financial/audit history.
7. **AuditLog:** retained long-term; safe because of the no-child-PII metadata policy; actor FKs SetNull on deletion.

Backups: standard PITR windows mean erased data persists in backups for the backup horizon (e.g. 30 days) — the privacy documentation states this; no per-row backup surgery is pretended.

---

## 11. Analytics query → index mapping

The teacher/admin queries that must be fast, and what serves them (all indexes already declared above):

| Query (screen) | Shape | Served by |
|---|---|---|
| Class progress matrix (teacher dashboard): students × levels of a world | `StudentProgress WHERE schoolId=? AND levelId IN (...) AND studentId IN (class)` | `@@unique([studentId, levelId])` + `@@index([schoolId, levelId, status])` |
| Struggling students: not completed, high failStreak / high hint tier | filtered scan per school | `@@index([schoolId, status, failStreak])`; hint dimension read off the same rows (`maxHintTier` is denormalized onto StudentProgress precisely for this) |
| Time spent per student, per class, per week | aggregate `StudentDailyActivity` | `@@unique([studentId, date])`, `@@index([schoolId, date])` |
| Attempt review: a student's attempts on a level, newest first, with code | `ActivityAttempt` | `@@index([studentId, levelId, createdAt Desc])` |
| Active students / attempts today (school admin, NITAQ health) | count per school per day | `@@index([schoolId, createdAt])` on ActivityAttempt + DailyActivity |
| Level difficulty tuning (NITAQ content team): pass rate, avg attempts per level across all schools | `ActivityAttempt GROUP BY levelId, grade` | `@@index([levelId, grade, createdAt])` |
| Which hint tiers a level burns | `HintUsage GROUP BY tier` | `@@index([levelId, tier])` |
| XP/achievement recency feeds | ledger scans | `@@index([studentId, createdAt])` on XpEvent, `@@index([schoolId, earnedAt])` on StudentAchievement |
| Certificate lookup (public) | point read | `@@unique(verifySlug)` |

Principle: teacher-facing pages read the **maintained read models** (StudentProgress, StudentDailyActivity, profile caches) — O(students × levels), tiny. Raw `ActivityAttempt` is only scanned for drill-downs and platform content tuning. No materialized views needed at MVP scale (a school is ~10³ students × ~10² levels); if NITAQ-wide analytics grows, add rollup tables fed by the same transactions, not a warehouse.

---

## 12. Seed-data strategy

- `prisma/seed.ts` is **idempotent** (`upsert` keyed on stable natural keys: `School.slug`, `User.email`/`[schoolId, username]`, `Program/World/Module/Level` slugs, `Achievement.code`). Safe to re-run; CI runs it against a fresh DB in integration tests.
- **Content lives in fixture files**, not inline TS: `prisma/fixtures/programs/ai-coding-foundations-g3-4.json` with nested worlds → modules → levels, each level matching the exact per-type Zod config schema. The seed **runs the real publish pipeline** (validate → snapshot v1 → PUBLISHED) so seeded content exercises the same code path as the admin level editor — no seed-only shortcuts.
- Seeded catalogue (spec quality bar, no lorem ipsum): World 1 **Bunny Meadow** — First Hop, Two Steps, Turn Around, Carrot Collector, Repeat After Me; World 2 **Logic Forest** — Loop Trail, Avoid the Rock, Choose the Path, Hidden Carrot, Forest Challenge. Every level ships full instructions, 4 hints, success conditions, star rules, and `postSuccessExplanation` (Repeat After Me explains why `Repeat 4 {Move}` beats four Move blocks). English complete; Arabic included for World 1 at minimum to exercise RTL end-to-end.
- Demo school: slug `demo-academy` ("Bunny Demo Academy", Sharjah), ACTIVE licence (STANDARD, 100 student seats, 1-year), academic year 2026–2027, 2 classes (Grade 3 Falcon, Grade 4 Oryx), 2 teachers, 16 students with varied *generated* progress (one star-studded, one struggling with failStreak and tier-3 hints, several mid-way) so teacher dashboards demo honestly. Attempts are generated by replaying real solution workspaces through the actual grading pipeline — demo data is real data.
- Demo credentials printed by the seed script and documented in the README (e.g. `admin@demo-academy.example` / generated password; students `falcon01`…); all demo passwords flagged `mustChangePassword=false` but the school is marked internal-only. The 12 spec achievements and the 4 certificate types' title templates seed as `Achievement` rows / constants.
- E2E (Playwright) uses a **separate** seeded school (`e2e-school`) created per-run, so demo data stays pristine for sales.

---

## 13. Trade-off ledger (decisions made, alternatives rejected)

- **T1 — Role on User vs SchoolMembership table.** Chose role+schoolId on User. Rejected membership join: no multi-school requirement exists, and every permission check pays for it forever. Migration path documented (§4.1).
- **T2 — 6-level curriculum hierarchy vs 4.** Chose Program→World→Module→Level; grade band as Program attributes, Lesson collapsed into Module (cosmetic `sectionLabel` preserved). Rejected literal spec hierarchy: two extra joins and two extra admin CRUD screens for entities with no behaviour.
- **T3 — Per-activity-type tables vs single `config Json` + Zod.** Chose JSONB payloads. Rejected 10 typed tables: activity types are the product's main growth axis; JSON+Zod makes a new type a code change, not a migration. Cost: no SQL queries *into* configs — accepted, since configs are only ever read whole.
- **T4 — Versioning: publish snapshots vs full temporal tables.** Chose per-level immutable snapshots + draft-in-place, attempts pin `(levelId, levelVersion)`. Rejected temporal/audit tables on all content (heavy, unneeded) and no-versioning (re-publishing would silently rewrite the meaning of past grades).
- **T5 — XP as ledger+cache vs single counter.** Chose ledger (`XpEvent`) with cached totals. Rejected bare counter: un-auditable, un-idempotent (double-submit double-award), and support tickets ("my XP vanished") become unanswerable. Partial unique indexes make awards idempotent at the DB.
- **T6 — Prerequisites: single FK vs join table.** Chose `LevelPrerequisite` join table despite spec saying "prerequisite level" (singular), because branching paths are an explicit roadmap item and the join costs nothing now. Acyclicity enforced in DAL.
- **T7 — Storing `generatedCode` (derived data).** Stored anyway: teachers review code without running codegen, and it freezes what the grader actually executed even if codegen evolves. Redundancy accepted; pruned with the workspace at retention time.
- **T8 — Seat enforcement: hard block vs soft overage.** Hard block at create/import time (clear sales story, no billing disputes). Overage handling, if wanted, is a licence edit by NITAQ, which is auditable.
- **T9 — Attempt payloads pruned, grades kept forever.** Chose split lifecycle (§10.3): pedagogical record ≠ child work product. Rejected keep-everything (data-minimization failure) and delete-attempts-entirely (destroys progress integrity and teacher history).
- **T10 — Streaks maintained transactionally, no cron.** Lazy reset on read for display; only correctness-critical writes happen in the grading transaction. Rejected nightly streak-reset job: timezone fan-out complexity and a failure mode where a dead cron corrupts every streak.

## 14. Open questions for the product owner

1. **Certificate redaction on student erasure** — default *keep verifiable with frozen name* vs *redact*: who chooses, school or platform policy?
2. **Arabic completeness gate at publish** — may a level publish with English only (current design: yes, `ar` optional), or must flagship worlds be bilingual before PUBLISHED?
3. **Streak grace policy** — strict calendar-day streaks (current design) vs weekend/holiday freeze for school-week realism.
4. **Attempt-payload retention default** — 12 months proposed; confirm against school contracts/PDPL review.
5. **Per-school custom content** — explicitly out of v1 (curriculum is platform-global); confirm no launch customer expects it, since it changes the content tenancy model.
