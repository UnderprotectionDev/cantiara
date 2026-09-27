import { readState, workspaceEnvironment } from "./workspace-neon";

const [, , kind] = process.argv;
if (kind !== "primary" && kind !== "security") {
  throw new Error("Expected primary or security migration target");
}
const env = await workspaceEnvironment(readState());
const child = Bun.spawn(
  [
    "bun",
    "./scripts/migrate.ts",
    ...(kind === "security" ? ["--security-events"] : []),
    ...process.argv.slice(3),
  ],
  { cwd: "packages/db", env, stdout: "inherit", stderr: "inherit" },
);
process.exitCode = await child.exited;
