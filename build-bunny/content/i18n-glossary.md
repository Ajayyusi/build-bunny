# Build Bunny — Arabic Terminology Glossary (M5 §1)

This glossary is the single source of truth for Arabic terminology across the
shipped curriculum (`content/worlds/*.ts`) and the Blockly block set
(`src/modules/blockly/blocks.ts`). Every Arabic string authored for a level —
title, story, objective, instructions, explanation, hints — uses these exact
renderings. If you need a new term, add it here first, then use it.

Register: Modern Standard Arabic, simple sentence structure, concrete verbs,
Grades 3–7 (UAE). Western digits (0–9) everywhere, never Arabic-Indic
numerals. No machine-translation artefacts — every string here and in the
content files was authored/reviewed as classroom copy, not bulk-translated.

## 1. Block names (must match `src/modules/blockly/blocks.ts` exactly)

| Block (English)                          | Arabic label                    | Notes |
|-------------------------------------------|----------------------------------|-------|
| When Start (hat)                          | عند البدء                        | |
| Move Forward                              | تقدّم للأمام                     | |
| Turn Left                                 | استدر يسارًا ↺                   | |
| Turn Right                                | استدر يمينًا ↻                   | |
| Collect                                   | التقط                            | |
| Say                                       | قل                                | `قل %1` |
| Repeat (counted, TIMES field)             | كرّر                              | `كرّر %1 مرات %2` — see §3 below for the grammar fix |
| Repeat Until I Reach the Goal             | كرّر حتى أصل إلى الهدف           | `كرّر حتى أصل إلى الهدف %1` |
| If (sensor CONDITION, DO)                 | إذا … نفّذ …                     | `إذا %1 نفّذ %2` |
| If / Else (adds ELSE)                     | إذا … نفّذ … وإلا …              | `إذا %1 نفّذ %2 وإلا %3` |
| Path Ahead (sensor, Boolean output)       | الطريق أمامي مسدود               | phrased as the sensor's yes/no question |

## 2. Teaching / CS vocabulary (the 13 terms named in the M5 brief)

| English      | Arabic        | Notes |
|--------------|----------------|-------|
| loop         | حلقة (تكرار)  | "حلقة" alone in short copy; "حلقة تكرار" when introducing the concept |
| condition    | شرط            | the Boolean question a sensor/If evaluates |
| sensor       | مستشعر         | e.g. "مستشعر الطريق أمامي" |
| program      | برنامج         | |
| instruction  | تعليمة (ج. تعليمات) | a single step the computer executes; "أمر" avoided as a second synonym to keep one fixed word |
| sequence     | تسلسل          | also "بالترتيب" (in order) in narrative prose |
| debug        | صحّح / تصحيح الأخطاء | "bug" → خطأ (برمجي) |
| algorithm    | خوارزمية       | not yet used in shipped W1–3 copy; reserved for later worlds |
| variable     | متغيّر          | not yet used in shipped W1–3 payloads; reserved for later worlds |
| star         | نجمة (ج. نجوم) | |
| level        | مستوى          | |
| world        | عالم            | |
| hint         | تلميح           | |

## 3. Fix applied to `blocks.ts`

The Repeat block's Arabic message read `"كرّر %1 مرة %2"` — singular "مرة"
paired with a numeric field that ranges 1–10 is grammatically inconsistent
for most of that range (Arabic count agreement needs مرة/مرتين/مرات
depending on the number, which a single template can't express). Changed to
the plural `"كرّر %1 مرات %2"` ("repeat N times"), the same simplification
Arabic children's-coding tools (e.g. Scratch) use for templated counts —
natural-sounding for 3–10 and understood without confusion for 1–2. All
other block labels were reviewed and judged natural, concrete classroom
Arabic; no other change was needed.

## 4. Supplementary content vocabulary (not mandated by the brief, kept here
for translator consistency across the shipped levels)

| English                          | Arabic                  |
|-----------------------------------|--------------------------|
| block (generic Blockly piece)     | لبنة (ج. لبنات)          |
| toolbox                           | صندوق الأدوات            |
| workspace                         | مساحة العمل              |
| Run (button)                      | تشغيل / شغّل             |
| goal / burrow tile                | الهدف                    |
| map / grid                        | خريطة                    |
| Robo Bunny (character)            | الأرنب الآلي             |
| burrow                            | جُحر                      |
| carrot                            | جزرة (ج. جزر)            |
| power cell (Robot Lab carrot skin)| خلية طاقة (ج. خلايا طاقة)|
| charging dock                     | محطة الشحن               |
| Bunny Meadow (world)              | مرج الأرنب               |
| Logic Forest (world)              | غابة المنطق              |
| Robot Lab (world)                 | مختبر الروبوتات          |

## 5. teacherNotes stay English

`teacherNotes` is a staff-only field (never shown to students, never
localized in the player UI) and is intentionally left English-only across
every level, per the M5 brief. The import pipeline's `hasArabic()` check
originally required Arabic in every populated localized field including
`teacherNotes`, which made `arComplete: true` impossible while honouring
that decision — `computeArComplete` in
`src/modules/curriculum/server/import.ts` was updated to exclude
`teacherNotes` from AR-coverage (student-facing fields only: title, story,
objective, instructions, explanation, all 4 hint tiers). See the comment
left at that function for the rationale.

## 6. AI & machine-learning vocabulary (Worlds 4–6)

Added when AI Island graduated from roadmap art to real content. These worlds
are the first place a child meets a machine that is TAUGHT rather than
programmed, and that distinction only survives translation if the words stay
fixed. Two rules govern this table:

1. **One rendering per idea, everywhere.** Levels authored separately produce
   three different renderings of "example" without this; that is the defect
   this section exists to prevent.
2. **Student-facing copy never uses the technical term.** A child reads "the
   bunny guesses" and "the ones you showed it". The technical column records
   what a teacher would recognise, and belongs only in `teacherNotes`, which
   is English-only by §5 — so the two columns can never get swapped by
   accident.

| English (student-facing)  | Arabic                    | Technical (teacherNotes, EN only) |
|----------------------------|----------------------------|------------------------------------|
| teach (a machine)          | علّم                       | train |
| example (one you show it)  | مثال (ج. أمثلة)            | training example |
| the ones you showed it     | ما علّمته إياه              | training set |
| guess (verb)               | يخمّن                       | predict |
| guess (noun)               | تخمين                      | prediction |
| new / never seen before    | جديد / لم يره من قبل        | held-out, unseen |
| it looks most like         | تشبه أكثر                   | nearest neighbour |
| measurement                | قياس (ج. قياسات)           | feature |
| basket                     | سلّة (ج. سلال)              | class / label |
| safe to eat / not safe     | آمنة للأكل / غير آمنة       | positive / negative class |
| a wrong note               | ملاحظة خاطئة                | mislabelled record |
| group (of things alike)    | مجموعة                      | cluster |
| pattern                    | نمط (ج. أنماط)             | structure, signal |
| machine learning           | تعلّم الآلة                 | machine learning |
| artificial intelligence    | الذكاء الاصطناعي            | artificial intelligence |

Names introduced by these worlds:

| English              | Arabic                  |
|-----------------------|--------------------------|
| AI Island (world)     | جزيرة الذكاء الاصطناعي   |
| Data Desert (world)   | صحراء البيانات           |
| Machine Learning Lab  | مختبر تعلّم الآلة        |
| berry                 | حبة توت (ج. حبات توت)    |
| crab                  | سلطعون (ج. سلاطعين)      |

### Why "علّم" and not "درّب"

"علّم" (to teach) is used throughout rather than "درّب" (to train). The whole
pedagogical point of these worlds is that showing examples is a kind of
TEACHING rather than a kind of programming, and "علّم" carries that to a child
in a way "درّب" — which a Grade 5 reader associates with sport — does not.
