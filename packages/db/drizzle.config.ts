import { defineConfig } from "drizzle-kit";

import { env } from "./src/env";

export default defineConfig({
  schema: [
    "./src/schema/auth.ts",
    "./src/schema/mutation.ts",
    "./src/schema/project.ts",
    "./src/schema/capture-triage.ts",
    "./src/schema/work.ts",
    "./src/schema/work-draft.ts",
    "./src/schema/relation.ts",
  ],
  out: "./src/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: env.DATABASE_URL,
  },
});
