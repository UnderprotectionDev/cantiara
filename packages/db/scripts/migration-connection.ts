export function migrationConnectionString(
  databaseUrl: string | undefined,
  unpooledDatabaseUrl?: string,
) {
  const configuredUrl = unpooledDatabaseUrl ?? databaseUrl;
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
