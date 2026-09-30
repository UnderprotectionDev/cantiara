import { defineConfig } from "drizzle-kit";
import { securitySchemaFiles } from "./schema-files";
import { resolveSecurityEventDatabaseUrl } from "./src/security-event-database-url";

const securityEventDatabaseUrl = resolveSecurityEventDatabaseUrl(process.env);

if (!securityEventDatabaseUrl) {
  throw new Error("SECURITY_EVENT_DATABASE_URL is required");
}

export default defineConfig({
  schema: securitySchemaFiles,
  out: "./src/migrations/security-events",
  dialect: "postgresql",
  dbCredentials: {
    url: securityEventDatabaseUrl,
  },
});
