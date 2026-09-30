import { defineConfig } from "drizzle-kit";
import { primarySchemaFiles } from "./schema-files";
import { env } from "./src/env";

export default defineConfig({
  schema: primarySchemaFiles,
  out: "./src/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: env.DATABASE_URL,
  },
});
