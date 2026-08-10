# Build Bunny — sales demo script

The owner's plan (§29) defines V1 success as one unbroken thread: create school →
class → student account → student login → adventure map → level → Blockly
program → run → simulation → useful failure feedback → success → stars/XP →
next level unlocks → teacher sees updated progress immediately → certificate
earned → certificate verifies publicly. This script walks a NITAQ salesperson
through that exact thread, live, with no engineering help.

It uses TWO account pools:

- A **brand-new school you create live** (Parts 1–3) — proves self-serve
  provisioning and shows a genuinely fresh student earning their first stars
  in front of the prospect.
- The pre-loaded **NITAQ Demo School** (Part 4) — a class with real weeks of
  progress and an already-earned certificate, because nobody can play 17
  levels in a sales meeting. Credentials for every account below live in
  `prisma/seed-output/credentials.md` (gitignored — never paste passwords
  from that file into this doc or into chat/email; read it on the machine
  you're demoing from).

## Before you start

1. **Reset the demo school** so it looks exactly like this script describes,
   no matter what the last demo (or a previous QA pass) left behind:
   ```
   npm run demo:reset
   ```
   Safe to run any time — it only ever touches the school with code `DEMO`
   and refuses to run at all if your database holds more than one school
   unless you pass `--force` (a guard against ever nuking a real customer's
   data by habit).
2. Open two browser windows side by side (or one normal + one incognito) —
   you'll have a **student** and a **teacher/admin** logged in at the same
   time in Part 3–4 to show progress syncing live.
3. Know the app URL. Locally that's `http://localhost:3000`; for a hosted
   demo/staging environment, substitute that origin everywhere below.
4. Optional wow-moment: the language switcher (footer of the login page, and
   the student profile page) flips the whole product to Arabic with full RTL
   layout — worth a 10-second detour if the audience is Arabic-speaking.

---

## Part 1 — Provision a school live (≈2 min)

**Say:** "Let me set this up the way your IT lead would, live — no
spreadsheets, no support ticket."

1. Go to `/login`, sign in as the **NITAQ platform admin** (Reem Al Shamsi —
   `admin@nitaq.demo`, password in credentials.md).
2. Go to `/nitaq/schools` → click **Create school**.
3. Step 1: name the school after the prospect (e.g. "Riverside Academy — demo"
   so it's obviously a throwaway), pick a short code, accept the slug.
4. Continue through licence seats and the **first admin's email/name** —
   this is who will run the school day to day.
5. Submit. **What the audience should see:** a success screen showing the new
   admin's login and a one-time generated password, right there on screen —
   the account is real and usable immediately, nothing to provision
   overnight.

**Say while it renders:** "That password is temporary — the first thing they
do on login is set their own. Everything from here on is what your admin and
teachers would actually click."

## Part 2 — Class + first student (≈2 min)

Stay logged in as the new school admin (or sign in as them now, using the
password from Part 1 — you'll be forced to set a permanent one first).

1. `/school/teachers` → **Add teacher** — one real teacher account, so Part 3
   can show the teacher's own view syncing live.
2. `/school/classes` → **Create class** — name it (e.g. "Grade 4 — Demo"),
   pick the grade, assign the teacher you just made. First class in a new
   school also creates its academic year inline — accept the default.
3. `/school/students` → **Add student** — one student. **What the audience
   should see:** the credential sheet — username, a friendly generated
   password (word-word-number, easy for an 8-year-old to type), and the
   school's login code, ready to hand a child a card.

## Part 3 — The student experience (≈4 min)

Switch to your second browser window.

1. Go to `/student-login`, enter the school code and the student username/
   password from Part 2's credential sheet.
2. **What the audience should see:** the adventure map (`/adventure`) —
   Bunny Meadow open, one level glowing as "current," everything else
   greyed with a lock. No dead ends, no "coming soon."
3. Click into the first level. **Say:** "Every program a child writes here is
   graded by the exact same engine on the server — the client is never
   trusted with the grade."
4. **Deliberately show the failure state first** — press **Run** before
   dragging any block under "When Start." The bunny sits still; the result
   banner reads *"Bunny finished away from the burrow. Where should the
   trail end?"* with a **Try Again** button. This is the "useful failure
   feedback" beat — point out it's specific (references the goal), not a
   generic error.
5. Drag **Move Forward** under **When Start**, press **Run** again.
   **What the audience should see:** the simulation plays the hop, a star
   overlay animates in, then the explanation card (the authored teaching
   copy — "You just wrote a program!"). Click through to **Next level**.
6. Back on `/adventure`: the completed level now shows its stars, XP has
   ticked up on the student's profile chip, and the next level is unlocked
   and glowing. This is "stars/XP → next level unlocks" — all three visible
   without a page refresh.

## Part 4 — Teacher sees it live, then the mature demo school (≈4 min)

Still on the student window from Part 3:

1. In your FIRST window, sign in as the teacher created in Part 2 and open
   `/teach` → the new class → the student's row. **Refresh** (or just note
   the timestamp) — the level just completed in the other window is already
   reflected: stars, attempts count, last-active time. **Say:** "Nothing to
   sync — it's the same database, read live."

Now switch the story to depth. Sign out and sign back in as the pre-loaded
demo staff:

2. Sign in as **Sara Haddad** (TEACHER, Grade 3A — credentials.md) at
   `/teach/classes/[Grade 3A]`. **What the audience should see:** a full
   progress matrix — 8 students × every published level, coloured by state,
   with "needs attention" flags (stuck / overtime / heavy hints / inactive)
   called out by name, not a black-box score.
3. Open **Aisha K.**'s student detail page
   (`/teach/classes/[Grade 3A]/students/[Aisha]`) — full per-level history,
   recent attempts (verdict, stars, hint tier, duration), and her earned
   achievements. This is a student who has finished Worlds 1 and 2 entirely.
4. **Certificate + public verification.** As the STUDENT this time — sign in
   as **Aisha** (`aisha`, school code `DEMO`, password in credentials.md) —
   go to `/achievements`. **What the audience should see:** her Bunny
   Meadow and Logic Forest certificates, both already earned (issuance is
   automatic the moment a student finishes every level in a world — nothing
   manual). Click **View certificate** on Logic Forest, then **Print /
   Save as PDF** to show the A4 printable sheet with NITAQ + Build Bunny
   branding and a QR/verify URL printed on it.
5. Copy the verify URL shown on the certificate sheet, open it in a private/
   incognito tab (proving no login is needed): `/verify/[the-slug-on-the-
   certificate]`. **What the audience should see:** student name, school
   name, world title, stars, issue date — a public, no-login page anyone
   (a parent, another school, a printer) can check the certificate against.
   Note the URL is a 22-character unguessable token, never the printed
   serial — the serial on paper can't be used to look anything up.

**Close:** "That's the whole loop — a school stood up from nothing, a child's
first program graded fairly, a teacher watching in real time, and a
credential that verifies itself with no login and no support ticket."

---

## After the meeting

- The throwaway school from Parts 1–3 stays in the database. Either leave it
  (it costs nothing and `npm run demo:reset` never touches non-DEMO schools),
  or deactivate it from `/nitaq/schools` (**Deactivate** on its row) before
  your next demo if you'd rather keep the schools list tidy.
- Run `npm run demo:reset` again before your NEXT demo regardless — it
  restores Aisha's certificates and the whole roster's progress to exactly
  the state this script describes, even if a previous audience member
  played around in it.
