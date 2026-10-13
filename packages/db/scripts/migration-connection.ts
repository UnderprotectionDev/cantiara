export function migrationConnectionString(
  databaseUrl: string | undefined,
  unpooledDatabaseUrl?: string,
  { useLocalPostgres = false }: { useLocalPostgres?: boolean } = {},
) {
  const configuredUrl = useLocalPostgres
    ? databaseUrl
    : (unpooledDatabaseUrl ?? databaseUrl);
  if (!configuredUrl) {
    return null;
  }

  const url = directDatabaseUrl(configuredUrl);
  if (databaseUrl && !useLocalPostgres) {
    const application = directDatabaseUrl(databaseUrl);
    if (
      application.hostname !== url.hostname ||
      (application.port || "5432") !== (url.port || "5432") ||
      application.pathname !== url.pathname ||
      application.username !== url.username
    ) {
      throw new Error("Application and migration targets differ");
    }
  }

  return url.toString();
}

function directDatabaseUrl(value: string) {
  if (!URL.canParse(value)) {
    throw new Error("Database connection URL is invalid");
  }
  const url = new URL(value);
  if (!["postgres:", "postgresql:"].includes(url.protocol)) {
    throw new Error("Database connection must use PostgreSQL");
  }
  if (url.hostname.endsWith(".neon.tech")) {
    const [endpoint = "", ...domain] = url.hostname.split(".");
    if (endpoint.endsWith("-pooler")) {
      url.hostname = [
        endpoint.slice(0, endpoint.length - "-pooler".length),
        ...domain,
      ].join(".");
    }
  }

  return url;
}

export function assertLocalPostgresTarget(value: string | undefined) {
  if (!value) {
    throw new Error("Local PostgreSQL URL is required");
  }
  if (!URL.canParse(value)) {
    throw new Error("Local PostgreSQL URL is invalid");
  }
  const url = new URL(value);
  if (
    !(
      ["postgres:", "postgresql:"].includes(url.protocol) &&
      ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)
    )
  ) {
    throw new Error("Local migration requires a local PostgreSQL target");
  }
}

export function assertNeonMigrationTarget(value: string | undefined) {
  if (!URL.canParse(value ?? "")) {
    throw new Error("Migration target must be Neon");
  }
  const url = new URL(value ?? "");
  if (
    !(
      ["postgres:", "postgresql:"].includes(url.protocol) &&
      url.hostname.endsWith(".neon.tech")
    )
  ) {
    throw new Error("Migration target must be Neon");
  }
}
