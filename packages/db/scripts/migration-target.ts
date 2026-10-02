import { Client, Pool } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import { loadWorkspaceEnvironment } from "../../../scripts/workspace-database";
import { resolveSecurityEventDatabaseUrl } from "../src/security-event-database-url";
import {
  assertLocalPostgresTarget,
  assertNeonMigrationTarget,
  migrationConnectionString,
} from "./migration-connection";

export function resolveMigrationTarget(
  environment: Record<string, string | undefined>,
  { securityEvents = false, deployment = false } = {},
) {
  const resolvedEnvironment = deployment
    ? environment
    : loadWorkspaceEnvironment(environment);
  if (deployment && resolvedEnvironment.CANTIARA_DEPLOY_MIGRATION !== "true") {
    throw new Error(
      "Deployment migration requires its explicit deployment command",
    );
  }
  const local =
    resolvedEnvironment.NEON_LOCAL === "true" ||
    (securityEvents && resolvedEnvironment.SECURITY_EVENT_LOCAL === "true");
  const applicationUrl = securityEvents
    ? resolveSecurityEventDatabaseUrl(resolvedEnvironment)
    : resolvedEnvironment.DATABASE_URL;
  if (local) {
    assertLocalPostgresTarget(applicationUrl);
  } else if (!deployment) {
    assertNeonMigrationTarget(applicationUrl);
  }
  const databaseUrl = migrationConnectionString(
    applicationUrl,
    securityEvents
      ? resolvedEnvironment.SECURITY_EVENT_DATABASE_URL_UNPOOLED
      : resolvedEnvironment.DATABASE_URL_UNPOOLED,
    { useLocalPostgres: local },
  );
  if (!databaseUrl) {
    throw new Error(
      securityEvents
        ? "SECURITY_EVENT_DATABASE_URL is required"
        : "DATABASE_URL is required",
    );
  }
  return { databaseUrl, local, securityEvents };
}

export async function connectMigrationTarget(
  target: ReturnType<typeof resolveMigrationTarget>,
  { queryTimeoutMs }: { queryTimeoutMs?: number } = {},
) {
  if (target.local) {
    const client = new Client({
      connectionString: target.databaseUrl,
      connectionTimeoutMillis: 10_000,
      query_timeout: queryTimeoutMs,
    });
    client.neonConfig.webSocketConstructor = WebSocket;
    client.neonConfig.useSecureWebSocket = false;
    client.neonConfig.pipelineConnect = false;
    client.neonConfig.wsProxy = () =>
      process.env.NEON_LOCAL_PROXY ?? "127.0.0.1:5433";
    await client.connect();
    return drizzle({ client });
  }
  return drizzle({
    client: new Pool({
      connectionString: target.databaseUrl,
      max: 2,
      connectionTimeoutMillis: 10_000,
      query_timeout: queryTimeoutMs,
    }),
  });
}
