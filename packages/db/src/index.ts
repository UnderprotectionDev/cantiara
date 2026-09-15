import { Pool } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";

import type { DatabaseConfig } from "./config";
// biome-ignore lint/performance/noNamespaceImport: Drizzle requires the complete relational schema object.
import * as schema from "./schema";

export function createDb(env: DatabaseConfig) {
  const pool = new Pool({ connectionString: env.DATABASE_URL });
  return drizzle({ client: pool, schema });
}

export type Database = ReturnType<typeof createDb>;
