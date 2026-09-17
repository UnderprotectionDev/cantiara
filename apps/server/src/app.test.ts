import { DEFAULT_ACCOUNT_PREFERENCES } from "@cantiara/api/account-preferences";
import {
  DESKTOP_API_UPDATE_REQUIRED_HEADER,
  type DesktopApiCompatibilityWindow,
} from "@cantiara/api/desktop-api-window";
import { SUPPORT_REFERENCE_PATTERN } from "@cantiara/api/support-reference";
import { createAuthOptions } from "@cantiara/auth";
import { betterAuth } from "better-auth";
import { memoryAdapter } from "better-auth/adapters/memory";
import { describe, expect, test, vi } from "vitest";
import type { AppDependencies } from "./app";
import { createApp } from "./app";
import { createGitHubAvailability } from "./features/account-access/server/github-availability";
import type { GitHubIdentityConfirmation } from "./features/account-access/server/github-identity-confirmation";
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
const CODE_VERIFIER = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk";
const CODE_CHALLENGE = "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM";

const availableGitHub = {
  getStatus: () => "available" as const,
  requiresFreshConsent: () => false,
};

function createTestApp(
  options: {
    accountSessionAccess?: AppDependencies["accountSessionAccess"];
    auth?: AppDependencies["auth"];
    authorized?: boolean;
    accountPreferencesMutationContract?: AppDependencies["accountPreferencesMutationContract"];
    desktopApiNow?: () => Date;
    desktopApiWindow?: DesktopApiCompatibilityWindow;
    desktopOrigins?: readonly string[];
    githubAvailability?: AppDependencies["githubAvailability"];
    githubIdentityConfirmation?: GitHubIdentityConfirmation;
    onGitHubLoginOAuthRevoked?: () => void;
    onRevokeSession?: (sessionId: string) => void;
    tauriSessionAccess?: TauriSessionAccess;
  } = {},
) {
  let handlerCalls = 0;
  let handlerBody: unknown;
  let replayCalls = 0;
  const dependencies: AppDependencies = {
    accountSessionAccess:
      options.accountSessionAccess ??
      ({
        authorizeWrite: async () => options.authorized ?? false,
        listSessions: async () => [],
        revokeGitHubLoginOAuth: () => {
          options.onGitHubLoginOAuthRevoked?.();
          return Promise.resolve();
        },
        replaySessionRevocations: () => {
          replayCalls += 1;
          return Promise.resolve();
        },
        revokeOtherSessions: async () => undefined,
        revokeSession: (_principal, sessionId) => {
          options.onRevokeSession?.(sessionId);
          return Promise.resolve();
        },
      } satisfies AppDependencies["accountSessionAccess"]),
    accountPreferences: {
      get: async () => ({
        ...DEFAULT_ACCOUNT_PREFERENCES,
        isSaved: false,
        revision: 0,
        savedAt: null,
      }),
    },
    accountPreferencesMutationContract:
      options.accountPreferencesMutationContract,
    auth:
      options.auth ??
      ({
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
          return Response.json({ status: true });
        },
      } as unknown as AppDependencies["auth"]),
    corsOrigin: "https://cantiara.example",
    database: {} as AppDependencies["database"],
    desktopApiNow: options.desktopApiNow,
    desktopApiWindow: options.desktopApiWindow,
    desktopOrigins: options.desktopOrigins ?? [],
    githubAvailability: options.githubAvailability ?? availableGitHub,
    githubIdentityConfirmation: options.githubIdentityConfirmation,
    nodeEnv: "test",
    redactSecrets: (value) => value,
    tauriSessionAccess: options.tauriSessionAccess,
    trustedProxyIps: ["203.0.113.10"],
  };

  return {
    app: createApp(dependencies),
    getHandlerCalls: () => handlerCalls,
    getHandlerBody: () => handlerBody,
    getReplayCalls: () => replayCalls,
    notifyGitHubLoginOAuthRevoked: () =>
      dependencies.accountSessionAccess.revokeGitHubLoginOAuth("account-1"),
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

  test("gives an unmatched RPC a restart-the-API Support reference", async () => {
    const { app } = createTestApp();
    const clientRequestId = "123e4567-e89b-12d3-a456-426614174000";

    const response = await app.fetch(
      new Request("https://api.cantiara.example/rpc/missing-procedure", {
        headers: { "x-request-id": clientRequestId },
      }),
    );
    const body = (await response.json()) as {
      data: {
        reasonCode: string;
        supportReference: string;
        writeOutcome: string;
      };
      message: string;
    };
    const serialized = JSON.stringify(body);

    expect(response.status).toBe(404);
    expect(body.message).toBe("Please restart the API and try again.");
    expect(body.data.reasonCode).toBe("restart-api");
    expect(body.data.supportReference).toMatch(SUPPORT_REFERENCE_PATTERN);
    expect(body.data.writeOutcome).toBe("not-written");
    expect(body.data.supportReference).not.toBe(
      `SUP-${clientRequestId.toUpperCase()}`,
    );
    expect(serialized).not.toContain(clientRequestId);
    expect(serialized).not.toContain("404 Not Found");
    expect(serialized).not.toContain("Not Found");
  });

  test("does not wrap Account Access errors in the Client Shell envelope", async () => {
    const { app } = createTestApp({
      auth: {
        api: { getSession: async () => null },
        handler: () => {
          throw new Error("private Workspace body token=secret-token");
        },
      } as unknown as AppDependencies["auth"],
    });

    const response = await app.fetch(
      new Request("https://api.cantiara.example/api/auth/sign-in/social", {
        headers: {
          "content-type": "application/json",
          origin: "https://cantiara.example",
        },
        method: "POST",
      }),
    );
    const body = await response.text();

    expect(response.status).toBe(500);
    expect(body).toBe("Internal Server Error");
    expect(response.headers.get("x-cantiara-support-reference")).toBeNull();
    expect(body).not.toContain("private Workspace body");
  });

  test("sanitizes a failed RPC before it reaches the response or log sink", async () => {
    const { app } = createTestApp({
      accountSessionAccess: {
        authorizeWrite: async () => true,
        listSessions: () => {
          throw new Error(
            '42P01 relation "private_workspace" does not exist token=secret-token private Workspace body',
          );
        },
        replaySessionRevocations: () => Promise.resolve(),
        revokeGitHubLoginOAuth: () => Promise.resolve(),
        revokeOtherSessions: async () => undefined,
        revokeSession: async () => undefined,
      },
      authorized: true,
    });

    const response = await app.fetch(
      new Request("https://api.cantiara.example/rpc/sessions", {
        body: JSON.stringify({}),
        headers: {
          "content-type": "application/json",
          origin: "https://cantiara.example",
        },
        method: "POST",
      }),
    );
    const body = (await response.json()) as {
      data: { reasonCode: string; writeOutcome: string };
      message: string;
    };
    const serialized = JSON.stringify(body);

    expect(response.status).toBe(500);
    expect(body.message).toBe(
      "Please restart after applying the latest migration.",
    );
    expect(body.data.reasonCode).toBe("schema-drift");
    expect(body.data.writeOutcome).toBe("unknown");
    expect(serialized).not.toContain("secret-token");
    expect(serialized).not.toContain("private Workspace body");
  });

  test("keeps mutation conflict details through the RPC Support envelope", async () => {
    const { app } = createTestApp({
      accountPreferencesMutationContract: {
        mutate: () => {
          throw Object.assign(new Error("Conflict"), {
            code: "CONFLICT",
          });
        },
      } as NonNullable<AppDependencies["accountPreferencesMutationContract"]>,
      authorized: true,
    });

    const response = await app.fetch(
      new Request("https://api.cantiara.example/rpc/saveAccountPreferences", {
        body: JSON.stringify({
          json: {
            baseRevision: 0,
            clientIdempotencyKey: "conflict-key",
            preferences: DEFAULT_ACCOUNT_PREFERENCES,
          },
        }),
        headers: {
          cookie: "__Secure-better-auth.session_token=valid-token",
          "content-type": "application/json",
          origin: "https://cantiara.example",
        },
        method: "POST",
      }),
    );
    const body = (await response.json()) as {
      code: string;
      data: Record<string, unknown>;
      defined: boolean;
      message: string;
      status: number;
    };

    expect(response.status).toBe(409);
    expect(body).toMatchObject({
      code: "CONFLICT",
      data: {
        code: "CONFLICT",
        label: "Conflict",
        targetId: "account-1",
      },
      defined: true,
      message: "Conflict",
      status: 409,
    });
    expect(response.headers.get("x-cantiara-support-reference")).toMatch(
      SUPPORT_REFERENCE_PATTERN,
    );
  });

  test("keeps the current value through the stale mutation Support envelope", async () => {
    const { app } = createTestApp({
      accountPreferencesMutationContract: {
        mutate: () => {
          throw Object.assign(new Error("Current value"), {
            code: "STALE_BASE_REVISION",
            currentRevision: 1,
            currentValue: {
              ...DEFAULT_ACCOUNT_PREFERENCES,
              appearance: "Light",
            },
          });
        },
      } as NonNullable<AppDependencies["accountPreferencesMutationContract"]>,
      authorized: true,
    });

    const response = await app.fetch(
      new Request("https://api.cantiara.example/rpc/saveAccountPreferences", {
        body: JSON.stringify({
          json: {
            baseRevision: 0,
            clientIdempotencyKey: "stale-key",
            preferences: DEFAULT_ACCOUNT_PREFERENCES,
          },
        }),
        headers: {
          cookie: "__Secure-better-auth.session_token=valid-token",
          "content-type": "application/json",
          origin: "https://cantiara.example",
        },
        method: "POST",
      }),
    );
    const body = (await response.json()) as {
      code: string;
      data: Record<string, unknown>;
      defined: boolean;
      message: string;
      status: number;
    };

    expect(response.status).toBe(412);
    expect(body).toMatchObject({
      code: "PRECONDITION_FAILED",
      data: {
        code: "STALE_BASE_REVISION",
        currentRevision: 1,
        currentValue: { appearance: "Light" },
        label: "Current value",
        targetId: "account-1",
      },
      defined: true,
      message: "Current value",
      status: 412,
    });
  });

  test("starts Tauri sign-in in the system browser with a browser-owned state cookie", async () => {
    const { app } = createTestApp({
      auth: {
        api: { getSession: async () => null },
        handler: async (request) => {
          expect(new URL(request.url).pathname).toBe(
            "/api/auth/sign-in/social",
          );
          await expect(request.json()).resolves.toEqual({
            callbackURL: `cantiara://auth/callback?challenge=${CODE_CHALLENGE}`,
            errorCallbackURL: "cantiara://auth/callback",
            provider: "github",
          });
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
      new Request(
        `https://api.cantiara.example/api/auth/tauri/start?code_challenge=${CODE_CHALLENGE}`,
      ),
    );

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toContain("github.com");
    expect(response.headers.get("location")).not.toContain("token");
    expect(response.headers.get("set-cookie")).toContain("state-cookie");
  });

  test("starts Confirm GitHub Identity only for the authorized current session", async () => {
    let requestedOperation: unknown;
    let requestedPrincipal: unknown;
    let requestedClientKey: unknown;
    const trustedProxy = {
      requestIP: () => ({
        address: "203.0.113.10",
        family: "IPv4" as const,
        port: 443,
      }),
    };
    const { app } = createTestApp({
      authorized: true,
      githubIdentityConfirmation: {
        complete: () => Promise.resolve(null),
        consume: () => Promise.resolve(false),
        exchange: () => Promise.resolve(null),
        recordFailure: () => Promise.resolve(),
        start: (principal, operationId, clientKey) => {
          requestedPrincipal = principal;
          requestedOperation = operationId;
          requestedClientKey = clientKey;
          return Promise.resolve({
            authorizationUrl: "https://github.com/confirm",
          });
        },
      },
    });

    const response = await app.fetch(
      new Request(
        "https://api.cantiara.example/api/auth/confirm-github-identity/start",
        {
          body: JSON.stringify({ operationId: "account-closure-start" }),
          headers: {
            cookie: "__Secure-better-auth.session_token=session-token",
            "content-type": "application/json",
            origin: "https://cantiara.example",
            "x-forwarded-for": "198.51.100.10, 203.0.113.10",
          },
          method: "POST",
        },
      ),
      trustedProxy,
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      authorizationUrl: "https://github.com/confirm",
    });
    expect(requestedPrincipal).toEqual({
      accountId: "account-1",
      sessionId: "stale-session",
    });
    expect(requestedOperation).toBe("account-closure-start");
    expect(requestedClientKey).toBe("198.51.100.10");
  });

  test("returns Waiting for GitHub from the start endpoint during an outage", async () => {
    const { app } = createTestApp({
      authorized: true,
      githubIdentityConfirmation: {
        complete: () => Promise.resolve(null),
        consume: () => Promise.resolve(false),
        exchange: () => Promise.resolve(null),
        recordFailure: () => Promise.resolve(),
        start: () => Promise.resolve({ status: "waiting" }),
      },
    });

    const response = await app.fetch(
      new Request(
        "https://api.cantiara.example/api/auth/confirm-github-identity/start",
        {
          body: JSON.stringify({ operationId: "account-closure-start" }),
          headers: {
            cookie: "__Secure-better-auth.session_token=session-token",
            "content-type": "application/json",
            origin: "https://cantiara.example",
          },
          method: "POST",
        },
      ),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ status: "waiting" });
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  test("rejects Confirm GitHub Identity when the current session is not authorized", async () => {
    let startCalls = 0;
    const { app } = createTestApp({
      githubIdentityConfirmation: {
        complete: () => Promise.resolve(null),
        consume: () => Promise.resolve(false),
        exchange: () => Promise.resolve(null),
        recordFailure: () => Promise.resolve(),
        start: () => {
          startCalls += 1;
          return Promise.resolve({
            authorizationUrl: "https://github.com/confirm",
          });
        },
      },
    });

    const response = await app.fetch(
      new Request(
        "https://api.cantiara.example/api/auth/confirm-github-identity/start",
        {
          body: JSON.stringify({ operationId: "account-closure-start" }),
          headers: {
            cookie: "__Secure-better-auth.session_token=session-token",
            "content-type": "application/json",
            origin: "https://cantiara.example",
          },
          method: "POST",
        },
      ),
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      code: "CONFIRM_GITHUB_IDENTITY_FAILURE",
    });
    expect(startCalls).toBe(0);
  });

  test("hands a successful web confirmation back through a no-store postMessage handoff", async () => {
    let completedInput: unknown;
    const trustedProxy = {
      requestIP: () => ({
        address: "203.0.113.10",
        family: "IPv4" as const,
        port: 443,
      }),
    };
    const { app } = createTestApp({
      authorized: true,
      githubIdentityConfirmation: {
        complete: (principal, input, clientKey) => {
          completedInput = { clientKey, input, principal };
          return Promise.resolve({
            callbackCode: "H".repeat(43),
            clientPlatform: "web" as const,
            grant: "G".repeat(43),
          });
        },
        consume: () => Promise.resolve(false),
        exchange: () => Promise.resolve(null),
        recordFailure: () => Promise.resolve(),
        start: () => Promise.resolve(null),
      },
    });

    const response = await app.fetch(
      new Request(
        "https://api.cantiara.example/api/auth/confirm-github-identity/callback?code=authorization-code&state=S".concat(
          "S".repeat(42),
        ),
        {
          headers: {
            cookie: "__Secure-better-auth.session_token=session-token",
            "x-forwarded-for": "198.51.100.10, 203.0.113.10",
          },
        },
      ),
      trustedProxy,
    );

    expect(response.status).toBe(200);
    const responseBody = await response.text();
    expect(responseBody).toContain('"code":"H'.concat("H".repeat(42), '"'));
    expect(responseBody).toContain("postMessage");
    expect(responseBody).not.toContain("G".repeat(43));
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("location")).toBeNull();
    expect(response.headers.get("set-cookie")).toBeNull();
    expect(completedInput).toEqual({
      clientKey: "198.51.100.10",
      input: {
        code: "authorization-code",
        state: "S".repeat(43),
      },
      principal: null,
    });
  });

  test("hands a successful Tauri confirmation back through a code-only deep link", async () => {
    let completedPrincipal: unknown;
    const { app } = createTestApp({
      githubIdentityConfirmation: {
        complete: (principal) => {
          completedPrincipal = principal;
          return Promise.resolve({
            callbackCode: "H".repeat(43),
            clientPlatform: "tauri" as const,
            grant: "G".repeat(43),
          });
        },
        consume: () => Promise.resolve(false),
        exchange: () => Promise.resolve(null),
        recordFailure: () => Promise.resolve(),
        start: () => Promise.resolve(null),
      },
    });

    const response = await app.fetch(
      new Request(
        "https://api.cantiara.example/api/auth/confirm-github-identity/callback?code=authorization-code&state=".concat(
          "S".repeat(43),
        ),
        { headers: { origin: "http://tauri.localhost" } },
      ),
    );

    const location = response.headers.get("location");
    expect(response.status).toBe(302);
    expect(location).toBe(
      "cantiara://auth/confirm-github-identity?code=".concat("H".repeat(43)),
    );
    expect(location).not.toContain("grant");
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(completedPrincipal).toBeNull();
  });

  test("exchanges a confirmation handoff only through the authorized no-store endpoint", async () => {
    let exchanged: unknown;
    const { app } = createTestApp({
      authorized: true,
      githubIdentityConfirmation: {
        complete: () => Promise.resolve(null),
        consume: () => Promise.resolve(false),
        exchange: (principal, code, clientKey) => {
          exchanged = { clientKey, code, principal };
          return Promise.resolve("G".repeat(43));
        },
        recordFailure: () => Promise.resolve(),
        start: () => Promise.resolve(null),
      },
    });

    const response = await app.fetch(
      new Request(
        "https://api.cantiara.example/api/auth/confirm-github-identity/exchange",
        {
          body: JSON.stringify({ code: "H".repeat(43) }),
          headers: {
            cookie: "__Secure-better-auth.session_token=session-token",
            "content-type": "application/json",
            origin: "https://cantiara.example",
          },
          method: "POST",
        },
      ),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      grant: "G".repeat(43),
    });
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(exchanged).toEqual({
      clientKey: "unknown",
      code: "H".repeat(43),
      principal: { accountId: "account-1", sessionId: "stale-session" },
    });
  });

  test("records a generic failure when GitHub returns an OAuth error", async () => {
    let failure: unknown;
    const trustedProxy = {
      requestIP: () => ({
        address: "203.0.113.10",
        family: "IPv4" as const,
        port: 443,
      }),
    };
    const { app } = createTestApp({
      authorized: true,
      githubIdentityConfirmation: {
        complete: () => Promise.resolve(null),
        consume: () => Promise.resolve(false),
        exchange: () => Promise.resolve(null),
        recordFailure: (principal, callbackState, clientKey) => {
          failure = { clientKey, principal, state: callbackState };
          return Promise.resolve();
        },
        start: () => Promise.resolve(null),
      },
    });

    const state = "S".repeat(43);
    const response = await app.fetch(
      new Request(
        `https://api.cantiara.example/api/auth/confirm-github-identity/callback?error=access_denied&state=${state}`,
        {
          headers: {
            cookie: "__Secure-better-auth.session_token=session-token",
            "x-forwarded-for": "198.51.100.10, 203.0.113.10",
          },
        },
      ),
      trustedProxy,
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      code: "CONFIRM_GITHUB_IDENTITY_FAILURE",
    });
    expect(failure).toEqual({
      clientKey: "198.51.100.10",
      principal: { accountId: "account-1", sessionId: "stale-session" },
      state,
    });
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
      new Request(
        `https://api.cantiara.example/api/auth/tauri/start?code_challenge=${CODE_CHALLENGE}`,
      ),
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
          revokeGitHubLoginOAuth: async () => undefined,
          replaySessionRevocations: async () => undefined,
          revokeOtherSessions: async () => undefined,
          revokeSession: async () => undefined,
        },
        auth: auth as unknown as AppDependencies["auth"],
        tauriSessionAccess: {
          exchangeCode: (code, codeVerifier) => {
            expect(codeVerifier).toBe(CODE_VERIFIER);
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
          issueCode: (sessionId, codeChallenge) => {
            expect(codeChallenge).toBe(CODE_CHALLENGE);
            issuedSessionId = sessionId;
            return Promise.resolve("one-time-code");
          },
        },
      });

      const start = await app.fetch(
        new Request(
          `https://api.cantiara.example/api/auth/tauri/start?code_challenge=${CODE_CHALLENGE}`,
        ),
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
          body: JSON.stringify({
            code: "one-time-code",
            codeVerifier: CODE_VERIFIER,
          }),
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
        exchangeCode: (code, codeVerifier) => {
          exchangedCode = code;
          expect(codeVerifier).toBe(CODE_VERIFIER);
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
        body: JSON.stringify({
          code: "one-time-code",
          codeVerifier: CODE_VERIFIER,
        }),
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

  test("carries the Account Access revocation signal into the next GitHub sign-in", async () => {
    const githubAvailability = createGitHubAvailability();
    const { app, getHandlerBody, notifyGitHubLoginOAuthRevoked } =
      createTestApp({
        githubAvailability,
        onGitHubLoginOAuthRevoked: githubAvailability.requireFreshConsent,
      });

    await notifyGitHubLoginOAuthRevoked();
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

  test("allows current and previous Tauri contracts to write within the window", async () => {
    const revoked: string[] = [];
    const desktopApiWindow = {
      currentContract: "cantiara-desktop-api/v2",
      previousContract: "cantiara-desktop-api/v1",
      publishedAt: "2026-08-01T00:00:00.000Z",
    } satisfies DesktopApiCompatibilityWindow;
    const { app } = createTestApp({
      authorized: true,
      desktopApiNow: () => new Date("2026-08-31T00:00:00.000Z"),
      desktopApiWindow,
      onRevokeSession: (sessionId) => {
        revoked.push(sessionId);
      },
    });

    const responses = await Promise.all(
      [desktopApiWindow.currentContract, desktopApiWindow.previousContract].map(
        (contract) =>
          app.fetch(
            new Request("https://api.cantiara.example/rpc/revokeSession", {
              body: JSON.stringify({ json: { sessionId: contract } }),
              headers: {
                "content-type": "application/json",
                origin: "http://tauri.localhost",
                "x-cantiara-desktop-api-contract": contract,
              },
              method: "POST",
            }),
          ),
      ),
    );

    for (const response of responses) {
      expect(response.status).toBe(200);
    }

    expect(revoked).toHaveLength(2);
    expect(new Set(revoked)).toEqual(
      new Set([
        desktopApiWindow.currentContract,
        desktopApiWindow.previousContract,
      ]),
    );
  });

  test("stops an expired Tauri contract before the write handler runs", async () => {
    const revoked: string[] = [];
    const { app } = createTestApp({
      authorized: true,
      desktopApiNow: () => new Date("2026-09-01T00:00:00.001Z"),
      desktopApiWindow: {
        currentContract: "cantiara-desktop-api/v2",
        previousContract: "cantiara-desktop-api/v1",
        publishedAt: "2026-08-01T00:00:00.000Z",
      },
      desktopOrigins: ["http://tauri.localhost"],
      onRevokeSession: (sessionId) => {
        revoked.push(sessionId);
      },
    });

    const response = await app.fetch(
      new Request("https://api.cantiara.example/rpc/revokeSession", {
        body: JSON.stringify({ json: { sessionId: "must-not-write" } }),
        headers: {
          "content-type": "application/json",
          origin: "http://tauri.localhost",
          "x-cantiara-desktop-api-contract": "cantiara-desktop-api/v2",
        },
        method: "POST",
      }),
    );
    const body = (await response.json()) as {
      code: string;
      data: { reasonCode: string; writeOutcome: string };
      message: string;
    };

    expect(response.status).toBe(426);
    expect(body.code).toBe("UPDATE_REQUIRED");
    expect(body.data.reasonCode).toBe("update-required");
    expect(body.data.writeOutcome).toBe("not-written");
    expect(body.message).toBe("Update required");
    expect(
      response.headers
        .get("access-control-expose-headers")
        ?.toLowerCase()
        .split(",")
        .map((header) => header.trim()),
    ).toContain(DESKTOP_API_UPDATE_REQUIRED_HEADER);
    expect(response.headers.get(DESKTOP_API_UPDATE_REQUIRED_HEADER)).toBe(
      "true",
    );
    expect(revoked).toEqual([]);
  });

  test("publishes GitHub waiting status without requiring a product session", async () => {
    const { app } = createTestApp({
      githubAvailability: {
        getStatus: () => "waiting",
        requiresFreshConsent: () => true,
      },
    });

    const response = await app.fetch(
      new Request("https://api.cantiara.example/rpc/githubAvailability", {
        body: JSON.stringify({}),
        headers: {
          "content-type": "application/json",
          origin: "https://cantiara.example",
        },
        method: "POST",
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      json: { status: "waiting" },
    });
  });
});
