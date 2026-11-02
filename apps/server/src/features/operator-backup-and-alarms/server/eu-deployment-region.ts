/**
 * Production deploy region assertion (spec 85, ADR-0009, ADR-0010, PRD 03
 * `ab-veri-bolgesi`). A check, not a feature: there is no region picker and no
 * user surface. Production may only complete when Neon (Frankfurt), Railway
 * (Amsterdam), R2 (`eu` jurisdiction) and Better Stack (Germany) are all
 * verifiably inside the approved EU placement. A missing value is not an
 * approval: every unknown fails closed.
 */

export type RegionProvider = "better-stack" | "neon" | "r2" | "railway";

/** Raw, secret-free placement facts read from the deployed environment. */
export interface DeploymentRegionConfig {
  betterStackRegion?: string;
  /** Neon connection hostnames (primary and security-event project). */
  neonHosts: readonly string[];
  r2Jurisdiction?: string;
  railwayRegion?: string;
}

export interface RegionViolation {
  actual: string;
  provider: RegionProvider;
  reason: "OUTSIDE_APPROVED_REGION" | "UNVERIFIABLE";
}

export interface RegionVerification {
  approved: Readonly<Record<RegionProvider, string>>;
  ok: boolean;
  violations: readonly RegionViolation[];
}

export const APPROVED_DEPLOYMENT_REGIONS: Readonly<
  Record<RegionProvider, string>
> = {
  "better-stack": "germany",
  neon: "eu-central-1 (Frankfurt)",
  r2: "eu",
  railway: "europe-west4 (Amsterdam)",
};

const NEON_FRANKFURT_HOST =
  /\.eu-central-1\.(?:aws\.neon\.tech|aws\.neon\.build)$/;
const RAILWAY_AMSTERDAM = /^europe-west4(?:-|$)/;
const MISSING = "(unset)";

function normalize(value: string | undefined): string {
  return value?.trim().toLowerCase() ?? "";
}

function check(
  provider: RegionProvider,
  actual: string | undefined,
  approved: (value: string) => boolean,
): RegionViolation | null {
  const value = normalize(actual);
  if (!value) {
    return { actual: MISSING, provider, reason: "UNVERIFIABLE" };
  }
  return approved(value)
    ? null
    : { actual: value, provider, reason: "OUTSIDE_APPROVED_REGION" };
}

export function verifyDeploymentRegion(
  config: DeploymentRegionConfig,
): RegionVerification {
  const violations: RegionViolation[] = [];
  const add = (violation: RegionViolation | null) => {
    if (violation) {
      violations.push(violation);
    }
  };
  if (config.neonHosts.length === 0) {
    add({ actual: MISSING, provider: "neon", reason: "UNVERIFIABLE" });
  }
  for (const host of config.neonHosts) {
    add(check("neon", host, (value) => NEON_FRANKFURT_HOST.test(value)));
  }
  add(
    check("railway", config.railwayRegion, (value) =>
      RAILWAY_AMSTERDAM.test(value),
    ),
  );
  add(check("r2", config.r2Jurisdiction, (value) => value === "eu"));
  add(
    check(
      "better-stack",
      config.betterStackRegion,
      (value) => value === "germany",
    ),
  );
  return {
    approved: APPROVED_DEPLOYMENT_REGIONS,
    ok: violations.length === 0,
    violations,
  };
}

export class DeploymentRegionError extends Error {
  readonly violations: readonly RegionViolation[];

  constructor(violations: readonly RegionViolation[]) {
    super(
      `Production deployment is outside the approved EU region: ${violations
        .map((v) => `${v.provider}:${v.reason}`)
        .join(", ")}`,
    );
    this.name = "DeploymentRegionError";
    this.violations = violations;
  }
}

/** Throws unless every provider is verified inside the approved EU placement. */
export function assertDeploymentRegion(
  config: DeploymentRegionConfig,
): RegionVerification {
  const verification = verifyDeploymentRegion(config);
  if (!verification.ok) {
    throw new DeploymentRegionError(verification.violations);
  }
  return verification;
}

/**
 * Reads placement facts from the process environment. Only host names and
 * region labels are taken from URLs; credentials are never read out.
 */
export function deploymentRegionFromEnv(
  environment: Record<string, string | undefined>,
): DeploymentRegionConfig {
  const hosts: string[] = [];
  for (const key of ["DATABASE_URL", "SECURITY_EVENT_DATABASE_URL"]) {
    const raw = environment[key];
    if (!raw) {
      continue;
    }
    try {
      hosts.push(new URL(raw).hostname);
    } catch {
      hosts.push("(unparseable)");
    }
  }
  return {
    betterStackRegion: environment.BETTER_STACK_REGION,
    neonHosts: hosts,
    r2Jurisdiction: environment.R2_JURISDICTION,
    railwayRegion: environment.RAILWAY_REPLICA_REGION,
  };
}
