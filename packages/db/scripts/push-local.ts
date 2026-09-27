const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl || process.env.NEON_LOCAL !== "true") {
  throw new Error(
    "db:push requires an explicit disposable local PostgreSQL target",
  );
}
const host = new URL(databaseUrl).hostname;
if (!["localhost", "127.0.0.1", "[::1]"].includes(host)) {
  throw new Error("db:push cannot target a managed or shared database");
}
const child = spawn(["./node_modules/.bin/drizzle-kit", "push"], {
  env: process.env,
  stdout: "inherit",
  stderr: "inherit",
});
process.exitCode = await child.exited;

import { spawn } from "bun";
