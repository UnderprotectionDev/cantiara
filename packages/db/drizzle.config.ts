import { defineConfig } from "drizzle-kit";

import { env } from "./src/env";

export default defineConfig({
  schema: [
    "./src/schema/auth.ts",
    "./src/schema/mutation.ts",
    "./src/schema/custom-fields.ts",
    "./src/schema/completion-effects.ts",
    "./src/schema/daily-focus.ts",
    "./src/schema/file-attachments.ts",
    "./src/schema/project.ts",
    "./src/schema/priority-metrics.ts",
    "./src/schema/backlog.ts",
    "./src/schema/prioritization-session.ts",
    "./src/schema/capture-triage.ts",
    "./src/schema/work.ts",
    "./src/schema/work-external-handoff.ts",
    "./src/schema/work-draft.ts",
    "./src/schema/work-template.ts",
    "./src/schema/record-action.ts",
    "./src/schema/relation.ts",
    "./src/schema/tags.ts",
  ],
  out: "./src/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: env.DATABASE_URL,
  },
});
