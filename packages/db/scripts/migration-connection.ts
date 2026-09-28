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

  const url = new URL(configuredUrl);
  if (url.hostname.endsWith(".neon.tech")) {
    const [endpoint, ...domain] = url.hostname.split(".");
    if (endpoint.endsWith("-pooler")) {
      url.hostname = [
        endpoint.slice(0, endpoint.length - "-pooler".length),
        ...domain,
      ].join(".");
    }
  }

  return url.toString();
}

export function assertLocalPostgresTarget(value: string | undefined) {
  if (!value) {
    throw new Error("Local PostgreSQL URL is required");
  }
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    // biome-ignore lint/style/useErrorCause: URL parser errors may expose credentials.
    throw new Error("Local PostgreSQL URL is invalid");
  }
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
  let url: URL;
  try {
    url = new URL(value ?? "");
  } catch {
    // biome-ignore lint/style/useErrorCause: URL parser errors may expose credentials.
    throw new Error("Migration target must be Neon");
  }
  if (
    !(
      ["postgres:", "postgresql:"].includes(url.protocol) &&
      url.hostname.endsWith(".neon.tech")
    )
  ) {
    throw new Error("Migration target must be Neon");
  }
}
