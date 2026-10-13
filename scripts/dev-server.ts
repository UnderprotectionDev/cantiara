import { acquireDevelopmentLease } from "../packages/db/scripts/development-lease";
import { superviseDevelopmentProcess } from "./development-session";

try {
  delete process.env.NEON_API_KEY;
  delete process.env.NEON_SECURITY_API_KEY;
  const lease = await acquireDevelopmentLease(process.env);
  process.exitCode = await superviseDevelopmentProcess(
    ["bun", "run", "--hot", "src/index.ts", ...process.argv.slice(2)],
    lease,
  );
} catch {
  console.error(
    "Development API could not start safely. No migration was applied.",
  );
  console.error("Run bun run db:doctor for a database diagnosis.");
  process.exitCode = 1;
}
