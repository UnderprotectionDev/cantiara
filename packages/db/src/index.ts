import { Pool } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";

import "./local-postgres";

import type { DatabaseConfig } from "./config";
import {
  account,
  accountPreferences,
  accountPreferencesRelations,
  accountRelations,
  auditRecord,
  rateLimit,
  session,
  sessionRelations,
  user,
  userRelations,
  verification,
  workspace,
  workspaceRelations,
} from "./schema";
import {
  mutationHistory,
  mutationReceipt,
  mutationTarget,
} from "./schema/mutation";

const schema = {
  account,
  accountPreferences,
  accountPreferencesRelations,
  accountRelations,
  auditRecord,
  mutationHistory,
  mutationReceipt,
  mutationTarget,
  rateLimit,
  session,
  sessionRelations,
  user,
  userRelations,
  verification,
  workspace,
  workspaceRelations,
};

export function createDb(env: DatabaseConfig) {
  const pool = new Pool({ connectionString: env.DATABASE_URL });
  return drizzle({ client: pool, schema });
}

export type Database = ReturnType<typeof createDb>;
