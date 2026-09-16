import { describe, expect, test } from "vitest";

import type { AppDependencies } from "./app";
import { createApp } from "./app";

const staleSession = {
  session: { id: "stale-session" },
  user: { id: "account-1" },
};

function createTestApp() {
  let handlerCalls = 0;
  let replayCalls = 0;
  const dependencies: AppDependencies = {
    accountSessionAccess: {
      authorizeWrite: async () => false,
      listSessions: async () => [],
      replaySessionRevocations: () => {
        replayCalls += 1;
        return Promise.resolve();
      },
      revokeOtherSessions: async () => undefined,
      revokeSession: async () => undefined,
    },
    auth: {
      api: {
        getSession: async () => staleSession,
      },
      handler: () => {
        handlerCalls += 1;
        return Promise.resolve(Response.json({ status: true }));
      },
    } as unknown as AppDependencies["auth"],
    corsOrigin: "https://cantiara.example",
    database: {} as AppDependencies["database"],
    desktopOrigins: [],
    nodeEnv: "test",
    redactSecrets: (value) => value,
  };

  return {
    app: createApp(dependencies),
    getHandlerCalls: () => handlerCalls,
    getReplayCalls: () => replayCalls,
  };
}

describe("server app Account Access boundary", () => {
  test("allows public GitHub sign-in to recover from a stale revoked cookie", async () => {
    const { app, getHandlerCalls } = createTestApp();

    const response = await app.fetch(
      new Request("https://api.cantiara.example/api/auth/sign-in/social", {
        body: JSON.stringify({
          callbackURL: "https://cantiara.example/dashboard",
          provider: "github",
        }),
        headers: {
          cookie: "__Secure-better-auth.session_token=stale-token",
          "content-type": "application/json",
          origin: "https://cantiara.example",
        },
        method: "POST",
      }),
    );

    expect(response.status).toBe(200);
    expect(getHandlerCalls()).toBe(1);
  });

  test("allows sign-out to clear a stale revoked cookie", async () => {
    const { app, getHandlerCalls } = createTestApp();

    const response = await app.fetch(
      new Request("https://api.cantiara.example/api/auth/sign-out", {
        body: JSON.stringify({}),
        headers: {
          cookie: "__Secure-better-auth.session_token=stale-token",
          "content-type": "application/json",
          origin: "https://cantiara.example",
        },
        method: "POST",
      }),
    );

    expect(response.status).toBe(200);
    expect(getHandlerCalls()).toBe(1);
  });

  test("does not replay security events on each request", async () => {
    const { app, getReplayCalls } = createTestApp();

    await app.fetch(new Request("https://api.cantiara.example/"));
    await app.fetch(new Request("https://api.cantiara.example/"));

    expect(getReplayCalls()).toBe(0);
  });

  test("rejects a protected request when the Account Access session is revoked", async () => {
    const { app } = createTestApp();

    const response = await app.fetch(
      new Request("https://api.cantiara.example/rpc/privateData", {
        body: JSON.stringify({}),
        headers: {
          cookie: "__Secure-better-auth.session_token=stale-token",
          "content-type": "application/json",
          origin: "https://cantiara.example",
        },
        method: "POST",
      }),
    );

    expect(response.status).toBe(401);
  });
});
