import { describe, expect, test } from "vitest";

const validEnvironment = {
  NODE_ENV: "test",
  BETTER_AUTH_SECRET: "test-secret-that-is-long-enough-123456",
  BETTER_AUTH_URL: "http://localhost:3000",
  CORS_ORIGIN: "http://localhost:3001",
  DATABASE_URL: "postgresql://user:password@localhost:5432/cantiara",
  GITHUB_CLIENT_ID: "github-client-id",
  GITHUB_CLIENT_SECRET: "github-client-secret",
  SECURITY_EVENT_DATABASE_URL:
    "postgresql://security:password@localhost:5432/cantiara_security",
  TRUSTED_PROXY_IPS: "203.0.113.10",
} as const;

const productionEnvironment = {
  ...validEnvironment,
  R2_ACCESS_KEY_ID: "r2-access-key",
  R2_ACCOUNT_ID: "r2-account",
  R2_BUCKET: "cantiara-staging",
  R2_SECRET_ACCESS_KEY: "r2-secret-key",
  NODE_ENV: "production",
  SECURITY_EVENT_DATABASE_URL:
    "postgresql://security:security-password@security-events.example:5432/cantiara_security",
} as const;

Object.assign(process.env, validEnvironment);

const { createServerEnv, redactSecrets } = await import("./env");

describe("server environment", () => {
  test("accepts a valid environment", () => {
    expect(createServerEnv(validEnvironment)).toMatchObject({
      ...validEnvironment,
      TRUSTED_PROXY_IPS: ["203.0.113.10"],
    });
  });

  test("rejects a short Better Auth secret", () => {
    expect(() =>
      createServerEnv({ ...validEnvironment, BETTER_AUTH_SECRET: "too-short" }),
    ).toThrow();
  });

  test("rejects an invalid Better Auth URL", () => {
    expect(() =>
      createServerEnv({ ...validEnvironment, BETTER_AUTH_URL: "not-a-url" }),
    ).toThrow();
  });

  test("rejects an invalid CORS origin", () => {
    expect(() =>
      createServerEnv({ ...validEnvironment, CORS_ORIGIN: "not-an-origin" }),
    ).toThrow();
  });

  test("requires GitHub OAuth credentials", () => {
    expect(() =>
      createServerEnv({ ...validEnvironment, GITHUB_CLIENT_ID: "" }),
    ).toThrow();
    expect(() =>
      createServerEnv({ ...validEnvironment, GITHUB_CLIENT_SECRET: "" }),
    ).toThrow();
  });

  test("parses trusted reverse proxy addresses", () => {
    expect(
      createServerEnv({
        ...validEnvironment,
        TRUSTED_PROXY_IPS: " 203.0.113.10, 198.51.100.0/24 ",
      }).TRUSTED_PROXY_IPS,
    ).toEqual(["203.0.113.10", "198.51.100.0/24"]);
  });

  test("requires trusted reverse proxies in production", () => {
    expect(() =>
      createServerEnv({
        ...productionEnvironment,
        TRUSTED_PROXY_IPS: "",
      }),
    ).toThrow("TRUSTED_PROXY_IPS");
  });

  test("requires R2 staging credentials in production", () => {
    expect(() =>
      createServerEnv({
        ...productionEnvironment,
        R2_SECRET_ACCESS_KEY: undefined,
      }),
    ).toThrow("R2_ACCESS_KEY_ID");
  });

  test("requires a separate security-event database in production", () => {
    expect(() =>
      createServerEnv({
        ...validEnvironment,
        NODE_ENV: "production",
        SECURITY_EVENT_DATABASE_URL: validEnvironment.DATABASE_URL,
      }),
    ).toThrow("SECURITY_EVENT_DATABASE_URL");
  });

  test("requires separate security-event credentials in production", () => {
    expect(() =>
      createServerEnv({
        ...productionEnvironment,
        SECURITY_EVENT_DATABASE_URL:
          "postgresql://user:other-password@security-events.example:5432/cantiara_security",
      }),
    ).toThrow("SECURITY_EVENT_DATABASE_URL");
  });

  test("rejects a shared security-event password in production", () => {
    expect(() =>
      createServerEnv({
        ...productionEnvironment,
        SECURITY_EVENT_DATABASE_URL:
          "postgresql://security:password@security-events.example:5432/cantiara_security",
      }),
    ).toThrow("SECURITY_EVENT_DATABASE_URL");
  });

  test("rejects invalid trusted reverse proxy addresses", () => {
    expect(() =>
      createServerEnv({
        ...validEnvironment,
        TRUSTED_PROXY_IPS: "not-an-ip",
      }),
    ).toThrow();
  });

  test("redacts configured secrets from errors and objects", () => {
    const originalError = new Error(
      `Database failed for ${validEnvironment.DATABASE_URL}`,
    );
    const redactedError = redactSecrets(originalError);
    const redactedObject = redactSecrets({
      database: validEnvironment.DATABASE_URL,
      auth: { secret: validEnvironment.BETTER_AUTH_SECRET },
    });

    expect(String(redactedError)).not.toContain(validEnvironment.DATABASE_URL);
    expect(String(redactedError)).toContain("[REDACTED]");
    expect(redactedObject).toEqual({
      database: "[REDACTED]",
      auth: { secret: "[REDACTED]" },
    });
    expect(originalError.message).toContain(validEnvironment.DATABASE_URL);
  });

  test("redacts the GitHub client secret", () => {
    expect(
      redactSecrets(
        `GitHub failed for ${validEnvironment.GITHUB_CLIENT_SECRET}`,
      ),
    ).toBe("GitHub failed for [REDACTED]");
  });

  test("redacts the separate security-event database URL", () => {
    expect(
      redactSecrets(
        `Security event database failed for ${validEnvironment.SECURITY_EVENT_DATABASE_URL}`,
      ),
    ).toBe("Security event database failed for [REDACTED]");
  });
});
