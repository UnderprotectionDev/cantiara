import { acquireDevelopmentLease } from "../packages/db/scripts/development-lease";
import {
  acquireLeaseWithPreparation,
  prepareDevelopmentDatabasesCommand,
  superviseDevelopmentProcess,
} from "./development-session";

try {
  delete process.env.NEON_API_KEY;
  delete process.env.NEON_SECURITY_API_KEY;
  const lease = await acquireLeaseWithPreparation(
    () => acquireDevelopmentLease(process.env),
    prepareDevelopmentDatabasesCommand,
  );
  process.exitCode = await superviseDevelopmentProcess(
    ["bun", "run", "--hot", "src/index.ts", ...process.argv.slice(2)],
    lease,
  );
} catch {
  console.error(
    "Development API could not start safely. Automatic migration preparation did not make the databases ready.",
  );
  console.error("Run bun run db:doctor for a database diagnosis.");
  process.exitCode = 1;
}
