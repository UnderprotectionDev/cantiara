import { readState, workspaceEnvironment } from "./workspace-neon";

const [, , kind] = process.argv;
if (kind !== "primary" && kind !== "security") {
  throw new Error("Expected primary or security migration target");
}
const local = process.env.NEON_LOCAL === "true";
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
