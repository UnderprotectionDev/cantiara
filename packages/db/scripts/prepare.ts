import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { type DatabaseDiagnosis, diagnoseDatabase } from "./doctor";

export interface DatabasePreparationActions {
  checkSources: () => Promise<void>;
  diagnose: (securityEvents: boolean) => Promise<DatabaseDiagnosis>;
  migrate: (securityEvents: boolean) => Promise<boolean>;
}

export async function prepareDevelopmentDatabases(
  actions: DatabasePreparationActions,
): Promise<boolean> {
  await actions.checkSources();
  const boundaries = [false, true];
  const diagnoses = await Promise.all(
    boundaries.map((securityEvents) => actions.diagnose(securityEvents)),
  );
  if (
    diagnoses.some(
      (diagnosis) => !["ready", "pending"].includes(diagnosis.reason),
    )
  ) {
    return false;
  }

  let applied = false;
  for (const [index, securityEvents] of boundaries.entries()) {
    if (diagnoses[index]?.reason !== "pending") {
      continue;
    }
    // biome-ignore lint/performance/noAwaitInLoops: Migrations must run sequentially and stop at the first failure.
    if (!(await actions.migrate(securityEvents))) {
      return false;
    }
    applied = true;
  }
  if (!applied) {
    return true;
  }
  const verified = await Promise.all(
    boundaries.map((securityEvents) => actions.diagnose(securityEvents)),
  );
  return verified.every((diagnosis) => diagnosis.reason === "ready");
}

async function runPreparation() {
  const arguments_ = process.argv
    .slice(2)
    .filter((argument) => argument !== "--");
  if (
    arguments_.length === 1 &&
    ["--help", "-h"].includes(arguments_[0] ?? "")
  ) {
    console.log(
      "Usage: bun run db:prepare\nReview pending SQL and stop development APIs before preparing both configured development databases.\nChecks sources, applies compatible pending migrations through canonical commands, and verifies both targets deeply.\nIssue-specific tests and manual test data remain part of the agent handoff.",
    );
    return;
  }
  if (arguments_.length > 0) {
    console.error(
      "Unsupported preparation arguments. Use bun run db:prepare --help.",
    );
    process.exitCode = 1;
    return;
  }
  if (
    process.env.CANTIARA_DEPLOY_MIGRATION === "true" ||
    process.env.NODE_ENV === "production"
  ) {
    console.error(
      "db:prepare requires a development environment; deployment is separate.",
    );
    process.exitCode = 1;
    return;
  }

  const environment = { ...process.env };
  const cwd = fileURLToPath(new URL("../", import.meta.url));
  async function command(script: string) {
    const child = spawn(process.execPath, ["run", script], {
      cwd,
      env: environment,
      stdio: "inherit",
    });
    return await new Promise<boolean>((resolve, reject) => {
      child.once("error", reject);
      child.once("close", (code) => resolve(code === 0));
    });
  }

  const ready = await prepareDevelopmentDatabases({
    async checkSources() {
      if (!(await command("db:check"))) {
        throw new Error("Migration source checks failed");
      }
    },
    async diagnose(securityEvents) {
      const diagnosis = await diagnoseDatabase(environment, {
        securityEvents,
        deep: true,
      });
      console.log(
        `${securityEvents ? "Security events" : "Primary"}: ${diagnosis.reason}`,
      );
      for (const detail of diagnosis.details) {
        console.log(`  ${detail}`);
      }
      console.log(`  Next: ${diagnosis.nextStep}`);
      return diagnosis;
    },
    async migrate(securityEvents) {
      console.log(
        `${securityEvents ? "Security events" : "Primary"}: applying reviewed pending migrations`,
      );
      const applied = await command(
        securityEvents ? "db:security:migrate" : "db:migrate",
      );
      if (!applied) {
        console.error(
          "Preparation stopped after a failed migration. Previously applied migrations remain; run bun run db:doctor before continuing.",
        );
      }
      return applied;
    },
  });
  if (ready) {
    console.log(
      "Both development databases are ready. Complete the affected issue tests and manual test data before handoff.",
    );
  } else {
    console.error(
      "Development database preparation is blocked. Resolve the reported cause before handoff.",
    );
    process.exitCode = 1;
  }
}

if (import.meta.main) {
  try {
    await runPreparation();
  } catch {
    console.error(
      "Development database preparation failed. Check the source check output and run bun run db:doctor; raw errors are not printed.",
    );
    process.exitCode = 1;
  }
}
