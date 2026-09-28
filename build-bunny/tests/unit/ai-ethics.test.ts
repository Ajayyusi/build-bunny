import { describe, expect, it } from "vitest";

import { restoreEthicsDraft } from "@/modules/activities/players/ethics-draft";
import { gradeAiEthics } from "@/modules/activities/server/ai-ethics";
import { aiEthicsStudentPayload } from "@/modules/activities/server/student-views";
import { aiEthicsPayload } from "@/modules/curriculum/schemas";
import type { LevelSnapshot } from "@/modules/curriculum/server/publish";
import { stripStudentPayload } from "@/modules/curriculum/server/queries";

import { bundle } from "../../content";

const levels = bundle.worlds.flatMap((w) => w.modules.flatMap((m) => m.levels));
const ethicsLevels = levels.filter((l) => l.activityType === "AI_ETHICS");
const level = (slug: string) => levels.find((l) => l.slug === slug)!;

const snapshotOf = (payload: unknown) => ({ activityType: "AI_ETHICS", payload }) as unknown as LevelSnapshot;
const story = {
  prompt: { en: "p" },
  scenes: [
    {
      id: "s1",
      text: { en: "one" },
      choices: [
        { id: "risky", text: { en: "r" }, outcome: { en: "o" }, safe: false },
        { id: "careful", text: { en: "c" }, outcome: { en: "o" }, safe: true },
        { id: "grownup", text: { en: "g" }, outcome: { en: "o" }, safe: true },
      ],
    },
    {
      id: "s2",
      text: { en: "two" },
      choices: [
        { id: "a", text: { en: "a" }, outcome: { en: "o" }, safe: true },
        { id: "b", text: { en: "b" }, outcome: { en: "o" }, safe: false },
      ],
    },
  ],
  takeaways: [{ en: "t1" }, { en: "t2" }],
};

describe("ethics grading: trying another choice", () => {
  it("records earlier tries; the top star is for a safe FIRST instinct", () => {
    const retried = gradeAiEthics(snapshotOf(story), {
      path: [
        { sceneId: "s1", choiceId: "careful", tried: ["risky"] },
        { sceneId: "s2", choiceId: "a" },
      ],
    });
    expect(retried).toMatchObject({ verdict: "PASS", qualityPassed: false, summary: { allSafe: true, firstAllSafe: false, retries: 1 } });

    // Exploring after a safe first pick keeps the star.
    const explored = gradeAiEthics(snapshotOf(story), {
      path: [
        { sceneId: "s1", choiceId: "grownup", tried: ["careful", "risky"] },
        { sceneId: "s2", choiceId: "a" },
      ],
    });
    expect(explored).toMatchObject({ verdict: "PASS", qualityPassed: true, summary: { retries: 2 } });
  });

  it("refuses tries that aren't this scene's choices, or are listed twice", () => {
    const bad = (tried: string[]) =>
      gradeAiEthics(snapshotOf(story), { path: [{ sceneId: "s1", choiceId: "careful", tried }, { sceneId: "s2", choiceId: "a" }] }).verdict;
    expect(bad(["a"])).toBe("ERROR");
    expect(bad(["risky", "risky"])).toBe("ERROR");
    expect(bad(["risky"])).toBe("PASS");
    // Going back to a choice tried earlier is allowed.
    expect(bad(["careful", "risky"])).toBe("PASS");
  });
});

describe("ethics content", () => {
  it("every ethics level names its own checklist, in both languages", () => {
    expect(ethicsLevels.length).toBeGreaterThanOrEqual(7);
    const titles = new Set<string>();
    for (const l of ethicsLevels) {
      const p = aiEthicsPayload.parse(l.payload);
      expect(p.checklist?.title.en, l.slug).toBeTruthy();
      expect(p.checklist?.title.ar, l.slug).toBeTruthy();
      titles.add(p.checklist!.title.en);
    }
    // "Your Privacy Shield" used to head every one of them.
    expect(titles.size).toBe(ethicsLevels.length);
  });

  it("Is That Real? lets a child say there isn't enough evidence yet", () => {
    const p = aiEthicsPayload.parse(level("is-that-real").payload);
    const evidence = p.scenes.flatMap((s) => s.choices).filter((c) => /not enough evidence|can't tell yet/i.test(c.text.en));
    expect(evidence.length).toBeGreaterThanOrEqual(2);
    expect(evidence.every((c) => c.safe && c.text.ar)).toBe(true);
  });

  it("Who Decides? shows the machine's suggestion, reason and confidence, to approve, question or override", () => {
    const p = aiEthicsPayload.parse(level("who-decides").payload);
    for (const scene of p.scenes) {
      expect(scene.suggestion, scene.id).toBeDefined();
      expect(scene.suggestion!.reason.en && scene.suggestion!.reason.ar, scene.id).toBeTruthy();
      expect(scene.suggestion!.confidence).toBeGreaterThan(0);
      expect(scene.choices.map((c) => c.action).sort(), scene.id).toEqual(["approve", "askMore", "override"]);
      expect(scene.choices.some((c) => c.safe), scene.id).toBe(true);
    }
    // One scene is very sure AND wrong: confidence isn't correctness.
    expect(p.scenes.some((s) => s.suggestion!.confidence >= 0.9 && !s.choices.find((c) => c.action === "approve")!.safe)).toBe(true);
  });

  it("reaches the child with the suggestion, actions and checklist, but never the safe flags", () => {
    for (const l of ethicsLevels) {
      const student = aiEthicsStudentPayload.parse(stripStudentPayload("AI_ETHICS", aiEthicsPayload.parse(l.payload)));
      expect(JSON.stringify(student)).not.toContain('"safe"');
      expect(student.checklist?.title.en).toBeTruthy();
    }
    const whoDecides = aiEthicsStudentPayload.parse(stripStudentPayload("AI_ETHICS", aiEthicsPayload.parse(level("who-decides").payload)));
    expect(whoDecides.scenes[0]!.suggestion?.confidence).toBe(0.85);
    expect(whoDecides.scenes[0]!.choices[0]!.action).toBe("approve");
  });
});

describe("resuming an ethics story from its draft", () => {
  const scenes = [
    { id: "s1", choices: [{ id: "x", next: "s3" }, { id: "y" }] },
    { id: "s2", choices: [{ id: "z" }] },
    { id: "s3", choices: [{ id: "w" }] },
  ] as unknown as Parameters<typeof restoreEthicsDraft>[1]["scenes"];

  it("resumes on the scene the path really leads to, branches included", () => {
    expect(restoreEthicsDraft({ path: [{ sceneId: "s1", choiceId: "y" }] }, { scenes })).toEqual({
      sceneIndex: 1,
      path: [{ sceneId: "s1", choiceId: "y" }],
      finished: false,
    });
    // "x" branches straight to s3.
    expect(restoreEthicsDraft({ path: [{ sceneId: "s1", choiceId: "x" }] }, { scenes }).sceneIndex).toBe(2);
  });

  it("brings a finished story back finished, so it can still be saved", () => {
    const done = restoreEthicsDraft({ path: [{ sceneId: "s1", choiceId: "x" }, { sceneId: "s3", choiceId: "w" }] }, { scenes });
    expect(done.finished).toBe(true);
    expect(done.path).toHaveLength(2);
  });

  it("stops at the first step off the story, and keeps only real earlier tries", () => {
    const drifted = restoreEthicsDraft(
      { path: [{ sceneId: "s1", choiceId: "y", tried: ["x", "x", "nope", "y"] }, { sceneId: "s3", choiceId: "w" }] },
      { scenes },
    );
    expect(drifted).toEqual({ sceneIndex: 1, path: [{ sceneId: "s1", choiceId: "y", tried: ["x", "y"] }], finished: false });
    expect(restoreEthicsDraft("junk", { scenes })).toEqual({ sceneIndex: 0, path: [], finished: false });
  });
});

describe("say what you think first (the predict step)", () => {
  const withPredict = {
    ...story,
    scenes: [
      {
        ...story.scenes[0]!,
        predict: {
          question: { en: "Real?" },
          options: [
            { id: "real", text: { en: "Real" }, note: { en: "n" } },
            { id: "unsure", text: { en: "Not enough evidence" }, note: { en: "n" } },
          ],
        },
      },
      story.scenes[1]!,
    ],
  };

  it("records the verdict, which is never graded", () => {
    const graded = gradeAiEthics(snapshotOf(withPredict), {
      path: [
        { sceneId: "s1", choiceId: "careful", predicted: "real" },
        { sceneId: "s2", choiceId: "a" },
      ],
    });
    expect(graded).toMatchObject({ verdict: "PASS", qualityPassed: true, summary: { predictions: ["real"] } });
  });

  it("refuses a verdict the scene doesn't offer", () => {
    const path = (sceneId: string, predicted: string) => [
      { sceneId: "s1", choiceId: "careful", ...(sceneId === "s1" ? { predicted } : {}) },
      { sceneId: "s2", choiceId: "a", ...(sceneId === "s2" ? { predicted } : {}) },
    ];
    expect(gradeAiEthics(snapshotOf(withPredict), { path: path("s1", "fake") }).verdict).toBe("ERROR");
    // s2 asks nothing.
    expect(gradeAiEthics(snapshotOf(withPredict), { path: path("s2", "real") }).verdict).toBe("ERROR");
  });

  it("Is That Real? and Who Decides? ask for a verdict first, with a careful 'can't tell' answer", () => {
    for (const slug of ["is-that-real", "who-decides"]) {
      const p = aiEthicsPayload.parse(level(slug).payload);
      const asking = p.scenes.filter((s) => s.predict);
      expect(asking.length, slug).toBeGreaterThanOrEqual(3);
      for (const scene of asking) {
        expect(scene.predict!.options.some((o) => /not enough|can't tell/i.test(o.text.en)), scene.id).toBe(true);
        for (const o of scene.predict!.options) expect(o.note.en && o.note.ar && o.text.ar, `${scene.id}/${o.id}`).toBeTruthy();
      }
    }
  });
});

describe("one short explanation on every AI level", () => {
  it("every AI-route level has a one-sentence big idea in both languages", () => {
    const ai = levels.filter((l) => l.track !== "PROGRAMMING");
    expect(ai.length).toBeGreaterThanOrEqual(31);
    for (const l of ai) {
      for (const lang of ["en", "ar"] as const) {
        const text = l.keyIdea?.[lang] ?? "";
        expect(text.length, `${l.slug} ${lang}`).toBeGreaterThan(20);
        expect(text.length, `${l.slug} ${lang} is short`).toBeLessThanOrEqual(150);
        // One sentence: nothing ends a sentence before the last character.
        expect(/[.!?؟](\s|$)/.test(text.slice(0, -1).replace(/"[^"]*"|«[^»]*»/g, "")), `${l.slug} ${lang} is one sentence`).toBe(false);
      }
    }
  });
});

describe("going back to a choice tried earlier", () => {
  it("counts the real first instinct, and the top star needs a safe final choice too", () => {
    // risky first, then careful, then back to risky.
    const back = gradeAiEthics(snapshotOf(story), {
      path: [
        { sceneId: "s1", choiceId: "risky", tried: ["risky", "careful"] },
        { sceneId: "s2", choiceId: "a" },
      ],
    });
    expect(back).toMatchObject({ verdict: "PASS", qualityPassed: false, summary: { firstAllSafe: false, allSafe: false } });
    // careful first, explored risky, back to careful: still the star.
    const kept = gradeAiEthics(snapshotOf(story), {
      path: [
        { sceneId: "s1", choiceId: "careful", tried: ["careful", "risky"] },
        { sceneId: "s2", choiceId: "a" },
      ],
    });
    expect(kept.qualityPassed).toBe(true);
    // Safe first, but went on with the risky one: no top star.
    const drifted = gradeAiEthics(snapshotOf(story), {
      path: [
        { sceneId: "s1", choiceId: "risky", tried: ["careful"] },
        { sceneId: "s2", choiceId: "a" },
      ],
    });
    expect(drifted.qualityPassed).toBe(false);
  });
});
