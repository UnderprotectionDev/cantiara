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
      githubAvailability: {
        getStatus: () => "waiting",
      },
      session: {
        session: { id: "current-session" },
        user: { id: "account-1" },
      } as Context["session"],
    } satisfies Context;
    const client = createRouterClient(appRouter, { context });

    await expect(client.githubAvailability()).resolves.toEqual({
      status: "waiting",
    });
    await expect(client.sessions()).resolves.toEqual([
      expect.objectContaining({ current: true, id: "current-session" }),
    ]);
    await client.revokeSession({ sessionId: "other-session" });
    await client.revokeOtherSessions();

    expect(revoked).toEqual(["other-session"]);
    expect(revokeOtherCalls).toBe(1);
  });

  test("starts and consumes an operation-bound Confirm GitHub Identity grant", async () => {
    const calls: unknown[] = [];
    const context = {
      accountAccess: {
        listSessions: async () => [],
        revokeOtherSessions: async () => undefined,
        revokeSession: async () => undefined,
      },
      auth: null,
      clientKey: "198.51.100.10",
      db: {} as Context["db"],
      githubAvailability: {
        getStatus: () => "available" as const,
      },
      githubIdentityConfirmation: {
        exchange: (principal, handoffCode, clientKey) => {
          calls.push({ clientKey, handoffCode, principal });
          return Promise.resolve("G".repeat(43));
        },
        start: (principal, operationId, clientKey) => {
          calls.push({ clientKey, operationId, principal });
          return Promise.resolve({
            authorizationUrl: "https://github.example/confirm",
          });
        },
        consume: (principal, operationId, grant, clientKey) => {
          calls.push({ clientKey, grant, operationId, principal });
          return Promise.resolve(true);
        },
      },
      session: {
        session: { id: "current-session" },
        user: { id: "account-1" },
      } as Context["session"],
    } satisfies Context;
    const client = createRouterClient(appRouter, { context });

    await expect(
      client.startGitHubIdentityConfirmation({
        operationId: "account-closure-start",
      }),
    ).resolves.toEqual({
      authorizationUrl: "https://github.example/confirm",
    });
    await expect(
      client.consumeGitHubIdentityGrant({
        grant: "G".repeat(43),
        operationId: "account-closure-start",
      }),
    ).resolves.toEqual({ consumed: true });
    await expect(
      client.exchangeGitHubIdentityHandoff({ code: "H".repeat(43) }),
    ).resolves.toEqual({ grant: "G".repeat(43) });

    expect(calls).toEqual([
      {
        clientKey: "198.51.100.10",
        operationId: "account-closure-start",
        principal: { accountId: "account-1", sessionId: "current-session" },
      },
      {
        clientKey: "198.51.100.10",
        grant: "G".repeat(43),
        operationId: "account-closure-start",
        principal: { accountId: "account-1", sessionId: "current-session" },
      },
      {
        clientKey: "198.51.100.10",
        handoffCode: "H".repeat(43),
        principal: { accountId: "account-1", sessionId: "current-session" },
      },
    ]);
  });
});
