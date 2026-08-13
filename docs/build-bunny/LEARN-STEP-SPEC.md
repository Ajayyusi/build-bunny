# Learn steps (CONCEPT_CARDS) — implementation spec

Status: **implemented** (2026-08 — `LearnPlayer.tsx`, the CONCEPT_CARDS
server engine, and five coding-concept Learn levels shipped; see
`build-bunny/docs/ai-data-flow.md` and BUILD-BUNNY-PLAN §0.2). Kept as the
design rationale record. Level counts below predate the AI worlds (the
curriculum now defines 37 levels).

## Why

Build Bunny currently tests knowledge without teaching it. A Grade 3
student meets `repeat` for the first time *inside a puzzle* — story and
objective, but no instruction. The 4-tier hint system catches them when
they're stuck, but a child who burns all four tiers learns "press hint
until it works", not what a loop is.

A Learn step teaches the concept immediately before the first puzzle that
needs it. This is the worked-example effect: for novices, studying a
solved example then completing a faded one beats solving from scratch.

It is also the difference between a puzzle game and a **course**, which is
the word the proposal uses when selling to schools — and it is the part
that substitutes for teacher instruction, which the self-paced,
no-teacher premise depends on.

## Shape

Three beats, one node on the trail, 60–90 seconds:

1. **Show** — a worked example runs on the grid, blocks highlighting as
   they execute. Read-only. "Watch how Robo Bunny hops 3 times."
2. **Faded practice** — the same program with one block removed. The
   student drops the missing block in. One gap only.
3. **Hand off** — "Now try it yourself" → the existing puzzle.

Not a video, not a wall of text. It runs the same simulation the puzzle
does, so the concept is shown in the medium it will be used in.

## Where it plugs in

`CONCEPT_CARDS` is already in the `ActivityType` enum
(prisma/schema.prisma) with no engine behind it. Per the registry
comments, adding a type is **one entry in each registry and nothing else
in the attempts pipeline changes**:

- `src/modules/activities/players/registry.tsx` — client half, lazy
  component. Must stay `"use client"`; use `ssr: false` like GridPlayer
  since it drives Blockly.
- `src/modules/activities/server/registry.ts` — server half, an
  `ActivityEngine` with `grade()` and `stripPayload()`.

### Payload

Author-side (server-held):

```ts
{
  conceptSlug: "loops",          // for spaced review + analytics
  workedExample: { blocks: <blockly json>, caption: LocalizedText },
  faded: {
    blocks: <blockly json with one gap>,
    missingBlockType: "bunny_repeat",
    caption: LocalizedText,
  },
}
```

`stripPayload` MUST remove `faded.missingBlockType` before the payload
reaches the client — otherwise the answer ships in the page source. Follow
`stripStudentPayload` in `curriculum/server/queries.ts`; that contract
already exists and the grid engine uses it.

### Grading

A Learn step is **not a test**. Grade it pass-on-completion:

- `verdict: "PASSED"` once the faded gap is filled correctly
- `qualityPassed: true` always
- Award **0 stars** — stars are for puzzles. Award a small XP amount so
  progress still moves.
- Wrong block in the gap → re-prompt inline, do not fail the attempt.
  There is no failure state in a lesson.

This keeps the existing `maxStars` / star-criteria logic untouched.

### Unlocking

Learn steps sit in the normal level order and unlock linearly, so
`recomputeUnlocks` needs no change. They count toward `totalLevels` in a
world — decide deliberately whether that's wanted, since it shifts every
"5 levels" label and the world-completion certificate thresholds. If not
wanted, filter `activityType === "CONCEPT_CARDS"` out of the counts in
`computeAdventureState`.

## First slice

Build **one concept end-to-end before authoring the rest**: `repeat`, in
Bunny Meadow, immediately before "Repeat After Me" (level 5). That level
already exists and already teaches repetition by trial and error, so the
before/after is directly comparable.

Ship it, watch the fail rate on that level in `/nitaq` (it currently
shows most-failed levels — Turn Around is at 100%, First Hop 67% on demo
data), then decide whether to author the remaining concepts.

## Follow-ons, ranked

1. **Misconception-aware feedback** — highest leverage on existing code.
   The grader already runs the program and knows *how* it failed, not just
   that it did. Classify the top few failure modes per level type
   (off-by-one, wrong turn direction, missing loop, right blocks wrong
   order) and respond specifically. "Your bunny went one square too far"
   teaches; "Try again!" does not.
2. **Spaced review levels** — reintroduce a concept two worlds after it is
   taught. Pure authoring, no code. `conceptSlug` above is what makes this
   selectable.
3. **"Why did that work?"** — one multiple-choice reflection after a solve.
   Builds transfer, not just pattern repetition.

## Check before building

The schema has 4 hint tiers, but it is **unverified whether all levels
(now 37, not the 17 this spec was written against) have all four
authored**. If some are thin, filling them is cheaper than any new feature
and helps every stuck student today. Check the `hints` JSON on each
published `LevelVersion`.

## Commercial note

The proposal defers "richer hints and feedback" and the full exercise
library past Phase 1, so this is billable scope rather than owed work.
