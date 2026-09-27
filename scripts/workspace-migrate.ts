import { existsSync } from "node:fs";
import { join } from "node:path";

import { readState, workspaceEnvironment } from "./workspace-neon";

const [, , kind] = process.argv;
if (kind !== "primary" && kind !== "security") {
  throw new Error("Expected primary or security migration target");
}
function isLocalPostgresEnabled() {
  if (process.env.NEON_LOCAL !== undefined) {
    return process.env.NEON_LOCAL === "true";
  }
  const envFile = join(import.meta.dir, "..", "apps", "server", ".env.local");
  if (!existsSync(envFile)) {
    return false;
  }
  const result = Bun.spawnSync(
    [
      "bun",
      `--env-file=${envFile}`,
      "--eval",
      "process.stdout.write(process.env.NEON_LOCAL ?? '')",
    ],
    { env: process.env, stderr: "ignore", stdout: "pipe" },
  );
  if (result.exitCode !== 0) {
    throw new Error("Could not load local migration environment");
  }
  return result.stdout.toString() === "true";
}

const local = isLocalPostgresEnabled();
const env = local ? process.env : await workspaceEnvironment(readState());
const child = Bun.spawn(
  [
    "bun",
    ...(local ? ["--env-file=../../apps/server/.env.local"] : []),
    "./scripts/migrate.ts",
    ...(kind === "security" ? ["--security-events"] : []),
    ...process.argv.slice(3),
  ],
  { cwd: "packages/db", env, stdout: "inherit", stderr: "inherit" },
);
process.exitCode = await child.exited;
