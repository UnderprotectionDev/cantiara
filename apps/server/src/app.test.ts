import { createAuthOptions } from "@cantiara/auth";
import { betterAuth } from "better-auth";
import { memoryAdapter } from "better-auth/adapters/memory";
import { describe, expect, test } from "vitest";

import type { AppDependencies } from "./app";
import { createApp } from "./app";
import type { TauriSessionAccess } from "./features/account-access/server/tauri-session";

const authConfig = {
  BETTER_AUTH_URL: "https://api.cantiara.example",
  BETTER_AUTH_SECRET: "test-secret-that-is-long-enough-123456",
  CORS_ORIGIN: "https://cantiara.example",
  GITHUB_CLIENT_ID: "github-client-id",
  GITHUB_CLIENT_SECRET: "github-client-secret",
  TRUSTED_PROXY_IPS: ["203.0.113.10"],
} as const;

const staleSession = {
  session: { id: "stale-session" },
  user: { id: "account-1" },
};

function createTestApp(
  options: {
    accountSessionAccess?: AppDependencies["accountSessionAccess"];
    auth?: AppDependencies["auth"];
    tauriSessionAccess?: TauriSessionAccess;
  } = {},
) {
  let handlerCalls = 0;
  let replayCalls = 0;
  const dependencies: AppDependencies = {
    accountSessionAccess:
      options.accountSessionAccess ??
      ({
        authorizeWrite: async () => false,
        listSessions: async () => [],
        replaySessionRevocations: () => {
          replayCalls += 1;
          return Promise.resolve();
        },
        revokeOtherSessions: async () => undefined,
        revokeSession: async () => undefined,
      } satisfies AppDependencies["accountSessionAccess"]),
    auth:
      options.auth ??
      ({
        api: {
          getSession: async () => staleSession,
        },
        handler: () => {
          handlerCalls += 1;
          return Promise.resolve(Response.json({ status: true }));
        },
      } as unknown as AppDependencies["auth"]),
    corsOrigin: "https://cantiara.example",
    database: {} as AppDependencies["database"],
    desktopOrigins: [],
    nodeEnv: "test",
    redactSecrets: (value) => value,
    tauriSessionAccess: options.tauriSessionAccess,
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

  test("starts Tauri sign-in in the system browser with a browser-owned state cookie", async () => {
    const { app } = createTestApp({
      auth: {
        api: { getSession: async () => null },
        handler: (request) => {
          expect(new URL(request.url).pathname).toBe(
            "/api/auth/sign-in/social",
          );
          return Promise.resolve(
            new Response(null, {
              headers: {
                location:
                  "https://github.com/login/oauth/authorize?scope=read%3Auser",
                "set-cookie": "__Secure-better-auth.state=state-cookie",
              },
              status: 200,
            }),
          );
        },
      } as AppDependencies["auth"],
      tauriSessionAccess: {
        exchangeCode: async () => null,
        issueCode: async () => "unused",
      },
    });

    const response = await app.fetch(
      new Request("https://api.cantiara.example/api/auth/tauri/start"),
    );

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toContain("github.com");
    expect(response.headers.get("location")).not.toContain("token");
    expect(response.headers.get("set-cookie")).toContain("state-cookie");
  });

  test("real Better Auth start creates a state cookie before opening GitHub", async () => {
    const auth = betterAuth({
      ...createAuthOptions(authConfig, {} as never, {
        admitAccount: async () => undefined,
        admitGitHubCallback: async () => true,
      }),
      database: memoryAdapter({
        account: [],
        rateLimit: [],
        session: [],
        user: [],
        verification: [],
      }),
    });
    const { app } = createTestApp({
      auth: auth as unknown as AppDependencies["auth"],
      tauriSessionAccess: {
        exchangeCode: async () => null,
        issueCode: async () => "unused",
      },
    });

    const response = await app.fetch(
      new Request("https://api.cantiara.example/api/auth/tauri/start"),
    );

    expect(response.status).toBe(302);
    expect(new URL(response.headers.get("location") ?? "").hostname).toBe(
      "github.com",
    );
    expect(response.headers.get("set-cookie")).toContain("state");
  });

  test("real GitHub callback turns the Better Auth bearer into a code-only deep link", async () => {
    const originalFetch = globalThis.fetch;
    const githubFetch = ((input) => {
      const url = input instanceof Request ? input.url : String(input);
      if (url === "https://github.com/login/oauth/access_token") {
        return Promise.resolve(
          Response.json({
            access_token: "github-test-token",
            scope: "read:user,user:email",
            token_type: "bearer",
          }),
        );
      }
      if (url === "https://api.github.com/user") {
        return Promise.resolve(
          Response.json({
            avatar_url: null,
            email: "founder@example.invalid",
            id: 42,
            login: "founder",
            name: "Founder",
          }),
        );
      }
      if (url === "https://api.github.com/user/emails") {
        return Promise.resolve(
          Response.json([
            {
              email: "founder@example.invalid",
              primary: true,
              verified: true,
              visibility: "private",
            },
          ]),
        );
      }
      throw new Error(`Unexpected GitHub request: ${url}`);
    }) as typeof fetch;
    githubFetch.preconnect = originalFetch.preconnect;
    globalThis.fetch = githubFetch;

    try {
      const memoryDatabase = {
        account: [],
        rateLimit: [],
        session: [],
        user: [],
        verification: [],
      };
      const authOptions = createAuthOptions(authConfig, {} as never, {
        admitAccount: async () => undefined,
        admitGitHubCallback: async () => true,
      });
      let sessionToken: string | undefined;
      const auth = betterAuth({
        ...authOptions,
        database: memoryAdapter(memoryDatabase),
        databaseHooks: {
          ...authOptions.databaseHooks,
          session: {
            ...authOptions.databaseHooks?.session,
            create: {
              ...authOptions.databaseHooks?.session?.create,
              after: (session) => {
                sessionToken = session.token;
                return Promise.resolve();
              },
            },
          },
        },
      });
      let issuedSessionId: string | undefined;
      let authorized = true;
      const { app } = createTestApp({
        accountSessionAccess: {
          authorizeWrite: async () => authorized,
          listSessions: async () => [],
          replaySessionRevocations: async () => undefined,
          revokeOtherSessions: async () => undefined,
          revokeSession: async () => undefined,
        },
        auth: auth as unknown as AppDependencies["auth"],
        tauriSessionAccess: {
          exchangeCode: (code) => {
            if (code !== "one-time-code") {
              return Promise.resolve(null);
            }
            if (!sessionToken) {
              throw new Error("Better Auth session was not created");
            }
            return Promise.resolve({
              accountId: "account-1",
              expiresAt: new Date("2026-10-16T09:00:00.000Z"),
              token: sessionToken,
            });
          },
          issueCode: (sessionId) => {
            issuedSessionId = sessionId;
            return Promise.resolve("one-time-code");
          },
        },
      });

      const start = await app.fetch(
        new Request("https://api.cantiara.example/api/auth/tauri/start"),
      );
      const authorizationURL = new URL(
        start.headers.get("location") ?? "https://github.com",
      );
      const state = authorizationURL.searchParams.get("state");
      const stateCookie = start.headers.get("set-cookie")?.split(";", 1)[0];
      if (!(state && stateCookie)) {
        throw new Error("Tauri OAuth state was not created");
      }

      const callback = await app.fetch(
        new Request(
          `https://api.cantiara.example/api/auth/callback/github?code=test-code&state=${state}`,
          { headers: { cookie: stateCookie } },
        ),
      );

      const callbackLocation = callback.headers.get("location");
      expect(callback.status).toBe(302);
      expect(callbackLocation).toBe(
        "cantiara://auth/callback?code=one-time-code",
      );
      expect(callbackLocation).not.toContain("token");
      expect(callback.headers.get("set-auth-token")).toBeNull();
      expect(callback.headers.get("set-cookie")).toBeNull();
      expect(issuedSessionId).toEqual(expect.any(String));

      const exchange = await app.fetch(
        new Request("https://api.cantiara.example/api/auth/tauri/exchange", {
          body: JSON.stringify({ code: "one-time-code" }),
          headers: { "content-type": "application/json" },
          method: "POST",
        }),
      );
      const exchangeBody = (await exchange.json()) as { token: string };
      expect(exchange.status).toBe(200);

      const protectedRequest = () =>
        app.fetch(
          new Request("https://api.cantiara.example/rpc/privateData", {
            body: JSON.stringify({}),
            headers: {
              authorization: `Bearer ${exchangeBody.token}`,
              "content-type": "application/json",
              origin: "https://cantiara.example",
            },
            method: "POST",
          }),
        );
      expect((await protectedRequest()).status).toBe(200);
      authorized = false;
      expect((await protectedRequest()).status).toBe(401);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test("exchanges a Tauri code only through the one-time code endpoint", async () => {
    let exchangedCode: string | undefined;
    const { app } = createTestApp({
      tauriSessionAccess: {
        exchangeCode: (code) => {
          exchangedCode = code;
          return Promise.resolve(
            code === "one-time-code"
              ? {
                  accountId: "account-1",
                  expiresAt: new Date("2026-10-16T09:00:00.000Z"),
                  token: "bearer-session-token",
                }
              : null,
          );
        },
        issueCode: async () => "unused",
      },
    });

    const response = await app.fetch(
      new Request("https://api.cantiara.example/api/auth/tauri/exchange", {
        body: JSON.stringify({ code: "one-time-code" }),
        headers: {
          "content-type": "application/json",
          origin: "http://tauri.localhost",
        },
        method: "POST",
      }),
    );

    expect(response.status).toBe(200);
    expect(exchangedCode).toBe("one-time-code");
    await expect(response.json()).resolves.toEqual({
      expiresAt: "2026-10-16T09:00:00.000Z",
      token: "bearer-session-token",
    });
  });

  test("does not reveal whether an exchanged Tauri code was expired or already used", async () => {
    const { app } = createTestApp({
      tauriSessionAccess: {
        exchangeCode: async () => null,
        issueCode: async () => "unused",
      },
    });

    const response = await app.fetch(
      new Request("https://api.cantiara.example/api/auth/tauri/exchange", {
        body: JSON.stringify({ code: "expired-or-replayed" }),
        headers: { "content-type": "application/json" },
        method: "POST",
      }),
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ code: "UNAUTHORIZED" });
  });
});
