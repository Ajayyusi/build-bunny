// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { flushOutbox, pendingCount, postAttempt, runIdFor } from "@/modules/activities/players/shared/attempt-outbox";

/**
 * The attempt outbox keeps a graded run on the device until the server has
 * answered, resends it when the connection returns, and never sends one
 * child's run under another child's session.
 */

const URL_A = "/api/levels/l1/attempts";
const body = (id: string) => JSON.stringify({ attemptRunId: id, workspaceJson: {} });
const init = (id: string) => ({ method: "POST", headers: { "Content-Type": "application/json" }, body: body(id) });

beforeEach(() => window.localStorage.clear());
afterEach(() => vi.unstubAllGlobals());

describe("attempt outbox", () => {
  it("removes a run once the server has answered", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 200 })));
    await postAttempt("kid-a", URL_A, init("r1"));
    expect(pendingCount("kid-a")).toBe(0);
  });

  it("keeps a run that never reached the server, and resends it later", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => {
      throw new TypeError("Failed to fetch");
    }));
    await expect(postAttempt("kid-a", URL_A, init("r2"))).rejects.toThrow();
    expect(pendingCount("kid-a")).toBe(1);

    const online = vi.fn(async () => new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", online);
    expect(await flushOutbox("kid-a")).toBe(1);
    expect(pendingCount("kid-a")).toBe(0);
    // Resent with the SAME run id — the server de-duplicates it.
    expect(JSON.parse((online.mock.calls[0] as unknown as [string, RequestInit])[1].body as string)).toMatchObject({
      attemptRunId: "r2",
    });
  });

  it("keeps a run the server could not take yet (5xx, 429), drops one it refused (4xx)", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 503 })));
    await postAttempt("kid-a", URL_A, init("r3"));
    vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 429 })));
    await postAttempt("kid-a", URL_A, init("r4"));
    expect(pendingCount("kid-a")).toBe(2);
    vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 403 })));
    expect(await flushOutbox("kid-a")).toBe(2);
    expect(pendingCount("kid-a")).toBe(0);
  });

  it("never sends one child's run under another child's session", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => {
      throw new TypeError("offline");
    }));
    await expect(postAttempt("kid-a", URL_A, init("r5"))).rejects.toThrow();
    const sent = vi.fn(async () => new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", sent);
    expect(await flushOutbox("kid-b")).toBe(0);
    expect(sent).not.toHaveBeenCalled();
    expect(pendingCount("kid-a")).toBe(1);
  });

  it("forgets runs older than a week", async () => {
    window.localStorage.setItem(
      "bb:outbox:v1",
      JSON.stringify({ old: { playerKey: "kid-a", url: URL_A, body: body("old"), queuedAt: Date.now() - 8 * 86_400_000 } }),
    );
    const sent = vi.fn(async () => new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", sent);
    await flushOutbox("kid-a");
    expect(sent).not.toHaveBeenCalled();
    expect(pendingCount("kid-a")).toBe(0);
  });

  it("never loses a run queued while a resend is waiting on the network", async () => {
    // r-old is queued (offline).
    vi.stubGlobal("fetch", vi.fn(async () => {
      throw new TypeError("Failed to fetch");
    }));
    await expect(postAttempt("kid-a", URL_A, init("r-old"))).rejects.toThrow();

    // The resend's request hangs until we release it…
    let release!: () => void;
    vi.stubGlobal("fetch", vi.fn(() => new Promise<Response>((resolve) => {
      release = () => resolve(new Response("{}", { status: 200 }));
    })));
    const flushing = flushOutbox("kid-a");
    await Promise.resolve();

    // …and meanwhile the child runs again, offline: r-new is queued.
    const hung = fetch;
    vi.stubGlobal("fetch", vi.fn(async () => {
      throw new TypeError("Failed to fetch");
    }));
    await expect(postAttempt("kid-a", URL_A, init("r-new"))).rejects.toThrow();
    vi.stubGlobal("fetch", hung);
    release();
    expect(await flushing).toBe(1);

    // r-old settled; r-new is still waiting on the device.
    expect(pendingCount("kid-a")).toBe(1);
    expect(Object.keys(JSON.parse(window.localStorage.getItem("bb:outbox:v1")!))).toEqual(["r-new"]);
  });

  it("keeps runs on an expired session (401) or when sent under another child (412)", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 401 })));
    await postAttempt("kid-a", URL_A, init("r-401"));
    vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 412 })));
    await postAttempt("kid-a", URL_A, init("r-412"));
    expect(pendingCount("kid-a")).toBe(2);
  });

  it("names the child who made the run on every send", async () => {
    const spy = vi.fn(async () => new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", spy);
    await postAttempt("kid-a", URL_A, init("r-h"));
    const sent = (spy.mock.calls[0] as unknown as [string, RequestInit])[1];
    expect(new Headers(sent.headers).get("X-BB-Player")).toBe("kid-a");
  });

  it("reuses the run id after a failed save while the answer is unchanged", () => {
    const failed = { id: "run-1", saveFailed: true, answer: { optionId: "a" } };
    expect(runIdFor(failed, { optionId: "a" })).toBe("run-1");
    expect(runIdFor(failed, { optionId: "b" })).not.toBe("run-1");
    expect(runIdFor({ ...failed, saveFailed: false }, { optionId: "a" })).not.toBe("run-1");
    expect(runIdFor(null, { optionId: "a" })).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("two sends of the same run at once share one request and its answer", async () => {
    const spy = vi.fn(async () => new Response(JSON.stringify({ xpAwarded: 30 }), { status: 200 }));
    vi.stubGlobal("fetch", spy);
    const [a, b] = await Promise.all([
      postAttempt("kid-a", URL_A, init("r-same")),
      postAttempt("kid-a", URL_A, init("r-same")),
    ]);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(await a.json()).toEqual({ xpAwarded: 30 });
    expect(await b.json()).toEqual({ xpAwarded: 30 });
    expect(pendingCount("kid-a")).toBe(0);
  });
});
