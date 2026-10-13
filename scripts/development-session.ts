import { spawn } from "node:child_process";

interface DevelopmentLease {
  close: () => Promise<void>;
  verify: () => Promise<void>;
}

export async function superviseDevelopmentProcess(
  command: string[],
  lease: DevelopmentLease,
  pollIntervalMs = 2000,
) {
  const [executable, ...arguments_] = command;
  if (!executable) {
    await lease.close();
    throw new Error("Development command is required");
  }
  const child = spawn(executable, arguments_, {
    stdio: "inherit",
    env: process.env,
  });
  let failure = false;
  let interrupted = false;
  let verifying: Promise<void> | undefined;
  let killTimeout: ReturnType<typeof setTimeout> | undefined;
  const stop = () => {
    if (child.exitCode !== null || child.signalCode !== null) {
      return;
    }
    child.kill("SIGTERM");
    killTimeout ??= setTimeout(() => child.kill("SIGKILL"), 5000);
  };
  const interrupt = () => {
    interrupted = true;
    stop();
  };
  process.on("SIGINT", interrupt);
  process.on("SIGTERM", interrupt);
  const timer = setInterval(() => {
    if (verifying) {
      return;
    }
    verifying = lease
      .verify()
      .catch(() => {
        failure = true;
        console.error(
          "Development database session changed or disconnected. API stopped. Run bun run db:doctor and reconcile schema/history before restarting.",
        );
        stop();
      })
      .finally(() => {
        verifying = undefined;
      });
  }, pollIntervalMs);
  try {
    const exitCode = await new Promise<number>((resolve) => {
      child.once("error", () => {
        failure = true;
        resolve(1);
      });
      child.once("exit", (code) => resolve(code ?? 1));
    });
    if (failure) {
      return 1;
    }
    return interrupted ? 130 : exitCode;
  } finally {
    clearInterval(timer);
    if (killTimeout) {
      clearTimeout(killTimeout);
    }
    process.off("SIGINT", interrupt);
    process.off("SIGTERM", interrupt);
    await verifying;
    await lease.close();
  }
}
