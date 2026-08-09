# Build Bunny — AI & ML Architecture (Phases G / H + Bunny Guide)

Design owner: AI/ML product architecture. Scope: AI Lab (Phase G), Real ML Lab (Phase H),
the Programming / AI Concepts / Machine Learning distinction, the Bunny Guide assistant,
AI-flavoured Blockly blocks, rollout and cost control. Everything here is **design now, build
later** — except §1.1, which lists the seams the MVP build (Phases A–F) must leave open so
G/H bolt on without rework.

Governing principles (applied throughout):

1. **Nothing fake is passed off as ML.** Every activity is explicitly tagged as Programming,
   AI Concepts (simulation), or Machine Learning (a real learner runs). Simulations say so, in
   child language.
2. **No child data leaves the device for ML.** Real ML training and inference run in-browser.
   The server stores configuration, label selections and metrics — never child-supplied media.
3. **The LLM is optional infrastructure, never load-bearing.** Every learning flow (hints,
   grading, feedback) works fully with the AI assistant disabled or the provider down.
4. **Determinism is preserved.** Anything that affects grading/XP must be re-runnable
   server-side, exactly — including levels that use a student-trained classifier (§6.2).

---

## 1. Module layout and MVP seams

### 1.0 Code organization (within the locked `src/modules/*` layout)

```
src/modules/ai/
  lab/            # Phase G: AI_SIM widget registry + widgets (client components + pure logic)
  ml/             # Phase H: ml-runtime (pure TS), dataset client, experiment UI
  guide/          # Bunny Guide: provider abstraction, safety pipeline, chat UI
src/engine/ml/    # pure-TS KNN / Naive Bayes / regression (NO DOM, NO tfjs) — shared by
                  # client lab UI and server re-grading; lives beside the grid engine because
                  # it must obey the same purity/determinism rules
content/ml-datasets/   # curated dataset sources (images, sentences, manifests) — seeds
public/models/mobilenet/  # self-hosted TF.js model files (never a third-party CDN)
```

`src/engine/ml/` is deliberately inside the engine boundary: pure, deterministic,
extractable, imported by both the browser lab and the server grader.

### 1.1 Seams the MVP (Phases A–F) must ship with

These are cheap now and expensive to retrofit:

| Seam | Where | MVP cost |
|---|---|---|
| `ActivityType` enum already contains `REAL_ML`, `AI_SIM`, `AI_CLASSIFICATION`, `AI_ETHICS` (engine registry returns "coming soon" renderer) | Prisma enum + activity-engine registry | trivial |
| `Level.track` enum `PROGRAMMING \| AI_CONCEPTS \| MACHINE_LEARNING` + the track badge component (§4) | schema + one UI chip | small |
| `SchoolAISettings` table with safe defaults (everything off) | schema + admin settings page section (read-only "coming soon" acceptable) | small |
| `LLMProvider` interface + `NoneProvider` implementation compiled in from day one | `src/modules/ai/guide/provider/` | trivial |
| Grid-engine items carry a `features` record (`color`, `size`, `shape`, `kind`) | engine item model | trivial — already needed for rendering |
| Blockly toolbox reserves the `AI` category; the four AI blocks exist in their deterministic form (§6) from Phase C | block definitions | small |
| Object-storage driver + public asset routes (already locked) reused for dataset serving | none — already planned | zero |
| No tfjs anywhere in MVP bundles; ML Lab pages will `dynamic(() => import(...))` | discipline, not code | zero |

---

## 2. AI LAB (Phase G) — ten learn-by-doing concept modules

The AI Lab lives in **World 4 DATA DESERT** (data, patterns, classification) and
**World 5 AI ISLAND** (AI concepts, CV, NLP, ethics), authored as normal admin-managed
levels. No walls of text: every module is an interactive widget the child manipulates,
with at most 2 sentences of framing at a time.

**New activity engine: `AI_SIM`.** Existing engines (QUIZ, PATTERN_RECOGNITION,
AI_CLASSIFICATION, AI_ETHICS, SEQUENCING) cover half the modules; the other half need
free-form interactive widgets. `AI_SIM` is a thin engine whose level `config` names a
`widgetId` from a client-side registry plus widget params:

```json
{ "activityType": "AI_SIM",
  "config": { "widgetId": "pixel-playground", "params": { "startImage": "falcon-01", "resolutions": [8, 16, 32, 64] } },
  "successConditions": [{ "check": "widgetGoalReached", "goalId": "recognized-at-16px" }] }
```

Widgets report goal events to the engine host; grading uses the existing PASS/FAIL/PARTIAL
checks (`widgetGoalReached` is one new reusable check). Widgets are pure-logic cores +
Canvas/DOM shells, so goal evaluation is re-checkable server-side from the submitted
interaction log (a compact event array, not media).

### 2.1 Module catalogue

Honesty column key — **REAL**: the computation shown is genuinely what runs.
**SIM**: scripted/deterministic illustration, labelled as simulation in-UI.

| # | Module (World) | What the child DOES (mechanic) | Activity type | Real vs simulated |
|---|---|---|---|---|
| 1 | **Is it AI?** (W5) | Sorts ~14 illustrated cards (calculator, thermostat, spam filter, voice assistant, video recommendations, washing machine, translation app, metro gate…) into AI / Not AI bins. Each drop triggers a one-line "why" and a counter of common wrong answers ("62% of kids put this one in the other bin!"). Ends with the takeaway: AI = software that works from examples/patterns, not only fixed rules. | AI_CLASSIFICATION | REAL (it's a taxonomy game; nothing pretends to compute) |
| 2 | **Rules vs Examples** (W5) | Split screen. Left: child builds explicit rules with sliders/toggles ("ear length > …", "has whiskers") to separate rabbits from cats; edge-case cards break the rules (a lop-eared rabbit). Right: child instead drags 10 example cards into labelled baskets and a KNN over precomputed features classifies the same edge cases — better. | AI_SIM (`rules-vs-examples`) | Left REAL (rules genuinely execute). Right REAL — it reuses the ML runtime (§3) in a locked mini mode. Banner: "This right side is a tiny taste of the Machine Learning Lab." |
| 3 | **Pattern Hunter** (W4) | Continues visual/number sequences, finds the odd one out in feature grids, and builds their own pattern for the bunny to complete (deterministic pattern matcher tries; child sees when a pattern is "learnable" vs random). | PATTERN_RECOGNITION | REAL (deterministic pattern logic; UI says "this is pattern *rules*, not learning — yet") |
| 4 | **Feed the Bunny Brain** (W4) | Child fills a "training basket" by choosing examples from a shelf. A live dataset meter shows counts per label and a balance gauge. Then tests: a KNN trained on exactly the chosen basket classifies test cards. Child re-balances the basket and watches results genuinely change. Teaches: data quality/quantity/balance IS the model. | AI_SIM (`training-basket`) | REAL — real KNN over precomputed embeddings; the child's basket genuinely determines outcomes |
| 5 | **You Be the Classifier** (W4) | Stage 1: child hand-sorts 12 items and writes (picks) the feature they used. Stage 2: child places a dividing line on a 2-feature scatter plot (size vs colour) with a draggable boundary; misclassified points wobble and count updates live. Stage 3: "now watch the computer place the line" (centroid rule, animated). | AI_SIM (`boundary-builder`) | REAL (the boundary math and the centroid rule are the real computation, shown honestly as "a simple method") |
| 6 | **Fortune Teller** — prediction (W4) | Scatter chart (e.g., hours of sun → plant height). Child drags a trend line to minimize a visible "total miss" score, then presses "computer's turn": least-squares line animates in and beats (or ties) them. Child then predicts the next point and sees the error band — "predictions are educated guesses, not facts." | AI_SIM (`trend-line`) | REAL (least squares actually computed; error bars honest) |
| 7 | **See Like a Computer** (W5) | Child zooms a photo down to its pixel grid, drags a resolution slider (64→8 px) and plays "recognize the mystery image" against a friend/timer; toggles greyscale; applies a real edge-detection filter with a draggable kernel. Optional final station: run the on-device image model (MobileNet, §3.1) on curated photos and see top-3 guesses with confidence. | AI_SIM (`pixel-playground`) | REAL throughout (canvas pixel ops and convolution are real; MobileNet inference is real, on-device) |
| 8 | **Word Machines** (W5) | Child types/picks sentences and watches live tokenization (words light up), builds a word-frequency tower, then powers a visible-lexicon sentiment meter: every word's score card is inspectable, and the child can EDIT a word's score and watch the verdict flip. Arabic sentences supported (tokenizer handles Arabic script). | AI_SIM (`word-machine`) | REAL (real tokenization + lexicon scoring). Banner: "Real chatbots use much bigger math — but this is honestly how the simple ones started." |
| 9 | **The Unfair Robot** — bias (W5) | Child trains the basket-KNN (module 4 runtime) on a deliberately skewed shelf (e.g., only red apples labelled "apple"), tests on a green apple → confidently wrong. Then fixes the dataset and re-tests. Ends with a 3-scenario discussion card (loan robot, face unlock, exam grader) at age-appropriate framing. | AI_SIM (`training-basket` skewed preset) + AI_ETHICS | REAL bias demonstration (the skew genuinely causes the error) + SIM scenarios (branching cards, clearly stories) |
| 10 | **Secret Keepers** — privacy & responsible AI (W5) | Comic-style branching scenarios: a friendly app asks for your name/photo/location; child chooses responses and sees consequences unfold; earns a "Privacy Shield" checklist they assemble themselves (share nothing personal, ask a grown-up, you can say no, data can be copied). Final station mirrors Build Bunny's own rules: "even OUR bunny never asks your real name — check!" | AI_ETHICS | SIM (branching story engine — no AI involved, and the module says exactly that) |

Ordering intent: 3→4→5→6 in Data Desert build the data/classification/prediction spine;
1→2→7→8→9→10 in AI Island build the "what AI is, how it sees/reads, and why care is
needed" spine. Modules 2, 4 and 9 secretly share one runtime (the ML Lab's KNN core),
which both saves build effort and guarantees the concept lab's claims are literally true.

### 2.2 What Phase G does NOT include

No external API calls, no LLM, no webcam, no child-typed free text leaving the device
(module 8 keeps typed sentences client-side; the interaction log stores token counts and
goal events only). Phase G's marginal infrastructure cost is zero.

---

## 3. REAL ML LAB (Phase H) — in-browser training, nothing leaves the device

Lives in **World 6 MACHINE LEARNING LAB** as `REAL_ML` activities, plus a free-play
"My Experiments" area under the AI LAB nav item.

### 3.1 Technical approach — per lab, with justification

**Lab 1: Image classifier — MobileNet embeddings + hand-rolled KNN (pure TS).**

- Feature extractor: TensorFlow.js **MobileNet v2, alpha 0.5** (~5 MB weights),
  self-hosted at `public/models/mobilenet/` (no Google CDN — CSP-clean, UAE-hosting
  friendly, versions pinned). WebGL backend, WASM fallback for weak tablets.
- Classifier: **hand-rolled cosine-distance KNN in `src/engine/ml/knn.ts`** (not
  `@tensorflow-models/knn-classifier`). Justification: (a) explainability — KNN lets us
  show *the actual k nearest training images* and phrase confidence as "7 of the 10
  closest examples were cats", which is the whole pedagogy; (b) determinism — pure TS,
  no GPU nondeterminism, so the server can re-run it bit-for-bit for grading (§6.2);
  (c) it's ~80 lines. A trainable softmax head was rejected: marginally better accuracy,
  massively worse explainability, nondeterministic training.
- **Precomputed embeddings**: for curated datasets we ship each item's 1280-d embedding
  (Float32Array in a single `.bin` per dataset, offsets in the manifest). Consequence:
  the default lab needs **no model download at all** — "training" (building the KNN
  index from the child's selection) is instant even on a 2019 iPad. MobileNet loads
  lazily *only* when the school-gated own-images/webcam mode is used (§3.6). The doc/UI
  is honest about this: embedding is a fixed measuring step; the *learning* is the
  example-comparison, which is fully live.

**Lab 2: Text / sentiment classifier — tokenizer + Multinomial Naive Bayes (pure TS).**

- `src/engine/ml/text.ts`: Unicode-aware tokenizer (whitespace + punctuation split,
  lowercase for Latin, Arabic normalization: strip tashkeel/tatweel, unify alef forms),
  count vectors, **Multinomial Naive Bayes** with Laplace smoothing.
- Justification over embedding models (e.g., Universal Sentence Encoder, ~25 MB,
  English-biased): NB trains in milliseconds on 40 sentences, needs no download, works
  identically for Arabic datasets, and — decisively — its decision is *inspectable*:
  the UI shows which words voted for which label and by how much ("'رائع' pushed hard
  toward Happy"). That per-word evidence view is the lesson.
- Rejected: TF-IDF + logistic regression (iterative training = nondeterministic-ish,
  harder to explain); hand-rolled text KNN (works, but no word-level evidence).

**Lab 3 (stretch): Number predictor — least-squares regression (pure TS).**
Reuses the Fortune Teller widget with child-editable training points. ~30 lines,
fully real, fully explainable.

All three cores live in `src/engine/ml/` with zero DOM/tfjs imports; tfjs appears only
in `src/modules/ai/ml/embedder.ts` (client-only, dynamically imported).

### 3.2 Curated built-in datasets

Young users train on **curated datasets by default** (locked spec). Each dataset is:

- **Authored** under `content/ml-datasets/<id>/`: `manifest.json`, `images/` (or
  `sentences.json`), licence file. All media CC0/licensed and manually reviewed by
  NITAQ content staff; **no identifiable real people, ever** (policy: labs never
  classify people or faces).
- **Built** by a script (`scripts/build-ml-datasets.ts`) that resizes images
  (256 px), computes MobileNet embeddings once, and emits `embeddings.bin` +
  versioned manifest.
- **Served** through the existing object-storage driver at
  `GET /api/ml/datasets` (list, localized names) and
  `GET /api/ml/datasets/:id/manifest` (+ static image/bin URLs, long-cache, immutable
  by version).
- **Registered** in DB:

```prisma
model MLDataset {
  id          String  @id            // "pets-cats-dogs"
  version     Int
  labType     MLLabType              // IMAGE_KNN | TEXT_NB | REGRESSION
  name        Json                   // { en, ar? }
  description Json
  labels      Json                   // [{ id:"cat", name:{en,ar} }, ...]
  itemCount   Int
  licenceNote String
  status      ContentStatus          // DRAFT/REVIEW/PUBLISHED/ARCHIVED (same pipeline as levels)
}
```

Launch set (each: ~50–60 train items/label + 15–20 held-out test items incl. deliberate
tricky cases):

| Dataset | Labels | Notes |
|---|---|---|
| `pets-cats-dogs` | cat / dog | the classic; tricky tests: puppy that looks kittenish |
| `desert-animals` | camel / falcon / oryx | UAE-local flavour; great for demos to schools |
| `recycling-sort` | plastic / paper / metal | ties into ethics/SDG framing |
| `drawn-shapes` | circle / square / triangle | hand-drawn style; robustness discussion |
| `fruit-ripeness` | ripe / not-ripe | intentionally hard → honest "ML isn't magic" lesson |
| `sentiment-en` | happy / sad | 80 labelled child-appropriate sentences |
| `sentiment-ar` | سعيد / حزين | authored in Arabic, not translated EN |
| `weather-wishes` (text) | wants-sun / wants-rain | intent-style classification |

### 3.3 MLExperiment data model — what is persisted (and what never is)

```prisma
model MLExperiment {
  id                String    @id @default(cuid())
  schoolId          String                    // tenant scope, enforced in DAL
  studentId         String
  levelId           String?                   // null = free-play experiment
  labType           MLLabType
  datasetId         String
  datasetVersion    Int
  name              String                    // child-chosen, filtered (no PII patterns)
  config            Json      // { k: 5, distance: "cosine", labels: ["cat","dog"], seed: 42 }
  trainingSelection Json      // { cat: ["img_014","img_022",...], dog: [...] }  — item IDs ONLY
  metrics           Json      // { testedCount, correct, accuracy, perLabel: {...}, confusion: [[..]] }
  usedCustomMedia   Boolean   @default(false) // count-only flag; media itself never persisted
  customMediaCounts Json?     // { cat: 12, dog: 9 } — numbers, never pixels/embeddings
  status            MLExperimentStatus        // DRAFT | TRAINED | SUBMITTED
  createdAt         DateTime  @default(now())
  updatedAt         DateTime  @updatedAt
  @@index([schoolId, studentId])
}
```

**Persistence rules (hard invariants):**
- Curated-mode experiments are fully reproducible from `trainingSelection` +
  `datasetId@version` — that is the *point*: the "model" is the selection.
- Child-supplied images/webcam frames/typed sentences: **never uploaded**. There is no
  server endpoint that accepts lab media — the safeguard is architectural, not a flag.
  Custom media and their embeddings live in browser memory for the session and are
  discarded on tab close (no IndexedDB persistence in v1 — re-capture is cheap and the
  privacy story stays one sentence long).
- Consequence, stated honestly in the UI: an experiment that used custom media cannot be
  reopened with those images; it reopens in curated mode with a note.

Routes (all `withAuth`, tenant-scoped, Zod-validated):
`POST /api/ml/experiments` · `GET /api/ml/experiments` (own; teacher: class) ·
`PATCH /api/ml/experiments/:id` (selection/config/metrics update) ·
`POST /api/ml/experiments/:id/submit` (level context → server re-grades, §3.5).

### 3.4 Train / test / confidence UX

Three-stage stepper, same shell for image and text labs:

1. **TEACH** — shelf of dataset items on the left, one labelled basket per label on the
   right. Child drags (or taps) examples in; live counters + balance gauge (reused from
   Feed the Bunny Brain). Minimum per label enforced (e.g., 5) with friendly nudge.
2. **TRAIN** — single button. Progress is honest and fast: "Measuring your 24
   examples… building the comparison index… done." No fake multi-minute progress bars.
   Post-train card: "Your model = your 24 choices. Change them, and it changes."
3. **TEST** — a row of held-out test cards (never shown during TEACH) + shuffle. Tapping
   a card shows:
   - **Prediction chip** ("Cat") + **confidence bars** per label.
   - **Evidence strip**: the k nearest training images with similarity dots — "these
     are the examples most like this picture."
   - Confidence phrasing is frequency-based, never mystical: **"7 of the 10 closest
     examples were cats."** For text: highlighted words with per-word vote bars.
   - Running **Report Card**: simple grid of tested items ✓/✗ per label; grades 6–7
     see it as a labelled confusion matrix.
   A "Fix it" affordance loops back to TEACH — the improve-retrain-retest loop is the
   core lesson, so the stepper is freely reversible.

**Honest-language catalogue** (enforced via the message catalog; the Arabic strings are
authored with a vetted glossary — تعلُّم الآلة, بيانات التدريب, التصنيف, الثقة):

| Never say | Say instead |
|---|---|
| "The AI knows / thinks / understands" | "The computer compared this to your examples" |
| "The AI is smart" | "You gave it good examples" |
| "100% sure" | "All 10 closest examples were cats — but it can still be wrong" |
| "Training the brain" | "Building the comparison list from your choices" |
| (silence about errors) | "It got 3 wrong. What examples could fix that?" |

### 3.5 Grading REAL_ML levels

A `REAL_ML` level's success conditions use the existing check vocabulary plus:
`classifierAccuracyAtLeast(0.8)`, `perLabelMinimum(4)`, `testedAtLeast(10)`,
`correctClassifierResult(itemId, label)` (already in the locked grading list). Because
curated-mode experiments are deterministic (selection + versioned embeddings + pure-TS
KNN/NB with fixed tie-breaking `seed`), the **server re-runs the experiment** from
`trainingSelection` on submit — client metrics are advisory, identical to the grid-world
grading model. Custom-media experiments are not gradeable (can't reproduce server-side);
levels requiring grading force curated mode. Free-play accepts anything.

### 3.6 Own images / webcam — explicit opt-in design

Disabled everywhere by default. Enablement requires **all** of:

1. **School toggle**: `SchoolAISettings.customMediaEnabled` (default `false`), set by
   SCHOOL_ADMIN, visible to NITAQ admins, audit-logged.
2. **Activity opt-in**: level/lab config `allowCustomMedia: true` (content-author
   decision; graded levels can't set it, §3.5).
3. **Child-facing consent screen** every session, plain language, both locales:
   "Your camera pictures stay inside this tab. They are never uploaded or saved. When
   you close the tab, they're gone. Don't point the camera at people — including you!
   [Use camera] [No thanks — use the built-in pictures]" — decline path is first-class.
4. **Live indicators**: persistent camera-on badge, big stop button, auto-stop when the
   step loses focus or after 60 s idle.
5. **People policy**: UI instructs "objects only, no people"; v1 enforcement is policy +
   teacher supervision (an on-device face-detect gate is listed as a fast-follow, and it
   too must run locally).

Because no upload path exists (§3.3), a compromised flag can at worst enable the camera
UI — it cannot cause data egress. That asymmetry is deliberate.

---

## 4. PROGRAMMING vs AI CONCEPTS vs MACHINE LEARNING — making the distinction real

This is a curriculum-integrity feature, enforced in data, UI and publishing:

1. **Data**: `Level.track` enum — `PROGRAMMING | AI_CONCEPTS | MACHINE_LEARNING`.
2. **UI**: every level header, adventure-map node and results screen carries the track
   chip: **CODE** (gear, blue) / **AI CONCEPTS** (lightbulb, purple) / **MACHINE
   LEARNING** (flask, green). Chips have a tap-to-explain: "AI Concepts levels *show
   you how AI works* using simulations. Machine Learning levels *actually train* a
   model from your choices."
3. **Publish-time lint** (content pipeline, Phase F editor): a level may carry
   `MACHINE_LEARNING` **only if** `activityType === REAL_ML` (a real learner runs).
   `AI_SIM` / `AI_CLASSIFICATION` / `AI_ETHICS` levels are capped at `AI_CONCEPTS`.
   The lint is a hard block, not a warning — this is the "no fake AI" quality bar made
   mechanical, and it protects the claim in every sales demo.
4. **Honesty ribbon**: `AI_SIM` widgets that *illustrate* learning (modules 2/4/9 excepted —
   they run the real KNN and are labelled accordingly) render a slim persistent ribbon:
   "Simulation — you'll train the real thing in the Machine Learning Lab 🧪".
5. **Consistent verbs across all copy** (message-catalog reviewed): programs
   "follow your instructions"; concept sims "show how it works"; ML labs "learn from
   your examples". Certificates reuse the split: *Coding Foundations* vs *AI Explorer*
   map to tracks, so the distinction survives onto the wall of the classroom.

---

## 5. BUNNY GUIDE — child-safe assistant behind a provider abstraction

### 5.1 Provider abstraction

```ts
// src/modules/ai/guide/provider/types.ts
export interface LLMProvider {
  readonly id: "anthropic" | "bedrock" | "local" | "none";
  chat(req: GuideRequest): Promise<GuideResult>;
  stream(req: GuideRequest): AsyncIterable<GuideDelta>;   // SSE-friendly deltas
  health(): Promise<{ ok: boolean; latencyMs?: number }>;
}

export interface GuideRequest {
  system: string;                 // fully assembled server-side (§5.3)
  messages: { role: "user" | "assistant"; content: string }[];  // already redacted
  maxOutputTokens: number;        // default 300
  locale: "en" | "ar";
  metadata: { conversationId: string };  // random ID only — never user identifiers
}
```

Implementations: `AnthropicProvider` (direct API, Haiku-class model),
`BedrockProvider` (same models via AWS Bedrock for regional routing, §5.6),
`LocalProvider` (OpenAI-compatible endpoint, e.g. Ollama — pilot/residency fallback),
`NoneProvider` (returns a typed `GUIDE_OFFLINE` result; ships in MVP so every seam
exists). Selection: platform env default, overridable per school
(`SchoolAISettings.providerOverride`, NITAQ-admin only). All calls are server-side
(route handlers); the API key never reaches the client.

### 5.2 Request pipeline (every message)

```
student msg → [1 authz + feature flag + budget check] → [2 input gate] →
[3 context pack + system prompt assembly] → [4 provider stream] →
[5 output gate (streamed with hold-back buffer)] → student
                     ↘ [6 log to AIConversation / AIUsageLog]
```

1. **Authz/flags/budget**: `withAuth("student:guide")`; school feature flag for the
   surface (coding-help / ai-lab / error-explainer); per-student rate limit
   (default 3 msg/min, 30 msg/hour); school daily token budget remaining.
2. **Input gate** (local, fast): length cap (500 chars); PII scrubber — regex strip of
   emails, phone-like digit runs, URLs, @handles, and the student's own display name
   (replaced with "you") *before* anything is stored or sent; deny-list for self-harm /
   sexual / violence terms in EN+AR → those short-circuit to a fixed supportive
   redirect ("That's something to talk about with a trusted grown-up, not a bunny…")
   and set a `flags.safety` marker teachers can see.
3. **Context pack**: level objective, allowed blocks, a *summarized* workspace (block
   counts + structure outline, not raw student text), last grader feedback codes,
   attempts, and hint tiers already viewed. No student identity, school name, or free
   PII ever enters the prompt.
4. **Provider call** with prompt caching on the static system+curriculum prefix.
5. **Output gate**: streamed with a ~200-char hold-back buffer so filters see complete
   sentences before release; deny-list re-check; strip any URLs; **solution-leak
   check** — the server holds the level's solution block sequence, and if the response
   enumerates a near-complete ordered match (≥80% of solution blocks in order), the
   stream is cut and replaced with a tiered hint ("I almost gave it away! Try this
   instead: …"). Also blocks the model *asking* for personal info (pattern match on
   name/age/where-do-you-live questions — belt on top of the system-prompt braces).
6. **Logging**: everything that was actually sent/received (post-redaction) is stored.

### 5.3 System-prompt strategy and the no-answer-completion policy

Prompt = three layered, versioned parts (version recorded per conversation):

- **Platform base** (static, cached): identity ("Bunny Guide, a friendly learning coach
  for children 8–13"), tone, respond-in-`locale`, ≤120-word replies, one idea per
  reply, **never provide complete solutions or full block sequences**, never request
  personal information, refuse and redirect off-topic requests to the lesson, no
  links, no roleplay-as-someone-else, honest-language rules from §3.4.
- **Pedagogy directive** (dynamic): the student's current **maximum help level**, derived
  from the hint state machine (§5.4) — e.g. "Help level 2 of 4: you may name the
  concept involved and ask one guiding question. You may NOT identify which block is
  wrong."
- **Level context** (dynamic): objective, allowed blocks, grader feedback codes,
  common misconceptions (authored per level in teacher notes).

The output-side solution-leak check (§5.2) backs the policy so it never rests on prompt
obedience alone.

### 5.4 Socratic escalation — integration with the 4-tier hint system

Static hints remain the primary, free, always-available help path. The guide is a
conversational layer *on top*, and its permitted specificity is **slaved to the same
ladder**:

| Hint tier state | Guide max-help behaviour |
|---|---|
| No hints viewed, <2 attempts | Questions only ("What should the bunny do first?") |
| Tier 1–2 viewed | Conceptual nudges; may name the relevant concept ("this is a repeat-until situation") |
| Tier 3 viewed | May point at the failing region using grader feedback ("look at what happens at the rock") |
| Tier 4 viewed | May explain the concept fully with a *different* worked example — still never this level's solution |

The guide can *suggest* viewing the next static hint (one-tap chip in chat), which keeps
hint-usage tracking (and its star/XP accounting) as the single source of truth. Guide
usage itself is tracked but **never** reduces stars/XP in v1 — asking questions must not
feel punished.

### 5.5 Data model & routes

```prisma
model AIConversation {
  id            String   @id @default(cuid())
  schoolId      String
  studentId     String
  levelId       String?
  surface       GuideSurface   // CODING_HELP | AI_LAB | ERROR_EXPLAINER
  providerId    String
  promptVersion String
  startedAt     DateTime @default(now())
  messages      AIMessage[]
  @@index([schoolId, studentId, startedAt])
}

model AIMessage {
  id             String  @id @default(cuid())
  conversationId String
  role           MsgRole            // USER | ASSISTANT | SYSTEM_EVENT
  content        String             // post-redaction text (what was actually sent/shown)
  flags          Json?              // { pii_stripped, safety, solution_leak_blocked, offtopic_redirect }
  tokensIn       Int?
  tokensOut      Int?
  createdAt      DateTime @default(now())
}

model AIUsageLog {   // daily rollup per school × feature — budget + billing source of truth
  id         String @id @default(cuid())
  schoolId   String
  date       DateTime @db.Date
  surface    GuideSurface
  messages   Int
  tokensIn   Int
  tokensOut  Int
  estCostUsd Decimal @db.Decimal(10,4)
  @@unique([schoolId, date, surface])
}

model SchoolAISettings {   // 1:1 with School; created with safe defaults at school creation
  schoolId          String  @id
  guideEnabled      Boolean @default(false)
  guideSurfaces     Json    @default("{}")   // { codingHelp: false, aiLab: false, errorExplainer: false }
  customMediaEnabled Boolean @default(false) // §3.6
  dailyTokenBudget  Int     @default(200000)
  providerOverride  String?                  // NITAQ-admin only
  updatedBy         String?
  updatedAt         DateTime @updatedAt
}
```

Routes: `POST /api/guide/conversations` · `POST /api/guide/conversations/:id/messages`
(SSE) · teacher review `GET /api/teacher/classes/:id/guide-conversations` (transparency:
teachers can read their students' guide chats — stated in student-facing copy: "your
teacher can see this chat") · admin `GET/PATCH /api/admin/schools/:id/ai-settings` ·
`GET /api/admin/ai-usage?schoolId&from&to`.

Retention: conversations auto-purge after a configurable window (default 90 days),
usage rollups kept; deletion of a student cascades to conversations (fits the locked
deletion/retention requirement).

### 5.6 UAE data residency

All *storage* (conversations, logs) is in-region by the locked deployment design. The
open question is *inference egress*. Design position: (a) provider abstraction makes
routing a config choice, not a rewrite; (b) `BedrockProvider` targets the nearest
available AWS region for Claude-class models and is preferred when contractual
data-locality matters; (c) `LocalProvider` (small open model on in-region compute) is
the strict-residency fallback, accepting quality loss; (d) regardless of provider, only
redacted, identity-free lesson text leaves the platform (§5.2), and school contracts
disclose the inference path. Do not claim PDPL compliance — document the data-flow so a
compliance review can verify it.

### 5.7 Failure modes

| Failure | Behaviour |
|---|---|
| Provider down / timeout (8 s) | Circuit breaker flips conversation to `NoneProvider`; chat shows "Bunny is resting 🌙 — try a hint instead" with the static-hint button. Hints, grading, everything else: unaffected. |
| School budget exhausted | Guide chip disabled with a neutral message; teachers see budget state; static hints unaffected. |
| Rate limit hit | Friendly cool-down message with countdown; input disabled, not hidden. |
| Output gate trips repeatedly | Conversation auto-closes with a hint suggestion; incident logged with `flags`. |
| Safety flag on input | Fixed supportive redirect (never sent to provider); flagged for teacher visibility. |

---

## 6. AI-flavoured Blockly blocks — honest simulation, seeds for real ML

All four ship in Phase C in deterministic form (the seam), gain ML-linked variants in
Phase H. Every block's help balloon states plainly which mode it is in.

| Block | In the simulation (honest description) | How it seeds real-ML understanding |
|---|---|---|
| **Detect Object** (`ai_detect_object`) → `"carrot" \| "rock" \| "gap" \| "nothing"` | Reads the grid engine's state for the facing tile — a perfect deterministic sensor. Tooltip: "In this world the robot's sensor is perfect. Real robots use cameras and models — and they can be wrong." | Establishes *perception as program input*; the See Like a Computer module and image lab later show why real perception is probabilistic. |
| **Check Pattern** (`ai_check_pattern(pattern)`) → boolean | Deterministic pattern matcher over the tile row ahead (e.g., alternating carrot/rock). | Bridges LOGIC to Data Desert: patterns as things software can verify — then modules 3–5 ask "what if the pattern must be *found*, not given?" |
| **Classify** (`ai_classify(item)`) → label | **Concept mode** (W3–5): applies a *visible rule table* defined in the level config (features → label); child can open and read the table. **ML mode** (W6): the level references `mlExperimentId` — the block runs the student's own KNN/NB from §3 against the item's precomputed feature vector. Same block, and the UI badge switches from "rule table" to "YOUR trained model". | The switch is the single most important seam in the product: the child watches the identical block go from following *written rules* to using *their trained model* — the Rules-vs-Examples lesson embodied in code. |
| **Predict** (`ai_predict(sequence)`) → next value | **Concept mode**: deterministic extrapolation of an authored pattern. **ML mode**: least-squares regression from the child's Fortune-Teller/lab data. | Prediction as computed guess with error, not prophecy. |

**Grading determinism for ML mode**: valid because §3.5 holds — the referenced
experiment's `trainingSelection` + versioned embeddings + pure-TS classifier are all
server-reproducible, so `correctClassifierResult` grading re-runs exactly. Levels
gate on `status = TRAINED` experiments over curated data only.

Toolbox placement: `Detect Object` also appears under SENSORS (it *is* a sensor);
`Classify`/`Predict`/`Check Pattern` live in the AI category, which stays hidden until
World 3+ so early worlds keep a clean toolbox.

---

## 7. Phased rollout and cost control

### 7.1 Phasing (refines locked phases G/H; the guide slots after H as "G2")

| Phase | Ships | External cost |
|---|---|---|
| **A–F (MVP)** | Seams from §1.1 only: enums, track chips, settings table, `NoneProvider`, deterministic AI blocks, `features` on engine items | $0 |
| **G — AI Lab** | `AI_SIM` engine + widget registry; modules 1, 3, 5, 6, 7, 10 (no ML-runtime dependency); track lint in the content editor | $0 (no external services) |
| **G+ / H1** | `src/engine/ml/` cores (KNN/NB/regression) + dataset build pipeline + 3 image / 2 text datasets; modules 2, 4, 8, 9 (they reuse the runtime); Feed-the-Bunny-Brain as the ML Lab's on-ramp | $0 (one-time content licensing/review) |
| **H2 — ML Lab** | MLExperiment + stepper UX + REAL_ML grading + Classify/Predict ML mode + `desert-animals` demo dataset; custom-media mode behind school toggle | $0 runtime |
| **G2 — Bunny Guide** | Provider abstraction live with Anthropic Haiku-class model; coding-help surface only; 2–3 pilot schools, budgets on | first real spend |
| **G3** | Guide surfaces for AI Lab + error explainer; Bedrock/local routing option; teacher conversation review UI | scaled spend |

Sales note: G and H1/H2 are the differentiators that demo brilliantly on a big screen
(train `desert-animals` live in front of a school head, on their iPad, offline) and cost
nothing per-use. The LLM is deliberately last: highest risk, only recurring cost.

### 7.2 Cost controls (Guide)

- **Deflection first**: static hints are the default help path; guide entry points appear
  only after an attempt + a viewed hint. Expected effect: guide handles the long tail,
  not the first question.
- **Model & tokens**: Haiku-class model; `maxOutputTokens` 300; system+curriculum prefix
  under prompt caching; conversation window truncated to last 6 exchanges + summary.
- **Budgets, layered**: per-student rate limits → per-school daily token budget
  (`AIUsageLog` rollup checked pre-call) → platform monthly cap with alerting at
  50/80/100% to NITAQ admins. Budget exhaustion degrades gracefully (§5.7).
- **Envelope estimate** (order-of-magnitude, for planning only): ~1.2k input (mostly
  cached) + ~250 output tokens per message; at Haiku-class pricing ≈ $0.001–0.002 per
  message → a 500-student school at 5 guide messages/student/school-day ≈ $3–7/day
  worst case, and the default budget (200k tokens/day) caps it below that. Licence
  pricing can absorb this; per-school budget is still the hard backstop.
- **No-LLM surfaces stay no-LLM**: AI Lab modules and ML labs never call the provider;
  the error-explainer prefers a curated map of grader/interpreter error codes →
  authored explanations, with the LLM only for the uncovered tail.

### 7.3 Risks / open questions for the product owner

1. **Inference egress vs residency** (§5.6): accept disclosed cross-border inference
   with redacted text, or mandate Bedrock-regional/local-model routing at quality cost?
   Per-school contractual matter; the architecture supports both.
2. **Teacher visibility of guide chats** is designed ON (with student-facing notice).
   Confirm this matches school expectations in the UAE market.
3. **Webcam mode at all in v1 of H2?** The design isolates it safely, but shipping
   curated-only first and adding camera later is a legitimate de-risking cut.
4. **MobileNet licence/attribution** (Apache-2.0 — fine, needs a credits page entry)
   and dataset image licensing budget for curated sets.
5. Arabic sentiment lexicon/dataset authoring needs a native-speaker educator — plan
   the content budget, don't machine-translate.
