import {
  type AccountAdmission,
  createAuthOptions,
  TAURI_AUTH_CALLBACK_URL,
} from "@cantiara/auth";
import { betterAuth } from "better-auth";
import { memoryAdapter } from "better-auth/adapters/memory";
import { afterEach, describe, expect, test } from "vitest";

import { GITHUB_LOGIN_SCOPES } from "./account-access";
import { sanitizeGitHubCallbackResponse } from "./github-callback-response";

const authConfig = {
  BETTER_AUTH_URL: "https://api.cantiara.example",
  BETTER_AUTH_SECRET: "test-secret-that-is-long-enough-123456",
  CORS_ORIGIN: "https://cantiara.example",
  GITHUB_CLIENT_ID: "github-client-id",
  GITHUB_CLIENT_SECRET: "github-client-secret",
  TRUSTED_PROXY_IPS: ["203.0.113.10"],
} as const;

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

function requestUrl(input: string | URL | Request) {
  if (input instanceof Request) {
    return input.url;
  }
  if (input instanceof URL) {
    return input.href;
  }
  return input;
}

function installGitHubOAuthTestDouble() {
  function githubFetch(input: string | URL | Request, _init?: RequestInit) {
    const url = requestUrl(input);
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
    return Promise.reject(new Error(`Unexpected GitHub request: ${url}`));
  }
  githubFetch.preconnect = originalFetch.preconnect;
  globalThis.fetch = githubFetch;
}

function createGitHubCallbackTestDriver(accountAdmission: AccountAdmission) {
  const database = {
    account: [],
    rateLimit: [],
    session: [],
    user: [],
    verification: [],
  };
  const options = createAuthOptions(authConfig, {} as never, accountAdmission);
  const auth = betterAuth({
    ...options,
    database: memoryAdapter(database),
  });

  return {
    async completeSignIn() {
      const start = await auth.handler(
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
      const startBody = (await start.json()) as { url: string };
      const state = new URL(startBody.url).searchParams.get("state");
      const stateCookie = start.headers.get("set-cookie")?.split(";", 1)[0];
      if (!(state && stateCookie)) {
        throw new Error("OAuth state was not created");
      }
      const response = await auth.handler(
        new Request(
          `https://api.cantiara.example/api/auth/callback/github?code=test-code&state=${state}`,
          { headers: { cookie: stateCookie } },
        ),
      );
      return sanitizeGitHubCallbackResponse(
        new Request("https://api.cantiara.example/api/auth/callback/github"),
        response,
        authConfig.CORS_ORIGIN,
      );
    },
  };
}

function acceptingAccountAdmission(): AccountAdmission {
  return {
    admitGitHubCallback: async () => true,
    admitAccount: async (accountId) => ({
      accountId,
      workspaceId: `workspace-${accountId}`,
    }),
  };
}

describe("Account Access", () => {
  test("login requests identity scopes and no repository authority", () => {
    expect(GITHUB_LOGIN_SCOPES).toEqual(["read:user", "user:email"]);
    expect(GITHUB_LOGIN_SCOPES).not.toContain("repo");
    expect(GITHUB_LOGIN_SCOPES).not.toContain("write:org");
  });

  test("Better Auth cannot refresh past the Account Access lifetime policy", () => {
    const options = createAuthOptions(
      authConfig,
      {} as never,
      acceptingAccountAdmission(),
    );

    expect(options.session).toMatchObject({
      disableSessionRefresh: true,
      expiresIn: 30 * 24 * 60 * 60,
    });
  });

  test("Better Auth accepts the Tauri bearer plugin only with the registered deep-link callback", () => {
    const options = createAuthOptions(
      authConfig,
      {} as never,
      acceptingAccountAdmission(),
    );

    expect(options.plugins).toEqual([
      expect.objectContaining({ id: "bearer" }),
    ]);
    expect(options.trustedOrigins).toContain(TAURI_AUTH_CALLBACK_URL);
  });

  test("callback failures do not reveal Account or Workspace existence", async () => {
    installGitHubOAuthTestDouble();
    const failingAdmissions = createGitHubCallbackTestDriver({
      admitGitHubCallback: async () => true,
      admitAccount: () => Promise.reject(new Error("workspace already exists")),
    });
    const rateLimitedAdmissions = createGitHubCallbackTestDriver({
      admitGitHubCallback: async () => false,
      admitAccount: async () => ({
        accountId: "account-42",
        workspaceId: "workspace-42",
      }),
    });

    const unknownResponse = await failingAdmissions.completeSignIn();
    const knownResponse = await rateLimitedAdmissions.completeSignIn();

    expect(unknownResponse.headers.get("location")).toBe(
      "https://cantiara.example/login?error=sign_in_failed",
    );
    expect(knownResponse.headers.get("location")).toBe(
      unknownResponse.headers.get("location"),
    );
  });

  test("callback is rate-limited by the immutable GitHub identity before admission", async () => {
    const callbackIdentities: string[] = [];
    let accountAdmissionCalls = 0;
    const driver = createGitHubCallbackTestDriver({
      admitGitHubCallback: (githubIdentityId) => {
        callbackIdentities.push(githubIdentityId);
        return Promise.resolve(false);
      },
      admitAccount: () => {
        accountAdmissionCalls += 1;
        return Promise.resolve({
          accountId: "account-42",
          workspaceId: "workspace-42",
        });
      },
    });
    installGitHubOAuthTestDouble();

    const response = await driver.completeSignIn();

    expect(response.headers.get("location")).toBe(
      "https://cantiara.example/login?error=sign_in_failed",
    );
    expect(callbackIdentities).toEqual(["42"]);
    expect(accountAdmissionCalls).toBe(0);
  });

  test("HTTP entry point rejects email and password sign-in", async () => {
    const options = createAuthOptions(
      authConfig,
      {} as never,
      acceptingAccountAdmission(),
    );
    const auth = betterAuth({
      ...options,
      database: memoryAdapter({
        account: [],
        rateLimit: [],
        session: [],
        user: [],
        verification: [],
      }),
    });
    const request = (path: string, body: Record<string, string>) =>
      auth.handler(
        new Request(`https://api.cantiara.example/api/auth${path}`, {
          body: JSON.stringify(body),
          headers: {
            "content-type": "application/json",
            origin: "https://cantiara.example",
          },
          method: "POST",
        }),
      );

    const emailResponse = await request("/sign-in/email", {
      email: "founder@example.invalid",
      password: "not-a-real-password",
    });
    const githubResponse = await request("/sign-in/social", {
      callbackURL: "https://cantiara.example/dashboard",
      provider: "github",
    });
    const githubResult = (await githubResponse.json()) as { url: string };
    const authorizationUrl = new URL(githubResult.url);

    expect(emailResponse.status).toBe(400);
    expect(githubResponse.status).toBe(200);
    expect(authorizationUrl.hostname).toBe("github.com");
    expect(authorizationUrl.searchParams.get("scope")?.split(" ")).toEqual(
      GITHUB_LOGIN_SCOPES,
    );
    expect(githubResponse.headers.get("set-cookie")).toContain("HttpOnly");
    expect(githubResponse.headers.get("set-cookie")).toContain("Secure");
    expect(githubResponse.headers.get("set-cookie")).toContain("SameSite=Lax");
  });

  test("raw session endpoints cannot expose tokens or bypass revoke events", async () => {
    const options = createAuthOptions(
      authConfig,
      {} as never,
      acceptingAccountAdmission(),
    );
    const auth = betterAuth({
      ...options,
      database: memoryAdapter({
        account: [],
        rateLimit: [],
        session: [],
        user: [],
        verification: [],
      }),
    });

    const responses = await Promise.all(
      [
        "/list-sessions",
        "/revoke-session",
        "/revoke-sessions",
        "/revoke-other-sessions",
      ].map((path) =>
        auth.handler(
          new Request(`https://api.cantiara.example/api/auth${path}`, {
            headers: {
              "content-type": "application/json",
              origin: "https://cantiara.example",
            },
            method: path === "/list-sessions" ? "GET" : "POST",
          }),
        ),
      ),
    );

    expect(responses.map((response) => response.status)).toEqual([
      404, 404, 404, 404,
    ]);
  });

  test("first and repeated GitHub callbacks create and reuse one Account and Workspace", async () => {
    const callbackIdentities: string[] = [];
    const accountIds: string[] = [];
    const workspaces = new Map<string, string>();
    const accountAdmission: AccountAdmission = {
      admitGitHubCallback(githubIdentityId) {
        callbackIdentities.push(githubIdentityId);
        return Promise.resolve(true);
      },
      admitAccount(accountId) {
        accountIds.push(accountId);
        const workspaceId =
          workspaces.get(accountId) ?? `workspace-${accountId}`;
        workspaces.set(accountId, workspaceId);
        return Promise.resolve({ accountId, workspaceId });
      },
    };
    const driver = createGitHubCallbackTestDriver(accountAdmission);
    installGitHubOAuthTestDouble();

    expect((await driver.completeSignIn()).status).toBe(302);
    expect((await driver.completeSignIn()).status).toBe(302);
    expect(callbackIdentities).toEqual(["42", "42"]);
    expect(accountIds).toHaveLength(2);
    expect(accountIds[0]).toBe(accountIds[1]);
    expect(workspaces).toHaveLength(1);
  });

  test("trusted forwarded client IPs receive separate sign-in rate-limit buckets", async () => {
    const options = createAuthOptions(
      authConfig,
      {} as never,
      acceptingAccountAdmission(),
    );
    const auth = betterAuth({
      ...options,
      database: memoryAdapter({
        account: [],
        rateLimit: [],
        session: [],
        user: [],
        verification: [],
      }),
    });
    const request = (clientIp: string) =>
      auth.handler(
        new Request("https://api.cantiara.example/api/auth/sign-in/social", {
          body: JSON.stringify({
            callbackURL: "https://cantiara.example/dashboard",
            provider: "github",
          }),
          headers: {
            "content-type": "application/json",
            "x-forwarded-for": `${clientIp}, 203.0.113.10`,
            origin: "https://cantiara.example",
          },
          method: "POST",
        }),
      );

    const firstClientResponses = await Promise.all(
      Array.from({ length: 5 }, () => request("198.51.100.10")),
    );
    const secondClientResponse = await request("198.51.100.11");

    expect(
      firstClientResponses.every((response) => response.status === 200),
    ).toBe(true);
    expect(secondClientResponse.status).toBe(200);
  });
});
