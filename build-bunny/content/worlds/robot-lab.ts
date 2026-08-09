import type { z } from "zod";
import type {
  WorldFixture,
  blockCodingPayload,
  debuggingPayload,
  sequencingPayload,
} from "@/modules/curriculum/schemas";

/**
 * World 3 — Robot Lab (m3-contracts wave 3, plus the m4 SEQUENCING level
 * "sensor-sequence" appended as repairs-and-trials/3, after the capstone —
 * every pre-existing level keeps its moduleId/order, so nothing needed
 * renumbering). Six levels: explicit collect (autoCollect OFF for the whole
 * world — power cells must be picked up on purpose), sensors + If, If/Else,
 * a two-bug DEBUGGING level, a HARD capstone, and a closing sense→decide→act
 * routine to reorder (synthesizing collect/sense/decide from the first
 * three). The "power cells" the copy talks about are grid "C" tiles — the
 * reskin is visual (lab theme), the legend never changes. Every recorded
 * grid solution here survives the REAL solutionRuns publish gate: regenerated
 * through server codegen, run on every variant, must PASS with 3 stars.
 */

type BlockCodingDraft = z.input<typeof blockCodingPayload>;
type DebuggingDraft = z.input<typeof debuggingPayload>;
type SequencingDraft = z.input<typeof sequencingPayload>;

const startWorkspace = {
  blocks: {
    languageVersion: 0,
    blocks: [
      {
        type: "bb_whenStart",
        id: "start",
        x: 24,
        y: 24,
        deletable: false,
        movable: false,
      },
    ],
  },
};

export const robotLab: WorldFixture = {
  slug: "robot-lab",
  name: { en: "Robot Lab", ar: "مختبر الروبوتات" },
  tagline: {
    en: "Machines that sense, decide, and act — taught by you.",
    ar: "آلات تستشعر وتقرّر وتتصرف — وأنت معلّمها.",
  },
  theme: "lab",
  horizon: false,
  modules: [
    {
      slug: "power-and-sensors",
      order: 1,
      name: { en: "Power & Sensors", ar: "الطاقة والمستشعرات" },
      description: {
        en: "In the lab, nothing happens by itself. Robots pick things up on purpose, check before they move, and choose between two plans.",
      },
      levels: [
        // ── Level 1 — POWER UP: explicit collect (autoCollect OFF) ────────
        {
          slug: "power-up",
          order: 1,
          activityType: "BLOCK_CODING",
          track: "PROGRAMMING",
          title: { en: "Power Up", ar: "شحن الطاقة" },
          story: {
            en: "Robo Bunny hops through the lab doors — and the lights are out. Two glowing power cells sit along the walkway to the charging dock. Out here in the lab, nothing gets picked up by hopping over it: a robot has to reach down and GRAB.",
          },
          objective: {
            en: "Use the new Collect block to pick up items deliberately, discovering that in Robot Lab nothing is collected automatically.",
          },
          instructions: {
            en: "Walk the lab corridor to the charging dock and pick up BOTH power cells on the way. New rule: hopping onto a cell isn't enough anymore — you must use the Collect block while standing on it.",
          },
          explanation: {
            en: "Welcome to precise mode! In the meadow, carrots jumped into Robo Bunny's paws. Lab robots don't work like that — every single action must be an instruction, even picking something up. That's how real robots are programmed: nothing is assumed, everything is stated. Move Forward changes where you are; Collect acts on the spot where you're standing. Try pressing Collect on an empty tile sometime — the robot just shrugs. No harm done, but no cell either.",
          },
          teacherNotes: {
            en: "The rule change from Worlds 1–2 (auto-collect off) is the whole lesson — say it out loud before anyone runs. Expect PARTIAL results from students who walk the corridor without collecting; the feedback message names how many cells were missed. Challenge extension: what happens if you Collect twice on the same cell? Predict, then try.",
          },
          difficulty: "MEDIUM",
          recommendedGradeMin: 4,
          recommendedGradeMax: 7,
          estimatedMinutes: 6,
          xpReward: 60,
          tags: ["robot", "sequencing"],
          requires: [],
          hints: [
            {
              tier: 1,
              text: {
                en: "Something is different in the lab: Robo Bunny hopped right over a power cell and nothing happened. What new block just appeared in the toolbox?",
              },
            },
            {
              tier: 2,
              text: {
                en: "The Collect block grabs whatever is on the tile Robo Bunny is STANDING on. Stop on a cell, then collect.",
              },
            },
            {
              tier: 3,
              text: {
                en: "Hop onto the first cell, Collect, then keep hopping to the second cell and Collect again before finishing at the dock.",
              },
            },
            {
              tier: 4,
              text: {
                en: "Move, Collect, Move, Move, Collect, Move — grab each cell while standing on it, and end on the charging dock.",
              },
            },
          ],
          payload: {
            toolbox: [{ type: "bb_moveForward" }, { type: "bb_collect" }],
            variants: [
              {
                rows: ["......", ".C.CG."],
                start: { x: 0, y: 1, dir: "E" },
              },
            ],
            // Robot Lab adjudication: explicit collect everywhere in W3.
            autoCollect: false,
            nonFatalBumps: false,
            checks: [
              { id: "reachedGoal", severity: "core" },
              { id: "collectedAll", severity: "secondary", params: { item: "powerCell" } },
              { id: "maxBlocks", severity: "quality", params: { count: 6 } },
            ],
            starCriteria: { threeStarMaxBlocks: 6 },
            startWorkspace,
            solution: {
              blocks: {
                languageVersion: 0,
                blocks: [
                  {
                    type: "bb_whenStart",
                    id: "start",
                    x: 24,
                    y: 24,
                    next: {
                      block: {
                        type: "bb_moveForward",
                        id: "m1",
                        next: {
                          block: {
                            type: "bb_collect",
                            id: "c1",
                            next: {
                              block: {
                                type: "bb_moveForward",
                                id: "m2",
                                next: {
                                  block: {
                                    type: "bb_moveForward",
                                    id: "m3",
                                    next: {
                                      block: {
                                        type: "bb_collect",
                                        id: "c2",
                                        next: {
                                          block: {
                                            type: "bb_moveForward",
                                            id: "m4",
                                          },
                                        },
                                      },
                                    },
                                  },
                                },
                              },
                            },
                          },
                        },
                      },
                    },
                  },
                ],
              },
            },
          } satisfies BlockCodingDraft,
        },

        // ── Level 2 — SENSOR CHECK: If + pathAhead, 2 variants ────────────
        {
          slug: "sensor-check",
          order: 2,
          activityType: "BLOCK_CODING",
          track: "PROGRAMMING",
          title: { en: "Sensor Check", ar: "فحص المستشعر" },
          story: {
            en: "The lab's delivery hall re-arranges itself overnight — sometimes the corridor runs straight to the docking bay, sometimes a supply crate blocks the way and the bay is through a side hatch. Robo Bunny's new sensor can feel what's ahead before moving. Time to trust it.",
          },
          objective: {
            en: "Write one sensor-driven program that reaches the docking bay on two different hall layouts by checking the path before committing.",
          },
          instructions: {
            en: "The hall has two layouts, and your ONE program must dock on BOTH. Walk to the junction, then use If with the path-ahead sensor: if a crate blocks the way, turn toward the side hatch. Run both layouts before you finish.",
          },
          explanation: {
            en: "Sense, THEN act — that's the robot way. Your program didn't know which hall it would get, and it didn't need to: the sensor asked 'is the path blocked?' at exactly the right moment, and the If block acted on the answer. This is how real robots survive the real world — vacuum robots feel for walls, delivery robots check crossings, rovers on Mars test the ground before rolling. None of them memorize the route. They check.",
          },
          teacherNotes: {
            en: "Same teaching device as Choose the Path, now in robot clothing: insist students run BOTH variants before submitting. Common bug: placing the If before reaching the junction, so the sensor checks the wrong tile. The playback thought bubble shows what the sensor answered at each check. Challenge extension: what would the program do in a hall where BOTH ways are open? Which door wins, and why?",
          },
          difficulty: "MEDIUM",
          recommendedGradeMin: 4,
          recommendedGradeMax: 7,
          estimatedMinutes: 8,
          xpReward: 70,
          tags: ["robot", "logic", "sensors"],
          requires: [],
          hints: [
            {
              tier: 1,
              text: {
                en: "The crate is in a different place on each layout, so a fixed route can't win both. Which block lets Robo Bunny ASK about the path before moving?",
              },
            },
            {
              tier: 2,
              text: {
                en: "Hop to the junction first — two Move Forwards. THEN check: is the path ahead blocked?",
              },
            },
            {
              tier: 3,
              text: {
                en: "At the junction: If the path ahead is blocked, Turn Right toward the side hatch. If it isn't, the If does nothing and straight ahead is correct.",
              },
            },
            {
              tier: 4,
              text: {
                en: "Move, Move, If path ahead is blocked { Turn Right }, Move. On the open hall the If stays quiet; on the blocked hall it turns Robo Bunny to the hatch. One more hop docks it — either way.",
              },
            },
          ],
          payload: {
            toolbox: [
              { type: "bb_moveForward" },
              { type: "bb_turnLeft" },
              { type: "bb_turnRight" },
              { type: "bb_if" },
              { type: "bb_pathAhead" },
            ],
            // Layout A: straight corridor to the bay. Layout B: crate ahead,
            // bay through the south hatch. One program must dock on both.
            variants: [
              {
                rows: ["####", "...G", "####"],
                start: { x: 0, y: 1, dir: "E" },
              },
              {
                rows: ["####", "...#", "..G#"],
                start: { x: 0, y: 1, dir: "E" },
              },
            ],
            autoCollect: false,
            nonFatalBumps: false,
            checks: [
              { id: "reachedGoal", severity: "core" },
              { id: "usedBlock", severity: "secondary", params: { block: "bb_if" } },
              { id: "maxBlocks", severity: "quality", params: { count: 5 } },
            ],
            starCriteria: { threeStarMaxBlocks: 5 },
            startWorkspace,
            solution: {
              blocks: {
                languageVersion: 0,
                blocks: [
                  {
                    type: "bb_whenStart",
                    id: "start",
                    x: 24,
                    y: 24,
                    next: {
                      block: {
                        type: "bb_moveForward",
                        id: "m1",
                        next: {
                          block: {
                            type: "bb_moveForward",
                            id: "m2",
                            next: {
                              block: {
                                type: "bb_if",
                                id: "if1",
                                inputs: {
                                  CONDITION: {
                                    block: { type: "bb_pathAhead", id: "s1" },
                                  },
                                  DO: {
                                    block: { type: "bb_turnRight", id: "t1" },
                                  },
                                },
                                next: {
                                  block: { type: "bb_moveForward", id: "m3" },
                                },
                              },
                            },
                          },
                        },
                      },
                    },
                  },
                ],
              },
            },
          } satisfies BlockCodingDraft,
        },

        // ── Level 3 — SMART TURNS: If/Else, 2 variants ────────────────────
        {
          slug: "smart-turns",
          order: 3,
          activityType: "BLOCK_CODING",
          track: "PROGRAMMING",
          title: { en: "Smart Turns", ar: "انعطافات ذكية" },
          story: {
            en: "Deeper in the lab, the maintenance tunnel ends at a T-junction. The charging dock is up one arm — but which one changes with the lab's nightly shuffle. The maintenance manual is short and confident: 'Blocked to the east? Dock is south. Clear to the east? Dock is north. There is no third option.'",
          },
          objective: {
            en: "Use If/Else to choose between two actions — one for each answer the sensor can give — and solve both junction layouts with one program.",
          },
          instructions: {
            en: "At the junction, the sensor's answer decides EVERYTHING: blocked means turn right toward the south dock, clear means turn left toward the north dock. Use the If/Else block so BOTH answers have a plan — and dock on both layouts with one program.",
          },
          explanation: {
            en: "If/Else is If with a backup plan. A plain If says 'when this is true, do something (otherwise, skip me)'. If/Else says 'when this is true do PLAN A — and when it's not, do PLAN B'. Every run picks exactly one of the two branches, never both, never neither. Programmers reach for If/Else whenever every answer needs its own action: game won or game lost, password right or wrong, path blocked or clear. Your robot now has a plan for both worlds it might wake up in.",
          },
          teacherNotes: {
            en: "Contrast with Sensor Check on the board: If has one branch and an invisible 'do nothing' case; If/Else makes both cases explicit. Ask the class which levels COULD be solved with plain If plus clever geometry — this one cannot, because both answers demand a different turn. Challenge extension: swap the two branches AND flip which turn goes where — does it still work? Why?",
          },
          difficulty: "MEDIUM",
          recommendedGradeMin: 4,
          recommendedGradeMax: 7,
          estimatedMinutes: 10,
          xpReward: 75,
          tags: ["robot", "logic", "conditionals"],
          requires: [],
          hints: [
            {
              tier: 1,
              text: {
                en: "This junction has no 'just keep going' option — Robo Bunny must turn left OR right every time. Which block gives you a plan for BOTH answers?",
              },
            },
            {
              tier: 2,
              text: {
                en: "Read the manual again: blocked east means the dock is SOUTH, clear east means the dock is NORTH. That's one turn for each answer.",
              },
            },
            {
              tier: 3,
              text: {
                en: "Hop twice to the junction. Then: If path ahead is blocked { Turn Right } Else { Turn Left }. After the turn, the dock is two hops away.",
              },
            },
            {
              tier: 4,
              text: {
                en: "Move, Move, If path ahead is blocked { Turn Right } Else { Turn Left }, Move, Move. The If/Else picks the correct arm on every layout, and the same two hops finish the job.",
              },
            },
          ],
          payload: {
            toolbox: [
              { type: "bb_moveForward" },
              { type: "bb_turnLeft" },
              { type: "bb_turnRight" },
              { type: "bb_ifElse" },
              { type: "bb_pathAhead" },
            ],
            // Layout A: east arm walled — turn right, dock south. Layout B:
            // east arm open (a decoy dead end) — turn left, dock north.
            variants: [
              {
                rows: ["#####", "...##", "##.##", "##G##"],
                start: { x: 0, y: 1, dir: "E" },
              },
              {
                rows: ["##G##", "##.##", ".....", "#####"],
                start: { x: 0, y: 2, dir: "E" },
              },
            ],
            autoCollect: false,
            nonFatalBumps: false,
            checks: [
              { id: "reachedGoal", severity: "core" },
              { id: "usedBlock", severity: "secondary", params: { block: "bb_ifElse" } },
              { id: "maxBlocks", severity: "quality", params: { count: 7 } },
            ],
            starCriteria: { threeStarMaxBlocks: 7 },
            startWorkspace,
            solution: {
              blocks: {
                languageVersion: 0,
                blocks: [
                  {
                    type: "bb_whenStart",
                    id: "start",
                    x: 24,
                    y: 24,
                    next: {
                      block: {
                        type: "bb_moveForward",
                        id: "m1",
                        next: {
                          block: {
                            type: "bb_moveForward",
                            id: "m2",
                            next: {
                              block: {
                                type: "bb_ifElse",
                                id: "if1",
                                inputs: {
                                  CONDITION: {
                                    block: { type: "bb_pathAhead", id: "s1" },
                                  },
                                  DO: {
                                    block: { type: "bb_turnRight", id: "t1" },
                                  },
                                  ELSE: {
                                    block: { type: "bb_turnLeft", id: "t2" },
                                  },
                                },
                                next: {
                                  block: {
                                    type: "bb_moveForward",
                                    id: "m3",
                                    next: {
                                      block: { type: "bb_moveForward", id: "m4" },
                                    },
                                  },
                                },
                              },
                            },
                          },
                        },
                      },
                    },
                  },
                ],
              },
            },
          } satisfies BlockCodingDraft,
        },
      ],
    },
    {
      slug: "repairs-and-trials",
      order: 2,
      name: { en: "Repairs & Trials", ar: "الإصلاح والتحدي" },
      description: {
        en: "Real engineers spend half their time fixing programs — theirs and other people's. Learn to read the clues, then face the lab's final trial.",
      },
      levels: [
        // ── Level 4 — BROKEN BOT: DEBUGGING with a 2-bug program ──────────
        {
          slug: "broken-bot",
          order: 1,
          activityType: "DEBUGGING",
          track: "PROGRAMMING",
          title: { en: "Broken Bot", ar: "الروبوت المعطّل" },
          story: {
            en: "Disaster in bay 4! The night-shift robot uploaded its own delivery program… and crashed straight into the lab wall. The program is still loaded — hops, turns, the lot — but somewhere in there are TWO mistakes. The lab needs a debugger, and Robo Bunny knows just the bunny.",
          },
          objective: {
            en: "Repair a broken program by running it, reading the located failure message, and fixing two distinct bugs — a wrong turn and a missing collect.",
          },
          instructions: {
            en: "Don't build from scratch — the broken program is already on your workspace. Run it AS IS first and watch where it goes wrong: the failure message tells you the exact step. Fix the program so the robot grabs the power cell AND parks at the charging dock. There are two bugs.",
          },
          explanation: {
            en: "You just debugged a real program, the way professionals do it: run it, read the clue, fix ONE thing, run again. The crash message named the exact step that hit the wall — that pointed you at the wrong turn. But fixing the crash wasn't the end: the run report then said a power cell was still missing, and that's a different kind of bug. A program can be crash-free and still not do its whole job. Debuggers fix the loud bug first, then re-run and listen for the quiet one.",
          },
          teacherNotes: {
            en: "The two bugs are deliberately different species: the wrong turn CRASHES (loud, located, step-numbered), the missing Collect merely leaves the job unfinished (quiet, PARTIAL verdict). Let students discover the second bug by re-running after the first fix — do not reveal there are two upfront beyond what the instructions say. Vocabulary to land: 'bug' and 'debugging'. Challenge extension: can the repaired program be rearranged to collect the cell on the way back instead? Why not, here?",
          },
          difficulty: "MEDIUM",
          recommendedGradeMin: 4,
          recommendedGradeMax: 7,
          estimatedMinutes: 10,
          xpReward: 85,
          tags: ["robot", "debugging"],
          requires: [],
          hints: [
            {
              tier: 1,
              text: {
                en: "Run the broken program exactly as it is and read the message. Which step crashed? Find that block in the program.",
              },
            },
            {
              tier: 2,
              text: {
                en: "The crash happens right after a turn. Watch the robot's ears at that moment — is it turning toward the dock, or away from it?",
              },
            },
            {
              tier: 3,
              text: {
                en: "Change Turn Right to Turn Left and run again. Better! But the report says a power cell is still sitting there. Where does the robot stand on the cell — and what block is missing there?",
              },
            },
            {
              tier: 4,
              text: {
                en: "Two fixes: swap the Turn Right for a Turn Left, and add a Collect right after the first Move — that's when the robot is standing on the cell. Move, Collect, Move, Turn Left, Move.",
              },
            },
          ],
          payload: {
            toolbox: [
              { type: "bb_moveForward" },
              { type: "bb_turnLeft" },
              { type: "bb_turnRight" },
              { type: "bb_collect" },
            ],
            variants: [
              {
                rows: ["..G.", ".C.."],
                start: { x: 0, y: 1, dir: "E" },
              },
            ],
            autoCollect: false,
            nonFatalBumps: false,
            checks: [
              { id: "reachedGoal", severity: "core" },
              { id: "collectedAll", severity: "secondary", params: { item: "powerCell" } },
              { id: "maxBlocks", severity: "quality", params: { count: 5 } },
            ],
            starCriteria: { threeStarMaxBlocks: 5 },
            // Bug 1: Turn Right (should be Turn Left) — crashes off the grid
            // at step 4. Bug 2: no Collect — the cell at (1,1) is never taken.
            brokenWorkspace: {
              blocks: {
                languageVersion: 0,
                blocks: [
                  {
                    type: "bb_whenStart",
                    id: "start",
                    x: 24,
                    y: 24,
                    deletable: false,
                    movable: false,
                    next: {
                      block: {
                        type: "bb_moveForward",
                        id: "m1",
                        next: {
                          block: {
                            type: "bb_moveForward",
                            id: "m2",
                            next: {
                              block: {
                                type: "bb_turnRight",
                                id: "t1",
                                next: {
                                  block: { type: "bb_moveForward", id: "m3" },
                                },
                              },
                            },
                          },
                        },
                      },
                    },
                  },
                ],
              },
            },
            solution: {
              blocks: {
                languageVersion: 0,
                blocks: [
                  {
                    type: "bb_whenStart",
                    id: "start",
                    x: 24,
                    y: 24,
                    next: {
                      block: {
                        type: "bb_moveForward",
                        id: "m1",
                        next: {
                          block: {
                            type: "bb_collect",
                            id: "c1",
                            next: {
                              block: {
                                type: "bb_moveForward",
                                id: "m2",
                                next: {
                                  block: {
                                    type: "bb_turnLeft",
                                    id: "t1",
                                    next: {
                                      block: { type: "bb_moveForward", id: "m3" },
                                    },
                                  },
                                },
                              },
                            },
                          },
                        },
                      },
                    },
                  },
                ],
              },
            },
          } satisfies DebuggingDraft,
        },

        // ── Level 5 — LAB GAUNTLET: capstone (loop + ifElse + collect) ────
        {
          slug: "lab-gauntlet",
          order: 2,
          activityType: "BLOCK_CODING",
          track: "PROGRAMMING",
          title: { en: "Lab Gauntlet", ar: "تحدي المختبر" },
          story: {
            en: "The lab's proving ground: a winding test track sown with power cells, rebuilt differently for every trial. No map is handed out. The plaque over the entrance reads: 'A great robot does not know the track. It knows what to do at every wall — and it leaves no cell behind.'",
          },
          objective: {
            en: "Combine a goal-controlled loop, an If/Else decision and explicit collection into one small program that clears two unknown test tracks completely.",
          },
          instructions: {
            en: "Reach the charging dock at the end of the gauntlet and collect EVERY power cell on the way — with ONE program that beats BOTH tracks. Think like the plaque: at every step, either the way is blocked (turn!) or it's open (advance — and grab whatever you land on).",
          },
          explanation: {
            en: "Five blocks. Two tracks it had never seen. Zero cells left behind. Your loop asked one question every single step — blocked or open? — and had exactly one answer for each: turn, or advance-and-collect. That tiny decision, repeated until the dock, is a full navigation strategy; robotics engineers literally call it wall-following. Notice what you did NOT do: you never counted hops, never memorized a track. You taught the robot judgment instead of directions — and judgment travels.",
          },
          teacherNotes: {
            en: "Capstone and demo piece. Students who unroll 20+ blocks can pass on one track but will almost never beat BOTH — the second variant is the honest examiner, and 'why does your long program fail track B?' is the best discussion this world offers. The Collect-on-every-tile trick (collecting on empty floor does nothing) surprises students who expect an error — that tolerance is worth naming. Watch the playback thought bubbles during the corner checks. Challenge extension: predict the robot's total hop count on each track BEFORE running; closest guess wins.",
          },
          difficulty: "HARD",
          recommendedGradeMin: 5,
          recommendedGradeMax: 7,
          estimatedMinutes: 15,
          xpReward: 100,
          tags: ["robot", "logic", "loops"],
          requires: [],
          hints: [
            {
              tier: 1,
              text: {
                en: "The plaque is the program: at every wall do one thing, everywhere else do another — until the dock. Which loop runs until the goal? Which block chooses between two actions?",
              },
            },
            {
              tier: 2,
              text: {
                en: "Build one loop that repeats until the goal. Inside it, every step is a choice: path blocked → turn right; path open → move forward. Where does Collect fit so no cell is ever missed?",
              },
            },
            {
              tier: 3,
              text: {
                en: "Repeat Until I Reach the Goal { If path ahead is blocked { Turn Right } Else { Move Forward, … } }. Collect right after every Move — collecting on an empty tile is harmless, and a cell can never be skipped.",
              },
            },
            {
              tier: 4,
              text: {
                en: "The whole program: Repeat Until I Reach the Goal { If path ahead is blocked { Turn Right } Else { Move Forward, Collect } }. Turn at every wall, grab at every step — five blocks that clear any track the lab can build.",
              },
            },
          ],
          payload: {
            toolbox: [
              { type: "bb_moveForward" },
              { type: "bb_turnLeft" },
              { type: "bb_turnRight" },
              { type: "bb_collect" },
              { type: "bb_repeat" },
              { type: "bb_repeatUntilGoal" },
              { type: "bb_if" },
              { type: "bb_ifElse" },
              { type: "bb_pathAhead" },
            ],
            // Two clockwise wall-terminated tracks (every straight run ends
            // at a wall or the grid edge, all turns are right turns), cells
            // placed on the running line. Variant B winds one ring tighter.
            variants: [
              {
                rows: [".....C", "#####.", ".C.G#.", ".####.", "..C..."],
                start: { x: 0, y: 0, dir: "E" },
              },
              {
                rows: ["....C", "####.", ".CG#.", ".###C", ".###.", "....."],
                start: { x: 0, y: 0, dir: "E" },
              },
            ],
            autoCollect: false,
            nonFatalBumps: false,
            checks: [
              { id: "reachedGoal", severity: "core" },
              { id: "collectedAll", severity: "secondary", params: { item: "powerCell" } },
              {
                id: "usedBlock",
                severity: "secondary",
                params: { block: "bb_repeatUntilGoal" },
              },
              { id: "maxBlocks", severity: "quality", params: { count: 5 } },
            ],
            starCriteria: { threeStarMaxBlocks: 5 },
            startWorkspace,
            solution: {
              blocks: {
                languageVersion: 0,
                blocks: [
                  {
                    type: "bb_whenStart",
                    id: "start",
                    x: 24,
                    y: 24,
                    next: {
                      block: {
                        type: "bb_repeatUntilGoal",
                        id: "r1",
                        inputs: {
                          DO: {
                            block: {
                              type: "bb_ifElse",
                              id: "if1",
                              inputs: {
                                CONDITION: {
                                  block: { type: "bb_pathAhead", id: "s1" },
                                },
                                DO: {
                                  block: { type: "bb_turnRight", id: "t1" },
                                },
                                ELSE: {
                                  block: {
                                    type: "bb_moveForward",
                                    id: "m1",
                                    next: {
                                      block: { type: "bb_collect", id: "c1" },
                                    },
                                  },
                                },
                              },
                            },
                          },
                        },
                      },
                    },
                  },
                ],
              },
            },
          } satisfies BlockCodingDraft,
        },

        // ── SENSOR SEQUENCE — SEQUENCING, closes out Robot Lab ────────────
        // Appended after the capstone rather than mid-power-and-sensors: no
        // existing level's moduleId/order moves, so nothing needed
        // renumbering (@@unique([moduleId, order]) stays untouched for every
        // pre-existing level).
        {
          slug: "sensor-sequence",
          order: 3,
          activityType: "SEQUENCING",
          track: "PROGRAMMING",
          title: { en: "Sensor Sequence", ar: "تسلسل الاستشعار" },
          story: {
            en: "The gauntlet is cleared, the dock is charged — and pinned to the charging bay door is the lab's maintenance manual for the very first docking routine you ever ran here. It fell off its clipboard months ago; the pages scattered, and nobody's fixed it since. One last job before graduation: put it back together.",
          },
          objective: {
            en: "Reconstruct the correct step order of a sense → decide → act → collect docking routine, synthesizing the collect, sensor-check and if/else lessons from this lab.",
          },
          instructions: {
            en: "Drag the steps into the right order — or use the up/down buttons on each step. The routine only works one way: think about what Robo Bunny needs to know or do BEFORE each later step makes sense.",
          },
          explanation: {
            en: "Sense, then decide, then act, then collect — that order isn't arbitrary, it's the actual shape of every routine you've built in this lab. You can't decide which way to turn before you've asked the sensor a question, and you can't collect a power cell before you've moved onto its tile. Real robots (and real programs) run their instructions in exactly the order they're written — reordering steps out of sequence is one of the most common bugs there is, and now you know what it looks like from both directions: writing it, and rebuilding it. Robot Lab: complete. The Data Desert is already shimmering on the horizon.",
          },
          teacherNotes: {
            en: "This level runs no code and touches no grid — it's a pure sequencing/synthesis check, placed as the lab's closing checkpoint so students reconstruct the pattern from memory (collect from Power Up, sense+decide from Sensor Check and Smart Turns) rather than reading it fresh. If a group finishes fast, ask them to explain OUT LOUD why 'collect' can't come before 'move forward through the door' — the answer (the cell isn't on this tile yet) is the whole lesson. Challenge extension: ask students to invent one MORE valid step that could be inserted between two existing ones without breaking the routine (e.g., a second sensor check before turning back).",
          },
          difficulty: "MEDIUM",
          recommendedGradeMin: 4,
          recommendedGradeMax: 7,
          estimatedMinutes: 6,
          xpReward: 65,
          tags: ["robot", "logic", "sensors", "sequencing"],
          requires: [],
          hints: [
            {
              tier: 1,
              text: {
                en: "Ask yourself, for every step: what does Robo Bunny need to already know or already be standing on before this step makes sense?",
              },
            },
            {
              tier: 2,
              text: {
                en: "You already built this shape twice: Sensor Check and Smart Turns both sense the path BEFORE deciding which way to turn — never after.",
              },
            },
            {
              tier: 3,
              text: {
                en: "The routine ends the way Power Up taught you: Robo Bunny must be standing ON the power cell's tile before Collect does anything. Collect goes last.",
              },
            },
            {
              tier: 4,
              text: {
                en: "The full order: reach the junction, read the sensor, turn if it's blocked, move through the door, then collect. Sense before you decide; decide before you act; act before you collect.",
              },
            },
          ],
          payload: {
            prompt: {
              en: "Robo Bunny's docking routine lost its page numbers — put these five steps back in the right order.",
            },
            items: [
              {
                id: "approach",
                text: { en: "Move forward until Robo Bunny reaches the junction." },
              },
              {
                id: "sense",
                text: { en: "Read the path-ahead sensor to check for a blocked door." },
              },
              {
                id: "turn",
                text: { en: "If the sensor reports blocked, turn toward the open door." },
              },
              {
                id: "advance",
                text: { en: "Move forward through the door onto the next tile." },
              },
              {
                id: "collect",
                text: { en: "Use Collect to pick up whatever is waiting on that tile." },
              },
            ],
            correctOrder: ["approach", "sense", "turn", "advance", "collect"],
          } satisfies SequencingDraft,
        },
      ],
    },
  ],
};
