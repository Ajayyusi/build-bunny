# Build Bunny — Coding, Simulation, Grading & Hint Engine Design

Author: coding-engine design agent · Status: DESIGN (implementation-ready) · Respects all LOCKED stack decisions.

Scope: Blockly integration, sandboxed execution, deterministic grid-world engine, server-authoritative
grading, pluggable non-Blockly activity engines, and the 4-tier hint system. Covers build phase **C**
(plus the grading/activity plumbing that phases B/D/E consume).

---

## 0. Architecture at a glance

```
CLIENT (student learning screen)                       SERVER (Next.js server actions)
┌──────────────────────────────────────┐              ┌─────────────────────────────────────┐
│ Blockly workspace (custom blocks)    │              │ withAuth('student:attempt.submit')  │
│  └─ JSON serialization (autosave)    │  workspace   │  ├─ Zod-validate submission         │
│ JS codegen ──> JS-interpreter        │  JSON only   │  ├─ headless Blockly: reload JSON,  │
│  └─ API bridge ──> SimSession        │ ───────────> │  │   validate whitelist, regen JS   │
│       (src/engine, pure TS)          │              │  ├─ JS-interpreter + SAME engine    │
│  └─ event log ──> Canvas renderer    │              │  ├─ check catalog -> PASS/PARTIAL/  │
│       (animated playback)            │ <─────────── │  │   FAIL + stars + feedback keys   │
│ Advisory result (instant feedback)   │  authoritative│ └─ progression module: XP, unlock  │
└──────────────────────────────────────┘   GradeResult└─────────────────────────────────────┘
```

Core invariant: **the client never submits code or results — only the Blockly workspace JSON.**
The server regenerates code from that JSON, re-runs it against the identical deterministic engine,
and its result is the only one that counts. Client execution exists purely for instant animated
feedback.

Execution model: **execute-then-animate** (Code.org maze model). The interpreted program runs to
completion (bounded by step budgets) against the engine *synchronously*, producing an **event log**.
The Canvas layer then animates the log. This makes client and server execution byte-identical,
makes infinite-loop protection trivial, and enables replay/scrubbing for teachers.

---

## 1. Blockly integration

### 1.1 Package layout

```
src/modules/coding/
  blockly/
    blocks/                 # one file per block: definition + JS gen + (stub) Python gen
      events.ts  movement.ts  loops.ts  logic.ts  variables.ts
      sensors.ts  robot.ts  ai.ts  say.ts
    registry.ts             # registers all blocks + generators exactly once (idempotent)
    toolbox.ts              # buildToolbox(levelPayload) -> Blockly toolbox JSON
    theme.ts                # BunnyTheme (category colours from design tokens)
    serialization.ts        # save/load + version stamping + migration hooks
    msg/                    # en.ts, ar.ts — Blockly.Msg overrides for custom blocks
  runner/
    bridge.ts               # createSimApi(session) -> interpreter native fns
    execute.ts              # runProgram(code, session, limits) -> RunResult (isomorphic)
    limits.ts               # step/command budget constants
  render/
    CanvasRenderer.ts  sprites.ts  animation.ts  themes/   # per-world atlas manifests
  components/
    CodingScreen.tsx  BlocklyPanel.tsx  SimPanel.tsx  CodeView.tsx  HintPanel.tsx  RunControls.tsx
```

`runner/` and everything it imports (`src/engine/`) is **isomorphic** — no DOM, runs in Node for
server grading. `blockly/registry.ts` is also loaded server-side (headless Blockly) for
re-generation; `render/` and `components/` are client-only.

### 1.2 Custom block catalog

All custom blocks use the `bb_` prefix. Kid-visible labels come from `Blockly.Msg` keys
(`BB_MOVE_FORWARD` etc.) so Arabic ships via the message catalog, not new block definitions.
Colours come from the category, defined once in `theme.ts`.

Statement-level animation attribution uses Blockly's canonical mechanism — the execution
generator sets `javascriptGenerator.STATEMENT_PREFIX = 'highlight(%1);\n'` (and
`addReservedWords('highlight,...')`), so every statement is preceded by `highlight('<blockId>')`.
The `highlight` native function records "current block" in the session; all subsequent engine
events carry that blockId. Display codegen (BLOCKS⇄CODE view) runs with the prefix disabled, so
kids see clean code.

| Block type | Category | Inputs / fields | Generated JS (execution) | Notes |
|---|---|---|---|---|
| `bb_when_start` | EVENTS | none (hat) | *(container — children emitted as program body)* | Exactly one per workspace; enforced via `maxInstances`. Orphan stacks not under the hat are ignored by codegen and flagged in the UI ("these blocks won't run"). |
| `bb_move_forward` | MOVEMENT | none | `moveForward();` | One tile in facing direction. |
| `bb_turn_left` | MOVEMENT | none | `turnLeft();` | 90° CCW. |
| `bb_turn_right` | MOVEMENT | none | `turnRight();` | 90° CW. |
| `bb_collect` | MOVEMENT | none | `collect();` | Picks up collectable on current tile; no-op event `collect_nothing` if empty (not a failure — feedback uses it). |
| `bb_say` | ROBOT | value input `TEXT` (string/number) | `say(String(<TEXT>));` | Speech bubble + appended to output log (drives `expectedOutput`). |
| `bb_activate` | ROBOT | none | `activate();` | Generic "use" for interactive objects on current tile (button, lever, gate switch). Introduced in Robot Lab. |
| `bb_repeat` | LOOPS | field `TIMES` (number field, 1–99) + statement `DO` | `for (var i0 = 0; i0 < N; i0++) { … }` | Kid-facing form of `controls_repeat`. Loop var name auto-uniquified by generator. |
| `bb_repeat_until` | LOOPS | value input `COND` (Boolean) + statement `DO` | `while (!(<COND>)) { … }` | "Repeat until ⟨condition⟩". |
| `bb_if` | LOGIC | value `COND` + statement `DO` | `if (<COND>) { … }` | Simplified single-branch. |
| `bb_if_else` | LOGIC | value `COND` + statements `DO`/`ELSE` | `if (<COND>) { … } else { … }` | |
| `bb_detect` | SENSORS | dropdown `WHAT` (carrot/rock/water/goal/gate/any) × dropdown `WHERE` (ahead/here/left/right) | `detect('WHAT','WHERE')` → boolean | Pure query of engine state; no tick consumed. Covers "Detect Object" and path-ahead checks with one flexible block. |
| `bb_at_goal` | SENSORS | none | `atGoal()` → boolean | Sugar for `detect('goal','here')`; used in Repeat-Until levels. |
| `bb_classify` | AI | value `ITEM` (item handle) | `classify(<ITEM>)` → string label | Deterministic: consults the level's classifier table (§3.6). |
| `bb_predict` | AI | value `SERIES` or dropdown source | `predict(<SERIES>)` → value | Next-value prediction against level-defined answer table. |
| `bb_check_pattern` | AI | value `SERIES` + dropdown `PATTERN` | `checkPattern(<SERIES>,'PATTERN')` → boolean | Data Desert pattern levels. |
| `bb_current_item` | AI | none | `currentItem()` → item handle | The item presented by the level (classification conveyor levels). |

Reused built-in Blockly blocks (restyled by BunnyTheme, whitelisted per level like any other block):

| Built-in | Category | Why reuse |
|---|---|---|
| `math_number` | LOGIC | Numeric literal for `bb_say`, comparisons. |
| `logic_compare`, `logic_operation`, `logic_negate`, `logic_boolean` | LOGIC | Mature UX; labels localized by Blockly's own `ar` locale. |
| `variables_set`, `math_change`, `variables_get` | VARIABLES | Spec's Set/Change Variable. Blockly's variable model (rename dialogs, dropdowns) is not worth rebuilding. `math_change` relabelled "change ⟨var⟩ by ⟨n⟩". |
| `procedures_defnoreturn`, `procedures_callnoreturn` | FUNCTIONS | "My Blocks" (Scratch naming) — category label overridden. Introduced in Code City / late Robot Lab. |
| `text` | LOGIC | String literal for `bb_say`. |

Category colour tokens (from the shared design-token system, Play theme):
EVENTS amber · MOVEMENT green · LOOPS orange · LOGIC blue · VARIABLES purple ·
FUNCTIONS pink · SENSORS teal · ROBOT slate · AI violet · CONTROL is an umbrella label used in
docs only — its blocks live in LOOPS/LOGIC toolbox categories to avoid a near-empty category.

Each block file exports one record consumed by `registry.ts`:

```ts
export const moveForward: BunnyBlock = {
  type: 'bb_move_forward',
  category: 'MOVEMENT',
  definition: { message0: '%{BKY_BB_MOVE_FORWARD}', previousStatement: null, nextStatement: null, style: 'movement' },
  js:     (block, g) => 'moveForward();\n',
  python: (block, g) => 'move_forward()\n',   // stub kept green from day one
};
```

### 1.3 Toolbox configuration per level

The level payload (§3.4) declares `toolbox`: an ordered list of `{ block: string, limit?: number }`
plus optional `categories: boolean`. `buildToolbox()`:

- **Flyout mode** (default when ≤ 8 block types and `categories` unset): a single always-open
  flyout — no category clicking for early grades (Bunny Meadow, Logic Forest).
- **Category mode**: standard category toolbox grouped by block category, shown when the level
  opts in (Robot Lab onward) or lists > 8 types.
- Per-block `limit` maps to the workspace `maxInstances` option; payload `maxBlocks` maps to the
  workspace `maxBlocks` option so the cap is enforced *while building*, not just at grading.
- The server re-validates at grading time that every block in the submitted workspace is in the
  level whitelist (defence against a doctored client).

### 1.4 Workspace options, theme, renderer (tablet-first kids UX)

- **Renderer: `zelos`** (the Scratch-style renderer) — largest touch targets, chunky notches,
  ideal for iPad. **Theme: `BunnyTheme`** extends the Zelos theme with our category styles, larger
  `FIELD_TEXT_FONTSIZE`, rounded flyout.
- Workspace options: `zoom: { controls: true, pinch: true, startScale: 0.9 }`, `trashcan: true`,
  `move: { scrollbars: true, drag: true, wheel: false }`, `sounds: true` (respect a user mute),
  grid off (visual noise for kids), `renderer: 'zelos'`, `rtl: locale === 'ar'`.
- Media served from `/public/blockly-media/` (self-hosted — no CDN, offline-friendly).
- Localization: load Blockly's own `ar` message pack for built-ins + our `msg/ar.ts` for `bb_*`
  blocks; `rtl: true` flips the workspace natively (Blockly supports full RTL).
- Reduced motion: pass through to renderer animations off; Blockly itself is fine.

### 1.5 Serialization

- Format: **Blockly JSON serialization** (`Blockly.serialization.workspaces.save/load`) — never
  the legacy XML. Stored as JSONB.
- Envelope stored everywhere a workspace is persisted (draft autosave, attempt submission,
  level `startingWorkspace`):

```json
{ "v": 1, "blockSetVersion": 3, "blockly": { "blocks": { "languageVersion": 0, "blocks": [ … ] } } }
```

- `blockSetVersion` increments whenever a `bb_*` block's shape changes; `serialization.ts` owns a
  migration table `{ from: 2, to: 3, migrate(json) }` applied on load. Unknown/removed blocks are
  dropped with a UI notice rather than crashing the workspace.
- Draft autosave: debounced 2 s after last change → server action `saveWorkspaceDraft(levelId,
  envelope)` (upsert into `StudentLevelState.draftWorkspace`). Restored on re-entry, with a
  "start over" reset to `startingWorkspace`.

### 1.6 BLOCKS ⇄ CODE toggle

- A segmented control above the workspace: **Blocks | Code**. Code view is **read-only** in MVP
  (editable text code is Code City scope, later phase).
- Code is produced by the *display* generator pass (no `STATEMENT_PREFIX`, no ids), pretty and
  kid-readable: `moveForward();`, `for (let i = 0; i < 4; i++) { … }`.
- Line⇄block map: during display generation we record `blockId → [startLine, endLine]` (walk the
  top-level statement order; Blockly generators emit deterministically). Hovering a line
  highlights the block and vice-versa — cheap, high "real code" credibility in demos.
- Syntax highlighting: a ~60-line in-house tokenizer (keywords / numbers / strings / identifiers)
  — no highlighting dependency, honouring the "no unnecessary deps" quality bar.
- **Python later**: every block file already carries a `python` generator fn; a `codeLanguage`
  feature flag ('js' | 'python') switches the display generator. Execution stays JS-interpreter
  regardless — Python is a *view* first (Code City teaches reading it), a runtime only if ever
  justified. This is the whole "JS now / Python later" strategy: one extra function per block, no
  second runtime.

---

## 2. Execution: sandboxed, step-based, deterministic

### 2.1 Runtime

**Neil Fraser's JS-interpreter** (`js-interpreter` npm), used identically on client and server
(it is pure ES5 JS; on the server it runs inside Node with no extra sandboxing needed beyond the
interpreter itself — interpreted code has access to *only* the natives we register).

`runner/execute.ts` (isomorphic):

```ts
export interface RunLimits { maxInterpreterSteps: number; maxCommands: number; maxOutputChars: number; }
export const DEFAULT_LIMITS: RunLimits = { maxInterpreterSteps: 100_000, maxCommands: 1_000, maxOutputChars: 4_000 };

export function runProgram(code: string, session: SimSession, limits = DEFAULT_LIMITS): RunResult
// RunResult = { termination: 'completed' | 'step_limit' | 'command_limit' | 'runtime_error' | 'sim_halted',
//               error?: { message: string; blockId?: string }, steps: number }
```

The loop is a plain `while (interpreter.step())` with counters — **fully synchronous**, no
promises, no `setTimeout`. A run of a kid-sized program finishes in single-digit milliseconds.

### 2.2 API bridge (`runner/bridge.ts`)

`createSimApi(session)` returns the `initFunc` for the interpreter, registering natives:

| Native | Signature | Effect |
|---|---|---|
| `highlight(blockId)` | `(string) => void` | Sets `session.currentBlockId`; also appended to the event log as a `trace` event (drives block highlighting during playback, including for loop iterations that produce no world event). |
| `moveForward()` | `() => void` | `session.exec({ kind: 'MOVE' })` — throws `SimHalt` if the sim entered a terminal failure state (fell in water), which aborts interpretation cleanly. |
| `turnLeft()` / `turnRight()` | `() => void` | `exec({ kind: 'TURN', dir })` |
| `collect()` | `() => void` | `exec({ kind: 'COLLECT' })` |
| `activate()` | `() => void` | `exec({ kind: 'ACTIVATE' })` |
| `say(text)` | `(string) => void` | `exec({ kind: 'SAY', text })` — text length capped; appended to `session.outputLog`. |
| `detect(what, where)` | `(string, string) => boolean` | Pure read of current world state; logs a `sense` event (so playback can show the "looking" animation and teachers can see sensor reads). |
| `atGoal()` | `() => boolean` | Sugar for detect. |
| `classify(item)` / `predict(x)` / `checkPattern(x, p)` | → string/value/boolean | Deterministic lookups against level payload tables (§3.6). |

Every native validates its arguments (interpreted code can call natives with anything) and throws
typed errors that surface as kid-readable messages ("Say needs some words to say").

### 2.3 Budgets & infinite-loop protection

Three independent guards, all producing distinct, teachable outcomes:

1. **Interpreter step budget** (100k): catches `while(true){}` with no commands. Feedback:
   "Your program is running forever without doing anything — check your Repeat Until condition."
2. **Command budget** (1,000 world commands): catches `while(true){ moveForward(); }`. Feedback:
   "Robo Bunny got tired after 1000 moves — your loop never stops."
3. **Sim halt**: terminal world states (hazard tile) stop execution immediately; remaining code
   never runs (mirrors reality, simplifies grading).

Server additionally wraps the whole grade call in a 2 s wall-clock guard (belt-and-braces; the
budgets make this unreachable in practice).

### 2.4 Animation timing (client only)

Execution finishes first; the renderer then plays the **event log**:

| Event | Base duration | Animation |
|---|---|---|
| `moved` | 320 ms | Tween hop between tiles + ear bounce |
| `turned` | 200 ms | Rotation tween |
| `bumped` | 280 ms | Half-hop + shake + "bonk" sfx |
| `collected` | 260 ms | Carrot pop + sparkle + counter increment |
| `collect_nothing` | 200 ms | Small "?" puff |
| `said` | 900 ms | Speech bubble (min-visible time) |
| `activated` | 300 ms | Object state swap (gate opens…) |
| `fell` (hazard) | 500 ms | Splash/fall + fade |
| `won` / `failed` | 800 ms | Confetti / gentle retry prompt |

Speed control ×0.5 / ×1 / ×2 multiplies all durations; **Skip** jumps to final state. During
playback the current `trace` blockId is highlighted in the workspace. `prefers-reduced-motion`
(or the user toggle): no tweens — discrete state steps at 400 ms with highlight only. Step-through
mode ("Step" button) advances the event log one world event at a time — implemented on the log,
not the interpreter, so it is trivial and can also *replay a finished run*.

---

## 3. Simulation engine (`src/engine/` — pure TS, zero DOM)

### 3.1 Module layout

```
src/engine/
  core/
    types.ts        # Pose, Direction, Vec2, TileDef, EntityDef, WorldState
    world.ts        # createWorld(levelDef) -> WorldState; tile queries; entity lookup
    rng.ts          # mulberry32 seeded PRNG (only randomness allowed; seed from levelDef)
  run/
    session.ts      # SimSession: exec(command) -> events; state; outputLog; halted flag
    commands.ts     # Command union + per-command reducers
    events.ts       # SimEvent union + log helpers
  levels/
    schema.ts       # Zod: LevelDefSchema (BLOCK_CODING payload) + parseLevelDef()
    legend.ts       # grid char legend <-> TileDef
  checks/
    index.ts        # check registry
    reachedGoal.ts collected.ts avoidedTiles.ts blocks.ts variableValue.ts
    expectedOutput.ts expectedSequence.ts classifierResult.ts
  version.ts        # export const ENGINE_VERSION = '1.0.0'
```

Determinism rules (enforced by an ESLint boundary rule on `src/engine/**`): no `Date`, no
`Math.random` (only `core/rng`), no DOM/Node globals, no dynamic imports, integer tile coords,
event log append-only with monotonically increasing `seq`. Same inputs ⇒ byte-identical event
log ⇒ client and server always agree.

### 3.2 World model

```ts
type Direction = 'N' | 'E' | 'S' | 'W';
interface Pose { x: number; y: number; facing: Direction }   // x=col, y=row, origin top-left

interface TileDef {                    // static per-cell terrain
  terrain: 'grass' | 'path' | 'water' | 'rock' | 'sand' | 'floor' | 'void';
  walkable: boolean;                   // rock/void: false (bump); water: true (then hazard)
  hazard: boolean;                     // stepping here => 'fell' + sim halt
  goal?: boolean;                      // goal flag lives on the tile
}

interface EntityDef {                  // dynamic objects placed on tiles
  id: string;                         // 'carrot-1'
  type: 'carrot' | 'gem' | 'key' | 'button' | 'gate' | 'sign' | string;  // string-extensible
  x: number; y: number;
  props?: Record<string, unknown>;    // e.g. gate: { linkedTo: 'button-1', open: false }
}

interface WorldState {
  width: number; height: number;
  tiles: TileDef[][];                 // [y][x]
  agent: Pose;
  entities: Map<string, EntityInstance>;   // EntityInstance = EntityDef + mutable state
  collected: Record<string, number>;       // by entity type: { carrot: 2 }
  visited: Vec2[];                         // every tile the agent occupied, in order
  halted: false | { reason: 'fell' | 'won' };
}
```

Terrain answers "can I stand here / do I die here"; entities answer "what is on this tile and
what happens when I collect/activate". **New exercise mechanics = new entity types + (rarely) a
new command — never an engine rewrite.** Entity behaviours are registered in a small
`entityBehaviors` registry (`onEnter`, `onCollect`, `onActivate` hooks per type), so e.g. a
Robot Lab "pressure plate" is ~20 lines in one new file.

### 3.3 Commands, tick loop, events

`SimSession.exec(cmd)` is the *only* mutation path. Each command = one tick:

```
tick(cmd):  validate -> apply reducer -> run entity onEnter hooks -> emit events -> check terminal state
```

Event log (the single source of truth for rendering, grading and teacher replay):

```json
[
  { "seq": 0, "type": "trace",     "blockId": "q3&Fz" },
  { "seq": 1, "type": "moved",     "blockId": "q3&Fz", "from": {"x":0,"y":2}, "to": {"x":1,"y":2}, "facing": "E" },
  { "seq": 2, "type": "collected", "blockId": "h8!Aq", "entityId": "carrot-1", "entityType": "carrot", "at": {"x":1,"y":2} },
  { "seq": 3, "type": "bumped",    "blockId": "q3&Fz", "at": {"x":1,"y":2}, "into": {"x":2,"y":1}, "obstacle": "rock" }
]
```

Event union: `trace · sense · moved · bumped · turned · collected · collect_nothing · said ·
activated · entity_changed · fell · won · failed`. `won` is emitted by the session when the
level's `winOn` condition (default: `reach_goal_with_all_required`) is satisfied *during*
execution — but authoritative pass/fail always comes from the check catalog after the run, so
levels without a spatial goal (pure output levels) also work.

### 3.4 Level definition JSON schema (BLOCK_CODING payload)

Stored in `Level.payload` (JSONB) by the content module; validated by
`src/engine/levels/schema.ts` (Zod) at authoring time *and* on every load. Localizable strings
use the platform-wide `{ en, ar? }` shape. Schema (abridged field list — every field below is in
the Zod schema):

```
LevelDef {
  schemaVersion: 1
  engine: { minVersion: '1.0.0' }
  theme: 'meadow' | 'forest' | 'lab' | 'desert' | ...     // rendering theme key (§3.5)
  seed?: number                                            // for future randomized variants
  grid: { width, height, rows: string[] }                  // char rows, legend below
  legend?: Record<string, TileDefPatch>                    // extend/override default legend
  start: { x, y, facing }
  entities: EntityDef[]
  winOn?: 'reach_goal' | 'all_collected' | 'checks_only'   // when the in-sim 'won' event fires
  toolbox: { categories?: boolean, blocks: { block: string, limit?: number }[] }
  maxBlocks?: number
  startingWorkspace?: WorkspaceEnvelope
  checks: CheckSpec[]                                      // §4.2 — REQUIRED, ≥1 'core'
  stars: StarRules                                         // §4.4
  optimalBlocks: number
  classifierTable?: { items: [...], labels: [...] }        // only for AI-block levels (§3.6)
  answerTables?: { predict?: ..., patterns?: ... }
}
```

Default legend: `.` grass · `#` rock · `~` water · `-` path · `G` grass+goal · `_` void.
Entities are *never* encoded in grid chars (they move/disappear); always in `entities[]`.

Instructions/story/hints/XP/etc. live in the surrounding `Level` row (phase B curriculum
schema), not in the engine payload — the engine payload is exactly what the simulator + grader
need, which is what makes the engine extractable later.

### 3.5 Rendering layer (client-only, `src/modules/coding/render/`)

- `CanvasRenderer` draws layered: (1) terrain — pre-rendered once to an offscreen canvas,
  (2) tile decorations, (3) entities, (4) agent, (5) effects/particles, (6) overlay (goal
  glow, debug grid). Only layers 3–6 redraw per frame; rAF-driven; devicePixelRatio-aware;
  resizes with its panel (min tile 40 px on iPad).
- **Theme = asset manifest**, not code: `render/themes/meadow.ts` maps logical ids →
  spritesheet frames (`terrain.grass → meadow.png#0,0`, `entity.carrot → …`, agent animation
  strips, palette for particles/sky). Adding Logic Forest = new manifest + one PNG atlas.
  The engine knows only the string `theme: 'forest'`.
- Renderer consumes **the event log**, never engine internals: `renderer.play(events, speed)`,
  `renderer.seek(seq)`, `renderer.showFinal(events)`. This is what makes teacher-side attempt
  replay free (same component fed a stored log).

### 3.6 Deterministic "AI" blocks

`classify` / `predict` / `checkPattern` in Data Desert & AI Island are **pedagogical
simulations**: the level payload carries an explicit table (`classifierTable.items[i] =
{ id, features, label, confidence }`). The engine returns table values — deterministic,
server-replayable, honest ("the robot was already trained" is part of the story text). Real
training belongs exclusively to the REAL_ML activity type (phase H, separate design), keeping
the promise to "clearly distinguish PROGRAMMING vs AI CONCEPTS vs MACHINE LEARNING".

---

## 4. Server-authoritative grading

### 4.1 Submission flow

Server action `submitAttempt` in `src/modules/learning/actions.ts`, wrapped
`withAuth('student:attempt.submit')`, rate-limited (10/min/student):

```
input (Zod): { levelId: cuid, workspace: WorkspaceEnvelope, clientResult?: { status, stars },
               durationMs: number, hintTierUsed: number }   // hintTier cross-checked server-side
1. Load Level (tenant-scoped), assert published + unlocked for this student.
2. Headless Blockly (Node): load workspace JSON, drop unknown blocks, verify every block ∈ toolbox
   whitelist and instance limits — violation ⇒ attempt rejected 'invalid_workspace' (not FAIL).
3. Compute WorkspaceStats: blockCount (excluding the hat), counts per type, topLevelStacks.
4. Generate execution JS (STATEMENT_PREFIX on). Never accept client code.
5. createWorld(levelDef) -> SimSession -> runProgram(code, session, DEFAULT_LIMITS).
6. Run check catalog -> GradeResult (status, stars, checkResults, feedback keys).
7. Persist Attempt row; hand GradeResult to progression module (XP delta, unlocks, achievements,
   streak) in the same transaction.
8. Return GradeResult to client; client reconciles with its advisory result; on mismatch, trust
   server and emit `grading_mismatch` telemetry (should be ~zero — determinism regression alarm).
```

Attempt row (Prisma excerpt): `id, studentId, schoolId, levelId, activityType, submission JSONB
(workspace envelope), status, stars, xpAwarded, checkResults JSONB, eventLog JSONB (capped 1000
events), outputLog, termination, blockCount, hintTierUsed, durationMs, engineVersion,
levelVersion, createdAt`. Teachers replay attempts from `eventLog` + view `submission` in a
read-only Blockly.

### 4.2 Check catalog

Every check: `{ id, params, severity: 'core' | 'secondary' | 'quality', feedbackKey? }`.
Registered in `src/engine/checks/index.ts`; evaluated against a `CheckContext = { levelDef,
finalState, events, outputLog, workspaceStats, termination, variablesFinal }`.
(`variablesFinal` is captured from the interpreter's global scope after the run — primitive
values only.)

| Check id | Params | Passes when | Typical severity |
|---|---|---|---|
| `reachedGoal` | `{}` | Final agent pose is on a `goal` tile and run completed | core |
| `collectedAll` | `{ entityType?, count? }` | Collected count ≥ count (default: all of that type in level) | core |
| `avoidedTiles` | `{ terrain: ['water'] }` \| `{ cells: [{x,y}] }` | No `visited` entry ∩ forbidden set; no `fell` event | core |
| `requiredBlocks` | `{ blocks: [{ type, min? }] }` | WorkspaceStats contains each type ≥ min (default 1) | secondary |
| `forbiddenBlocks` | `{ blocks: ['bb_move_forward'] , max?: 0 }` | Count ≤ max | secondary |
| `maxBlocks` | `{ count }` | blockCount ≤ count | secondary (hard cap already enforced by workspace `maxBlocks`; check exists for content that only *scores* it) |
| `variableValue` | `{ name, equals \| gte \| lte }` | Final interpreter variable matches | core/secondary |
| `expectedOutput` | `{ lines: string[], ordered?: true, match?: 'exact' \| 'trim' \| 'number' }` | `outputLog` (from `say`) matches | core |
| `expectedSequence` | `{ events: ['collected:carrot','activated:button-1'], ordered: true }` | Event log contains subsequence | core/secondary |
| `classifierResult` | `{ itemId, expectedLabel }[]` | Each `classify` call in the log returned expected label for the item | core |
| `noRuntimeFailure` | `{}` (implicit, always evaluated) | termination = 'completed' | core (auto-added) |

Adding a check = one file exporting `{ id, paramsSchema (Zod), evaluate(ctx, params): CheckResult }`
plus registry entry. `CheckResult = { passed, detail?: Record<string,unknown> }` — `detail`
feeds feedback templating (e.g. which carrot was missed, where the bump happened).

### 4.3 PASS / FAIL / PARTIAL semantics

- **FAIL** — any `core` check fails.
- **PARTIAL** — all `core` pass, ≥ 1 `secondary` fails. (Example: reached the goal and got all
  carrots, but used a forbidden block or exceeded the target block count.) PARTIAL awards
  1 star and completion-credit XP but does **not** mark the level "mastered" (no 2–3 stars);
  the level stays replayable with a "make it shine" prompt.
- **PASS** — all `core` + `secondary` pass. `quality` checks never gate status; they only feed
  stars/feedback.

### 4.4 Stars

`StarRules` in the level payload, with platform defaults so authors rarely write them:

```json
{ "three": { "maxBlocks": "optimal", "maxHintTier": 2 },
  "two":   { "maxBlocks": "optimal*1.5", "maxHintTier": 3 },
  "one":   {} }
```

- 1★ = status PASS (or PARTIAL). 2★/3★ require PASS plus the listed criteria
  (`"optimal"` resolves against `optimalBlocks`).
- Hint policy per spec ("never punish excessively"): tiers 1–2 are free; tier 3 caps at 2★;
  tier 4 caps at 2★ as well (never below — a child who needed strong help and then succeeded
  still gets a good outcome). Stars are **high-water-mark** per level: replays can only raise
  the stored star count; XP on replay = only the delta for newly earned stars.

### 4.5 Feedback generation (guides, never reveals)

Rule-based, i18n-keyed, ordered by pedagogical priority — the student sees **one primary
message** (+ optional tip), never a wall of check failures:

1. Runtime failures first (`fell`, budgets) — they explain what the child *watched happen*.
2. Then the first failing `core` check in level-author order.
3. Then `secondary` polish prompts (only when status ≠ FAIL).

Each feedback template gets the failing check's `detail` + event log context as slots. Examples
(en catalog; ar parallel):

| Situation | Key | Message (style guide: name what happened + point *where* to look + end with a question or nudge; never the answer) |
|---|---|---|
| bumped into rock | `fb.bumped` | "Robo Bunny bumped into a rock near step {step}. Watch the replay — what should happen just before the bump?" |
| fell in water | `fb.fell` | "Splash! Bunny hopped into the water at ({x},{y}). Which block sent it that way?" |
| missed collectables | `fb.collect.missed` | "So close — {remaining} carrot{s} left on the field. Did Bunny stop on every carrot *and* collect it?" |
| collect on empty tile | `fb.collect.empty` | "Bunny tried to collect where there was no carrot. Collect only works while standing on one." |
| command budget | `fb.loop.runaway` | "Your loop never stops! Check what should make it end." |
| requiredBlocks fail | `fb.blocks.required` | "This level wants you to use the {blockName} block — it can make your program much shorter." |
| maxBlocks/optimal (PARTIAL/2★) | `fb.blocks.optimal` | "It works! Can you solve it with {target} blocks or fewer? A Repeat block might help…" |
| expectedOutput mismatch | `fb.output.mismatch` | "Bunny said \"{got}\" but something different was expected. Check what you put inside Say." |

The full solution is *never* in feedback; strong help lives only in hint tier 4 (§6), which the
student must explicitly request.

---

## 5. Non-Blockly activity engines

### 5.1 Common interface

`src/modules/activities/` hosts a registry keyed by `ActivityType`. BLOCK_CODING and DEBUGGING
are themselves just registry entries whose grader delegates to the engine + check catalog — one
uniform pipeline for `submitAttempt`, attempts storage, teacher review, and progression.

```ts
interface ActivityEngine<P, S> {
  type: ActivityType;
  payloadSchema: z.ZodType<P>;        // validates Level.payload at authoring + load
  submissionSchema: z.ZodType<S>;     // validates student submission at the boundary
  grade(payload: P, submission: S, ctx: GradeCtx): GradeResult;   // pure + synchronous
  clientComponent: string;            // 'BlockCodingActivity' — resolved by the student UI
}
```

`GradeResult` is the same shape for every type (`status, stars, checkResults, feedbackKeys,
score0to100`), so dashboards and progression code never branch on activity type.

### 5.2 Per-type payload + grading

| Type | Payload (essentials) | Submission | Grading |
|---|---|---|---|
| `BLOCK_CODING` | `LevelDef` (§3.4) | workspace envelope | Engine re-run + checks (§4). |
| `DEBUGGING` | `LevelDef` + `brokenWorkspace` (served as the starting workspace) + optional `maxEdits` | workspace envelope | Same as BLOCK_CODING; optional secondary check `maxWorkspaceEdits` (tree-diff of block ids vs broken version — teaches *repair*, not rewrite). |
| `CODE_PREDICTION` | rendered read-only workspace (or code text) + `question {en,ar}` + `options[] { id, label {en,ar} \| image }` + `correctOptionId` + `explanation {en,ar}` | `{ optionId }` | Exact match ⇒ PASS else FAIL; one retry allowed before feedback shows explanation; stars: 3 first-try, 2 second-try, 1 with hint. |
| `SEQUENCING` | `items[] { id, label {en,ar} \| image }` + `correctOrder: string[]` + `allowPartial: boolean` | `{ order: string[] }` | All-correct ⇒ PASS. If `allowPartial`: longest-common-subsequence ratio ≥ 0.6 ⇒ PARTIAL with "some steps are in the right order" feedback pointing at the *first* misplaced item. |
| `PATTERN_RECOGNITION` | `sequence[]` (emoji/image/number tokens) + `options[]` + `correctOptionId` + optional `rule {en,ar}` shown after success | `{ optionId }` | Like CODE_PREDICTION. |
| `AI_CLASSIFICATION` | `buckets[] { id, label {en,ar} }` + `items[] { id, image \| text, correctBucketId }` + `passThreshold` (default 0.8) | `{ placements: { itemId, bucketId }[] }` | accuracy = correct/total; ≥ threshold ⇒ PASS, ≥ 0.5 ⇒ PARTIAL; feedback names *categories* confused ("some vehicles ended up with animals"), never the specific answers. Stars by accuracy bands (1.0 / ≥0.9 / ≥threshold). |
| `QUIZ` | `questions[]` of subtypes `mcq \| true_false \| matching \| sorting`, each with its own sub-schema + per-question `points` | `{ answers: [...] }` per subtype | Score = points ratio; PASS ≥ 0.7, PARTIAL ≥ 0.5. Matching graded per-pair; sorting via LCS like SEQUENCING. Per-question feedback flags wrong ones without giving answers; retry regenerates question order (seeded shuffle). |

`AI_ETHICS` reuses `QUIZ` (scenario + question payload) in MVP; `REAL_ML` and
`CREATIVE_PROJECT` register later with the same interface (CREATIVE_PROJECT's grader is
"teacher-reviewed": auto-PASS on submit with `needsReview: true`).

All answer-bearing payloads are **server-only**: the student-facing loader
(`getLevelForPlay`) strips `correctOptionId`, `correctOrder`, `correctBucketId`,
`explanation`, `answerTables`, hints — students only ever receive what they need to attempt.

---

## 6. Progressive 4-tier hint system

### 6.1 Content model

Hints live on the Level row (not the engine payload): `hints: [{ tier: 1..4, text: {en,ar},
highlight?: { blockType?: string, cell?: {x,y} } }]` — exactly 4, enforced at authoring.
Tier semantics (authoring guideline, enforced by content review):

1. **Conceptual** — restate the idea ("think about what repeats").
2. **Specific** — name the tool ("the Repeat block can do this in 3 blocks").
3. **Locate** — point at the problem region (may highlight a workspace block type or glow a
   grid cell via `highlight`).
4. **Strong help** — near-solution structure in words (never a pasteable block-by-block answer).

### 6.2 Delivery & gating

- Hints are **never included** in the level payload sent to the client (no scraping). The
  HintPanel calls server action `unlockHint(levelId)` which returns the next tier's text and
  records the unlock.
- Gating (server-enforced): tier 1 any time; tier n>1 requires (tier n−1 unlocked) AND (≥1
  failed/partial attempt since that unlock OR 60 s elapsed). The panel shows a friendly
  countdown ("try once more, then I can help further") — pressure-free pacing, and it keeps
  hints a *learning* tool rather than a skip button.
- The bunny mascot presents hints (same surface the future BUNNY GUIDE will occupy — the
  HintPanel is designed so the LLM assistant later slots in behind the same UI with tiers as
  fallback).

### 6.3 Tracking

`StudentLevelState` (one row per student×level, also holds draft + best stars) gains
`hintTierUsed: number` (high-water mark) + `hintUnlocks: { tier, at }[]` JSONB. Every
`unlockHint` is also an AuditLog-light event for analytics. Consumers:

- **Stars** (§4.4): tier ≤ 2 free; tier ≥ 3 caps at 2★. Never blocks completion or XP for 1★.
- **Teacher dashboard**: "struggling" signal = (attempts ≥ 3 AND tier ≥ 3) OR time-on-level
  > 2× estimate — surfaced per student per level.
- **Content analytics** (NITAQ admin): levels with abnormal tier-3/4 usage rates are flagged
  for redesign — hints double as a content-quality sensor.

---

## 7. Seed level example — "Carrot Collector" (World 1 · Bunny Meadow · Level 4)

Teaches: planning a multi-step path + the new **Collect** block (levels 1–3 taught move/turns).
Below is the complete `Level.payload` for BLOCK_CODING plus the hint rows, as they will ship in
the seed script.

```json
{
  "schemaVersion": 1,
  "engine": { "minVersion": "1.0.0" },
  "theme": "meadow",
  "grid": {
    "width": 5, "height": 5,
    "rows": [
      "....G",
      "..#..",
      ".....",
      "....#",
      "....."
    ]
  },
  "start": { "x": 0, "y": 2, "facing": "E" },
  "entities": [
    { "id": "carrot-1", "type": "carrot", "x": 1, "y": 2 },
    { "id": "carrot-2", "type": "carrot", "x": 3, "y": 2 },
    { "id": "carrot-3", "type": "carrot", "x": 3, "y": 0 }
  ],
  "winOn": "checks_only",
  "toolbox": {
    "blocks": [
      { "block": "bb_when_start", "limit": 1 },
      { "block": "bb_move_forward" },
      { "block": "bb_turn_left" },
      { "block": "bb_turn_right" },
      { "block": "bb_collect" }
    ]
  },
  "maxBlocks": 16,
  "startingWorkspace": { "v": 1, "blockSetVersion": 1, "blockly": { "blocks": { "languageVersion": 0,
      "blocks": [ { "type": "bb_when_start", "x": 24, "y": 24 } ] } } },
  "checks": [
    { "id": "collectedAll", "params": { "entityType": "carrot" }, "severity": "core" },
    { "id": "reachedGoal",  "params": {}, "severity": "core" }
  ],
  "optimalBlocks": 11,
  "stars": { "three": { "maxBlocks": "optimal", "maxHintTier": 2 },
             "two":   { "maxBlocks": 14,        "maxHintTier": 3 } }
}
```

Board narrative: Bunny starts mid-left facing East. Carrots at (1,2) and (3,2) along the row;
rocks at (2,1) and (4,3) hem the path; the third carrot sits at (3,0) with the goal flag at
(4,0). Optimal 11 blocks (excluding the hat): `Move, Collect, Move, Move, Collect, Turn Left,
Move, Move, Collect, Turn Right, Move`. Deliberate trap: continuing East past the second carrot
and hugging the right edge reaches the goal in only 9 blocks — but misses carrot-3, so
`collectedAll` FAILs with the "1 carrot left" feedback, teaching kids to scan the whole field
before running.

Surrounding Level-row content (seed script, abridged): title `{ "en": "Carrot Collector",
"ar": "جامع الجزر" }`; objective "Plan a full path and use Collect on every carrot"; XP 50;
estimated 6 min; post-success explanation "You planned 11 steps ahead — real programmers write
the whole plan before running it!"; challenge "Try it with 11 blocks for 3 stars."; hints:

| Tier | Text (en) |
|---|---|
| 1 | "Bunny only picks up a carrot when you tell it to. Plan the whole path before you press Run." |
| 2 | "There are 3 carrots — so you need the Collect block 3 times, each time Bunny is standing on one." |
| 3 | "Bunny gets the two carrots in its row, but the last carrot is above the second one. After collecting at the second carrot, which way should Bunny turn?" *(highlight: cell (3,0))* |
| 4 | "Hop and collect along the row: Move, Collect, Move, Move, Collect. Then Turn Left, hop up twice, Collect. Finally Turn Right and one hop to the flag." |

---

## 8. Testing & quality strategy (engine-specific)

- **Golden event-log tests** (Vitest): for every seed level, a known-good workspace JSON is
  executed and the event log snapshot-compared. Any engine change that alters behaviour fails
  loudly. Same fixtures run through `submitAttempt` in integration tests (headless Blockly path).
- **Property tests**: random command sequences on random small grids — invariants: agent always
  on-board or halted; collected counts ≤ placed; event `seq` strictly increasing; re-running the
  same sequence yields identical logs.
- **Determinism CI gate**: one test executes the Carrot Collector optimal solution 100× and
  asserts a single distinct log hash.
- **Check-catalog unit tests**: each check gets table-driven pass/fail/detail cases.
- **Playwright**: one E2E per activity type — open level, build solution via injected workspace
  JSON (not drag-simulation), run, assert stars UI, assert server Attempt row.
- Version discipline: `ENGINE_VERSION` + `blockSetVersion` + `levelVersion` stored on every
  attempt; grading always re-runnable for support disputes.

## 9. Risks & scope notes

- Headless Blockly on the server is well-trodden but must be loaded once per process (module
  registration is global); wrap in a lazily-initialized singleton and never per-request.
- JS-interpreter is ES5-only — our generators emit ES5 (`var`, no arrow fns) for execution; the
  *display* generator may show `let/const` for readability. Two small generator configs, clearly
  separated.
- The `bb_repeat_until` + sensors combination is where kids first hit non-termination; budgets +
  the `fb.loop.runaway` message are designed for exactly that moment — test with real kids early.
- PARTIAL semantics and star rules are the most content-sensitive knobs; they live in level
  payload with defaults so tuning never requires code changes.
