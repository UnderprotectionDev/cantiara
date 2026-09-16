import { describe, expect, test, vi } from "vitest";

import { createGitHubIdentityConfirmationOAuth } from "./github-identity-confirmation-oauth";

describe("Account Access Confirm GitHub Identity OAuth", () => {
  test("builds a least-privilege PKCE URL with account selection", () => {
    const oauth = createGitHubIdentityConfirmationOAuth({
      callbackURL:
        "https://api.cantiara.example/api/auth/confirm-github-identity/callback",
      clientId: "github-client-id",
      clientSecret: "github-client-secret",
    });

    const url = new URL(
      oauth.createAuthorizationUrl({
        codeChallenge: "C".repeat(43),
        state: "S".repeat(43),
      }),
    );

    expect(url.origin + url.pathname).toBe(
      "https://github.com/login/oauth/authorize",
    );
    expect(url.searchParams.get("client_id")).toBe("github-client-id");
    expect(url.searchParams.get("redirect_uri")).toBe(
      "https://api.cantiara.example/api/auth/confirm-github-identity/callback",
    );
    expect(url.searchParams.get("scope")).toBe("read:user");
    expect(url.searchParams.get("state")).toBe("S".repeat(43));
    expect(url.searchParams.get("code_challenge")).toBe("C".repeat(43));
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
    expect(url.searchParams.get("prompt")).toBe("select_account");
    expect(url.href).not.toContain("client_secret");
  });

  test("exchanges the code with PKCE and returns only GitHub's stable user id", async () => {
    const requests: Request[] = [];
    const markAvailable = vi.fn();
    const oauth = createGitHubIdentityConfirmationOAuth({
      callbackURL:
        "https://api.cantiara.example/api/auth/confirm-github-identity/callback",
      clientId: "github-client-id",
      clientSecret: "github-client-secret",
      fetch: (input, init) => {
        if (input instanceof Request) {
          requests.push(new Request(input, init));
        } else {
          requests.push(new Request(input.toString(), init));
        }
        if (requests.length === 1) {
          return Promise.resolve(
            Response.json({
              access_token: "github-access-token",
              scope: "read:user",
              token_type: "bearer",
            }),
          );
        }
        return Promise.resolve(
          Response.json({
            email: "founder@example.invalid",
            id: 42,
            login: "founder",
          }),
        );
      },
      githubAvailability: {
        markAvailable,
        markUnavailable: vi.fn(),
      },
    });

    await expect(
      oauth.exchangeAuthorizationCode({
        code: "authorization-code",
        codeVerifier: "V".repeat(43),
      }),
    ).resolves.toBe("42");

    expect(requests).toHaveLength(2);
    expect(requests[0]?.url).toBe(
      "https://github.com/login/oauth/access_token",
    );
    const tokenBody = await requests[0]?.text();
    expect(tokenBody).toContain("client_id=github-client-id");
    expect(tokenBody).toContain("client_secret=github-client-secret");
    expect(tokenBody).toContain(
      "code_verifier=VVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV",
    );
    expect(requests[0]?.url).not.toContain("github-client-secret");
    expect(requests[1]?.headers.get("authorization")).toBe(
      "Bearer github-access-token",
    );
    expect(markAvailable).toHaveBeenCalledOnce();
  });

  test("marks GitHub unavailable and returns no identity when the provider is down", async () => {
    const markUnavailable = vi.fn();
    const oauth = createGitHubIdentityConfirmationOAuth({
      callbackURL:
        "https://api.cantiara.example/api/auth/confirm-github-identity/callback",
      clientId: "github-client-id",
      clientSecret: "github-client-secret",
      fetch: () => Promise.reject(new Error("GitHub unavailable")),
      githubAvailability: {
        markAvailable: vi.fn(),
        markUnavailable,
      },
    });

    await expect(
      oauth.exchangeAuthorizationCode({
        code: "authorization-code",
        codeVerifier: "V".repeat(43),
      }),
    ).resolves.toBeNull();
    expect(markUnavailable).toHaveBeenCalledOnce();
  });

  test("does not treat a rejected authorization code as a provider outage", async () => {
    const markUnavailable = vi.fn();
    const oauth = createGitHubIdentityConfirmationOAuth({
      callbackURL:
        "https://api.cantiara.example/api/auth/confirm-github-identity/callback",
      clientId: "github-client-id",
      clientSecret: "github-client-secret",
      fetch: async () =>
        Response.json({
          error: "bad_verification_code",
          error_description: "The code passed is incorrect or expired.",
        }),
      githubAvailability: {
        markAvailable: vi.fn(),
        markUnavailable,
      },
    });

    await expect(
      oauth.exchangeAuthorizationCode({
        code: "authorization-code",
        codeVerifier: "V".repeat(43),
      }),
    ).resolves.toBeNull();
    expect(markUnavailable).not.toHaveBeenCalled();
  });
});
