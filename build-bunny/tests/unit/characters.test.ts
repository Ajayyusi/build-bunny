import { describe, expect, it } from "vitest";

import { CAST, CHARACTER_IDS, lineKey } from "@/modules/characters/cast";
import { animationMs, CHARACTER_STATES, MOTION_MS, reactTo } from "@/modules/characters/states";

import en from "../../messages/en.json";
import ar from "../../messages/ar.json";

/**
 * The cast and its motion, against the handoff: one teaching job and short
 * repeatable lines per character; six states; a 2-4 s idle loop, 0.5-1 s
 * reactions, celebration under 2 s; feedback after a choice, then idle.
 */

const at = (messages: unknown, path: string) =>
  path.split(".").reduce<unknown>((node, key) => (node as Record<string, unknown> | undefined)?.[key], messages);

describe("the cast", () => {
  it("has the host and the three supporting characters, each with one job", () => {
    expect(CHARACTER_IDS).toEqual(["bunny", "ruli", "tessa", "noura"]);
    expect(Object.values(CAST).map((c) => c.job)).toEqual(["host", "rules", "testing", "fairness"]);
  });

  it("names, jobs and every line exist in English and Arabic, and lines stay short", () => {
    for (const id of CHARACTER_IDS) {
      for (const messages of [en, ar]) {
        expect(at(messages, `characters.${id}.name`), `${id} name`).toBeTypeOf("string");
        expect(at(messages, `characters.${id}.job`), `${id} job`).toBeTypeOf("string");
        for (const line of CAST[id].lines) {
          const text = at(messages, `characters.${lineKey(id, line)}`);
          expect(text, `${id}.${line}`).toBeTypeOf("string");
          // "Short repeatable lines": one sentence or two, never a lecture.
          expect((text as string).split(/\s+/).length, `${id}.${line} is short`).toBeLessThanOrEqual(14);
        }
      }
    }
  });

  it("the handoff's own lines are there", () => {
    expect(at(en, "characters.tessa.lines.newExample")).toBe("What happens on a new example?");
    expect(at(en, "characters.noura.lines.fairExamples")).toMatch(/Were our examples fair/);
  });

  it("a character can't say another character's line", () => {
    expect(() => lineKey("ruli", "newExample")).toThrow();
    expect(lineKey("tessa", "newExample")).toBe("tessa.lines.newExample");
  });

  it("art is the placeholder until production art is listed, state by state", () => {
    for (const id of CHARACTER_IDS) {
      for (const state of Object.keys(CAST[id].art)) expect(CHARACTER_STATES).toContain(state);
    }
  });
});

describe("states and the motion spec", () => {
  it("has exactly the six states", () => {
    expect(CHARACTER_STATES).toEqual(["idle", "listening", "thinking", "error", "hint", "celebration"]);
  });

  it("keeps every timing inside the spec", () => {
    expect(MOTION_MS.idleLoop).toBeGreaterThanOrEqual(2000);
    expect(MOTION_MS.idleLoop).toBeLessThanOrEqual(4000);
    for (const ms of [MOTION_MS.reaction, MOTION_MS.hint]) {
      expect(ms).toBeGreaterThanOrEqual(500);
      expect(ms).toBeLessThanOrEqual(1000);
    }
    expect(MOTION_MS.celebration).toBeLessThan(2000);
    for (const state of CHARACTER_STATES) {
      const ms = animationMs(state);
      if (state === "idle") expect(ms).toBe(MOTION_MS.idleLoop);
      else expect(ms).toBeLessThan(2000);
    }
  });

  it("reacts after a choice, then settles back to idle", () => {
    expect(reactTo("choice")).toEqual({ state: "listening", holdMs: MOTION_MS.reaction });
    expect(reactTo("wrong")).toEqual({ state: "error", holdMs: MOTION_MS.reaction });
    expect(reactTo("hint")).toEqual({ state: "hint", holdMs: MOTION_MS.hint });
    expect(reactTo("right")).toEqual({ state: "celebration", holdMs: MOTION_MS.celebration });
    // Thinking holds until the answer comes; nothing else loops.
    expect(reactTo("think").holdMs).toBeNull();
    expect(reactTo("settle")).toEqual({ state: "idle", holdMs: null });
  });
});
