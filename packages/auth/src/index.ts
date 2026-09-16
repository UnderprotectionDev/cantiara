import type { Database } from "@cantiara/db";
import {
  account,
  rateLimit,
  session,
  user,
  verification,
} from "@cantiara/db/schema/auth";
import { type BetterAuthOptions, betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { github } from "better-auth/social-providers";

const schema = { account, rateLimit, session, user, verification };

export interface AccountAdmission {
  admitAccount: (accountId: string) => Promise<unknown>;
  admitGitHubCallback: (githubIdentityId: string) => Promise<boolean>;
}

export interface AuthConfig {
  BETTER_AUTH_SECRET: string;
  BETTER_AUTH_URL: string;
  CORS_ORIGIN: string;
  GITHUB_CLIENT_ID: string;
  GITHUB_CLIENT_SECRET: string;
  TRUSTED_PROXY_IPS: readonly string[];
}

export function createAuthOptions(
  env: AuthConfig,
  database: Database,
  accountAdmission: AccountAdmission,
  desktopOrigins: readonly string[] = [],
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
    trustedOrigins: [env.CORS_ORIGIN, ...desktopOrigins],
    emailAndPassword: { enabled: false },
    socialProviders: {
      github: {
        clientId: env.GITHUB_CLIENT_ID,
        clientSecret: env.GITHUB_CLIENT_SECRET,
        getUserInfo: async (token) => {
          try {
            // This runs after GitHub identity verification and before Better Auth
            // links/provisions an Account or creates a session.
            const userInfo = await defaultGitHubProvider.getUserInfo(token);
            if (
              !(
                userInfo &&
                (await accountAdmission.admitGitHubCallback(
                  String(userInfo.data.id),
                ))
              )
            ) {
              return null;
            }
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
    plugins: [],
  };
}

export function createAuth(
  env: AuthConfig,
  database: Database,
  accountAdmission: AccountAdmission,
  desktopOrigins: readonly string[] = [],
) {
  return betterAuth(
    createAuthOptions(env, database, accountAdmission, desktopOrigins),
  );
}
