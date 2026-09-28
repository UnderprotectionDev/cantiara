import { Client, Pool } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";

import "./local-postgres";
import { securityEvent } from "./schema/security-event";

const schema = { securityEvent };

export function createSecurityEventDb(config: { DATABASE_URL: string }) {
  const pool = new Pool({ connectionString: config.DATABASE_URL });
  return drizzle({ client: pool, schema });
}

export async function createLocalSecurityEventDb(config: {
  DATABASE_URL: string;
  proxyAddress?: string;
}) {
  const client = new Client({ connectionString: config.DATABASE_URL });
  client.neonConfig.webSocketConstructor = WebSocket;
  client.neonConfig.useSecureWebSocket = false;
  client.neonConfig.pipelineConnect = false;
  client.neonConfig.wsProxy = () => config.proxyAddress ?? "127.0.0.1:5433";
  await client.connect();
  return drizzle({ client, schema });
}

export type SecurityEventDatabase =
  | ReturnType<typeof createSecurityEventDb>
  | Awaited<ReturnType<typeof createLocalSecurityEventDb>>;
