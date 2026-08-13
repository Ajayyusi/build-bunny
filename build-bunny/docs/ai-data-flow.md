# AI Lab — what data leaves the browser

**Status: Phase G (AI Lab) — shipped. Answer: nothing.**

This document exists because of a standing product rule: *before any AI or ML
feature is implemented, document exactly what data would leave the browser.*
No children's content may reach an external service implicitly. This file is
written before the feature and updated whenever an AI/ML surface changes.

## Phase G summary

| Question | Answer |
|---|---|
| Does any AI Lab module call an external API? | **No.** There is no network call to any third party from any AI Lab surface. |
| Does any module send a child's drawing, typing, photo or voice anywhere? | **No.** Phase G has no camera, no microphone and no free-text field. |
| Does any module use an LLM? | **No.** No LLM is wired into the product at all yet (the provider abstraction ships with a `none` provider). |
| What computation happens where? | All widget interaction is client-side. Grading re-runs the child's *work product* on our own server (see below). |
| What is stored about a child's lab session? | The same as any other level: an attempt row with their submitted work, the grade, stars, XP, and timing. Nothing extra. |

## What is actually transmitted, per module

Every module submits the same shape as any other activity: a small, typed
"work product" posted to our own `/api/levels/[levelId]/attempts` endpoint,
which re-evaluates it server-side. Nothing else is sent.

| Module | What the browser sends us | What it never sends |
|---|---|---|
| Teach the Bunny family (AI Island, AI_CLASSIFICATION) | The specimen ids the child chose to teach with and the label they assigned each one (plus, where the level asks for one, their hold-out picks). | — |
| The Grouping Machine family (Data Desert / ML Lab, PATTERN_RECOGNITION) | The flag positions the child placed (a few coordinate pairs) and any readings they struck out. | — |
| Learn steps (CONCEPT_CARDS) | The block type dropped into the faded example's gap. | — |
| You Be the Classifier | The child's dividing-line parameters (two numbers). | — |
| Fortune Teller | The child's trend-line parameters (slope, intercept) and their predicted value. | — |
| See Like a Computer | Answers to the mystery rounds (which image was identified, per round). Pixel data stays in the canvas. | The image pixels themselves; nothing is uploaded. |
| Secret Keepers | The branch choices made in the scenario. | — |

The datasets these modules use (item cards, scatter points, sample photos) are
**curated assets we ship**, served from our own origin. No third-party CDN, no
external image host — the Content-Security-Policy in `next.config.ts` blocks
any such request at the browser level regardless.

## Why grading is server-side, and what that means for data

The product rule is that a client may never assert its own score. So each
widget submits the work itself — the boundary line the child drew, the cards
they sorted — and our server recomputes the outcome against the level's fixed
dataset. This means the child's *choices* are stored (as with any level
attempt), but the computation is ours end to end, and no third party is
involved in it.

This is also what keeps the modules honest: the "real" label in the module
catalogue means the arithmetic shown to the child is the arithmetic that
actually runs, on their device and again on our server.

## What would change this document

The following are **not** in Phase G, and each requires this file to be revised
and re-approved before it ships:

- **Phase H (ML Lab)** — in-browser model training. The design keeps training
  on the device and persists only the child's dataset *selections* and the
  resulting metrics, never raw media. Camera and own-image modes are gated
  behind a school-level toggle, a per-activity flag, and a per-session consent
  screen.
- **Bunny Guide (the assistant)** — the first feature that would send text off
  our servers. It is deliberately last, requires a per-school opt-in that is
  off by default, strips personal data before any request, and carries a
  data-residency decision (regional hosting versus a disclosed cross-border
  call) that is a contractual choice per school, not a technical default.

Until those ship, the honest answer to a parent, a teacher or a procurement
officer asking "where does my child's data go when they use the AI Lab?" is:
**nowhere — it stays between their browser and the school's own Build Bunny
server.**
