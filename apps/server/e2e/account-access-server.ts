import { createAuthOptions } from "@cantiara/auth";
import { createDb } from "@cantiara/db";
import { account, session, user } from "@cantiara/db/schema/auth";
import { createSecurityEventDb } from "@cantiara/db/security-events";
import { betterAuth } from "better-auth";
import { testUtils } from "better-auth/plugins";
import { serve } from "bun";
import { eq } from "drizzle-orm";
import { initLogger } from "evlog";

import { createApp } from "../src/app";
import { createDatabaseAccountAdmission } from "../src/features/account-access/server/account-admission";
import { createGitHubAvailability } from "../src/features/account-access/server/github-availability";
import { CONFIRM_GITHUB_IDENTITY_CALLBACK_PATH } from "../src/features/account-access/server/github-identity-confirmation";
import { createDatabaseGitHubIdentityConfirmation } from "../src/features/account-access/server/github-identity-confirmation-database";
import { createDatabaseAccountSessionAccess } from "../src/features/account-access/server/session-access-database";
import {
  accountPreferencesMutationTarget,
  createDatabaseAccountPreferences,
} from "../src/features/account-preferences/server/account-preferences-database";
import { createDatabaseMutationContract } from "../src/features/mutation-and-undo/server/mutation-contract-database";

const serverPort = Number(process.env.E2E_SERVER_PORT ?? "3100");
const serverOrigin = `http://127.0.0.1:${serverPort}`;
const webOrigin = process.env.E2E_WEB_ORIGIN ?? "http://127.0.0.1:4173";
const E2E_FIXTURE_KEY_PATTERN = /^[a-z-]+$/;
const databaseUrl = process.env.DATABASE_URL;
const securityEventDatabaseUrl = process.env.SECURITY_EVENT_DATABASE_URL;
const secret = process.env.BETTER_AUTH_SECRET;

if (!(databaseUrl && securityEventDatabaseUrl && secret)) {
  throw new Error(
    "DATABASE_URL, SECURITY_EVENT_DATABASE_URL, and BETTER_AUTH_SECRET are required",
  );
}

const database = createDb({ DATABASE_URL: databaseUrl });
const securityEventDatabase = createSecurityEventDb({
  DATABASE_URL: securityEventDatabaseUrl,
});
const accountAdmission = createDatabaseAccountAdmission(database);
const accountPreferences = createDatabaseAccountPreferences(database);
const accountPreferencesMutationContract = createDatabaseMutationContract(
  database,
  { target: accountPreferencesMutationTarget },
);
const githubAvailability = createGitHubAvailability();
const auth = betterAuth({
  ...createAuthOptions(
    {
      BETTER_AUTH_SECRET: secret,
      BETTER_AUTH_URL: serverOrigin,
      CORS_ORIGIN: webOrigin,
      GITHUB_CLIENT_ID: "e2e-github-client",
      GITHUB_CLIENT_SECRET: "e2e-github-secret",
      TRUSTED_PROXY_IPS: [],
    },
    database,
    accountAdmission,
    [],
    githubAvailability,
  ),
  plugins: [testUtils()],
});
const accountSessionAccess = createDatabaseAccountSessionAccess(
  database,
  securityEventDatabase,
  { onGitHubLoginOAuthRevoked: githubAvailability.requireFreshConsent },
);
const githubIdentityConfirmation = createDatabaseGitHubIdentityConfirmation(
  database,
  {
    authorizeSession: (principal) =>
      accountSessionAccess.authorizeWrite(principal),
    callbackURL: new URL(CONFIRM_GITHUB_IDENTITY_CALLBACK_PATH, serverOrigin)
      .href,
    clientId: "e2e-github-client",
    clientSecret: "e2e-github-secret",
    githubAvailability,
  },
);
await accountSessionAccess.replaySessionRevocations();

initLogger({ env: { service: "cantiara-e2e-server" } });

const app = createApp({
  accountSessionAccess,
  accountPreferences,
  accountPreferencesCompatibility: accountPreferences,
  accountPreferencesMutationContract,
  auth,
  corsOrigin: webOrigin,
  database,
  desktopOrigins: [],
  githubAvailability,
  githubIdentityConfirmation,
  nodeEnv: "test",
  redactSecrets: () => new Error("Redacted E2E server error"),
  trustedProxyIps: [],
});

const authContext = await auth.$context;
async function createE2EFixture(fixtureKey: string) {
  const fixtureEmail = `account-access-e2e-${fixtureKey}@example.invalid`;
  await database.delete(user).where(eq(user.email, fixtureEmail));
  const founder = authContext.test.createUser({
    email: fixtureEmail,
    emailVerified: true,
    name: "Founder",
  });
  await authContext.test.saveUser(founder);
  await database.insert(account).values({
    accountId: `e2e-github-${crypto.randomUUID()}`,
    id: crypto.randomUUID(),
    providerId: "github",
    userId: founder.id,
  });
  const currentLogin = await authContext.test.login({ userId: founder.id });
  const otherLogin = await authContext.test.login({ userId: founder.id });
  await database
    .update(session)
    .set({
      userAgent:
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:155.0) Gecko/20100101 Firefox/155.0",
    })
    .where(eq(session.id, currentLogin.session.id));
  await database
    .update(session)
    .set({
      userAgent:
        "Mozilla/5.0 (X11; Linux x86_64; rv:142.0) Gecko/20100101 Firefox/142.0",
    })
    .where(eq(session.id, otherLogin.session.id));

  const [currentCookie] = currentLogin.cookies;
  const [otherCookie] = otherLogin.cookies;
  if (!(currentCookie && otherCookie)) {
    throw new Error("Better Auth did not create an E2E session cookie");
  }

  return { currentCookie, otherCookie };
}

serve({
  hostname: "127.0.0.1",
  port: serverPort,
  async fetch(request, server) {
    const url = new URL(request.url);
    if (url.pathname === "/__e2e/setup") {
      const fixtureKey = url.searchParams.get("fixture");
      if (!(fixtureKey && E2E_FIXTURE_KEY_PATTERN.test(fixtureKey))) {
        return Response.json(
          { error: "A lowercase fixture key is required" },
          { status: 400 },
        );
      }

      const { currentCookie, otherCookie } = await createE2EFixture(fixtureKey);
      return Response.json({ cookie: currentCookie, otherCookie });
    }
    return app.fetch(request, server);
  },
});
