import { describe, expect, test } from "vitest";
import { resolveSecurityEventDatabaseUrl } from "./security-event-database-url";

describe("security-event database URL", () => {
  test("derives a separate local database without another configured URL", () => {
    expect(
      resolveSecurityEventDatabaseUrl({
        NODE_ENV: "development",
        NEON_LOCAL: "true",
        DATABASE_URL: "postgresql://user:secret@localhost:5432/cantiara",
      }),
    ).toBe("postgresql://user:secret@localhost:5432/cantiara_security");
  });

  test("keeps an explicit URL for isolated tests", () => {
    expect(
      resolveSecurityEventDatabaseUrl({
        NODE_ENV: "test",
        NEON_LOCAL: "true",
        DATABASE_URL: "postgresql://user:secret@localhost:5432/cantiara",
        SECURITY_EVENT_DATABASE_URL:
          "postgresql://other:secret@localhost:5432/isolated_events",
      }),
    ).toBe("postgresql://other:secret@localhost:5432/isolated_events");
  });

  test("does not derive a production URL", () => {
    expect(
      resolveSecurityEventDatabaseUrl({
        NODE_ENV: "production",
        NEON_LOCAL: "true",
        DATABASE_URL: "postgresql://user:secret@localhost:5432/cantiara",
      }),
    ).toBeUndefined();
  });

  test("rejects a remote database in local mode without exposing credentials", () => {
    expect(() =>
      resolveSecurityEventDatabaseUrl({
        NEON_LOCAL: "true",
        DATABASE_URL: "postgresql://user:secret@remote.example/cantiara",
      }),
    ).toThrow("Local security-event database requires local PostgreSQL");
  });
});
