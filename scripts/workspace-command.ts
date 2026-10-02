import { loadWorkspaceEnvironment } from "./workspace-database";

if (import.meta.main) {
  try {
    const command = process.argv.slice(2);
    if (command[0] === "--") {
      command.shift();
    }
    if (!command.length) {
      throw new Error("Workspace command is required");
    }
    const child = Bun.spawn(command, {
      cwd: process.cwd(),
      env: loadWorkspaceEnvironment(process.env),
      stdin: "inherit",
      stdout: "inherit",
      stderr: "inherit",
    });
    const stop = () => child.kill();
    process.on("SIGINT", stop);
    process.on("SIGTERM", stop);
    try {
      process.exitCode = await child.exited;
    } finally {
      process.off("SIGINT", stop);
      process.off("SIGTERM", stop);
    }
  } catch (error) {
    console.error(
      error instanceof Error ? error.message : "Workspace command failed",
    );
    process.exitCode = 1;
  }
}
