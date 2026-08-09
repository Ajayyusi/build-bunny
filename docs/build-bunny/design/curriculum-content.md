# Build Bunny — Curriculum System & Seed Content Design

**Author role:** Curriculum designer / EdTech content architect
**Audience:** Senior engineer implementing phases B (learning engine), C (Blockly engine), F (content management)
**Respects:** all LOCKED stack decisions in `bunny-context.md` (Next.js 15, Prisma/Postgres, pure TS engine in `src/engine/`, JSONB `{ en, ar? }` localization, server-authoritative grading, admin-manageable content).

---

## 1. Curriculum hierarchy — evaluation and recommended shape

### 1.1 The spec's proposal, evaluated

Spec proposes: `PROGRAM → GRADE BAND → WORLD → MODULE → LESSON → ACTIVITY/LEVEL` (6 layers).

Two layers do not earn their keep as **structural containers** for a grades 3–7 product:

**GRADE BAND should be an attribute, not a container.** If GRADE BAND is a tree node, every world/module/level lives *under* a band, which forces content duplication the moment "Bunny Meadow" serves both Grade 3–4 and Grade 5–7 audiences (which it will — the same levels with different pacing). Making the band a property of the PROGRAM, and letting programs *reference* shared worlds, gives reuse for free.

**LESSON should collapse into LEVEL.** For ages 8–13, a separate "lesson page" between module and activity is friction, not pedagogy. Children in this band learn by doing; a lesson layer produces exactly the "walls of text" the spec bans from AI Lab, adds a navigation hop on tablets, doubles authoring surface, and creates a progress-tracking ambiguity (is a lesson "complete" when read?). The teaching content a lesson would hold goes to three homes instead:

1. **Level intro cards** — 1–3 optional story/concept cards shown before the workspace opens (skippable, revisitable from the level screen). This is where "Repeating Actions" teaching lives before "Carrot Collector".
2. **Post-completion explanation** — the spec already requires this per level; it is the strongest teaching moment (explain *after* the child has felt the problem).
3. **Module concept intro** — one localizable rich-text/card field on MODULE, shown when a module is first opened on the adventure map.

Escape hatch: because LEVEL is typed (`activityType`), a future "lesson-like" unit is just another activity type (`CONCEPT_CARDS`) slotted into a module — no schema change, no relitigation.

**ACTIVITY vs LEVEL: one entity.** They are the same row. The DB entity is `Level`; its `type` field is the activity type (BLOCK_CODING, QUIZ, …). Adventure-map nodes = levels. "Activity" is vocabulary, not schema.

### 1.2 Recommended shape

```
PROGRAM  (has gradeBandMin/Max; e.g. "Coding & AI Foundations — Grades 3–7")
  └─ ProgramWorld (ordered join — worlds are shared, reusable content)
       WORLD  (Bunny Meadow, Logic Forest, … — theme, map art, tagline)
         └─ MODULE  (ordered; concept intro; unlock rule)
              └─ LEVEL (= activity; typed; ordered; intro cards; the playable unit)
```

Four layers of authored content, one join table. The example path from the spec still reads naturally: *"Coding & AI Foundations (Gr 3–7)" → Robot Lab → Loops → Carrot Collector* — the lesson title "Repeating Actions" becomes the module's concept intro heading.

### 1.3 Grade bands

- `Program.gradeBandMin` / `gradeBandMax` (ints, 3–7 at launch).
- `Level.recommendedGrade` (int) + `Level.stretchGrade?` for "grade 4 with support".
- Launch with **one program**: `coding-ai-foundations` (Grades 3–7). When sales demand a split ("Grades 3–4" vs "5–7"), create a second program referencing the *same worlds* with a different module subset/order — zero content duplication. Teachers additionally tune per-class via assignments.

### 1.4 Prerequisites and unlocking

Three rules, evaluated server-side in the progress service (never trusted from client):

1. **Within a module:** linear by default — level *N* unlocks when level *N−1* has ≥ 1 star. No explicit edges needed for the common case.
2. **Level override:** optional `prerequisiteLevelId` (spec field) replaces the linear rule for that level — enables future branching paths on the map. `isBonus: true` levels are excluded from all completion requirements and never block progression.
3. **Module/world unlock:** `Module.unlockRule` JSONB, default `{ "previousModule": "ALL_CORE_LEVELS_PASSED" }`; worlds unlock when the previous world's core modules are complete, **OR** when a teacher assignment explicitly targets them (assignment overrides gating — the teacher is the authority in a school product).

---

## 2. Content model

### 2.1 Entities (Prisma excerpt — shapes, not full source)

```prisma
model Program {
  id            String   @id @default(cuid())
  slug          String   @unique
  title         Json     // LocalizedText
  description   Json
  gradeBandMin  Int
  gradeBandMax  Int
  status        ContentStatus
  worlds        ProgramWorld[]
}

model World {
  id        String @id @default(cuid())
  slug      String @unique          // "bunny-meadow"
  title     Json                    // LocalizedText
  tagline   Json
  themeKey  String                  // maps to design tokens + map art set
  status    ContentStatus
  modules   Module[]
}

model ProgramWorld { programId String; worldId String; order Int; @@id([programId, worldId]) }

model Module {
  id           String @id @default(cuid())
  worldId      String
  order        Int
  title        Json
  conceptIntro Json?    // LocalizedRichText cards
  unlockRule   Json     // see §1.4
  status       ContentStatus
  levels       Level[]
}

model Level {
  id                  String  @id @default(cuid())
  moduleId            String
  order               Int
  slug                String            // unique per world: "first-hop"
  type                ActivityType      // BLOCK_CODING | QUIZ | ...
  status              ContentStatus     // DRAFT | REVIEW | PUBLISHED | ARCHIVED
  draft               Json              // full editable LevelPayload (typed by `type`)
  publishedVersionId  String?           // -> LevelVersion
  prerequisiteLevelId String?
  isBonus             Boolean @default(false)
  recommendedGrade    Int
  difficulty          Int               // 1–5
  estimatedMinutes    Int
  xpReward            Int
  maxStars            Int @default(3)
  teacherNotes        Json?             // LocalizedText, staff-only
  versions            LevelVersion[]
}

model LevelVersion {
  id          String   @id @default(cuid())
  levelId     String
  version     Int                       // 1, 2, 3…
  payload     Json                      // FROZEN full LevelPayload snapshot
  publishedAt DateTime
  publishedBy String
  changelog   String?
  @@unique([levelId, version])
}
```

`ContentStatus` transitions: `DRAFT → REVIEW → PUBLISHED ⇄ (edit creates pending draft) → PUBLISHED(v+1)`, and `PUBLISHED → ARCHIVED`. A published level whose `draft` differs from `publishedVersion.payload` renders in admin as **"Published · pending changes"** (derived, not a stored status).

### 2.2 Localization shape

Every author-facing string is `LocalizedText`:

```json
{ "en": "First Hop", "ar": "القفزة الأولى", "arHash": "sha256-of-en-at-translation-time" }
```

- `en` required; `ar` optional (locale fallback to `en` with a small "English" chip in the student UI).
- `arHash` = hash of the `en` value at the moment `ar` was last saved. If current `en` hash ≠ `arHash`, the Arabic is **stale** — computed, never manually flagged. This one field powers the whole translation dashboard (§9).
- Rich/structured fields (intro cards, explanation) are `LocalizedRichText`: same `{en, ar?, arHash?}` envelope around a small block-content JSON (paragraph / image / blockly-block-chip inline token), not raw HTML.

### 2.3 Per-activity-type payloads (Zod discriminated union on `type`)

All payloads share a **common core** (mirrors the spec's "every level supports" list):

```ts
const LevelCommon = z.object({
  title: LocalizedText, description: LocalizedText,
  story: LocalizedText,                    // 1–2 sentence hook
  learningObjective: LocalizedText,        // teacher-facing
  instructions: LocalizedText,             // student-facing, imperative
  introCards: LocalizedRichText.array().max(3).optional(),
  hints: LocalizedText.array().length(4),  // tiers 1–4
  explanation: LocalizedRichText,          // post-completion teaching copy
  challenge: LocalizedText.optional(),     // optional extra goal
  starCriteria: StarCriteria,              // §2.4
});
```

**BLOCK_CODING** (the engine of all 10 seed levels):

```ts
const BlockCodingPayload = LevelCommon.extend({
  type: z.literal('BLOCK_CODING'),
  grid: z.object({ cols: z.number().max(12), rows: z.number().max(10) }),
  variants: Variant.array().min(1).max(4),  // see below
  toolbox: z.array(z.object({
    blockType: BlockType,                   // 'move_forward' | 'turn_left' | 'repeat_n' | ...
    maxInstances: z.number().optional(),    // per-block count limit (used in Repeat After Me)
  })),
  startingWorkspace: BlocklyJson,           // usually just the locked when_start hat block
  maxBlocks: z.number().optional(),         // hard cap (grading check)
  successConditions: SuccessCondition.array(), // §2.4 — applied to EVERY variant
  solution: z.object({ workspace: BlocklyJson, blockCount: z.number() }), // recorded, §5.3
});

const Variant = z.object({
  id: z.string(),                            // 'a', 'b'
  terrain: TileRow.array(),                  // 'grass' | 'tree' | 'water'
  entities: Entity.array(),                  // { kind: 'rock'|'carrot'|'burrow', x, y }
  bunnyStart: z.object({ x, y, facing: z.enum(['N','E','S','W']) }),
});
```

**Variants are a deliberate design addition.** A single deterministic map makes `If` and `Repeat Until` fake — students hard-code the answer. A level may define up to 4 map variants; the **same program must pass all of them**. The client lets the student run each variant (variant chips above the sim); the server re-runs all variants authoritatively. Levels 8–10 depend on this; the engine cost is one loop.

**Other payloads** (schema sketch only — form-driven editors, §5.5):

| Type | Payload essentials |
|---|---|
| CODE_PREDICTION | `program` (Blockly JSON or code text), `renderAs: 'blocks'\|'code'`, `question`, `options[]` (each: label + optional grid-state thumbnail), `correctOptionId`, `whyExplanation` |
| DEBUGGING | `brokenWorkspace`, `bugCount`, grid + variants + successConditions (graded by the same engine — a debugging level *is* a block level with a pre-broken workspace and `editLimit?`) |
| SEQUENCING | `items[]` (LocalizedText + image?), `correctOrder[]`, `allowTies: false` |
| PATTERN_RECOGNITION | `sequence[]` (emoji/image/number tokens), `answerMode: 'pick-next'\|'find-rule'`, `options[]`, `correctOptionId` |
| AI_CLASSIFICATION | `categories[]`, `examples[]` (image/text + correctCategory), `passThreshold` (e.g. 8/10) |
| QUIZ | `questions[]`, each `{ kind: 'mcq'\|'tf'\|'match'\|'sort', … }`, `passThreshold` |
| AI_ETHICS | `scenario` (rich text), `choices[]` with `feedback` per choice, `noSingleRightAnswer: bool` |
| REAL_ML | `datasetKey` (curated built-in), `taskKind: 'image'\|'text-sentiment'`, `labels[]`, `minTrainExamples`, `testSet[]` (phase H; schema reserved now) |
| CREATIVE_PROJECT | `brief`, `requiredElements[]`, `rubric[]` (teacher-graded), `shareToClass: bool` |

### 2.4 Success conditions & stars (grading DSL)

Success conditions are a JSON array of reusable checks — exactly the spec's grading-engine list, expressed as data so the level editor can compose them and the server engine can evaluate them:

```json
[
  { "check": "reachedGoal" },
  { "check": "collectedAll", "item": "carrot" },
  { "check": "usedBlock", "block": "repeat_n" },
  { "check": "notUsedBlock", "block": "..." },
  { "check": "maxBlocks", "count": 8 },
  { "check": "variableEquals", "name": "carrots", "value": 3 },
  { "check": "expectedOutput", "say": ["Hello"] },
  { "check": "avoidedTiles", "tile": "water" }
]
```

Result per variant → aggregate: **PASS** = all checks on all variants; **PARTIAL** = goal-class checks passed on ≥1 variant or some checks passed (feedback names what's missing without revealing the fix: *"You reached the burrow but left 2 carrots behind"*); **FAIL** otherwise. Runtime failures (rock bump, off-grid, step-limit 200 exceeded → "Robo Bunny got tired — is a loop running forever?") short-circuit to FAIL with located feedback ("bumped a rock at step 3").

**StarCriteria** — uniform shape across all levels:

```json
{ "star1": "pass",
  "star2": { "maxBlocks": 8 },
  "star3": { "maxBlocks": 6, "maxHintTier": 2 } }
```

House rules (encode in validator): star2/star3 only ever *add* constraints; hint tiers 1–2 are always free (never gate stars); only tier 3–4 usage may gate star 3, and never gates star 1–2 — this implements "may consider hint usage but never punish excessively". Stars are recomputed on every attempt; a student's best star count per level is kept forever (upgrades only).

### 2.5 Versioning — published snapshots

**Problem:** an admin edits "Carrot Collector" while 200 students hold half-finished attempts; grading must not shift under them, and historical stars must stay explainable.

**Strategy (pragmatic, no full CMS versioning):**

- Publishing = write one immutable `LevelVersion` row containing the **entire denormalized payload** (grid, toolbox, conditions, hints, copy — everything needed to render *and* grade), bump `version`, point `Level.publishedVersionId` at it.
- **Students always start attempts from `publishedVersionId`.** `Attempt.levelVersionId` is stamped at attempt start; every run/submit of that attempt renders and grades against that frozen payload — even if a new version publishes mid-attempt. Next *new* attempt picks up the new version.
- Progress, stars, XP, unlocks key on the **stable `levelId`** — history survives republishing. If a republish changes star criteria, existing stars are not retroactively recomputed (append-only fairness).
- Old versions are never deleted (audit + attempt replay for teachers viewing student code). Storage is trivial: payloads are tens of KB.
- `ARCHIVED` levels: hidden from progression and new assignments; attempts/history/certificates remain valid; teacher UI shows an "archived content" chip on old reports.

### 2.6 How assignments reference content

`Assignment { classId, targetType: WORLD|MODULE|LEVEL, targetId, assignedBy, dueAt?, instructions? }` — assignments point at **stable content IDs, never version IDs**. Resolution at student render time: assignment → level(s) → each level's current `publishedVersionId`. Consequences, by design:

- Republishing content silently improves live assignments (teachers want fixed typos to appear).
- Archiving an assigned level flags the assignment in the teacher UI ("1 activity was retired by NITAQ") rather than breaking it.
- An assignment can target a not-yet-unlocked world — that *is* the teacher-override unlock (§1.4).

---

## 3. Engine contract the curriculum depends on (content-facing, engine team owns internals)

These semantics are assumed by every seed level; they must be true in `src/engine/`:

1. Grid is `cols × rows`, origin top-left, `(x, y)`; facing ∈ N/E/S/W; `move_forward` advances one tile in facing.
2. **Tiles:** `grass` (walkable), `tree`/border (blocks — see 4), `water` (walkable-but-forbidden; used with `avoidedTiles` from W2 bonus content onward). **Entities:** `rock` (blocking), `carrot` (auto-collected on enter), `burrow` (goal tile, walkable).
3. Carrots collect automatically on entering their tile (no "pick up" block in W1–2; a `collect` verb is unnecessary cognitive load at this stage).
4. **Moving into a rock = FAIL** ("bumped a rock", bunny thumps, sim stops). **Moving into a tree/border = blocked bump, also FAIL** — same message family. Sensors *check* without moving, which is the whole point of `path ahead is blocked`.
5. Success conditions are evaluated **when the program ends** (bunny must *finish* on the burrow, not pass through it). All 10 seed solutions verified against end-state semantics below.
6. `repeat_until <condition> { … }` checks the condition **before** each iteration. Sensor conditions at launch: `path ahead is blocked` (tree/rock/border ahead), `carrot ahead`, `on carrot`. Only the conditions a level's toolbox exposes appear in its dropdown.
7. Step limit 200 per run (configurable per level) → FAIL with the "tired bunny" message naming the infinite-loop hypothesis.
8. Multi-variant levels: engine runs the same program against each variant independently; results aggregated per §2.4.

---

## 4. Admin content-builder UX (phase F)

All under the **Pro theme**, NITAQ_ADMIN/SUPER_ADMIN only (permission `content:manage`, review approval requires `content:publish`).

### 4.1 Information architecture & routes

```
/admin/content                          → curriculum tree: programs rail, world cards w/ status + AR coverage
/admin/content/programs/[slug]          → program editor: metadata, world ordering (drag), grade band
/admin/content/worlds/[slug]            → world editor: metadata/theme/map art, MODULE list (drag reorder),
                                          level table (status chip, version, type icon, AR %, last editor)
/admin/content/levels/[id]              → level editor (tabbed, per §4.2)
/admin/content/translations             → translation dashboard (§9)
```

Module ordering and level ordering are drag-and-drop with keyboard fallback (spec accessibility bar); order writes are transactional reindexes scoped to the parent.

### 4.2 Level editor — tab layout (BLOCK_CODING)

Tabs: **Basics · Scene · Blocks · Grading · Story & Hints · Test Play · Publish**. Every text input is a paired EN/AR field (AR side collapsible, RTL-rendered).

**Scene — grid painter.** Canvas grid, brush palette: grass, tree, water, rock, carrot, burrow, bunny-start (click again to rotate facing). Resize cols/rows (max 12×10 — tablet legibility ceiling). **Variant tabs** across the top: "Variant A ▾ | + duplicate as B" — variants share `cols/rows`, differ in terrain/entities/bunnyStart. Fully keyboard operable (arrow-move cursor, key-per-brush).

**Blocks — toolbox picker.** The full block registry grouped by category (EVENTS, MOVEMENT, CONTROL, LOOPS, LOGIC, VARIABLES, FUNCTIONS, SENSORS, ROBOT, AI) with checkboxes + optional `maxInstances` numeric per block. Live warning strip if the recorded solution uses a block not in the toolbox. Sensor blocks expose a sub-picker for which conditions appear in dropdowns.

### 4.3 Solution recording & auto-derived grading

The **Grading** tab embeds the real student player (same components). Author flow:

1. Author builds the solution in the embedded workspace and clicks **Record solution**.
2. Engine runs it against **every variant**. On all-pass, the workspace JSON + block count are saved as `solution`.
3. From the run **traces**, the editor *proposes* success conditions: ended on burrow → `reachedGoal`; picked up all N carrots in every variant → `collectedAll(carrot)`; used `repeat_n` → offers `usedBlock(repeat_n)` as an *optional* toggle (off by default — requiring a block is a pedagogical decision, not an inference); never entered water while water exists → offers `avoidedTiles(water)`.
4. Author confirms/edits the checklist. Star suggestions auto-fill: `star3.maxBlocks = solution.blockCount`, `star2.maxBlocks = ceil(blockCount × 1.5)` — editable.
5. Any later change to scene/toolbox **invalidates the recording** (banner: "Scene changed — re-record solution"), which is also a publish gate.

### 4.4 Test Play

Runs the exact student experience in a modal: intro cards, instructions, toolbox, all variant chips, hint drawer (tiers revealed in order, as students see them), failure/success states, star toast, explanation screen. Toggles: **grade preview** (renders `recommendedGrade` typography scale), **AR/RTL preview**, **reduced-motion**. Test-play submissions run the server grading path against the *draft* payload (marked `isTestPlay`, no XP writes) — this exercises the authoritative pipeline before publish.

### 4.5 Publish gates — validation checklist

Publish button is disabled until every machine check passes; the checklist renders inline with jump-links to the offending tab:

1. All required EN fields present (title, description, story, objective, instructions, explanation).
2. Exactly 4 hint tiers, non-empty, strictly ordered tiers 1–4.
3. ≥1 variant; every variant has exactly one bunnyStart and ≥1 burrow (when `reachedGoal` used).
4. **Recorded solution exists, is current (not invalidated), and passes all variants** under the *current* success conditions — re-run server-side at publish time, not trusted from the editor session.
5. Toolbox ⊇ every block type used in the solution; `maxInstances` limits don't contradict the solution.
6. Star criteria monotonic (star3 ⊆ star2 constraints; `maxHintTier` only on star3) and `star3.maxBlocks ≥ solution.blockCount`.
7. Reachability sanity: burrow and every carrot reachable from bunnyStart (BFS over walkable tiles, per variant).
8. `xpReward`, `estimatedMinutes`, `recommendedGrade`, `difficulty` set; `prerequisiteLevelId` (if any) points at a PUBLISHED level in the same world.
9. Human gate: level in `REVIEW`; a second staff account with `content:publish` approves (author ≠ approver enforced; SUPER_ADMIN may self-approve with audit-log entry).
10. Diff view vs current published version (field-level; grid diff renders both scenes side by side) shown at approval.

Arabic is **not** a publish gate (see §9 — separate "AR complete" flag), except for content inside an Arabic-flagged program.

### 4.6 Editors for other activity types

Non-Blockly payloads are flat enough for schema-driven forms: each type gets a form generated from its Zod schema with type-specific preview panes (quiz question preview, sequencing drag preview, classification card deck preview). DEBUGGING reuses the entire BLOCK_CODING editor plus a "break it" step (author records the *working* solution first, then edits the broken starting workspace; gate: broken workspace must FAIL and solution must PASS). Only the Blockly editor warrants bespoke UI investment in phase F.

---

## 5. SEED CONTENT — Worlds 1–2, fully specified

### 5.0 Conventions

- **ASCII legend:** `▶ ◀ ▲ ▼` bunny start + facing · `C` carrot · `R` rock · `G` burrow (goal) · `#` tree/hedge · `.` grass. Grid border is implicitly blocking.
- **Block counts exclude** the locked `When Start` hat block.
- Every level: success requires the program to **end** with conditions met (§3.5).
- Hint tiers: T1 conceptual nudge → T2 strategy → T3 locate the problem/structure → T4 strong help (near-walkthrough, still not a paste-able answer).
- All copy below is the actual EN ship copy. Tone target: warm, adventurous, a 9-year-old is respected, never babyish ("Robo Bunny", not "little bunny-wunny").

**Program:** `coding-ai-foundations` · Grades 3–7.
**World 1 — BUNNY MEADOW** *(tagline: "Every explorer starts with a single hop.")* — Module 1.1 **First Hops** (L1–L3), Module 1.2 **Carrots & Loops** (L4–L5).
**World 2 — LOGIC FOREST** *(tagline: "The forest is tricky. Your brain is trickier.")* — Module 2.1 **Trails & Obstacles** (L6–L7), Module 2.2 **Forest Decisions** (L8–L10).

Module concept intros (one-liners for the intro card, EN):
- 1.1: "A program is a list of instructions. Robo Bunny does exactly what your blocks say — nothing more, nothing less."
- 1.2: "When you catch yourself doing the same thing again and again… there's a block for that."
- 2.1: "Loops can hold more than one block. And the forest has rocks — plan your trail."
- 2.2: "The best programs can handle surprises. Time to teach Robo Bunny to check before hopping."

---

### Level 1 — FIRST HOP  `bunny-meadow/first-hop`

| | |
|---|---|
| New idea | A block is an instruction; Run executes your program |
| Difficulty / Grade / Time | 1 / Grade 3+ / 3 min |
| XP | 20 |

**Learning objective:** Student assembles and runs a one-instruction program, connecting a block under When Start and pressing Run.

**Story hook:** Robo Bunny just woke up in Bunny Meadow — and spots a burrow one hop away. Time for the very first hop of the adventure.

**Grid (3×3, variant A only):**
```
. . .
▶ G .
. . .
```
Bunny (0,1) facing E · burrow (1,1).

**Allowed blocks:** `when_start` (pre-placed, locked) · `move_forward`.
**Starting workspace:** When Start only.

**Solution (optimal, 1 block):** `Move Forward`.

**Success conditions:** `[ {reachedGoal} ]`.

**Stars:** ★1 pass · ★2 ≤ 2 blocks · ★3 = 1 block. (Confidence shower — nearly everyone 3-stars level 1, by design.)

**Hints:**
- T1: "Robo Bunny only moves when a block tells it to. Which block looks like it makes the bunny move?"
- T2: "Drag one **Move Forward** block from the toolbox into your workspace."
- T3: "Blocks only run when they're snapped **underneath** When Start. Is your Move Forward block connected?"
- T4: "Drag **Move Forward** under **When Start** so they click together, then press **Run**. One hop is all it takes."

**Post-completion explanation:** "You just wrote a program! A program is a set of instructions for a computer. Your program had one instruction: **Move Forward** — and Robo Bunny followed it exactly. Computers never guess and never get bored. They just do what the instructions say. Next up: what happens when you give MORE than one instruction?"

**Challenge:** none (first level stays pure).
**Teacher notes:** Watch for students pressing Run with a disconnected block — the #1 friction at minute one. The T3 hint targets it.

---

### Level 2 — TWO STEPS  `bunny-meadow/two-steps`

| | |
|---|---|
| New idea | Programs are sequences — blocks run in order, top to bottom |
| Difficulty / Grade / Time | 1 / Grade 3+ / 4 min |
| XP | 20 |

**Learning objective:** Student sequences multiple instructions and observes ordered execution.

**Story hook:** The burrow moved a little further down the meadow. One hop won't cut it anymore — Robo Bunny needs a plan with more than one step.

**Grid (4×3):**
```
. . . .
▶ . G .
. . . .
```
Bunny (0,1) E · burrow (2,1).

**Allowed blocks:** `move_forward`.
**Solution (optimal, 2):** `Move Forward, Move Forward`.
**Success:** `[ {reachedGoal} ]`.
**Stars:** ★1 pass · ★2 ≤ 3 blocks · ★3 = 2 blocks.

**Hints:**
- T1: "How many hops does Robo Bunny need to reach the burrow? Count the tiles."
- T2: "You can use more than one Move Forward block. They run one after another, top to bottom."
- T3: "Two tiles means two Move Forward blocks, snapped in a column under When Start."
- T4: "Stack **Move Forward, Move Forward** under When Start — the top one runs first, then the next."

**Explanation:** "Programs run **in order** — the top block first, then the next, like a recipe. Your two Move Forward blocks made two hops, one after another. This idea is called a **sequence**, and it's how every program in the world works, from games to rockets. Order matters: a recipe that says 'eat, then cook' wouldn't go well."

**Challenge:** none (kept pure alongside Level 1 — the first challenge appears at Level 3).
**Teacher notes:** Ask students to predict the number of hops *before* running — this is the seed of the CODE_PREDICTION habit.

---

### Level 3 — TURN AROUND  `bunny-meadow/turn-around`

| | |
|---|---|
| New idea | Turning changes *direction*, not position (Turn Left / Turn Right) |
| Difficulty / Grade / Time | 2 / Grade 3+ / 6 min |
| XP | 25 |

**Learning objective:** Student combines moves and turns to navigate a bend, understanding that a turn is an instruction that moves nothing.

**Story hook:** The meadow path takes a sharp bend around a berry bush. Robo Bunny can hop and — new trick! — spin on the spot.

**Grid (4×4):**
```
. . . .
. . G .
. # . .
▶ . . .
```
Bunny (0,3) E · burrow (2,1) · decorative bush `#` at (1,2).
Path: E two tiles, then N two tiles.

**Allowed blocks:** `move_forward`, `turn_left`, `turn_right`.
**Solution (optimal, 5):** `Move, Move, Turn Left, Move, Move`.
**Success:** `[ {reachedGoal} ]`.
**Stars:** ★1 pass · ★2 ≤ 7 blocks · ★3 ≤ 5 blocks.

**Hints:**
- T1: "Turning and moving are different. A turn spins Robo Bunny in place — it doesn't hop anywhere."
- T2: "Hop to the corner first. Then which way should Robo Bunny face — left or right from where it's looking?"
- T3: "After two Move Forwards, Robo Bunny faces the meadow edge. One **Turn Left** points it at the burrow."
- T4: "The pattern is: **Move, Move, Turn Left, Move, Move**. Watch the bunny's ears — they show which way it's facing."

**Explanation:** "Turns are instructions too — they just change which way Robo Bunny is *facing*. Left and right are from **the bunny's point of view**, not yours. That's why programmers sometimes tilt their head at the screen (really!). Move changes *where* you are; Turn changes *where you're headed*. Together they can take you anywhere."

**Challenge:** "Solve it again using **Turn Right** three times instead of Turn Left once. Which program is shorter?"
**Teacher notes:** The left/right-from-whose-view confusion is the classic misconception here. Have students physically stand and turn if stuck (unplugged moment).

---

### Level 4 — CARROT COLLECTOR  `bunny-meadow/carrot-collector`

| | |
|---|---|
| New idea | Goals can have multiple parts: collect ALL carrots, then finish at the burrow |
| Difficulty / Grade / Time | 2 / Grade 3+ / 7 min |
| XP | 30 |

**Learning objective:** Student plans a route satisfying two success conditions (collection + destination) and reads PARTIAL feedback to fix a route.

**Story hook:** Carrot season! Three carrots grew along the trail to the burrow — and a good explorer never leaves a carrot behind.

**Grid (5×4):**
```
. . . . .
. . . G .
. . . C .
▶ C . C .
```
Bunny (0,3) E · carrots (1,3), (3,3), (3,2) · burrow (3,1).
Route: E three tiles (collecting two carrots), turn left, N two tiles (third carrot, then burrow).

**Allowed blocks:** `move_forward`, `turn_left`, `turn_right`.
**Solution (optimal, 6):** `Move, Move, Move, Turn Left, Move, Move`.
**Success:** `[ {reachedGoal}, {collectedAll: carrot} ]`.
**Stars:** ★1 pass · ★2 ≤ 8 blocks · ★3 ≤ 6 blocks.

**Hints:**
- T1: "This level has TWO jobs: grab every carrot AND finish in the burrow. Trace the trail with your finger first."
- T2: "Robo Bunny picks up a carrot just by hopping onto its tile. Which route touches all three?"
- T3: "Hop straight along the bottom row first — that collects two carrots — then turn toward the burrow."
- T4: "Three Move Forwards along the bottom, then **Turn Left**, then two more Move Forwards. Carrots on the way up are grabbed automatically."

**Explanation:** "Robo Bunny collected carrots just by hopping over them — but the level only counted as done because you finished **all** the jobs: every carrot AND the burrow. Real programs often have a checklist like this. When you missed a carrot, the meadow told you *what* was missing, not *how* to fix it — that's what debugging feels like, and you just did it."

**Challenge:** "Beat the level, then re-run it and watch the carrot counter. Can you call out which hop collects each carrot — *before* it happens?"
**Teacher notes:** First level where PARTIAL results appear (reaching the burrow with missed carrots). Show the class the feedback message — reading grader feedback is a skill.

---

### Level 5 — REPEAT AFTER ME  `bunny-meadow/repeat-after-me`

| | |
|---|---|
| New idea | The Repeat block — loops replace copy-paste |
| Difficulty / Grade / Time | 2 / Grade 3+ / 8 min |
| XP | 40 |

**Learning objective:** Student uses `Repeat N` to express four identical actions with one Move block, and can articulate why the loop version is better.

**Story hook:** A long, straight stretch of meadow — hop, hop, hop, hop. Robo Bunny sighs: "Do I really have to be told the same thing four times?"

**Grid (6×3):**
```
. . . . . .
▶ . . . G .
. . . . . .
```
Bunny (0,1) E · burrow (4,1). Four hops.

**Allowed blocks:** `move_forward` (**maxInstances: 1**) · `repeat_n` (**maxInstances: 1**).
This is the one seed level using per-block count limits: with a single Move available, brute force is structurally impossible and discovery is guided ("you only get ONE Move block — how can it run four times?"). The limit is stated in the instructions so it reads as the puzzle, not a bug.

**Starting workspace:** When Start only.
**Solution (optimal, 2):** `Repeat 4 { Move Forward }`.
**Success:** `[ {reachedGoal}, {usedBlock: repeat_n} ]` (the usedBlock check is belt-and-braces given the toolbox limit; keeps grading honest if limits are later relaxed).
**Stars:** ★1 pass · ★2 pass with ≤ 3 blocks · ★3 = 2 blocks and no T4 hint.

**Hints:**
- T1: "Four hops, but only one Move block in the toolbox. Is there a block that can *run another block* more than once?"
- T2: "The **Repeat** block is a container — blocks placed inside it run again and again. Try dropping Move Forward *inside* Repeat."
- T3: "Set the Repeat number to how many hops the burrow needs. Count the tiles: it's 4."
- T4: "Drag **Repeat** under When Start, set its number to **4**, and snap **Move Forward** inside its mouth. One block, four hops."

**Explanation:** "**Repeat 4 { Move Forward }** does exactly the same thing as four Move Forward blocks — but you only had to say it once. That's a **loop**, and it's one of the most powerful ideas in all of programming. Need 100 hops? Change one number. A programmer's rule of thumb: if you're repeating yourself, there's probably a loop hiding in your plan."

**Challenge:** "Change the Repeat number to 3, then run it. Predict first: where will Robo Bunny stop?"
**Teacher notes:** The "same result, shorter program" comparison is the lesson — after success, the explanation screen shows both versions side by side (explanation rich-text includes a two-column block image). Don't rush students past it.

---

### Level 6 — LOOP TRAIL  `logic-forest/loop-trail`

| | |
|---|---|
| New idea | Loop bodies can hold SEVERAL blocks — find the repeating pattern in a path |
| Difficulty / Grade / Time | 3 / Grade 4+ (3 with support) / 8 min |
| XP | 40 |

**Learning objective:** Student identifies a repeating movement pattern (move-move-turn) and encodes it as a multi-block loop body.

**Story hook:** Welcome to Logic Forest, where the trails play tricks. This one runs in a perfect square around an old oak stump — and squares are very, very repetitive.

**Grid (3×3 playable, rendered inside a 5×5 frame of forest trees):**
```
▶ . C
. # .
C . C
```
Bunny (0,0) E · carrots (2,0), (2,2), (0,2) · **burrow is the starting tile (0,0)** (revealed as the "home stump hollow" — the trail loops back to it) · oak stump `#` at (1,1).
Path: the square perimeter, returning home.

**Allowed blocks:** `move_forward`, `turn_left`, `turn_right`, `repeat_n`.
**Solution (optimal, 4):** `Repeat 4 { Move, Move, Turn Right }`.
Trace: (0,0)E → M(1,0) M(2,0 C) R(S) → M(2,1) M(2,2 C) R(W) → M(1,2) M(0,2 C) R(N) → M(0,1) M(0,0 = home) R. Ends on burrow ✓, 3 carrots ✓.
**Success:** `[ {reachedGoal}, {collectedAll: carrot} ]`.
**Stars:** ★1 pass · ★2 ≤ 8 blocks · ★3 ≤ 4 blocks (i.e., the loop solution; the 12-block unrolled version passes at ★2 max).

**Hints:**
- T1: "Walk the square trail with your eyes. Do you notice yourself thinking the same little dance over and over?"
- T2: "Each side of the square is: hop, hop, turn. A Repeat block's mouth can hold ALL THREE of those blocks."
- T3: "Put **Move, Move, Turn Right** inside one Repeat. How many sides does a square have? That's your Repeat number."
- T4: "**Repeat 4 { Move Forward, Move Forward, Turn Right }** — two hops and a right turn, four times, brings Robo Bunny all the way around and home."

**Explanation:** "Your loop had three blocks inside, and the whole *group* repeated four times. Loops don't just repeat one action — they repeat a **pattern**. Spotting the pattern ('two hops and a turn… again!') is the real skill; the Repeat block is just how you tell the computer about it. Programmers call each time around the loop an **iteration** — you just ran four of them."

**Challenge:** "Solve it turning LEFT instead — where must Robo Bunny face at the start? (You may add one turn before the loop.)"
**Teacher notes:** Students who unroll all 12 blocks still pass — celebrate, then point at the ★3 criterion and ask what repeats. Never frame the unrolled version as wrong; frame the loop as *stronger*.

---

### Level 7 — AVOID THE ROCK  `logic-forest/avoid-the-rock`

| | |
|---|---|
| New idea | Obstacles: bumping a rock fails the run — plan a detour (and loops still help) |
| Difficulty / Grade / Time | 3 / Grade 4+ / 8 min |
| XP | 45 |

**Learning objective:** Student plans a collision-free route around blocking obstacles and interprets a runtime failure message ("bumped at step N") to fix a program.

**Story hook:** A rockslide dumped two boulders right across the forest trail. Robo Bunny can't push rocks — but rocks can't stop a bunny with a better route.

**Grid (6×4):**
```
. . R . . .
▶ . R . . .
. . . . . G
. . . . . .
```
Bunny (0,1) E · rocks (2,0), (2,1) · burrow (5,2).
Route: E one, S one (past the rocks), then E four.

**Allowed blocks:** `move_forward`, `turn_left`, `turn_right`, `repeat_n`.
**Solution (optimal, 6):** `Move, Turn Right, Move, Turn Left, Repeat 4 { Move }`.
(Unrolled 8-block version: `M, TR, M, TL, M, M, M, M` — passes, ★2.)
**Success:** `[ {reachedGoal} ]`.
**Stars:** ★1 pass · ★2 ≤ 8 blocks · ★3 ≤ 6 blocks.

**Hints:**
- T1: "Robo Bunny stops the moment it bumps a rock. Look at the grid — where does the clear path go?"
- T2: "You can't go through the rocks, so go *around*: one hop forward, then drop down a row before continuing."
- T3: "Move, then **Turn Right**, Move, then **Turn Left** gets you past the boulders facing the right way. Count the hops that remain."
- T4: "**Move, Turn Right, Move, Turn Left**, then four more hops east — and four-of-the-same sounds like a job for Repeat."

**Explanation:** "That crash wasn't a mistake by Robo Bunny — it did *exactly* what the program said. When a program fails, the computer isn't being mean; it's giving you a clue. 'Bumped a rock at step 3' tells you exactly **where** to look. Programmers read error messages like detectives read fingerprints. Also: did you spot the hidden loop in the detour? Four hops east = Repeat 4."

**Challenge:** "Find a different route to the burrow that also takes exactly 6 blocks. (Hint: there's more than one way around a rock.)"
**Teacher notes:** Let students crash on purpose once — seeing the step-numbered failure teaches more than avoiding it. The step counter in the sim maps 1:1 to executed blocks.

---

### Level 8 — CHOOSE THE PATH  `logic-forest/choose-the-path`

| | |
|---|---|
| New idea | The IF block + a sensor: programs that CHECK before acting (first multi-variant level) |
| Difficulty / Grade / Time | 4 / Grade 4+ / 10 min |
| XP | 50 |

**Learning objective:** Student writes one program that succeeds on two different maps by using `If path ahead is blocked` to choose a direction at a junction.

**Story hook:** Deep in the forest, the trail splits at two burrow doors — and last night's rockslide blocked one of them. Nobody knows which. Robo Bunny will have to *check*.

**Grids (5×5, TWO variants — same program must pass both):**
```
Variant A            Variant B
# # G # #            # # G # #
# # R # #            # # . # #
▶ . . # #            ▶ . . # #
# # . # #            # # R # #
# # G # #            # # G # #
```
Both variants: bunny (0,2) E · junction (2,2) · north burrow (2,0) · south burrow (2,4). Variant A: rock (2,1) blocks north. Variant B: rock (2,3) blocks south. Success = end on **either** burrow.

**Allowed blocks:** `move_forward`, `turn_left`, `turn_right`, `if` (condition dropdown exposes only: **path ahead is blocked**).
**Solution (optimal, 7):**
`Move, Move, Turn Left, If path ahead is blocked { Turn Right, Turn Right }, Move, Move.`
- Variant A: at junction face N, blocked → two right turns face S → two hops → south burrow ✓.
- Variant B: face N, clear → If body skipped → two hops → north burrow ✓.
Note the elegance: no Else needed — the "clear" case simply falls through. (If/Else is formally introduced in World 3.)
**Success:** `[ {reachedGoal}, {usedBlock: if} ]` — evaluated on **both** variants.
**Stars:** ★1 pass (both variants) · ★2 ≤ 9 blocks · ★3 ≤ 7 blocks and no T4 hint.

**Hints:**
- T1: "The rock is in a different place on each map — so a fixed list of hops can't work every time. What if the program could *ask a question*?"
- T2: "The **If** block runs its inside blocks only when its question is true. Hop to the junction, face one door, and ask: is the path blocked?"
- T3: "Face NORTH at the junction (Move, Move, Turn Left). If blocked, Robo Bunny needs to face south instead — two right turns spin it around."
- T4: "**Move, Move, Turn Left, If blocked { Turn Right, Turn Right }, Move, Move.** If the north door is clear the If does nothing; if it's blocked, the bunny turns around. Then two hops finish it — whichever way it's facing."

**Explanation:** "You wrote your first program that **makes a decision**. The If block asked a question — *is the path blocked?* — and Robo Bunny acted differently depending on the answer. That's why your ONE program beat BOTH maps. This is huge: real software faces different situations every time it runs (different players, different weather, different rockslides), and If is how it copes. Checking before acting — that's not just good programming, it's good hiking."

**Challenge:** "Rebuild your solution checking the SOUTH door first instead. Same block count?"
**Teacher notes:** The two-variant chips above the sim are the teaching device — insist students run both before submitting. Common bug: turning left *before* reaching the junction. The step-through playback shows the sensor check as a thought bubble ("blocked? YES").

---

### Level 9 — HIDDEN CARROT  `logic-forest/hidden-carrot`

| | |
|---|---|
| New idea | Repeat Until — loops that stop on a CONDITION, when you can't count the steps |
| Difficulty / Grade / Time | 3 / Grade 4+ / 8 min |
| XP | 50 |

**Learning objective:** Student uses a condition-controlled loop (`Repeat Until path ahead is blocked`) to traverse a corridor of unknown length.

**Story hook:** Somewhere down this foggy trail, a legendary golden carrot is buried right at the old burrow door. How far? The fog isn't telling.

**Grids (8×3, TWO variants):**
```
Variant A                Variant B
# # # # # # # #          # # # # # # # #
▶ . C . G # # #          ▶ . . C . . G #
# # # # # # # #          # # # # # # # #
```
Variant A: bunny (0,1) E · carrot (2,1) · burrow (4,1), hedge behind at (5,1). Variant B: carrot (3,1) · burrow (6,1), hedge at (7,1). (Client renders unexplored trail with a fog overlay — cosmetic only; the engine state is fully deterministic.)

**Allowed blocks:** `move_forward`, `repeat_until` (condition dropdown: **path ahead is blocked**), `repeat_n` (present as a decoy — part of the lesson is choosing the right loop).
**Solution (optimal, 2):** `Repeat Until path ahead is blocked { Move Forward }`.
Trace (A): checks before each hop; hops (1,1)(2,1 C)(3,1)(4,1 = burrow); next check → hedge ahead → loop exits → program ends on burrow ✓. Same program walks 6 hops in variant B ✓.
**Success:** `[ {reachedGoal}, {collectedAll: carrot}, {usedBlock: repeat_until} ]` on both variants.
**Stars:** ★1 pass · ★2 ≤ 3 blocks · ★3 = 2 blocks.

**Hints:**
- T1: "The trail is a different length on each map — so Repeat *4* can't be right. When should the hopping STOP?"
- T2: "**Repeat Until** keeps going until its question becomes true. What becomes true exactly when Robo Bunny reaches the burrow door?"
- T3: "The hedge sits right behind the burrow. 'Path ahead is blocked' becomes true exactly when the bunny is standing on the burrow."
- T4: "**Repeat Until path ahead is blocked { Move Forward }** — two blocks. Robo Bunny hops until the hedge says stop, grabbing the carrot on the way. Run BOTH maps."

**Explanation:** "Your two-block program just solved a trail of ANY length. **Repeat N** is for when you know the count; **Repeat Until** is for when you know the *stopping condition* instead. That tiny program is the smartest one you've written: it doesn't contain the answer — it contains a way to FIND the answer. That's the difference between memorizing and thinking, and computers can do both."

**Challenge:** "What would happen on a trail with NO hedge at the end? Say your prediction out loud, then ask your teacher about 'infinite loops'."
**Teacher notes:** The step-limit failure message ("Robo Bunny got tired") is intentionally discoverable via the challenge. Contrast Repeat 4 vs Repeat Until on the board; the decoy `repeat_n` in the toolbox will catch students who pattern-match from Level 5 — variant B corrects them.

---

### Level 10 — FOREST CHALLENGE  `logic-forest/forest-challenge`

| | |
|---|---|
| New idea | Composition: nest a sensor loop inside a counting loop (capstone of Worlds 1–2) |
| Difficulty / Grade / Time | 5 / Grade 5+ (4 as stretch) / 15 min |
| XP | 80 |

**Learning objective:** Student combines `Repeat N`, `Repeat Until`, movement and turning to solve a spiral maze, demonstrating that small general programs beat long specific ones.

**Story hook:** The heart of Logic Forest is a spiral thicket, and at its center: the Great Golden Burrow. The old trail signs say only this — *"Hop until you can't. Turn. Trust the pattern."*

**Grids (7×5 variant A; 6×6 variant B — same program must pass both):**
```
Variant A
▶ . . . . . C
# # # # # # .
. C . . G # .
. # # # # # .
. C . . . . C
```
A: bunny (0,0) E. Entities: carrots (6,0), (6,4), (1,4), (1,2); burrow (4,2); trees as drawn — row 1 cols 0–5, row 3 cols 1–5, plus (5,2); grid border blocks implicitly.
Trace of solution: run E → stops at (6,0) [border, carrot] · S → (6,4) [carrot] · W → (0,4), collecting (1,4) on the way · N → stops at (0,2) [tree at (0,1)] · E → (1,2 carrot) … lands on (4,2) **burrow**, tree at (5,2) ends the inner loop. Program ends on the burrow ✓.
Variant B is a 6×6 spiral built the same way (one ring tighter); the identical program works because every straight run is sensor-terminated.

**Allowed blocks:** `move_forward`, `turn_left`, `turn_right`, `repeat_n`, `repeat_until` (condition: path ahead is blocked).
**Solution (optimal, 4):**
`Repeat 5 { Repeat Until path ahead is blocked { Move Forward }, Turn Right }`.
(After landing on the burrow in run 5, the inner loop exits on the tree ahead, the final Turn Right executes harmlessly in place, the outer loop completes, and the program ends on the burrow — end-state semantics hold.)
A fully unrolled ~20-block version passes for ★1: the capstone is inclusive.
**Success:** `[ {reachedGoal}, {collectedAll: carrot} ]` on both variants.
**Stars:** ★1 pass · ★2 ≤ 10 blocks · ★3 ≤ 6 blocks and no T4 hint.

**Hints:**
- T1: "Read the trail signs again: *hop until you can't, then turn*. You have a block for each half of that sentence."
- T2: "One 'hop until blocked, then turn right' handles ONE straight stretch of the spiral. How do you do that same dance again and again?"
- T3: "Put **Repeat Until blocked { Move }** and a **Turn Right** together *inside* a Repeat block. Count the straight stretches of the spiral for the Repeat number — it's 5."
- T4: "**Repeat 5 { Repeat Until path ahead is blocked { Move Forward }, Turn Right }** — the inner loop hops each corridor, the turn takes the corner, and the outer loop does it five times, right into the Golden Burrow."

**Explanation:** "Look at what you built: a loop INSIDE a loop. The inside one handles one corridor — however long it is. The outside one repeats the whole dance for every corner. Four blocks solved a maze of 20 hops, and the SAME four blocks solved a completely different maze. That's the deepest secret in this forest: great programmers don't write longer programs for bigger problems — they find the pattern and let the loops do the work. Worlds 1 and 2: complete. Robot Lab is waiting."

**Challenge:** "Ask your teacher to show variant C (a 9×7 spiral, bonus). Will your program still work? Why?"
**Teacher notes:** This is the level to project on the big screen in demos. Students who unroll it: pass them, then run their 20 blocks and the 4-block version side by side — the class will gasp; that gasp is the lesson. Expected help hotspots: setting the outer Repeat to 4 instead of 5 (bunny stops one corridor short — great debugging moment).

---

### 5.1 Difficulty ramp (verification table)

| # | Level | New idea (exactly one) | Optimal blocks | Diff | Grade | Min |
|---|---|---|---|---|---|---|
| 1 | First Hop | a block is an instruction | 1 | 1 | 3+ | 3 |
| 2 | Two Steps | sequences run in order | 2 | 1 | 3+ | 4 |
| 3 | Turn Around | turning ≠ moving | 5 | 2 | 3+ | 6 |
| 4 | Carrot Collector | multi-part goals | 6 | 2 | 3+ | 7 |
| 5 | Repeat After Me | Repeat N | 2 | 2 | 3+ | 8 |
| 6 | Loop Trail | multi-block loop bodies | 4 | 3 | 4+ | 8 |
| 7 | Avoid the Rock | obstacles & runtime failure | 6 | 3 | 4+ | 8 |
| 8 | Choose the Path | If + sensor (variants) | 7 | 4 | 4+ | 10 |
| 9 | Hidden Carrot | Repeat Until | 2 | 3 | 4+ | 8 |
| 10 | Forest Challenge | composition / nesting | 4 | 5 | 5+ | 15 |

Ramp properties worth noting: optimal block count is deliberately **non-monotonic** — levels 5, 9, 10 have *tiny* optimal solutions for *harder* problems, which is itself the abstraction lesson; difficulty dips at level 9 after the level-8 stretch (breather before the capstone); every level's toolbox contains only blocks already taught plus at most one new block.

**Achievement hooks (seed):** *First Program* = complete L1 · *Loop Master* = ★3 on L5, L6 and L9 · *Bug Hunter* seeds later (W3 debugging) · *World Champion* = all core levels of a world at ≥1★.

---

## 6. Worlds 3–8 — structural outline

Where each activity type **enters** the progression (first appearance bolded). Principle: a new *interaction format* never debuts in the same module as a new *concept* — one novelty at a time.

### World 3 — ROBOT LAB (automation & conditionals) · Gr 4–6
- **M3.1 Robot Senses** — If/Else formally; sensors deepen (`carrot ahead`, `on carrot`). Levels: *Bump Detector* (BLOCK_CODING, If/Else), *Left or Right?* (BLOCK_CODING, 3 variants), ***What Will Robo Do?*** (**CODE_PREDICTION** debut: show a short block program + grid, choose the ending frame from 4 thumbnails), ***Robot Orders*** (**SEQUENCING** debut: order the steps of an automation routine).
- **M3.2 Broken Robots** — **DEBUGGING** debut (same engine, pre-broken workspaces): *Fix the Wobble* (one wrong turn), *Loop Doctor* (off-by-one Repeat count), *The Tired Robot* (missing until-condition → infinite loop, connects to L9's challenge). Module ends with the first **QUIZ** checkpoint (5 questions: MCQ + T/F on sequences/loops/If).
- **M3.3 Teach the Robot** — FUNCTIONS intro ("My Blocks"): *The Dance Move* (define+call), *Dance Remix* (call a function inside a loop). Capstone: *Factory Floor* (functions + If/Else + variants).

### World 4 — DATA DESERT (data, patterns, classification) · Gr 4–6
- **M4.1 Pattern Dunes** — **PATTERN_RECOGNITION** debut: *What Comes Next?* (shape sequences), *Mirage Rule* (find-the-rule), *Number Caravan* (numeric patterns).
- **M4.2 Sorting Oasis** — **AI_CLASSIFICATION** debut (human-as-classifier — this is *concept prep* for ML, clearly labelled "you are the classifier"): *Cactus or Not?*, *Sort the Tracks* (animal footprints, 2→3 categories, threshold 8/10).
- **M4.3 Data Caravan** — VARIABLES in the grid engine: *Count the Carrots* (`variableEquals` check debuts: count collected carrots into a variable, Say the total), *Water Budget* (change-variable per step), SEQUENCING level *From Question to Answer* (order the steps of a data investigation). QUIZ checkpoint.

### World 5 — AI ISLAND (AI concepts) · Gr 5–7
- **M5.1 What Is AI, Really?** — QUIZ + CODE_PREDICTION mix: *AI or Just Rules?* (classify scenarios: chatbot vs calculator), *Smart Speaker Says* (prediction on rule-based vs learned behavior). Explicitly teaches the spec's PROGRAMMING vs AI CONCEPTS distinction.
- **M5.2 How Machines Learn** — AI_CLASSIFICATION with a twist: student first classifies with *too few* examples (designed to induce errors), then with many — the level's explanation lands "more good examples → better learning". *Train Your Eye*, *The Confusing Cat*.
- **M5.3 Fair & Safe** — **AI_ETHICS** debut: *The Biased Fruit Sorter* (training data missing green apples → sorter fails; bias from data), *Whose Photo?* (privacy scenario, no single right answer, choice-specific feedback), *Rumor Machine* (misinformation). QUIZ checkpoint gated for World 5 certificate ("AI Explorer" milestone).

### World 6 — MACHINE LEARNING LAB (real beginner ML) · Gr 5–7 · phase H
- **M6.1 Train Your First Model** — **REAL_ML** debut: *Cats vs Dogs* (curated built-in image set, train, test, confidence bars), *More Data, Better Brain* (retrain with more examples, watch accuracy move).
- **M6.2 Text Feelings** — sentiment on labelled sentences: *Happy or Grumpy?*, *Tricky Sentences* (sarcasm-free, age-appropriate ambiguity).
- **M6.3 Test & Trust** — evaluation literacy: *When the Model Is Wrong*, *Confidence Isn't Certainty*. Clear "MACHINE LEARNING" banner per spec's three-way distinction; no student-personal content ever enters training data (curated sets only).

### World 7 — CODE CITY (Blockly → real code) · Gr 5–7
- **M7.1 Two Views** — blocks⇄JavaScript toggle becomes the lesson: *Same Program, Two Costumes* (CODE_PREDICTION rendered as *code*), *Read the Street Signs* (match block ↔ code line).
- **M7.2 Read & Fix** — DEBUGGING with the code view primary (blocks available as fallback): *The Broken Traffic Light*, *Semicolon City* (reading errors, not typing yet).
- **M7.3 Type It** — constrained code entry (fill-in-the-blank tokens, not free typing): *Finish the Line*, capstone *City Lights* (write 3 lines inside a scaffold, graded by the same engine via generated-code equivalence).

### World 8 — INVENTOR ISLAND (open-ended) · Gr 5–7
- **M8.1 Design a Level** — **CREATIVE_PROJECT** debut: student uses a kid-safe subset of the grid painter to build a level, must record their own passing solution (publish gate for kids! — same validation, friendlier words), share to class gallery (teacher-moderated).
- **M8.2 Bunny Show** — creative programs with `Say`/events: *Tell a Grid Story* (rubric: uses a loop, uses an If, has an ending).
- **M8.3 Capstone Expo** — teacher-rubric project + "Coding Foundations" certificate milestone.

Certificates map: World completion certs per world; "AI Explorer" after W5; "Coding Foundations" after W8 capstone (course completion).

---

## 7. Seeding mechanics (engineering note)

Seed script (`prisma/seed.ts` domain: `content`) loads the 10 levels from `content-seed/` as typed TS fixtures (not JSON strings — they must compile against the Zod payload schemas in CI), creates them as `PUBLISHED` with `version: 1` snapshots authored by the system user, and wires program/world/module ordering exactly as §5. The demo school's two classes get one assignment each (Class A → World 1; Class B → Module 2.1) so teacher dashboards demo non-empty. A CI test runs every seed level's recorded solution through the engine against all variants and asserts PASS + ★3 — the seed content is executable test fixture for the grading engine, permanently.

---

## 8. English → Arabic translation workflow (managed later, designed now)

The `{ en, ar?, arHash }` envelope (§2.2) makes translation a *reporting problem*, not a schema problem.

**Pipeline states per field (computed, never stored as workflow): `missing` (no ar) → `draft` (ar present, unreviewed flag on the batch) → `reviewed` → `stale` (arHash mismatch after an EN edit).**

1. **Authoring rule:** EN is always authored first and is the source of truth. Arabic never blocks EN publishing (§4.5); a level additionally carries a computed `arComplete` boolean (all required localizable fields non-missing and non-stale).
2. **Translation dashboard** `/admin/content/translations`: coverage % per world/module (fields translated / total), filterable by `missing | stale`, sorted by "what students will hit first" (world order, then level order) so translation effort follows the student journey.
3. **Export/import:** batch export of untranslated+stale fields as a flat JSON/CSV — rows: `levelId, fieldPath, en, ar(current), status, context` (`context` = field kind: "hint tier 3", "story hook" — translators need it). Re-import validates: fieldPath exists, level not archived, EN unchanged since export (via included hash — else row flagged for re-translation, not silently applied). This supports an external translator with zero platform access.
4. **Review gate:** an Arabic-speaking educator (NITAQ_ADMIN with `content:translate-review`) approves batches in a side-by-side EN/AR view with RTL preview; approval stamps the batch and flips fields to `reviewed`.
5. **Staleness on republish:** editing EN text automatically renders its Arabic `stale` (hash mismatch) — visible in the dashboard the same minute, no human bookkeeping. Publishing a new version with stale AR is allowed but warns; the student UI falls back to EN for stale fields *only if* the school's policy is "prefer complete" (school-level setting: `arFallback: 'field' | 'level'` — fall back per field, or show the whole level in EN when any field is stale, avoiding mid-level language mixing; default `'level'`).
6. **Glossary:** a short canonical terms table (loop = حلقة, block = لبنة, program = برنامج, Robo Bunny = روبو بَني — transliterated, never translated) shipped with the export so hints stay terminologically consistent with the Blockly Arabic UI.
7. **Blockly itself:** block labels are **UI catalog** strings (next-intl messages + Blockly's `ar` locale + our custom-block msg entries), *not* content fields — the workflow above covers content only; block-label translation is a one-time engineering task in phase K.
8. **What does NOT get translated:** slugs, ASCII/grid data (visual), block type ids, solution workspaces (Blockly JSON is language-neutral; labels localize at render).

---

## 9. Open questions (product-owner decisions)

Design defaults are stated inline above and are safe to build against; these are the calls only the product owner should ratify:

1. **Multi-variant levels** (§2.3) add modest engine + editor scope but are what make If/Repeat-Until honest (levels 8–10 depend on them). Confirm they're in the MVP engine contract, or levels 8–10 get redesigned around weaker single-map versions.
2. **Rock/tree bump = immediate FAIL** (§3.4) vs. "bump blocks movement and the run continues". FAIL teaches error-reading and is this design's default; some competitors soft-block. One decision, engine-wide.
3. **Star-3 hint gating** (only tier 3–4 usage can cost the third star, on some levels): confirm this reading of "never punish excessively", or drop hint terms from star criteria entirely.
4. **Grade-band packaging at launch:** one program "Grades 3–7" (default here) vs. two programs (3–4 / 5–7) on day one — a sales-positioning call, zero content cost either way (§1.3).
5. **Arabic launch bar:** is `arComplete` on Worlds 1–2 a hard requirement before the first school demo, or is EN-first with the fallback chip acceptable for early demos? Determines when the §8 workflow needs staffing.
6. **Repeat After Me's toolbox limit** (single Move block forces the loop): confirm this guided-discovery approach vs. open toolbox with star-gated loop usage. Default: keep the limit — it's the level's puzzle.
