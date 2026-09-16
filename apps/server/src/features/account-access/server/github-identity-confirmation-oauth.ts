import { fetch as undiciFetch } from "undici";

const GITHUB_AUTHORIZATION_ENDPOINT =
  "https://github.com/login/oauth/authorize";
const GITHUB_TOKEN_ENDPOINT = "https://github.com/login/oauth/access_token";
const GITHUB_USER_ENDPOINT = "https://api.github.com/user";
const GITHUB_IDENTITY_ID_PATTERN = /^\d+$/;

export const CONFIRM_GITHUB_IDENTITY_SCOPE = "read:user";

interface GitHubOAuthFetchInit {
  body?: URLSearchParams;
  headers?: Record<string, string>;
  method?: string;
}

interface GitHubOAuthFetchResponse {
  json: () => Promise<unknown>;
  ok: boolean;
  status: number;
}

export interface GitHubIdentityConfirmationOAuthAvailability {
  markAvailable: () => void | Promise<void>;
  markUnavailable: () => void | Promise<void>;
}

interface GitHubIdentityConfirmationOAuthOptions {
  callbackURL: string;
  clientId: string;
  clientSecret: string;
  fetch?: (
    input: string | URL,
    init?: GitHubOAuthFetchInit,
  ) => Promise<GitHubOAuthFetchResponse>;
  githubAvailability?: GitHubIdentityConfirmationOAuthAvailability;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseAccessToken(value: unknown) {
  if (!isRecord(value) || typeof value.access_token !== "string") {
    return null;
  }
  return value.access_token.length > 0 ? value.access_token : null;
}

function parseGitHubIdentityId(value: unknown) {
  if (!isRecord(value)) {
    return null;
  }

  if (
    typeof value.id === "number" &&
    Number.isSafeInteger(value.id) &&
    value.id >= 0
  ) {
    return String(value.id);
  }

  if (
    typeof value.id === "string" &&
    GITHUB_IDENTITY_ID_PATTERN.test(value.id)
  ) {
    return value.id;
  }

  return null;
}

export function createGitHubIdentityConfirmationOAuth({
  callbackURL,
  clientId,
  clientSecret,
  fetch: fetcher = undiciFetch,
  githubAvailability,
}: GitHubIdentityConfirmationOAuthOptions) {
  async function markUnavailable() {
    try {
      await githubAvailability?.markUnavailable();
    } catch {
      // Availability is advisory; the confirmation remains fail-closed.
    }
  }

  async function markAvailable() {
    try {
      await githubAvailability?.markAvailable();
    } catch {
      // Availability is advisory and cannot turn a verified identity into a grant.
    }
  }

  async function requestToken(code: string, codeVerifier: string) {
    try {
      return await fetcher(GITHUB_TOKEN_ENDPOINT, {
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          code,
          code_verifier: codeVerifier,
          redirect_uri: callbackURL,
        }),
        headers: {
          accept: "application/json",
          "content-type": "application/x-www-form-urlencoded",
        },
        method: "POST",
      });
    } catch {
      await markUnavailable();
      return null;
    }
  }

  async function accessTokenFromResponse(response: GitHubOAuthFetchResponse) {
    let body: unknown;
    try {
      body = await response.json();
    } catch {
      if (response.status !== 400) {
        await markUnavailable();
      }
      return null;
    }

    if (!response.ok) {
      if (response.status !== 400) {
        await markUnavailable();
      }
      return null;
    }

    if (!isRecord(body) || "error" in body) {
      return null;
    }

    return parseAccessToken(body);
  }

  async function requestUser(accessToken: string) {
    try {
      return await fetcher(GITHUB_USER_ENDPOINT, {
        headers: {
          accept: "application/vnd.github+json",
          authorization: `Bearer ${accessToken}`,
          "user-agent": "cantiara-account-access",
        },
      });
    } catch {
      await markUnavailable();
      return null;
    }
  }

  async function identityFromResponse(response: GitHubOAuthFetchResponse) {
    if (!response.ok) {
      if (response.status !== 401 && response.status !== 403) {
        await markUnavailable();
      }
      return null;
    }

    let body: unknown;
    try {
      body = await response.json();
    } catch {
      return null;
    }

    return parseGitHubIdentityId(body);
  }

  return {
    createAuthorizationUrl({
      codeChallenge,
      state,
    }: {
      codeChallenge: string;
      state: string;
    }) {
      const url = new URL(GITHUB_AUTHORIZATION_ENDPOINT);
      url.searchParams.set("client_id", clientId);
      url.searchParams.set("redirect_uri", callbackURL);
      url.searchParams.set("scope", CONFIRM_GITHUB_IDENTITY_SCOPE);
      url.searchParams.set("state", state);
      url.searchParams.set("code_challenge", codeChallenge);
      url.searchParams.set("code_challenge_method", "S256");
      url.searchParams.set("prompt", "select_account");
      return url.href;
    },
    async exchangeAuthorizationCode({
      code,
      codeVerifier,
    }: {
      code: string;
      codeVerifier: string;
    }) {
      const tokenResponse = await requestToken(code, codeVerifier);
      if (!tokenResponse) {
        return null;
      }

      const accessToken = await accessTokenFromResponse(tokenResponse);
      if (!accessToken) {
        return null;
      }

      const userResponse = await requestUser(accessToken);
      if (!userResponse) {
        return null;
      }

      const githubIdentityId = await identityFromResponse(userResponse);
      if (!githubIdentityId) {
        return null;
      }

      await markAvailable();
      return githubIdentityId;
    },
  };
}
