import { assertLocalPostgresTarget } from "../packages/db/scripts/migration-connection";
import { resolveSecurityEventDatabaseUrl } from "../packages/db/src/security-event-database-url";

const task = process.argv[2] ?? "dev";
const commands: Record<string, string[]> = {
  dev: [
    "./node_modules/.bin/turbo",
    "run",
    "dev",
    "--ui=tui",
    "--filter=fumadocs",
    "--filter=server",
    "--filter=web",
    "--filter=extension",
    "--filter=@cantiara/api",
  ],
  server: ["bun", "run", "dev:server"],
};
const command = commands[task];
if (!command) {
  throw new Error("Expected dev or server task");
}
if (process.env.NEON_LOCAL !== "true") {
  throw new Error("Local development requires NEON_LOCAL=true");
}
assertLocalPostgresTarget(process.env.DATABASE_URL);
assertLocalPostgresTarget(resolveSecurityEventDatabaseUrl(process.env));

const proxy = Bun.spawn(["bun", "scripts/neon-local-proxy.ts"], {
  env: process.env,
  stdout: "inherit",
  stderr: "inherit",
});
await Bun.sleep(300);
if (proxy.exitCode !== null) {
  throw new Error("Local PostgreSQL proxy could not start");
}

const development = Bun.spawn(command, {
  env: process.env,
  stdin: "inherit",
  stdout: "inherit",
  stderr: "inherit",
});
const stop = () => {
  development.kill();
  proxy.kill();
};
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
try {
  process.exitCode = await development.exited;
} finally {
  stop();
  await proxy.exited;
  process.off("SIGINT", stop);
  process.off("SIGTERM", stop);
}
