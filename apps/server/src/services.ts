import { createAuth } from "@cantiara/auth";
import { type Database, createDb } from "@cantiara/db";

import { env, desktopOrigins } from "./env.server";

const db = createDb(env);

export function getDb(): Database {
  return db;
}
export const auth = createAuth(env, db, desktopOrigins);
