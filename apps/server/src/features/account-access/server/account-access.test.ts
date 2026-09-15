import { createAuthOptions } from "@cantiara/auth";
import { betterAuth } from "better-auth";
import { memoryAdapter } from "better-auth/adapters/memory";
import { afterEach, describe, expect, test } from "vitest";

import {
  ACCOUNT_ACCESS_FAILURE_CODE,
  createAccountAdmission,
  GITHUB_LOGIN_SCOPES,
  type GitHubIdentity,
} from "./account-access";
import { sanitizeGitHubCallbackResponse } from "./github-callback-response";

class GitHubOAuthTestDouble {
  readonly #identities = new Map<string, GitHubIdentity>();

  addAccount(accountId: string, identity: GitHubIdentity) {
    this.#identities.set(accountId, identity);
  }

  findByAccountId(accountId: string) {
    return Promise.resolve(this.#identities.get(accountId) ?? null);
  }
}

function createMemoryAccountWorkspaceStore() {
  const admissions = new Map<
    string,
    { accountId: string; workspaceId: string }
  >();

  return {
    admissions,
    add(accountId: string) {
      const admission = {
        accountId,
        workspaceId: `workspace-${accountId}`,
      };
      admissions.set(accountId, admission);
      return admission;
    },
    findByAccountId(accountId: string) {
      return Promise.resolve(admissions.get(accountId) ?? null);
    },
  };
}

const acceptingRateLimit = {
  consume: async () => true,
};

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

describe("Account Access", () => {
  test("first GitHub sign-in creates one Account and Workspace", async () => {
    const github = new GitHubOAuthTestDouble();
    const store = createMemoryAccountWorkspaceStore();
    github.addAccount("account-42", {
      id: "github-42",
    });
    store.add("account-42");
    const accountAccess = createAccountAdmission({
      githubIdentities: github,
      rateLimit: acceptingRateLimit,
      workspaces: store,
    });

    await expect(accountAccess.admitAccount("account-42")).resolves.toEqual({
      accountId: "account-42",
      workspaceId: "workspace-account-42",
    });
    expect(store.admissions).toHaveLength(1);
  });

  test("repeat GitHub sign-in reuses the same Account and Workspace", async () => {
    const github = new GitHubOAuthTestDouble();
    const store = createMemoryAccountWorkspaceStore();
    github.addAccount("account-42", { id: "github-42" });
    store.add("account-42");
    const accountAccess = createAccountAdmission({
      githubIdentities: github,
      rateLimit: acceptingRateLimit,
      workspaces: store,
    });

    const first = await accountAccess.admitAccount("account-42");
    const repeated = await accountAccess.admitAccount("account-42");

    expect(repeated).toEqual(first);
    expect(store.admissions).toHaveLength(1);
  });

  test("login requests identity scopes and no repository authority", () => {
    expect(GITHUB_LOGIN_SCOPES).toEqual(["read:user", "user:email"]);
    expect(GITHUB_LOGIN_SCOPES).not.toContain("repo");
    expect(GITHUB_LOGIN_SCOPES).not.toContain("write:org");
  });

  test("callback failures do not reveal Account or Workspace existence", async () => {
    const github = new GitHubOAuthTestDouble();
    const store = createMemoryAccountWorkspaceStore();
    github.addAccount("known", { id: "github-42" });
    const accountAccess = createAccountAdmission({
      githubIdentities: github,
      rateLimit: acceptingRateLimit,
      workspaces: {
        ...store,
        findByAccountId(accountId) {
          if (accountId === "known") {
            return Promise.reject(new Error("account already exists"));
          }
          return store.findByAccountId(accountId);
        },
      },
    });

    await expect(accountAccess.admitAccount("unknown")).rejects.toThrow(
      ACCOUNT_ACCESS_FAILURE_CODE,
    );
    await expect(accountAccess.admitAccount("known")).rejects.toThrow(
      ACCOUNT_ACCESS_FAILURE_CODE,
    );

    const callbackRequest = new Request(
      "https://api.cantiara.example/api/auth/callback/github",
    );
    const unknownResponse = sanitizeGitHubCallbackResponse(
      callbackRequest,
      Response.redirect(
        "https://api.cantiara.example/error?error=unable_to_create_user",
      ),
      "https://cantiara.example",
    );
    const knownResponse = sanitizeGitHubCallbackResponse(
      callbackRequest,
      Response.redirect(
        "https://api.cantiara.example/error?error=account_not_linked",
      ),
      "https://cantiara.example",
    );

    expect(unknownResponse.headers.get("location")).toBe(
      "https://cantiara.example/login?error=sign_in_failed",
    );
    expect(knownResponse.headers.get("location")).toBe(
      unknownResponse.headers.get("location"),
    );
  });

  test("start and callback are rate-limited by the immutable GitHub identity", async () => {
    const github = new GitHubOAuthTestDouble();
    const consumedBudgets: string[] = [];
    github.addAccount("account-42", { id: "github-42" });
    const accountAccess = createAccountAdmission({
      githubIdentities: github,
      rateLimit: {
        consume(githubIdentityId, stage) {
          consumedBudgets.push(`${stage}:${githubIdentityId}`);
          return Promise.resolve(stage === "start");
        },
      },
      workspaces: createMemoryAccountWorkspaceStore(),
    });

    await expect(accountAccess.admitAccount("account-42")).rejects.toThrow(
      ACCOUNT_ACCESS_FAILURE_CODE,
    );
    expect(consumedBudgets).toEqual(["start:github-42", "callback:github-42"]);
  });

  test("Better Auth exposes only GitHub sign-in with secure web cookies", () => {
    const options = createAuthOptions(
      {
        BETTER_AUTH_URL: "https://api.cantiara.example",
        BETTER_AUTH_SECRET: "test-secret-that-is-long-enough-123456",
        CORS_ORIGIN: "https://cantiara.example",
        GITHUB_CLIENT_ID: "github-client-id",
        GITHUB_CLIENT_SECRET: "github-client-secret",
      },
      {} as never,
      {
        admitAccount: async (accountId) => ({
          accountId,
          workspaceId: "workspace-42",
        }),
      },
    );

    expect(options.emailAndPassword).toEqual({ enabled: false });
    expect(Object.keys(options.socialProviders ?? {})).toEqual(["github"]);
    expect(options.socialProviders?.github).toMatchObject({
      clientId: "github-client-id",
      clientSecret: "github-client-secret",
    });
    expect(options.account?.accountLinking).toEqual({ enabled: false });
    expect(options.account?.encryptOAuthTokens).toBe(true);
    expect(options.advanced).toMatchObject({
      defaultCookieAttributes: {
        httpOnly: true,
        sameSite: "lax",
        secure: true,
      },
      disableCSRFCheck: false,
      disableOriginCheck: false,
      useSecureCookies: true,
    });
    expect(options.rateLimit).toMatchObject({
      enabled: true,
      storage: "database",
    });
  });

  test("HTTP entry point rejects email and password sign-in", async () => {
    const options = createAuthOptions(
      {
        BETTER_AUTH_URL: "https://api.cantiara.example",
        BETTER_AUTH_SECRET: "test-secret-that-is-long-enough-123456",
        CORS_ORIGIN: "https://cantiara.example",
        GITHUB_CLIENT_ID: "github-client-id",
        GITHUB_CLIENT_SECRET: "github-client-secret",
      },
      {} as never,
      {
        admitAccount: async (accountId) => ({
          accountId,
          workspaceId: "workspace-42",
        }),
      },
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

  test("GitHub callback creates and then reuses one Account and Workspace", async () => {
    const database = {
      account: [],
      rateLimit: [],
      session: [],
      user: [],
      verification: [],
    };
    const workspaces = new Map<string, string>();
    const accountAdmission = {
      admitAccount(accountId: string) {
        const workspaceId =
          workspaces.get(accountId) ?? `workspace-${accountId}`;
        workspaces.set(accountId, workspaceId);
        return Promise.resolve({ accountId, workspaceId });
      },
    };
    const options = createAuthOptions(
      {
        BETTER_AUTH_URL: "https://api.cantiara.example",
        BETTER_AUTH_SECRET: "test-secret-that-is-long-enough-123456",
        CORS_ORIGIN: "https://cantiara.example",
        GITHUB_CLIENT_ID: "github-client-id",
        GITHUB_CLIENT_SECRET: "github-client-secret",
      },
      {} as never,
      accountAdmission,
    );
    const auth = betterAuth({
      ...options,
      database: memoryAdapter(database),
    });
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

    async function completeSignIn() {
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
      return auth.handler(
        new Request(
          `https://api.cantiara.example/api/auth/callback/github?code=test-code&state=${state}`,
          { headers: { cookie: stateCookie } },
        ),
      );
    }

    expect((await completeSignIn()).status).toBe(302);
    expect((await completeSignIn()).status).toBe(302);
    expect(database.user).toHaveLength(1);
    expect(database.account).toHaveLength(1);
    expect(workspaces).toHaveLength(1);
  });

  test("session admission fails closed without exposing its reason", async () => {
    const attempts: string[] = [];
    const options = createAuthOptions(
      {
        BETTER_AUTH_URL: "https://api.cantiara.example",
        BETTER_AUTH_SECRET: "test-secret-that-is-long-enough-123456",
        CORS_ORIGIN: "https://cantiara.example",
        GITHUB_CLIENT_ID: "github-client-id",
        GITHUB_CLIENT_SECRET: "github-client-secret",
      },
      {} as never,
      {
        admitAccount(accountId) {
          attempts.push(accountId);
          return Promise.reject(new Error("workspace exists"));
        },
      },
    );

    const result = await options.databaseHooks?.session?.create?.before?.(
      { userId: "account-42" } as never,
      null,
    );

    expect(attempts).toEqual(["account-42"]);
    expect(result).toBe(false);
  });
});
