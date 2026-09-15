import { createAuth } from "@cantiara/auth";
import { createDb, type Database } from "@cantiara/db";

import { desktopOrigins, env } from "./env.server";

const db = createDb(env);

export function getDb(): Database {
  return db;
}
export const auth = createAuth(env, db, desktopOrigins);
