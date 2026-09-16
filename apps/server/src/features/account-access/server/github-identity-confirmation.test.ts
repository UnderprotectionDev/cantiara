import { describe, expect, test } from "vitest";

import {
  createGitHubIdentityConfirmation,
  type GitHubIdentityConfirmationGrant,
  type GitHubIdentityConfirmationHandoff,
  type GitHubIdentityConfirmationState,
  type GitHubIdentityConfirmationStore,
} from "./github-identity-confirmation";

const PRINCIPAL = {
  accountId: "account-1",
  sessionId: "session-1",
} as const;
const BASE64_URL_VALUE_PATTERN = /^[A-Za-z0-9_-]{43}$/;

function createStore() {
  const states = new Map<
    string,
    { expiresAt: Date; state: GitHubIdentityConfirmationState }
  >();
  const grants = new Map<
    string,
    { expiresAt: Date; grant: GitHubIdentityConfirmationGrant }
  >();
  const handoffs = new Map<
    string,
    { expiresAt: Date; handoff: GitHubIdentityConfirmationHandoff }
  >();

  return {
    consumeGrant: (
      identifier: string,
      grant: GitHubIdentityConfirmationGrant,
      now: Date,
    ) => {
      const stored = grants.get(identifier);
      if (
        !stored ||
        stored.expiresAt <= now ||
        stored.grant.accountId !== grant.accountId ||
        stored.grant.operationId !== grant.operationId
      ) {
        return Promise.resolve(false);
      }
      grants.delete(identifier);
      return Promise.resolve(true);
    },
    consumeHandoff: (
      identifier: string,
      principal: { accountId: string; sessionId: string },
      now: Date,
    ) => {
      const stored = handoffs.get(identifier);
      if (
        !stored ||
        stored.expiresAt <= now ||
        stored.handoff.accountId !== principal.accountId ||
        stored.handoff.sessionId !== principal.sessionId
      ) {
        return Promise.resolve(null);
      }
      const grant = grants.get(stored.handoff.grantIdentifier);
      if (
        !grant ||
        grant.expiresAt <= now ||
        grant.grant.accountId !== stored.handoff.accountId ||
        grant.grant.operationId !== stored.handoff.operationId
      ) {
        return Promise.resolve(null);
      }
      handoffs.delete(identifier);
      return Promise.resolve(stored.handoff);
    },
    findState: (identifier: string, now: Date) => {
      const stored = states.get(identifier);
      return Promise.resolve(
        stored && stored.expiresAt > now ? stored.state : null,
      );
    },
    consumeState: (identifier: string, now: Date) => {
      const stored = states.get(identifier);
      if (!stored || stored.expiresAt <= now) {
        return Promise.resolve(null);
      }
      states.delete(identifier);
      return Promise.resolve(stored.state);
    },
    createGrant: (
      identifier: string,
      grant: GitHubIdentityConfirmationGrant,
      expiresAt: Date,
    ) => {
      grants.set(identifier, { expiresAt, grant });
      return Promise.resolve();
    },
    createHandoff: (
      identifier: string,
      handoff: GitHubIdentityConfirmationHandoff,
      expiresAt: Date,
    ) => {
      handoffs.set(identifier, { expiresAt, handoff });
      return Promise.resolve();
    },
    createState: (
      identifier: string,
      state: GitHubIdentityConfirmationState,
      expiresAt: Date,
    ) => {
      states.set(identifier, { expiresAt, state });
      return Promise.resolve();
    },
  } satisfies GitHubIdentityConfirmationStore;
}

describe("Account Access Confirm GitHub Identity", () => {
  test("fails closed when the session or confirmation rate limit rejects", async () => {
    let sessionAuthorized = false;
    let rateLimitAllowed = false;
    const rateLimitStages: string[] = [];
    const randomValues = ["A".repeat(43), "B".repeat(43)];
    const confirmation = createGitHubIdentityConfirmation({
      accountIdentities: {
        findGitHubIdentityId: async () => "42",
      },
      authorizeSession: () => Promise.resolve(sessionAuthorized),
      githubOAuth: {
        createAuthorizationUrl: ({ state }) => state,
        exchangeAuthorizationCode: () => Promise.resolve("42"),
      },
      randomValue: () => {
        const value = randomValues.shift();
        if (!value) {
          throw new Error("No deterministic random value remains");
        }
        return value;
      },
      rateLimit: {
        consume: ({ stage }) => {
          rateLimitStages.push(stage);
          return Promise.resolve(rateLimitAllowed);
        },
      },
      store: createStore(),
    });

    await expect(
      confirmation.start(PRINCIPAL, "account-closure-start"),
    ).resolves.toBeNull();
    expect(rateLimitStages).toEqual([]);

    sessionAuthorized = true;
    await expect(
      confirmation.start(PRINCIPAL, "account-closure-start"),
    ).resolves.toBeNull();
    expect(rateLimitStages).toEqual(["start"]);

    rateLimitAllowed = true;
    await confirmation.start(PRINCIPAL, "account-closure-start");
    rateLimitAllowed = false;
    await expect(
      confirmation.complete(PRINCIPAL, {
        code: "github-code",
        state: "A".repeat(43),
      }),
    ).resolves.toBeNull();
    expect(rateLimitStages).toEqual(["start", "start", "callback"]);

    await confirmation.recordFailure(
      PRINCIPAL,
      "A".repeat(43),
      "198.51.100.10",
    );
    expect(rateLimitStages).toEqual(["start", "start", "callback", "callback"]);
  });

  test("starts a fresh PKCE authorization-code tour for the requested operation", async () => {
    const confirmation = createGitHubIdentityConfirmation({
      accountIdentities: {
        findGitHubIdentityId: async () => "42",
      },
      githubOAuth: {
        createAuthorizationUrl: ({ codeChallenge, state }) => {
          const url = new URL(
            "https://github.com/login/oauth/authorize?client_id=github-client-id",
          );
          url.searchParams.set("state", state);
          url.searchParams.set("code_challenge", codeChallenge);
          url.searchParams.set("code_challenge_method", "S256");
          url.searchParams.set("prompt", "select_account");
          return url.href;
        },
        exchangeAuthorizationCode: async () => null,
      },
      store: createStore(),
    });

    const result = await confirmation.start(PRINCIPAL, "account-closure-start");

    expect(result).toEqual({
      authorizationUrl: expect.stringContaining("prompt=select_account"),
    });
    if (!(result && "authorizationUrl" in result)) {
      throw new Error("Authorization URL was not created");
    }
    const authorizationUrl = new URL(result.authorizationUrl);
    expect(authorizationUrl.searchParams.get("code_challenge_method")).toBe(
      "S256",
    );
    expect(authorizationUrl.searchParams.get("code_challenge")).toMatch(
      BASE64_URL_VALUE_PATTERN,
    );
    expect(authorizationUrl.searchParams.get("state")).toMatch(
      BASE64_URL_VALUE_PATTERN,
    );
  });

  test("returns Waiting for GitHub without creating an OAuth tour during an outage", async () => {
    let authorizationURLCalls = 0;
    const confirmation = createGitHubIdentityConfirmation({
      accountIdentities: {
        findGitHubIdentityId: async () => "42",
      },
      githubAvailability: { getStatus: () => "waiting" },
      githubOAuth: {
        createAuthorizationUrl: ({ state }) => {
          authorizationURLCalls += 1;
          return state;
        },
        exchangeAuthorizationCode: async () => "42",
      },
      store: createStore(),
    });

    await expect(
      confirmation.start(PRINCIPAL, "account-closure-start"),
    ).resolves.toEqual({ status: "waiting" });
    expect(authorizationURLCalls).toBe(0);
  });

  test("completes from the state-bound session and exchanges a one-time handoff", async () => {
    const randomValues = [
      "A".repeat(43),
      "B".repeat(43),
      "C".repeat(43),
      "D".repeat(43),
    ];
    const confirmation = createGitHubIdentityConfirmation({
      accountIdentities: {
        findGitHubIdentityId: async () => "42",
      },
      authorizeSession: (principal) =>
        Promise.resolve(
          principal.accountId === PRINCIPAL.accountId &&
            principal.sessionId === PRINCIPAL.sessionId,
        ),
      githubOAuth: {
        createAuthorizationUrl: ({ state }) => state,
        exchangeAuthorizationCode: ({ code, codeVerifier }) => {
          expect(code).toBe("github-code");
          expect(codeVerifier).toBe("B".repeat(43));
          return Promise.resolve("42");
        },
      },
      randomValue: () => {
        const value = randomValues.shift();
        if (!value) {
          throw new Error("No deterministic random value remains");
        }
        return value;
      },
      store: createStore(),
    });

    await confirmation.start(
      PRINCIPAL,
      "account-closure-start",
      "unknown",
      "tauri",
    );
    const completion = await confirmation.complete(null, {
      code: "github-code",
      state: "A".repeat(43),
    });

    expect(completion).toEqual({
      callbackCode: "D".repeat(43),
      clientPlatform: "tauri",
      grant: "C".repeat(43),
    });
    await expect(
      confirmation.exchange(PRINCIPAL, "D".repeat(43)),
    ).resolves.toBe("C".repeat(43));
    await expect(
      confirmation.consume(PRINCIPAL, "account-closure-start", "C".repeat(43)),
    ).resolves.toBe(true);
    await expect(
      confirmation.exchange(PRINCIPAL, "D".repeat(43)),
    ).resolves.toBeNull();
  });

  test("mints an operation-bound grant that can be consumed only once", async () => {
    const randomValues = [
      "A".repeat(43),
      "B".repeat(43),
      "C".repeat(43),
      "D".repeat(43),
    ];
    const confirmation = createGitHubIdentityConfirmation({
      accountIdentities: {
        findGitHubIdentityId: async () => "42",
      },
      githubOAuth: {
        createAuthorizationUrl: ({ state }) =>
          `https://github.com/login/oauth/authorize?state=${state}`,
        exchangeAuthorizationCode: ({ code, codeVerifier }) => {
          expect(code).toBe("github-code");
          expect(codeVerifier).toBe("B".repeat(43));
          return Promise.resolve("42");
        },
      },
      now: () => new Date("2026-09-16T09:00:00.000Z"),
      randomValue: () => {
        const value = randomValues.shift();
        if (!value) {
          throw new Error("No deterministic random value remains");
        }
        return value;
      },
      store: createStore(),
    });

    await confirmation.start(PRINCIPAL, "account-closure-start");
    const completion = await confirmation.complete(PRINCIPAL, {
      code: "github-code",
      state: "A".repeat(43),
    });
    const grant = completion?.grant;

    expect(grant).toBe("C".repeat(43));
    await expect(
      confirmation.consume(PRINCIPAL, "account-closure-start", grant ?? ""),
    ).resolves.toBe(true);
    await expect(
      confirmation.consume(PRINCIPAL, "account-closure-start", grant ?? ""),
    ).resolves.toBe(false);
  });

  test("rejects a callback when the current Account, session, or GitHub identity changes", async () => {
    const randomValues = [
      "A".repeat(43),
      "B".repeat(43),
      "C".repeat(43),
      "D".repeat(43),
      "E".repeat(43),
      "F".repeat(43),
      "G".repeat(43),
      "H".repeat(43),
    ];
    let returnedIdentityId = "42";
    const confirmation = createGitHubIdentityConfirmation({
      accountIdentities: {
        findGitHubIdentityId: async () => "42",
      },
      githubOAuth: {
        createAuthorizationUrl: ({ state }) =>
          `https://github.com/login/oauth/authorize?state=${state}`,
        exchangeAuthorizationCode: async () => returnedIdentityId,
      },
      randomValue: () => {
        const value = randomValues.shift();
        if (!value) {
          throw new Error("No deterministic random value remains");
        }
        return value;
      },
      store: createStore(),
    });

    await confirmation.start(PRINCIPAL, "account-closure-start");
    await expect(
      confirmation.complete(
        { accountId: "account-1", sessionId: "session-2" },
        { code: "github-code", state: "A".repeat(43) },
      ),
    ).resolves.toBeNull();

    await confirmation.start(PRINCIPAL, "account-closure-start");
    await expect(
      confirmation.complete(
        { accountId: "account-2", sessionId: "session-2" },
        { code: "github-code", state: "C".repeat(43) },
      ),
    ).resolves.toBeNull();

    await confirmation.start(PRINCIPAL, "account-closure-start");
    returnedIdentityId = "99";
    await expect(
      confirmation.complete(PRINCIPAL, {
        code: "github-code",
        state: "E".repeat(43),
      }),
    ).resolves.toBeNull();

    returnedIdentityId = "42";
    await expect(
      confirmation.complete(PRINCIPAL, {
        code: "github-code",
        state: "A".repeat(43),
      }),
    ).resolves.toMatchObject({ grant: "G".repeat(43) });
  });

  test("fails closed for an invalid state, provider PKCE failure, and an expired tour", async () => {
    let currentTime = new Date("2026-09-16T09:00:00.000Z");
    const randomValues = [
      "A".repeat(43),
      "B".repeat(43),
      "C".repeat(43),
      "D".repeat(43),
    ];
    const exchangeAuthorizationCode = async ({ code }: { code: string }) =>
      code === "valid-code" ? "42" : null;
    const confirmation = createGitHubIdentityConfirmation({
      accountIdentities: {
        findGitHubIdentityId: async () => "42",
      },
      githubOAuth: {
        createAuthorizationUrl: ({ state }) =>
          `https://github.com/login/oauth/authorize?state=${state}`,
        exchangeAuthorizationCode,
      },
      now: () => currentTime,
      randomValue: () => {
        const value = randomValues.shift();
        if (!value) {
          throw new Error("No deterministic random value remains");
        }
        return value;
      },
      store: createStore(),
    });

    await confirmation.start(PRINCIPAL, "account-closure-start");
    await expect(
      confirmation.complete(PRINCIPAL, {
        code: "valid-code",
        state: "Z".repeat(43),
      }),
    ).resolves.toBeNull();
    await expect(
      confirmation.complete(PRINCIPAL, {
        code: "invalid-pkce-code",
        state: "A".repeat(43),
      }),
    ).resolves.toBeNull();

    await confirmation.start(PRINCIPAL, "account-closure-start");
    currentTime = new Date("2026-09-16T09:10:00.001Z");
    await expect(
      confirmation.complete(PRINCIPAL, {
        code: "valid-code",
        state: "C".repeat(43),
      }),
    ).resolves.toBeNull();
  });

  test("keeps a grant bound to its own operation identifier", async () => {
    const randomValues = [
      "A".repeat(43),
      "B".repeat(43),
      "C".repeat(43),
      "D".repeat(43),
    ];
    const confirmation = createGitHubIdentityConfirmation({
      accountIdentities: {
        findGitHubIdentityId: async () => "42",
      },
      githubOAuth: {
        createAuthorizationUrl: ({ state }) => state,
        exchangeAuthorizationCode: async () => "42",
      },
      randomValue: () => {
        const value = randomValues.shift();
        if (!value) {
          throw new Error("No deterministic random value remains");
        }
        return value;
      },
      store: createStore(),
    });

    await confirmation.start(PRINCIPAL, "account-closure-start");
    const grant = (
      await confirmation.complete(PRINCIPAL, {
        code: "valid-code",
        state: "A".repeat(43),
      })
    )?.grant;

    await expect(
      confirmation.consume(PRINCIPAL, "account-closure-cancel", grant ?? ""),
    ).resolves.toBe(false);
    await expect(
      confirmation.consume(PRINCIPAL, "account-closure-start", grant ?? ""),
    ).resolves.toBe(true);
  });

  test("expires the OAuth tour and minted grant after at most ten minutes", async () => {
    const randomValues = [
      "A".repeat(43),
      "B".repeat(43),
      "C".repeat(43),
      "D".repeat(43),
    ];
    const baseStore = createStore();
    let stateExpiresAt: Date | undefined;
    let grantExpiresAt: Date | undefined;
    const store: GitHubIdentityConfirmationStore = {
      ...baseStore,
      createGrant: (identifier, grant, expiresAt) => {
        grantExpiresAt = expiresAt;
        return baseStore.createGrant(identifier, grant, expiresAt);
      },
      createState: (identifier, state, expiresAt) => {
        stateExpiresAt = expiresAt;
        return baseStore.createState(identifier, state, expiresAt);
      },
    };
    const now = new Date("2026-09-16T09:00:00.000Z");
    const confirmation = createGitHubIdentityConfirmation({
      accountIdentities: {
        findGitHubIdentityId: async () => "42",
      },
      githubOAuth: {
        createAuthorizationUrl: ({ state }) => state,
        exchangeAuthorizationCode: async () => "42",
      },
      now: () => now,
      randomValue: () => {
        const value = randomValues.shift();
        if (!value) {
          throw new Error("No deterministic random value remains");
        }
        return value;
      },
      store,
    });

    await confirmation.start(PRINCIPAL, "account-closure-start");
    await confirmation.complete(PRINCIPAL, {
      code: "valid-code",
      state: "A".repeat(43),
    });

    expect(stateExpiresAt).toEqual(new Date("2026-09-16T09:10:00.000Z"));
    expect(grantExpiresAt).toEqual(new Date("2026-09-16T09:10:00.000Z"));
  });

  test("records confirmation outcomes without raw Account, state, grant, or provider secrets", async () => {
    const randomValues = [
      "A".repeat(43),
      "B".repeat(43),
      "C".repeat(43),
      "D".repeat(43),
    ];
    const auditRecords: unknown[] = [];
    const confirmation = createGitHubIdentityConfirmation({
      accountIdentities: {
        findGitHubIdentityId: async () => "42",
      },
      auditRecords: {
        append: (record) => {
          auditRecords.push(record);
          return Promise.resolve();
        },
      },
      githubOAuth: {
        createAuthorizationUrl: ({ state }) => state,
        exchangeAuthorizationCode: () => Promise.resolve("42"),
      },
      randomValue: () => {
        const value = randomValues.shift();
        if (!value) {
          throw new Error("No deterministic random value remains");
        }
        return value;
      },
      store: createStore(),
    });

    await confirmation.start(PRINCIPAL, "account-closure-start");
    const grant = (
      await confirmation.complete(PRINCIPAL, {
        code: "provider-secret-code",
        state: "A".repeat(43),
      })
    )?.grant;
    await confirmation.consume(PRINCIPAL, "account-closure-start", grant ?? "");
    await confirmation.consume(PRINCIPAL, "account-closure-start", grant ?? "");

    expect(auditRecords).toHaveLength(4);
    expect(
      (auditRecords as Array<{ type: string }>).map((record) => record.type),
    ).toEqual([
      "github.identity-confirmation.started",
      "github.identity-confirmation.succeeded",
      "github.identity-confirmation.succeeded",
      "github.identity-confirmation.failed",
    ]);
    const serialized = JSON.stringify(auditRecords);
    expect(serialized).not.toContain("account-1");
    expect(serialized).not.toContain("A".repeat(43));
    expect(serialized).not.toContain("C".repeat(43));
    expect(serialized).not.toContain("provider-secret-code");
  });
});
