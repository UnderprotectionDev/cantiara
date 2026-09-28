type DatabaseEnvironment = Record<string, string | undefined>;

export function resolveSecurityEventDatabaseUrl(
  environment: DatabaseEnvironment,
): string | undefined {
  if (environment.SECURITY_EVENT_DATABASE_URL) {
    return environment.SECURITY_EVENT_DATABASE_URL;
  }
  if (
    environment.NEON_LOCAL !== "true" ||
    environment.NODE_ENV === "production"
  ) {
    return undefined;
  }

  let primary: URL;
  try {
    primary = new URL(environment.DATABASE_URL ?? "");
  } catch {
    // biome-ignore lint/style/useErrorCause: URL parser errors may expose credentials.
    throw new Error("Local security-event database requires local PostgreSQL");
  }
  if (
    !(
      ["postgres:", "postgresql:"].includes(primary.protocol) &&
      ["localhost", "127.0.0.1", "[::1]"].includes(primary.hostname)
    ) ||
    primary.pathname.length < 2
  ) {
    throw new Error("Local security-event database requires local PostgreSQL");
  }

  primary.pathname = `${primary.pathname}_security`;
  return primary.toString();
}
