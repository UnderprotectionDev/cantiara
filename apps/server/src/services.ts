import { createAuth } from "@cantiara/auth";
import { createDb, type Database } from "@cantiara/db";
import { createSecurityEventDb } from "@cantiara/db/security-events";

import { desktopOrigins, env } from "./env";
import { createDatabaseAccountAdmission } from "./features/account-access/server/account-admission";
import { createDatabaseAccountSessionAccess } from "./features/account-access/server/session-access-database";

const db = createDb(env);
const securityEventDb = createSecurityEventDb({
  DATABASE_URL: env.SECURITY_EVENT_DATABASE_URL,
});
const accountAdmission = createDatabaseAccountAdmission(db);
export const accountSessionAccess = createDatabaseAccountSessionAccess(
  db,
  securityEventDb,
);
let securityReplay: Promise<void> | undefined;

export function replaySessionRevocations() {
  securityReplay ??= accountSessionAccess.replaySessionRevocations();
  return securityReplay.finally(() => {
    securityReplay = undefined;
  });
}

export function getDb(): Database {
  return db;
}
export const auth = createAuth(env, db, accountAdmission, desktopOrigins);
