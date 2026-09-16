import { migrate } from "drizzle-orm/neon-serverless/migrator";

import { createDb } from "../src/index";
import { createSecurityEventDb } from "../src/security-events";

const securityEvents = process.argv.includes("--security-events");
const databaseUrl = securityEvents
  ? process.env.SECURITY_EVENT_DATABASE_URL
  : process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error(
    securityEvents
      ? "SECURITY_EVENT_DATABASE_URL is required"
      : "DATABASE_URL is required",
  );
}

const database = securityEvents
  ? createSecurityEventDb({ DATABASE_URL: databaseUrl })
  : createDb({ DATABASE_URL: databaseUrl });

try {
  await migrate(database, {
    migrationsFolder: securityEvents
      ? "./src/migrations/security-events"
      : "./src/migrations",
  });
} finally {
  await database.$client.end();
}
