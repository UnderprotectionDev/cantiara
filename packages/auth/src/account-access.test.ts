import { betterAuth } from "better-auth";
import { memoryAdapter } from "better-auth/adapters/memory";
import { describe, expect, test } from "vitest";

import {
  ACCOUNT_ACCESS_FAILURE_MESSAGE,
  createAccountAdmission,
  GITHUB_LOGIN_SCOPES,
  type GitHubIdentity,
} from "./account-access";
import { createAuthOptions } from "./index";

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
    findOrCreate(accountId: string) {
      const existing = admissions.get(accountId);
      if (existing) {
        return Promise.resolve(existing);
      }

      const admission = {
        accountId,
        workspaceId: `workspace-${accountId}`,
      };
      admissions.set(accountId, admission);
      return Promise.resolve(admission);
    },
  };
}

const acceptingRateLimit = {
  consume: async () => true,
};

describe("Account Access", () => {
  test("first GitHub sign-in creates one Account and Workspace", async () => {
    const github = new GitHubOAuthTestDouble();
    const store = createMemoryAccountWorkspaceStore();
    github.addAccount("account-42", {
      id: "github-42",
    });
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
        findOrCreate(accountId) {
          if (accountId === "known") {
            return Promise.reject(new Error("account already exists"));
          }
          return store.findOrCreate(accountId);
        },
      },
    });

    await expect(accountAccess.admitAccount("unknown")).rejects.toThrow(
      ACCOUNT_ACCESS_FAILURE_MESSAGE,
    );
    await expect(accountAccess.admitAccount("known")).rejects.toThrow(
      ACCOUNT_ACCESS_FAILURE_MESSAGE,
    );
  });

  test("callback is rate-limited by the immutable GitHub identity", async () => {
    const github = new GitHubOAuthTestDouble();
    const consumedIdentities: string[] = [];
    github.addAccount("account-42", { id: "github-42" });
    const accountAccess = createAccountAdmission({
      githubIdentities: github,
      rateLimit: {
        consume(githubIdentityId) {
          consumedIdentities.push(githubIdentityId);
          return Promise.resolve(false);
        },
      },
      workspaces: createMemoryAccountWorkspaceStore(),
    });

    await expect(accountAccess.admitAccount("account-42")).rejects.toThrow(
      ACCOUNT_ACCESS_FAILURE_MESSAGE,
    );
    expect(consumedIdentities).toEqual(["github-42"]);
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
