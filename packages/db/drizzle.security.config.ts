import { defineConfig } from "drizzle-kit";
import { resolveSecurityEventDatabaseUrl } from "./src/security-event-database-url";

const securityEventDatabaseUrl = resolveSecurityEventDatabaseUrl(process.env);

if (!securityEventDatabaseUrl) {
  throw new Error("SECURITY_EVENT_DATABASE_URL is required");
}

export default defineConfig({
  schema: "./src/schema/security-event.ts",
  out: "./src/migrations/security-events",
  dialect: "postgresql",
  dbCredentials: {
    url: securityEventDatabaseUrl,
  },
});
