import { acquireDevelopmentLease } from "../packages/db/scripts/development-lease";
import { diagnoseDatabase } from "../packages/db/scripts/doctor";
import { superviseDevelopmentProcess } from "./development-session";
import { loadWorkspaceEnvironment } from "./workspace-database";

try {
  const environment = loadWorkspaceEnvironment(process.env);
  Object.assign(process.env, environment);
  delete process.env.NEON_API_KEY;
  delete process.env.NEON_SECURITY_API_KEY;
  const lease = await acquireDevelopmentLease(environment);
  process.exitCode = await superviseDevelopmentProcess(
    ["bun", "run", "--hot", "src/index.ts", ...process.argv.slice(2)],
    lease,
  );
} catch {
  console.error(
    "Development API could not start safely. No migration was applied.",
  );
  const diagnoses = await Promise.all(
    [false, true].map(async (securityEvents) => ({
      securityEvents,
      result: await diagnoseDatabase(process.env, { securityEvents }),
    })),
  );
  for (const { securityEvents, result } of diagnoses) {
    console.error(
      `${securityEvents ? "Security events" : "Primary"}: ${result.reason}`,
    );
    console.error(result.nextStep);
  }
  process.exitCode = 1;
}
