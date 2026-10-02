export function applicationEnvironment(
  environment: Record<string, string | undefined>,
) {
  const application = { ...environment };
  application.NEON_API_KEY = undefined;
  application.NEON_SECURITY_API_KEY = undefined;
  return application;
}
