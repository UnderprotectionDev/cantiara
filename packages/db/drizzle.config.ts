import { defineConfig } from "drizzle-kit";

import { env } from "./src/env";

export default defineConfig({
  schema: ["./src/schema/auth.ts", "./src/schema/mutation.ts"],
  out: "./src/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: env.DATABASE_URL,
  },
});
