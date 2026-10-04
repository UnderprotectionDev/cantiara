import { applicationEnvironment } from "./application-environment";
import { developmentDatabaseMode } from "./dev-database-mode";
import { developmentCommand } from "./local-dev-command";

const { command, requiresDatabase } = developmentCommand(process.argv.slice(2));
const environment = applicationEnvironment(process.env);
if (!requiresDatabase) {
  const help = Bun.spawn(command, {
    env: environment,
    stdin: "inherit",
    stdout: "inherit",
    stderr: "inherit",
  });
  process.exit(await help.exited);
}
const { startLocalProxy } = developmentDatabaseMode(environment);

const proxy = startLocalProxy
  ? Bun.spawn(["bun", "scripts/neon-local-proxy.ts"], {
      env: environment,
      stdout: "inherit",
      stderr: "inherit",
    })
  : null;
if (proxy) {
  await Bun.sleep(300);
  if (proxy.exitCode !== null) {
    throw new Error("Local PostgreSQL proxy could not start");
  }
}

let development: ReturnType<typeof Bun.spawn> | undefined;
let doctor: ReturnType<typeof Bun.spawn> | undefined;
let stopped = false;
const stop = () => {
  stopped = true;
  doctor?.kill();
  development?.kill();
  proxy?.kill();
};
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
try {
  doctor = Bun.spawn(
    ["bun", "packages/db/scripts/doctor.ts", "--development"],
    {
      env: environment,
      stdout: "inherit",
      stderr: "inherit",
    },
  );
  const status = await doctor.exited;
  doctor = undefined;
  if (stopped) {
    process.exitCode = 130;
  } else if (status === 0) {
    development = Bun.spawn(command, {
      env: environment,
      stdin: "inherit",
      stdout: "inherit",
      stderr: "inherit",
    });
    process.exitCode = await development.exited;
  } else {
    process.exitCode = status;
  }
} finally {
  stop();
  if (proxy) {
    await proxy.exited;
  }
  process.off("SIGINT", stop);
  process.off("SIGTERM", stop);
}
