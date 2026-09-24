// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { flushOutbox, pendingCount, postAttempt } from "@/modules/activities/players/shared/attempt-outbox";

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
});
