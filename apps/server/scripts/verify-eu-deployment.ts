/**
 * Fail-closed production region check (spec 85, ADR-0009/0010). Runs before
 * the production server starts; exits non-zero outside the approved EU region.
 * An unset NODE_ENV is unknown and fails closed; a production environment
 * whose region cannot be verified never starts. Explicitly set non-production
 * environments are not production and pass without a check.
 */
import {
  deploymentRegionCheckGate,
  deploymentRegionFromEnv,
  verifyDeploymentRegion,
} from "../src/features/operator-backup-and-alarms/server/eu-deployment-region";

const gate = deploymentRegionCheckGate(process.env.NODE_ENV);
if (gate.action === "fail-closed") {
  console.error(`EU region check failed: ${gate.reason}`);
  process.exit(1);
}
if (gate.action === "verify") {
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
