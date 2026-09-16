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
import { createDatabaseAccountSessionAccess } from "../src/features/account-access/server/session-access-database";

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
  ),
  plugins: [testUtils()],
});
const accountSessionAccess = createDatabaseAccountSessionAccess(
  database,
  securityEventDatabase,
);

initLogger({ env: { service: "cantiara-e2e-server" } });

const app = createApp({
  accountSessionAccess,
  auth,
  corsOrigin: webOrigin,
  database,
  desktopOrigins: [],
  nodeEnv: "test",
  redactSecrets: () => new Error("Redacted E2E server error"),
  replaySessionRevocations: () =>
    accountSessionAccess.replaySessionRevocations(),
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
  .set({ userAgent: "Current browser" })
  .where(eq(session.id, currentLogin.session.id));
await database
  .update(session)
  .set({ userAgent: "Firefox on Linux" })
  .where(eq(session.id, otherLogin.session.id));

const [currentCookie] = currentLogin.cookies;
if (!currentCookie) {
  throw new Error("Better Auth did not create an E2E session cookie");
}

serve({
  hostname: "127.0.0.1",
  port: 3100,
  fetch(request) {
    if (new URL(request.url).pathname === "/__e2e/setup") {
      return Response.json({ cookie: currentCookie });
    }
    return app.fetch(request);
  },
});
