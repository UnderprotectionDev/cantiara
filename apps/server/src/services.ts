import { createAuth } from "@cantiara/auth";
import { createDb, type Database } from "@cantiara/db";
import { createSecurityEventDb } from "@cantiara/db/security-events";

import { desktopOrigins, env } from "./env";
import { createDatabaseAccountAdmission } from "./features/account-access/server/account-admission";
import { createDatabaseAccountSessionAccess } from "./features/account-access/server/session-access-database";
import { createDatabaseTauriSessionAccess } from "./features/account-access/server/tauri-session-database";

const db = createDb(env);
const securityEventDb = createSecurityEventDb({
  DATABASE_URL: env.SECURITY_EVENT_DATABASE_URL,
});
const accountAdmission = createDatabaseAccountAdmission(db);
export const accountSessionAccess = createDatabaseAccountSessionAccess(
  db,
  securityEventDb,
);
export const tauriSessionAccess = createDatabaseTauriSessionAccess(
  db,
  accountSessionAccess,
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

export function getDb(): Database {
  return db;
}
export const auth = createAuth(env, db, accountAdmission, desktopOrigins);
