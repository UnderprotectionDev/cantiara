import { assertLocalPostgresTarget } from "../packages/db/scripts/migration-connection";
import { resolveSecurityEventDatabaseUrl } from "../packages/db/src/security-event-database-url";

export function developmentDatabaseMode(
  environment: Record<string, string | undefined>,
) {
  if (environment.NEON_LOCAL === "true") {
    assertLocalPostgresTarget(environment.DATABASE_URL);
  } else {
    let primary: URL;
    try {
      primary = new URL(environment.DATABASE_URL ?? "");
    } catch {
      // biome-ignore lint/style/useErrorCause: URL parser errors may expose credentials.
      throw new Error("Primary development database must be Neon");
    }
    if (
      !(
        ["postgres:", "postgresql:"].includes(primary.protocol) &&
        primary.hostname.endsWith(".neon.tech")
      )
    ) {
      throw new Error("Primary development database must be Neon");
    }
  }

  const securityUrl = resolveSecurityEventDatabaseUrl(environment);
  if (environment.SECURITY_EVENT_LOCAL === "true") {
    assertLocalPostgresTarget(securityUrl);
  } else if (environment.NEON_LOCAL === "true") {
    assertLocalPostgresTarget(securityUrl);
  } else if (!securityUrl) {
    throw new Error("SECURITY_EVENT_DATABASE_URL is required");
  }

  return {
    startLocalProxy:
      environment.NEON_LOCAL === "true" ||
      environment.SECURITY_EVENT_LOCAL === "true",
  };
}
