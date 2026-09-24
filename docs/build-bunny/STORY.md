# Build Bunny — The Story Bible

One connected story across the eight worlds, written to be told in short,
skippable beats by Robo Bunny itself. Every beat below is authored in
English and Arabic in `content/worlds/*.ts` (`story`, `character`, `power`)
and shown by the game: a world's opening scene on first entry, its
character on the map card, its **Power** at the finale. This file is the
source the content follows; if they disagree, fix the content.

## The spine: eight Powers for the Inventor's Fair

Robo Bunny is a small robot rabbit who woke up in Bunny Meadow with an
empty memory and one wish: to reach **Inventor Island** and build something
of its own at the Inventor's Fair. It cannot do anything alone — it only
does what a program tells it — so the child is its coder and its friend.

Each world has a problem only a new way of thinking can solve. Solving it
earns Robo Bunny a **Power**: a way of thinking it keeps forever. The eight
Powers are the eight ideas the curriculum teaches. At the Fair, Robo Bunny
uses all eight to build its own invention — and so does the child.

| # | World | Problem | Friend | Power earned (the idea) |
|---|---|---|---|---|
| 1 | Bunny Meadow | Robo Bunny has just woken up and can't even hop without instructions; the Spring Feast carrots need gathering. | **Grandma Clover**, who keeps the carrot garden and speaks in short, kind orders. | **Sequence** — one clear instruction after another |
| 2 | Logic Forest | The forest lanterns went dark and the trails rearrange themselves every night. | **Oona the Owl**, who answers every question with a question. | **Loops & Decisions** — repeat what repeats, check before you hop |
| 3 | Robot Lab | The lab where Robo Bunny was built is broken: power cells scattered, night-shift robots crashing into walls. | **Professor Pip**, a hedgehog inventor who loves a bug report. | **Sensing & Debugging** — read what's there, find the mistake |
| 4 | AI Island | The island's berry-sorting machine has lost its examples, and a very nosy app has washed ashore. | **Coco the Parrot**, who only learns by copying what she's shown. | **Learning from Examples** — and choosing them carefully |
| 5 | Data Desert | A sandstorm scrambled the caravan's records; something impossible is in the readings. | **Fenn the Fennec**, the caravan's keeper of numbers. | **Patterns in Data** — and the courage to doubt a number |
| 6 | Machine Learning Lab | Robo Bunny is asked to train a checker that decides what is safe — and to prove it works fairly. | **Dr. Nova**, a robot owl who tests everything twice. | **Train & Test** — hold some back, weigh the costs |
| 7 | Code City | The city's delivery bots speak real code; blocks alone can't read the signs. | **Mayor Mo**, a pigeon who runs the city by the clock. | **Reading Code** — blocks are code, and code can be read |
| 8 | Inventor Island | The Fair is tomorrow and there are no instructions — only ideas. | **All the friends**, arriving for the Fair. | **Invention** — every Power at once, on something of your own |

Robo Bunny's memory fills up as the Powers are earned; the child sees the
same eight Powers on their profile as badges (`WORLD_COMPLETED` per world).

## Robo Bunny's voice

- Speaks in first person, short sentences, curious and kind. Never sarcastic.
- Admits it cannot do things alone: "I can't hop until you tell me how."
- Celebrates the *idea*, not the score: "You used one Repeat instead of four
  hops. That's the Loop power!"
- When the child fails: names what happened, never who is at fault.
  "I bumped a rock at step 3. Where should I have turned?"

## Per-world beats (what the cutscene says)

Cutscenes are three lines, each with a bunny pose; the child can skip at
any line, and they are shown once per device per world.

### 1 · Bunny Meadow — "The First Hop"
1. *(waving)* "Hi! I'm Robo Bunny. I just woke up in this meadow — and I can't move a whisker until someone tells me how."
2. *(thinking)* "Grandma Clover needs carrots for the Spring Feast. If you give me the instructions, I'll do the hopping."
3. *(excited)* "Snap a block, press Run, and watch me go. Let's find out what we can do together!"

Finale: **Repeat After Me** — one Repeat instead of four hops. Grandma
Clover: "One order, said once. That's a coder."

### 2 · Logic Forest — "Lanterns in the Dark"
1. *(pointing)* "The forest lanterns went dark, and the trails move every night. Oona the Owl says only a pattern can find the way."
2. *(thinking)* "Some trails repeat. Some split. I'll need to check before I hop — and to keep going until I get there."
3. *(excited)* "Loops and decisions. Let's light the lanterns back up!"

Finale: **Forest Challenge** (the spiral) and **Loop Detective** (reading a
loop). Oona: "You didn't count the steps. You trusted the pattern."

### 3 · Robot Lab — "Where I Was Made"
1. *(surprised)* "This is the lab where I was built! But the lights are out, the power cells are everywhere, and the night-shift robot keeps crashing."
2. *(thinking)* "Professor Pip gave me a sensor. Now I can feel what's ahead before I move — and I can read a broken program to find its bug."
3. *(excited)* "Sense, decide, act. Let's fix the lab."

Finale: **Lab Gauntlet** and **Sensor Sequence**. Pip: "A great robot doesn't
know the track. It knows what to do at every wall."

### 4 · AI Island — "Coco Learns by Watching"
1. *(waving)* "Coco the Parrot learns everything by copying — show her a berry, she remembers it. The island's sorting machine works the same way."
2. *(thinking)* "This time there's no program to write. I only get better by the examples you choose. Choose well, and I'll sort berries I've never seen."
3. *(pointing)* "And watch out for that nosy app on the beach. Not everything that asks deserves an answer."

Finale: **Two Things at Once** and **Secret Keepers**. Coco: "You taught me
with the tricky ones, not just the easy ones. That's why I learned."

### 5 · Data Desert — "The Reading That Couldn't Be Real"
1. *(thinking)* "A sandstorm scrambled Fenn's records. Twelve creatures came to the waterhole, and nobody wrote down what they were."
2. *(pointing)* "Fenn says the groups are already in the data. We just have to find them — and not trust a number that can't be true."
3. *(excited)* "Patterns, and the courage to doubt. Let's read the dunes."

Finale: **Fortune Teller** — predicting past the data with an honest error.
Fenn: "You said 'about', not 'exactly'. That's how a scientist talks."

### 6 · Machine Learning Lab — "Prove It"
1. *(surprised)* "Dr. Nova wants me to train a checker that decides which power cells are safe. And she wants proof it works."
2. *(thinking)* "So I'll keep some cells back to test with. And I'll remember: some mistakes cost more than others."
3. *(excited)* "Train, test, and choose the safe kind of wrong. Let's earn Nova's trust."

Finale: **Let It Run**. Nova: "You checked where it stopped, not how nicely
it started. Tested, not trusted."

### 7 · Code City — "The Signs Are in Code"
1. *(pointing)* "Welcome to Code City! Mayor Mo runs everything by the clock, and the delivery bots read their orders as real code."
2. *(thinking)* "Every block I've ever used was code underneath. If I can read it, I can spot what a program will do before it runs — and fix the ones that go wrong."
3. *(excited)* "Read first, then run. Let's keep the city moving!"

Finale: **City Bug Bounty** — three bugs, one delivery. Mo: "On time, and
you read every line first. Have a key to the city."

### 8 · Inventor Island — "The Fair"
1. *(waving)* "Everyone's here for the Inventor's Fair — Grandma Clover, Oona, Pip, Coco, Fenn, Nova and Mayor Mo. And I have all eight Powers."
2. *(thinking)* "There are no instructions on this island. There's a workbench, every block I know, and an empty map."
3. *(excited)* "So let's invent something. Yours first — then mine."

Finale: the child's own project (`feat/curriculum-expansion`: maze builder
and creative projects). Until those ship, Inventor Island opens with its
first workshop module — open-ended levels with many right answers.

## Rules the story keeps

- No public leaderboards, no "you're falling behind", no countdowns. Powers
  reward understanding; there is nothing to grind for.
- Every character is fictional and non-human; no real names, brands or
  places (UAE flavour comes from the desert, the caravan and the fennec).
- Arabic is authored per line, not translated in bulk (`content/i18n-glossary.md`).
- Cutscenes are three lines and skippable at every line; a child who skips
  loses nothing they need to play.
