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
import { createDatabaseAccountPreferences } from "../src/features/account-preferences/server/account-preferences-database";

const webOrigin = "http://127.0.0.1:4173";
const serverOrigin = "http://127.0.0.1:3100";
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
const fixtureEmail = "account-access-e2e@example.invalid";
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
if (!currentCookie) {
  throw new Error("Better Auth did not create an E2E session cookie");
}

serve({
  hostname: "127.0.0.1",
  port: 3100,
  fetch(request, server) {
    if (new URL(request.url).pathname === "/__e2e/setup") {
      return Response.json({ cookie: currentCookie });
    }
    return app.fetch(request, server);
  },
});
