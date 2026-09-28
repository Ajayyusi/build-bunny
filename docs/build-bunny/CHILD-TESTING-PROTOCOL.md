# Observed child sessions: protocol

**Status: not yet conducted.** This is the plan for the handoff's "five observed child sessions across grades 3 to 7". Nothing here reports results. The measures are proposed product metrics, not a measured baseline (handoff, "Evaluation plan and measures").

## Purpose

Find out, before launch, whether a child can:

1. reach an AI action quickly, with no coding first;
2. finish an AI learning loop (predict, try, observe, retry) without an adult's help;
3. explain in their own words how a machine that learns from **examples** differs from one that follows **rules**. This is the crucial test: completion and enjoyment alone don't prove it.

Also find where the instructions fail.

## Who and when

| | |
|---|---|
| Children | At least 5, across grades 3 to 7. At least two in grades 3–4 and two in grades 5–7. At least one Arabic-first reader. Mix of confident and less confident readers. |
| Round 1 | Before launch, on the build under test (note its commit or version). |
| Round 2 | After changes, with different children where possible. Same protocol and measures, so results can be compared. |
| Length | 20 minutes of play per child, plus 5 minutes of questions. No child plays for more than 30 minutes. |
| Devices | Mix of the school's own tablets and laptops. Note the device, browser and screen size for every session. |

## Consent and privacy

- Written consent from a parent or guardian, and the child's own agreement at the start. A child may stop at any time without giving a reason.
- The child uses a **fresh test account** made for the session (not their own). Its name is a code: `T1`–`T5` for round 1, `R1`–`R5` for round 2.
- Record the screen only. No faces, no voices without separate consent. Handwritten notes use the code, never the child's name.
- Recordings and notes are stored with school data and deleted after the report is written. The report shows codes and grade bands only.
- An adult the child knows (teacher or parent) is in the room.

## Roles

- **Facilitator:** reads the script and asks the questions. Does not help, point or hint (see "No coaching").
- **Note-taker:** fills in the recording sheet, with timestamps, while the session runs.

## Setup (before each child)

1. Make a fresh test student in a class you control (a teacher can see the class page). Note the code.
2. Sign the device into that account, on the login screen of the language the child reads best.
3. Sound on at a low volume; reduced motion off unless the child needs it.
4. Start the screen recording and a stopwatch.

## Script

Read these lines as written.

**Opening (1 minute).**
> "This is a game some children might use at school. We're testing the game, not you: there are no wrong answers. If something is confusing, that's the game's fault, and it helps us to know. Please think out loud: say what you're looking at and what you're trying to do. I can't help you while you play, but I'll ask you some questions at the end."

**Task 1: first session (up to 8 minutes).**
> "Please log in and start playing. Play whatever you like."

Note the time from login to the first AI action (a first example placed in Train a Sorter, or a first guess in any AI activity). Don't direct the child. If they're stuck for 60 seconds, ask only: "What are you trying to do?"

**Task 2: the two routes (2 minutes).** After Task 1, whatever they chose:
> "Can you find somewhere in the game to learn about AI? And somewhere to learn coding?"

**Task 3: free play (up to 10 minutes).**
> "Now play anything you like. You can go back to things you've played."

Note the activities they choose, retries after a mistake, uses of "Show me the next step" and "Ask Robo Bunny", and any sign of frustration or delight.

**Questions (5 minutes).** Ask all of them, in this order, and write the answers word for word.

1. "What did the robot (or bunny) learn? How did it learn it?"
2. "In the sorting game, why did the robot get one wrong? What did you do about it?"
3. "Imagine two robots sorting fruit. One follows rules someone wrote. The other learned from examples. What's the difference?"
4. "What was the Explore AI part of the game about? What was the Coding Lab about?"
5. "Was there anything you didn't understand, or that didn't do what you expected?"
6. "Would you want to play again? What would you play first?"

## No coaching

The facilitator must not:

- point at the screen, or name a button or place ("try the blue one");
- explain what a word means (if the child asks, say "What do you think it means?", then note that they asked);
- praise right answers or correct wrong ones during play;
- reword the questions. If a child doesn't understand a question, read it once more, then move on and note it.

If a child is upset or completely stuck for 3 minutes, stop the task, reassure them, and note "stopped" with the reason. That is a finding, not a failure.

## Measures

Record these for every child. Where the product records something itself (`LearningEvent`), use that as a cross-check, not instead of watching.

| Measure | How it's measured | Product cross-check |
|---|---|---|
| First AI action | Seconds from login to first example or guess in an AI activity | `LEVEL_SESSION_STARTED`, `AI_TEST` |
| Coding before AI? | Did the child do any coding before their first AI action? (yes/no) | Level order of the events |
| Loop completed | Finished at least one AI activity (yes/no, which one) | `LEVEL_COMPLETED` |
| Predicted before seeing | Made a prediction before a reveal, unprompted (yes/no) | `AI_TEST` "revealGuesses", "lockPrediction" |
| Retry after an error | After a wrong result, tried again rather than leaving (count, and yes/no for "at least once") | `AI_RETRY` |
| Help used | "Show me the next step" and "Ask Robo Bunny" uses | Hint rows |
| Explains examples vs rules | Answer to Q3, scored with the rubric below (0–2) | — |
| Explains what the AI learned | Answers to Q1–Q2, scored with the rubric (0–2) | Quick-check answers (first try right?) |
| Routes understood | Q4, and whether Task 2 was done: both routes found and told apart (yes/no) | — |
| Instruction failures | Every moment the child misread, hesitated for more than 15 seconds, or asked what to do: where, and what they said | — |
| Enjoyment / return | Q6 (would play again: yes / maybe / no) | Return session: `LEVEL_SESSION_STARTED` on a later day (round 2 only, if children keep access) |

### Explanation rubric (0–2)

| Score | "Examples vs rules" (Q3) | "What the AI learned" (Q1–Q2) |
|---|---|---|
| 0 | No answer, or restates the question | "It just knew" / nothing about examples |
| 1 | Names one side correctly ("the second one learned from the fruit it saw") | Mentions examples, but not that it can be wrong on new cases |
| 2 | Contrasts the two ("someone told the first one; the second worked it out from examples, so it can get new ones wrong") | Examples, plus that it can fail on new cases and that better examples fix it |

Two people score the answers separately from the written notes, then agree a score. Record any disagreement.

## Teacher comprehension (separate, 10 minutes per teacher)

With one or two teachers of these children, after the sessions. Don't show them the children's answers first.

1. Open the class page. "What does this tell you about how your class is doing with AI ideas?"
2. "Which idea is the class least sure about? How can you tell?"
3. "What's the difference between 'finished' and 'explained' here?"
4. "What are sessions, tests and retries?"

Score each question: understood / partly / not understood. Note anything they expected to find and didn't. Repeat with the school admin on `/school`, "AI activities: last 30 days".

## Recording sheet (one per child)

```
Code: ____  Grade: __  Language: EN / AR  Device & browser: __________  Build: ______
Date: ______  Facilitator: ____  Note-taker: ____

Login at: __:__   First AI action at: __:__  (= ___ s)   Activity: ____________
Coding before AI?  yes / no
Task 2: AI route found  yes / no   Coding Lab found  yes / no   Told apart  yes / no

Activities played (in order), with outcome (finished / stopped / left) and retries:
1. ______________________  __________  retries: __
2. ______________________  __________  retries: __
3. ______________________  __________  retries: __

Predicted before a reveal, unprompted:  yes / no   (where: ________)
Next-step hints used: __   Robo Bunny opened: __

Instruction failures (time, where, what the child said or did):
- __:__ ____________________________________________
- __:__ ____________________________________________

Q1 (word for word): ______________________________________   score 0 1 2
Q2: ______________________________________________________   score 0 1 2
Q3: ______________________________________________________   score 0 1 2
Q4: ______________________________________________________   routes understood yes / no
Q5: ______________________________________________________
Q6: play again  yes / maybe / no   first choice: ____________

Stopped early?  no / yes (task, reason): _______________________
```

## Reading the results against the launch criteria

The handoff's launch criteria, and what counts as meeting each one in round 1 (at least 5 children):

| Launch criterion | Met when |
|---|---|
| No coding prerequisite | Every child reached an AI action with no coding first |
| Child reaches an AI action quickly | Median time to first AI action is under 2 minutes, and no child took more than 5 |
| Every AI lesson produces an explanation in the learner's own words | At least 4 of 5 score 1 or more on Q1–Q2, and at least 3 of 5 score 2 on Q3. (The in-product explanation builder is a separate P1 item; this measures the spoken explanation.) |
| Grade adaptation is usable | Grade 3–4 children finish a loop without adult help as often as grade 5–7 children (note the difference if not) |
| Incorrect predictions are safe and instructive | After a wrong result, at least 4 of 5 retried rather than leaving, and no child showed distress at being wrong |
| Routes plainly labelled | At least 4 of 5 found and told apart Explore AI and Coding Lab (Task 2, Q4) |

These thresholds are a starting point for a formative test with five children, not statistical claims. Treat any criterion that fails as a design problem to fix and retest in round 2.

## Report

One page per round:

- what was tested (build, devices, children by code and grade band);
- the measures table, per child and in total;
- the instruction failures, grouped by screen and ranked by how often they happened;
- the launch-criteria table, with met / not met and the evidence;
- the changes proposed, each tied to a failure above.

Keep the recording sheets with the report until round 2 is done, then delete them with the recordings.
