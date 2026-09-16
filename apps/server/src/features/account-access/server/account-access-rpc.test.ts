import type { Context } from "@cantiara/api/context";
import { appRouter } from "@cantiara/api/routers/index";
import { createRouterClient } from "@orpc/server";
import { describe, expect, test } from "vitest";

describe("Account Access RPC", () => {
  test("lists and revokes sessions through the authenticated public interface", async () => {
    const revoked: string[] = [];
    let revokeOtherCalls = 0;
    const context = {
      accountAccess: {
        listSessions: async () => [
          {
            current: true,
            device: "Test browser",
            id: "current-session",
            lastActivityAt: "2026-09-16T09:00:00.000Z",
          },
        ],
        revokeOtherSessions: () => {
          revokeOtherCalls += 1;
          return Promise.resolve();
        },
        revokeSession: (_principal, sessionId) => {
          revoked.push(sessionId);
          return Promise.resolve();
        },
      },
      auth: null,
      db: {} as Context["db"],
      session: {
        session: { id: "current-session" },
        user: { id: "account-1" },
      } as Context["session"],
    } satisfies Context;
    const client = createRouterClient(appRouter, { context });

    await expect(client.sessions()).resolves.toEqual([
      expect.objectContaining({ current: true, id: "current-session" }),
    ]);
    await client.revokeSession({ sessionId: "other-session" });
    await client.revokeOtherSessions();

    expect(revoked).toEqual(["other-session"]);
    expect(revokeOtherCalls).toBe(1);
  });
});
