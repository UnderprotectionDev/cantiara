import type { Database } from "@cantiara/db";
import {
  account,
  rateLimit,
  session,
  user,
  verification,
} from "@cantiara/db/schema/auth";
import {
  type BetterAuthOptions,
  type BetterAuthPlugin,
  betterAuth,
} from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import {
  authorizationCodeRequest,
  getOAuth2Tokens,
  type OAuth2Tokens,
  type OAuthProvider,
} from "better-auth/oauth2";
import { github } from "better-auth/social-providers";

const schema = { account, rateLimit, session, user, verification };
export const SESSION_ABSOLUTE_LIFETIME_MS = 30 * 24 * 60 * 60 * 1000;
export const SESSION_IDLE_LIFETIME_MS = 12 * 60 * 60 * 1000;
const SESSION_ABSOLUTE_LIFETIME_SECONDS = SESSION_ABSOLUTE_LIFETIME_MS / 1000;

export interface AccountAdmission {
  admitAccount: (accountId: string) => Promise<unknown>;
  admitGitHubCallback: (githubIdentityId: string) => Promise<boolean>;
}

export interface GitHubAvailabilityObserver {
  markAvailable: () => void | Promise<void>;
  markLoginConsentSatisfied?: () => void | Promise<void>;
  markUnavailable: () => void | Promise<void>;
}

export interface AuthConfig {
  BETTER_AUTH_SECRET: string;
  BETTER_AUTH_URL: string;
  CORS_ORIGIN: string;
  GITHUB_CLIENT_ID: string;
  GITHUB_CLIENT_SECRET: string;
  TRUSTED_PROXY_IPS: readonly string[];
}

const GITHUB_OAUTH_TOKEN_ENDPOINT =
  "https://github.com/login/oauth/access_token";
const GITHUB_USER_ENDPOINT = "https://api.github.com/user";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isGitHubOAuthAvailabilityFailure(status: number) {
  // GitHub normally returns an OAuth error payload for an invalid or already
  // consumed code. A 400 is therefore an identity-flow failure, not proof
  // that GitHub is unavailable. Other non-success responses are provider
  // failures worth surfacing as Waiting for GitHub.
  return status !== 400;
}

function isGitHubIdentityRejection(status: number) {
  return status === 401 || status === 403;
}

async function markUnavailableAfterGitHubUserInfoFailure(
  token: OAuth2Tokens,
  githubAvailability: GitHubAvailabilityObserver,
) {
  try {
    const response = await fetch(GITHUB_USER_ENDPOINT, {
      headers: {
        Authorization: `Bearer ${token.accessToken}`,
        "User-Agent": "better-auth",
      },
    });

    if (!(response.ok || isGitHubIdentityRejection(response.status))) {
      await githubAvailability.markUnavailable();
    }
  } catch {
    await githubAvailability.markUnavailable();
  }
}

function shouldMarkGitHubOAuthUnavailable(response: Response) {
  return response.ok || isGitHubOAuthAvailabilityFailure(response.status);
}

async function parseGitHubOAuthTokenResponse(
  response: Response,
  githubAvailability: GitHubAvailabilityObserver,
) {
  let data: unknown;
  try {
    data = await response.json();
  } catch {
    if (shouldMarkGitHubOAuthUnavailable(response)) {
      await githubAvailability.markUnavailable();
    }
    return null;
  }

  if (!response.ok) {
    if (shouldMarkGitHubOAuthUnavailable(response)) {
      await githubAvailability.markUnavailable();
    }
    return null;
  }

  if (!(isRecord(data) && !("error" in data))) {
    return null;
  }

  return getOAuth2Tokens(data);
}

async function exchangeGitHubAuthorizationCode(
  provider: OAuthProvider,
  input: {
    code: string;
    codeVerifier?: string;
    redirectURI: string;
  },
  githubAvailability: GitHubAvailabilityObserver,
) {
  const { body, headers } = await authorizationCodeRequest({
    ...input,
    options: provider.options ?? {},
    tokenEndpoint: GITHUB_OAUTH_TOKEN_ENDPOINT,
  });

  try {
    const response = await fetch(GITHUB_OAUTH_TOKEN_ENDPOINT, {
      body,
      headers,
      method: "POST",
    });
    return parseGitHubOAuthTokenResponse(response, githubAvailability);
  } catch {
    await githubAvailability.markUnavailable();
    return null;
  }
}

function createGitHubAvailabilityPlugin(
  githubAvailability: GitHubAvailabilityObserver,
): BetterAuthPlugin {
  return {
    id: "cantiara-github-availability",
    init: (context) => {
      const provider = context.socialProviders.find(
        (candidate) => candidate.id === "github",
      );
      if (!provider) {
        return;
      }

      // Better Auth validates the authorization code before calling the
      // configured getUserInfo hook. Observe that provider stage here so a
      // transport outage cannot leave the public availability state stale.
      provider.validateAuthorizationCode = ({
        code,
        codeVerifier,
        redirectURI,
      }) =>
        exchangeGitHubAuthorizationCode(
          provider,
          { code, codeVerifier, redirectURI },
          githubAvailability,
        );
    },
  };
}

export function createAuthOptions(
  env: AuthConfig,
  database: Database,
  accountAdmission: AccountAdmission,
  desktopOrigins: readonly string[] = [],
  githubAvailability?: GitHubAvailabilityObserver,
): BetterAuthOptions {
  const defaultGitHubProvider = github({
    clientId: env.GITHUB_CLIENT_ID,
    clientSecret: env.GITHUB_CLIENT_SECRET,
  });

  return {
    database: drizzleAdapter(database, {
      provider: "pg",
      schema,
      transaction: true,
    }),
    disabledPaths: [
      "/list-sessions",
      "/revoke-session",
      "/revoke-sessions",
      "/revoke-other-sessions",
    ],
    trustedOrigins: [env.CORS_ORIGIN, ...desktopOrigins],
    emailAndPassword: { enabled: false },
    socialProviders: {
      github: {
        clientId: env.GITHUB_CLIENT_ID,
        clientSecret: env.GITHUB_CLIENT_SECRET,
        getUserInfo: async (token) => {
          let userInfo: Awaited<
            ReturnType<typeof defaultGitHubProvider.getUserInfo>
          > = null;
          try {
            // This runs after GitHub identity verification and before Better Auth
            // links/provisions an Account or creates a session.
            userInfo = await defaultGitHubProvider.getUserInfo(token);
          } catch {
            if (githubAvailability) {
              await markUnavailableAfterGitHubUserInfoFailure(
                token,
                githubAvailability,
              );
            }
            return null;
          }

          if (!userInfo) {
            if (githubAvailability) {
              await markUnavailableAfterGitHubUserInfoFailure(
                token,
                githubAvailability,
              );
            }
            return null;
          }
          await githubAvailability?.markAvailable();

          try {
            if (
              !(await accountAdmission.admitGitHubCallback(
                String(userInfo.data.id),
              ))
            ) {
              return null;
            }
            await githubAvailability?.markLoginConsentSatisfied?.();
            return userInfo;
          } catch {
            return null;
          }
        },
      },
    },
    account: {
      accountLinking: { enabled: false },
      encryptOAuthTokens: true,
    },
    session: {
      disableSessionRefresh: true,
      expiresIn: SESSION_ABSOLUTE_LIFETIME_SECONDS,
    },
    secret: env.BETTER_AUTH_SECRET,
    baseURL: env.BETTER_AUTH_URL,
    rateLimit: {
      enabled: true,
      storage: "database",
      customRules: {
        "/sign-in/social": { window: 60, max: 5 },
        "/callback/github": { window: 60, max: 5 },
      },
    },
    databaseHooks: {
      session: {
        create: {
          before: async (sessionRecord) => {
            try {
              await accountAdmission.admitAccount(sessionRecord.userId);
            } catch {
              return false;
            }
          },
        },
      },
    },
    advanced: {
      disableCSRFCheck: false,
      disableOriginCheck: false,
      ipAddress: {
        ipAddressHeaders: ["x-forwarded-for"],
        trustedProxies: [...env.TRUSTED_PROXY_IPS],
      },
      useSecureCookies: true,
      defaultCookieAttributes: {
        sameSite: "lax",
        secure: true,
        httpOnly: true,
      },
    },
    plugins: githubAvailability
      ? [createGitHubAvailabilityPlugin(githubAvailability)]
      : [],
  };
}

export function createAuth(
  env: AuthConfig,
  database: Database,
  accountAdmission: AccountAdmission,
  desktopOrigins: readonly string[] = [],
  githubAvailability?: GitHubAvailabilityObserver,
) {
  return betterAuth(
    createAuthOptions(
      env,
      database,
      accountAdmission,
      desktopOrigins,
      githubAvailability,
    ),
  );
}
