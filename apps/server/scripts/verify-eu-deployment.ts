/**
 * Fail-closed production region check (spec 85, ADR-0009/0010). Runs before
 * the production server starts; exits non-zero outside the approved EU region.
 * Other environments are not production and pass without a check.
 */
import {
  deploymentRegionFromEnv,
  verifyDeploymentRegion,
} from "../src/features/operator-backup-and-alarms/server/eu-deployment-region";

if (process.env.NODE_ENV === "production") {
  const verification = verifyDeploymentRegion(
    deploymentRegionFromEnv(process.env),
  );
  if (!verification.ok) {
    for (const violation of verification.violations) {
      console.error(
        `EU region check failed: ${violation.provider} ${violation.reason} (${violation.actual})`,
      );
    }
    process.exit(1);
  }
}
