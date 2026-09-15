import { createAuth } from "@cantiara/auth";
import { createDb, type Database } from "@cantiara/db";

import { desktopOrigins, env } from "./env";
import { createDatabaseAccountAdmission } from "./features/account-access/server/account-admission";

const db = createDb(env);
const accountAdmission = createDatabaseAccountAdmission(db);

export function getDb(): Database {
  return db;
}
export const auth = createAuth(env, db, accountAdmission, desktopOrigins);
