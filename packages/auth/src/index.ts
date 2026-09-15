import type { Database } from "@cantiara/db";
// biome-ignore lint/performance/noNamespaceImport: The Drizzle adapter requires the complete schema object.
import * as schema from "@cantiara/db/schema/auth";
import { type BetterAuthOptions, betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import type { AccountAdmission } from "./account-access";
import { createDatabaseAccountAdmission } from "./account-admission";

export interface AuthConfig {
  BETTER_AUTH_SECRET: string;
  BETTER_AUTH_URL: string;
  CORS_ORIGIN: string;
  GITHUB_CLIENT_ID: string;
  GITHUB_CLIENT_SECRET: string;
}

export function createAuthOptions(
  env: AuthConfig,
  database: Database,
  accountAdmission: AccountAdmission,
  desktopOrigins: readonly string[] = [],
): BetterAuthOptions {
  return {
    database: drizzleAdapter(database, {
      provider: "pg",
      schema,
    }),
    trustedOrigins: [env.CORS_ORIGIN, ...desktopOrigins],
    emailAndPassword: { enabled: false },
    socialProviders: {
      github: {
        clientId: env.GITHUB_CLIENT_ID,
        clientSecret: env.GITHUB_CLIENT_SECRET,
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
          before: async (session) => {
            try {
              await accountAdmission.admitAccount(session.userId);
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
  desktopOrigins: readonly string[] = [],
) {
  return betterAuth(
    createAuthOptions(
      env,
      database,
      createDatabaseAccountAdmission(database),
      desktopOrigins,
    ),
  );
}
