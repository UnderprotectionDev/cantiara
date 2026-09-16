import { defineConfig } from "drizzle-kit";

const securityEventDatabaseUrl = process.env.SECURITY_EVENT_DATABASE_URL;

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
