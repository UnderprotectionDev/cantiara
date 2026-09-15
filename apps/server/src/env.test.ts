import { describe, expect, test } from "vitest";

const validEnvironment = {
  NODE_ENV: "test",
  BETTER_AUTH_SECRET: "test-secret-that-is-long-enough-123456",
  BETTER_AUTH_URL: "http://localhost:3000",
  CORS_ORIGIN: "http://localhost:3001",
  DATABASE_URL: "postgresql://user:password@localhost:5432/cantiara",
  GITHUB_CLIENT_ID: "github-client-id",
  GITHUB_CLIENT_SECRET: "github-client-secret",
} as const;

Object.assign(process.env, validEnvironment);

const { createServerEnv, redactSecrets } = await import("./env");

describe("server environment", () => {
  test("accepts a valid environment", () => {
    expect(createServerEnv(validEnvironment)).toMatchObject(validEnvironment);
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
});
