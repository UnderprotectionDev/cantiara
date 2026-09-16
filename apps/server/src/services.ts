import { createAuth } from "@cantiara/auth";
import { createDb, type Database } from "@cantiara/db";
import { createSecurityEventDb } from "@cantiara/db/security-events";

import { desktopOrigins, env } from "./env";
import { createDatabaseAccountAdmission } from "./features/account-access/server/account-admission";
import { createGitHubAvailability } from "./features/account-access/server/github-availability";
import { createDatabaseAccountSessionAccess } from "./features/account-access/server/session-access-database";
import { createDatabaseTauriSessionAccess } from "./features/account-access/server/tauri-session-database";

const db = createDb(env);
const securityEventDb = createSecurityEventDb({
  DATABASE_URL: env.SECURITY_EVENT_DATABASE_URL,
});
const accountAdmission = createDatabaseAccountAdmission(db);
export const githubAvailability = createGitHubAvailability();
export const accountSessionAccess = createDatabaseAccountSessionAccess(
  db,
  securityEventDb,
  { onGitHubLoginOAuthRevoked: githubAvailability.requireFreshConsent },
);
export const tauriSessionAccess = createDatabaseTauriSessionAccess(
  db,
  accountSessionAccess,
  securityEventDb,
);
let securityReplay: Promise<void> | undefined;

export function replaySessionRevocations() {
  if (!securityReplay) {
    securityReplay = accountSessionAccess
      .replaySessionRevocations()
      .catch((error) => {
        securityReplay = undefined;
        throw error;
      });
  }
  return securityReplay;
}

// The GitHub login OAuth adapter calls this signal when its authorization is revoked.
// GitHub App installation signals must not call it.
export function notifyGitHubLoginOAuthRevoked(accountId: string) {
  return accountSessionAccess.revokeGitHubLoginOAuth(accountId);
}

export function getDb(): Database {
  return db;
}
export const auth = createAuth(
  env,
  db,
  accountAdmission,
  desktopOrigins,
  githubAvailability,
);
