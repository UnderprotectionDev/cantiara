import { Pool } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";

import "./local-postgres";
import { securityEvent } from "./schema/security-event";

const schema = { securityEvent };

export function createSecurityEventDb(config: { DATABASE_URL: string }) {
  const pool = new Pool({ connectionString: config.DATABASE_URL });
  return drizzle({ client: pool, schema });
}

export type SecurityEventDatabase = ReturnType<typeof createSecurityEventDb>;
