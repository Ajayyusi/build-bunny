# Teacher and principal views, reviewed separately

The handoff's developer checklist asks for this review, because the student review it was based on never covered these views: "Review teacher and principal views separately; they were outside the verified student review." It also asks to "validate permissions and reporting against actual principal workflow".

Date: 2026-10-01, branch `feat/audit-gaps-2`, production build, seeded demo school.

## How it was checked

A script (`staff-review.mjs`, kept outside the repo) signed in as the demo teacher and the demo principal through the auth API. It covered every staff page:

- **Teacher:** overview, class page, student page, attempt replay, curriculum and assignments.
- **Principal:** overview, classes, students, teachers, activity, reports, certificates, privacy and imports.

Each page was visited in English and Arabic, at laptop (1280 px) and tablet-portrait (768 px) widths. For every page the script recorded:

- a full-page screenshot;
- any horizontal overflow;
- serious or critical axe findings (at laptop width);
- whether the other role is refused.

## Results

| Check | Result |
|---|---|
| Pages reachable for their role | 60 of 60 |
| Horizontal overflow | None |
| Serious or critical axe findings | None |
| Teacher opening principal pages (`/school`, `/school/teachers`, `/school/reports`) | Redirected to `/teach`. No school data in the HTML or on the page. |
| Principal opening teacher pages | Allowed by design (`requireRole("TEACHER", "SCHOOL_ADMIN")`): a principal can read every class in their own school. |

### What the principal sees (the handoff: "school usage, completion and concept trends by class")

- **Usage:** active this week and this month, and AI sessions, tests and retries by class. Also by class, how many children came back to the AI activities on another day.
- **Completion:** by grade and by class, and AI completions by class.
- **Concept trends by class:** for each of the five AI concepts, how many children are secure now and the change over four weeks. The CSV carries both.
- **Week by week:** AI activity school-wide, plus the most-attempted and most-failed levels.

### What the teacher sees

- **Class page:**
  - where the class finds it hard;
  - common mistakes to reteach;
  - Explore AI launch control;
  - finished against understood, for each Explore AI idea;
  - concept mastery, with attempts, retries, misconceptions and grade bands;
  - the progress matrix.
- **Student page:** progress, attempts, notes, AI mode, the child's own sentences and the "heard them explain it" tick.
- **Attempt replay:**
  - coding levels: the program run step by step;
  - Teach-the-bunny levels: what was taught, what was kept back, the report, and what changed since the previous try.

## Found and fixed

- **Right-to-left names:** a Latin name with punctuation, such as "Adam B.", rendered as ".Adam B" in Arabic pages. Staff and student pages now isolate names (`<bdi>`), so a name keeps its own direction.

## Open: needs a person

- **Validate against a real principal's workflow:** the handoff asks for this before release. The permission model is verified above; whether these numbers answer a principal's actual questions needs a principal.
- **Teacher's "AI ideas" panel:** it covers the eight Explore AI activities. The other AI lessons appear in concept mastery and on the principal's page. Whether teachers want a per-lesson view for all 30 is a product question.
