import { describe, expect, test, vi } from "vitest";

import type { AppDependencies } from "./app";
import { createApp } from "./app";

const staleSession = {
  session: { id: "stale-session" },
  user: { id: "account-1" },
};

const availableGitHub = {
  getStatus: () => "available" as const,
  requiresFreshConsent: () => false,
};

function createTestApp({
  authorized = false,
  githubAvailability,
  onRevokeSession = () => undefined,
}: {
  authorized?: boolean;
  githubAvailability?: AppDependencies["githubAvailability"];
  onRevokeSession?: (sessionId: string) => void;
} = {}) {
  let handlerCalls = 0;
  let handlerBody: unknown;
  let replayCalls = 0;
  const dependencies: AppDependencies = {
    accountSessionAccess: {
      authorizeWrite: async () => authorized,
      listSessions: async () => [],
      revokeGitHubLoginOAuth: async () => undefined,
      replaySessionRevocations: () => {
        replayCalls += 1;
        return Promise.resolve();
      },
      revokeOtherSessions: async () => undefined,
      revokeSession: (_principal, sessionId) => {
        onRevokeSession(sessionId);
        return Promise.resolve();
      },
    },
    auth: {
      api: {
        getSession: async () => staleSession,
      },
      handler: async (request: Request) => {
        handlerCalls += 1;
        try {
          handlerBody = await request.clone().json();
        } catch {
          handlerBody = undefined;
        }
        return Promise.resolve(Response.json({ status: true }));
      },
    } as unknown as AppDependencies["auth"],
    corsOrigin: "https://cantiara.example",
    database: {} as AppDependencies["database"],
    desktopOrigins: [],
    githubAvailability: githubAvailability ?? availableGitHub,
    nodeEnv: "test",
    redactSecrets: (value) => value,
  };

  return {
    app: createApp(dependencies),
    getHandlerCalls: () => handlerCalls,
    getHandlerBody: () => handlerBody,
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

  test("requests fresh GitHub consent after login OAuth revocation", async () => {
    const { app, getHandlerBody } = createTestApp({
      githubAvailability: {
        getStatus: () => "available",
        requiresFreshConsent: () => true,
      },
    });

    const response = await app.fetch(
      new Request("https://api.cantiara.example/api/auth/sign-in/social", {
        body: JSON.stringify({
          callbackURL: "https://cantiara.example/dashboard",
          provider: "github",
        }),
        headers: {
          "content-type": "application/json",
          origin: "https://cantiara.example",
        },
        method: "POST",
      }),
    );

    expect(response.status).toBe(200);
    expect(getHandlerBody()).toEqual({
      additionalParams: { prompt: "consent" },
      callbackURL: "https://cantiara.example/dashboard",
      provider: "github",
    });
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

  test("continues an authorized product request when GitHub is unavailable", async () => {
    const githubDown = vi.fn(() =>
      Promise.reject(new Error("GitHub is unavailable")),
    );
    vi.stubGlobal("fetch", githubDown);
    const { app } = createTestApp({ authorized: true });

    try {
      const response = await app.fetch(
        new Request("https://api.cantiara.example/rpc/privateData", {
          body: JSON.stringify({}),
          headers: {
            cookie: "__Secure-better-auth.session_token=valid-token",
            "content-type": "application/json",
            origin: "https://cantiara.example",
          },
          method: "POST",
        }),
      );

      expect(response.status).toBe(200);
      expect(githubDown).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  test("keeps session revoke available when GitHub is unavailable", async () => {
    const githubDown = vi.fn(() =>
      Promise.reject(new Error("GitHub is unavailable")),
    );
    const revoked: string[] = [];
    vi.stubGlobal("fetch", githubDown);
    const { app } = createTestApp({
      authorized: true,
      onRevokeSession: (sessionId) => {
        revoked.push(sessionId);
      },
    });

    try {
      const response = await app.fetch(
        new Request("https://api.cantiara.example/rpc/revokeSession", {
          body: JSON.stringify({
            json: { sessionId: "other-session" },
          }),
          headers: {
            cookie: "__Secure-better-auth.session_token=valid-token",
            "content-type": "application/json",
            origin: "https://cantiara.example",
          },
          method: "POST",
        }),
      );

      expect(response.status).toBe(200);
      expect(revoked).toEqual(["other-session"]);
      expect(githubDown).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  test("keeps an authorized product request independent from App installation", async () => {
    const appUninstalled = vi.fn(() =>
      Promise.resolve(Response.json({ installed: false })),
    );
    vi.stubGlobal("fetch", appUninstalled);
    const { app } = createTestApp({ authorized: true });

    try {
      const response = await app.fetch(
        new Request("https://api.cantiara.example/rpc/privateData", {
          body: JSON.stringify({}),
          headers: {
            cookie: "__Secure-better-auth.session_token=valid-token",
            "content-type": "application/json",
            origin: "https://cantiara.example",
          },
          method: "POST",
        }),
      );

      expect(response.status).toBe(200);
      expect(appUninstalled).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  test("publishes GitHub waiting status without requiring a product session", async () => {
    const { app } = createTestApp({
      githubAvailability: {
        getStatus: () => "waiting",
        requiresFreshConsent: () => true,
      },
    });

    const response = await app.fetch(
      new Request(
        "https://api.cantiara.example/api/account-access/github/availability",
      ),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      requiresFreshConsent: true,
      status: "waiting",
    });
  });
});
