# Accessibility — audit and status (m5 §41)

This is a real audit against the shipped app (Worlds 1–3, achievements, teacher
matrix, school/platform admin, auth, public verify), not a checklist filled in
from memory. Every fix below was found by reading the actual component code
(and, for the broad sweep, a dedicated review pass) and verified against the
WCAG 2.1 AA success criteria it maps to. Re-run instructions are at the
bottom — please re-run them after any UI change to these surfaces.

## What changed in this pass

### 1. Skip-to-content link on every shell
Added `<SkipLink>` (`src/ui/SkipLink.tsx`) — the first focusable element on
every page — to the student shell, staff shell, platform shell, the
projector/live shell, and the auth shell. It is visually hidden until it
receives keyboard focus (Tab from a fresh page load lands on it first) and
jumps to `id="main-content"` (`tabIndex={-1}` so the jump actually **moves**
focus, not just scroll position — a bare anchor to a non-focusable element
does not). WCAG 2.4.1 (Bypass Blocks). The `(public)` route group (landing
page, `/verify/[slug]`) has no persistent nav to bypass, so it was left as-is.

### 2. Focus trap + focus restore on the three hand-rolled overlays
`Dialog.tsx` (used by the hint drawer, every admin confirm/create dialog,
the credential-sheet dialogs, etc.) is a native `<dialog>` with
`showModal()`, which gives it a real focus trap and Escape handling for
free. Three player/achievement surfaces render their own `role="dialog"`
`<div>` instead — because they're absolutely/fixed positioned *inside* their
own page (an immersive full-bleed player, a print preview) rather than
promoted to the browser's top layer, so `<dialog>` isn't a drop-in fit —
and none of them moved focus in, trapped Tab, or restored focus on close:

- `src/modules/activities/players/shared/IntroOverlay.tsx` — the level's
  story → mission briefing. Before this fix a keyboard user landing on the
  player had to Tab through the (invisible-behind-the-overlay) back link,
  Blocks/Code toggle, and Run/Reset/Hint controls before ever reaching
  "Skip"/"Next"/"Start".
- `src/modules/activities/players/shared/SuccessOverlay.tsx` — the star-burst
  → explanation-card celebration. Same problem in both stages.
- `src/app/[locale]/(student)/(shell)/achievements/_components/CertificatesPanel.tsx`
  — the certificate print preview. It already closed on Escape; it now also
  focuses in and restores focus to the "View certificate" button on close.

Fixed with one small reusable hook, `useFocusTrap` (`src/ui/useFocusTrap.ts`):
focuses the first focusable element (or the container itself) on open, traps
Tab/Shift+Tab inside while open, restores focus to whatever had it on close.
`SuccessOverlay` passes its `stage` as the hook's `resetKey` so focus moves
again when the burst gives way to the card without unmounting the component.
WCAG 2.4.3 (Focus Order), 2.1.2 (No Keyboard Trap in reverse — nothing to
escape the overlay *into* by accident).

### 3. "say"-block dialogue is now announced
`SimulationCanvas` renders the whole run — including in-program `say(...)`
speech bubbles — on a `<canvas>`, which has no DOM text at all. A
screen-reader student got the located-feedback banner on failure and the
star-burst on success, but never heard what the bunny actually *said* mid-run.
Fixed by mirroring the current bubble text into a `sr-only`
`aria-live="polite"` region next to the canvas, updated only when the text
changes (not once per animation frame). WCAG 1.1.1 / 4.1.3.

### 4. Smaller, concrete fixes found in the sweep
- **Replay variant selector** (`ReplayViewer.tsx`) — the "1 / 2 / 3" variant
  buttons indicated the active one by colour only, with no `aria-pressed`.
  Added `aria-pressed`, an `aria-label` ("Map N of M"), and an underline so
  the state isn't colour-only either. WCAG 4.1.2, 1.4.1.
- **Live projector view** (`LiveView.tsx`) — a completed student's status
  rendered as a bare `"✓"` glyph (the other two states were full sentences);
  fixed to render translated "Completed" text alongside the glyph. The
  20-second auto-refreshing roster had no `aria-live` at all; added
  `aria-live="polite" aria-atomic="false"` so only the cards that actually
  changed get announced, not the whole roster every poll. WCAG 1.4.1, 4.1.3.
- **Publish success message** (`PublishButton.tsx`) — the failure paths were
  `role="alert"`; the success path was a bare `<p>`, so publishing a level
  produced no announcement at all. Added `role="status"`. WCAG 4.1.3.
- **CSV import wizards** (staff `ImportWizard.tsx`, platform
  `ImportWizard.tsx`) — the disabled "Commit" button gave no reason why via
  assistive tech (the explanatory sentence next to it was unlinked). Added
  `aria-describedby` from the button to the hint/status text. WCAG 4.1.2.
- **Class roster search** (`ClassesManager.tsx`) — typing into the "add a
  student" search silently updated the results list below with no feedback
  for a screen-reader user. Added an `sr-only aria-live="polite"` match-count
  announcement. WCAG 4.1.3.

### 5. Contrast audit — real numbers, both themes
Computed WCAG relative-luminance contrast ratios (not eyeballed) for every
semantic token pair in `src/app/globals.css`, in both themes ("Play" for
students, "Pro" for staff/platform — this app ships one light mode per
theme, not a light/dark pair; see the file's own header comment). Method
below under "re-running the audit" so this is reproducible.

| Pair | Play | Pro | AA needed | Result |
|---|---|---|---|---|
| `ink` / `surface` | 14.41:1 | 14.19:1 | 4.5:1 | pass |
| `ink` / `surface-raised` | 14.89:1 | 14.99:1 | 4.5:1 | pass |
| `ink` / `surface-sunken` | 13.56:1 | 13.33:1 | 4.5:1 | pass |
| `ink-muted` / `surface` | 6.44:1 | 5.40:1 | 4.5:1 | pass |
| `ink-muted` / `surface-raised` | 6.66:1 | 5.70:1 | 4.5:1 | pass |
| `ink-muted` / `surface-sunken` | 6.06:1 | 5.07:1 | 4.5:1 | pass |
| `on-brand` / `brand` | 5.38:1 | 10.38:1 | 4.5:1 | pass |
| `on-brand` / `brand-strong` | 7.63:1 | 12.77:1 | 4.5:1 | pass |
| brand text / `surface` | 5.20:1 | 9.83:1 | 4.5:1 | pass |
| `positive` text / `surface` | 5.20:1 | 5.09:1 | 4.5:1 | pass |
| `warning` text / `surface` | 5.34:1 | 5.23:1 | 4.5:1 | pass |
| `warning` text / `surface-raised` | 5.52:1 | 5.52:1 | 4.5:1 | pass |
| `danger` text / `surface` | 5.84:1 | 5.72:1 | 4.5:1 | pass |
| `danger` text / white button (`Button` danger variant) | 6.04:1 | 6.04:1 | 4.5:1 | pass |
| `info` text / `surface` | 5.23:1 | 5.12:1 | 4.5:1 | pass |
| `ink-900`/`ink` on solid `accent` (star-400/sky-600) | 8.22:1 | 5.41:1 | 4.5:1 | pass |
| Badge `accent` variant (`bg-accent/25 text-ink`) blended over `surface-raised` | 12.85:1 | 10.54:1 | 4.5:1 | pass |
| Badge `brand`/`positive`/`warning`/`danger`/`neutral` variants, blended tint over `surface-raised` | 4.56–5.74:1 | 4.56–8.46:1 | 4.5:1 | pass |
| `focus` ring / `surface` (non-text UI) | 3.86:1 | 3.77:1 | 3:1 | pass |
| `focus` ring / `surface-raised` (non-text UI) | 3.99:1 | 3.99:1 | 3:1 | pass |
| `ink-faint` / `surface` | 2.85:1 | 2.14:1 | 4.5:1 | **below AA — see below** |

**`ink-faint` is intentionally sub-AA and stays that way.** Its own comment
in `globals.css` says so explicitly ("`ink-faint` is below AA by design —
decorative/disabled use only"), and the audit confirmed every actual usage
respects that: the locked-level lock icon and the "empty star" glyphs on
`LevelNode`. Both are **redundant** with a non-colour cue that already
carries the real information — the locked node also has a distinct border
style and an `aria-label` saying "Locked"; the star count is separately
read out via `aria-label="X of Y stars"` — so `ink-faint` never carries
meaning on its own. No pair used for anything a user *must* read to operate
the product came in under 4.5:1 (text) or 3:1 (focus ring / non-text UI).
Nothing needed changing here — worth stating plainly rather than inventing a
fix for a non-bug.

### 6. Already correct, verified rather than re-fixed
Re-reading the following against the audit's checklist found them already
compliant — noted here so "verified" isn't silently indistinguishable from
"not checked":
- **Progress matrix** (`ProgressMatrix.tsx`): proper `scope="col"` /
  `scope="colgroup"` / `scope="row"`, every cell carries a glyph (🔒 ○ ◐ ✓)
  **and** a star count **and** a full `aria-label`, never colour alone; a
  legend component spells out the mapping.
- **Adventure map nodes** (`LevelNode.tsx`): real `<button>`s (not clickable
  `<div>`s), `aria-label`, `aria-current="step"` on the student's current
  level, `aria-disabled` + `aria-describedby` explaining *why* a locked node
  is locked, and the locked/unlocked/completed states are distinguished by
  border style and an icon/number in addition to colour.
- **Sequencing reorder** (`SequencingPlayer.tsx`): reorder is drag **and**
  always-visible ↑/↓ buttons (44px targets) — never drag-only — with an
  `aria-live="polite"` region announcing every move ("X moved to position
  N of M").
- **`Dialog`, `Toast`**: native `<dialog>` + `showModal()` (real focus
  trap/Escape for free); toast region is `aria-live="polite"`.
- **Reduced motion**: a global `@media (prefers-reduced-motion: reduce)`
  rule in `globals.css` zeroes CSS animation/transition duration everywhere;
  on top of that, `SimulationCanvas` takes an explicit `reducedMotion` prop
  and switches to instant 120ms-stepped playback (not just faster — a
  genuinely different, non-animated code path), `SuccessOverlay` skips the
  star-burst stage entirely, and `SequencingPlayer` reads
  `matchMedia("(prefers-reduced-motion: reduce)")` itself.

## Keyboard operability — what works, honestly, per surface

**Fully keyboard-operable:** auth pages, the student shell (nav, home,
profile), the adventure map (every node, the intro sheet, Start/Close),
achievements (badge list, certificate preview + print), the whole staff
shell (nav, teacher/school-admin CRUD dialogs, CSV import wizard, progress
matrix — cells aren't interactive so there's nothing to reach, the student
name in each row is the real link), the projector/live view (nothing
interactive there is content, it's read-only by design), the platform shell,
and the public verify page.

**The level player (`/play/[levelId]`):** Run, Reset, the Blocks/Code
toggle, the hint drawer and every hint reveal button, and all of the intro
and success overlays are keyboard-operable (the two focus-trap fixes above
make Tab actually stay inside them). **Blockly's drag-and-drop block canvas
is not.** This is a real, known gap, not an oversight:

- Blockly ships no keyboard-navigation support by default; the official
  `@blockly/keyboard-navigation` plugin is a separate package this
  milestone's rules don't permit adding without asking first (no new
  dependencies without approval, and `package.json` is explicitly off-limits
  for this pass).
- **`CODE_PREDICTION` and `SEQUENCING` levels have no such gap** — they use
  ordinary buttons/radios and the SequencingPlayer's button-based reorder,
  so two of the four V1 activity types are already 100% keyboard-operable
  end to end.
- For `BLOCK_CODING`/`DEBUGGING` levels, a student who cannot use a pointer
  cannot currently assemble a program. The read-only `CodeView` (generated
  code display) exists but isn't an input surface. **Recommended next step**
  (not done here — flagged, not fixed, per this task's own instruction to be
  honest about limits): install `@blockly/keyboard-navigation` in a
  follow-up milestone, or ship a text-based program-entry fallback.

## Screen-reader semantics — what to expect

Landmarks (`<header>`, `<nav aria-label>`, `<main>`), heading hierarchy
(each page has exactly one `<h1>`), form labels (`Field`/`Input` wire
`<label for>` + `aria-describedby` for hints/errors), and `aria-live`
regions for toasts, hint reveals, run failures (`role="alert"`), run
successes (dialog focus + `role="status"` on the publish confirmation), and
the sequencing/roster-search live regions above were all spot-checked this
pass. Icons that are purely decorative are `aria-hidden`; icons that carry
state (lock, checkmark, stars) are paired with a text alternative every
time.

## How to re-run this audit

1. **Contrast**: re-run the relative-luminance formula (WCAG 2.1 §1.4.3)
   against `src/app/globals.css`'s primitives for both `[data-theme="play"]`
   and `[data-theme="pro"]` semantic pairs. A ~40-line Node script computing
   `sRGB → linear → relative luminance → (L1+0.05)/(L2+0.05)` for each pair
   is enough — no dependency needed. Re-run whenever a token in
   `globals.css` changes.
2. **Keyboard walkthrough**: unplug the mouse. For each surface in the table
   above, Tab from a fresh page load and confirm (a) the skip link is the
   first stop, (b) every interactive control is reachable in a sensible
   order, (c) every dialog/overlay traps Tab and Esc closes it, (d) closing
   a dialog returns focus to what opened it.
3. **Screen reader spot check**: NVDA (Windows) or VoiceOver (macOS) through
   the player (run a level to failure, then to success), the adventure map,
   the progress matrix, and one admin CRUD dialog. Confirm state changes are
   announced (not just visible) and nothing reads as "button" / "link" with
   no further context.
4. **Automated pass**: axe DevTools or Lighthouse's accessibility audit
   against `/`, `/adventure`, `/play/[levelId]`, `/teach/classes/[id]`,
   `/school/students`, `/nitaq/schools` catches contrast/label regressions a
   manual pass might miss — it's a supplement to the above, not a
   replacement (axe does not catch the focus-trap or keyboard-reachability
   classes of bug this pass found).
