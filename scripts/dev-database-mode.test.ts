import { describe, expect, test } from "vitest";
import { developmentDatabaseMode } from "./dev-database-mode";

describe("development database mode", () => {
  test("uses Neon for both databases without starting a local proxy", () => {
    expect(
      developmentDatabaseMode({
        DATABASE_URL:
          "postgresql://owner:primary-secret@ep-main.neon.tech/neondb",
        NEON_LOCAL: "false",
        SECURITY_EVENT_DATABASE_URL:
          "postgresql://security:security-secret@ep-security.neon.tech/neondb",
        SECURITY_EVENT_LOCAL: "false",
      }),
    ).toEqual({ startLocalProxy: false });
  });

  test("uses Neon for primary data and a local proxy only for security events", () => {
    expect(
      developmentDatabaseMode({
        DATABASE_URL: "postgresql://owner:secret@ep-main.neon.tech/neondb",
        NEON_LOCAL: "false",
        SECURITY_EVENT_DATABASE_URL:
          "postgresql://local@127.0.0.1:5432/cantiara_security",
        SECURITY_EVENT_LOCAL: "true",
      }),
    ).toEqual({ startLocalProxy: true });
  });

  test("rejects a local primary database when Neon mode is selected", () => {
    expect(() =>
      developmentDatabaseMode({
        DATABASE_URL: "postgresql://local@127.0.0.1:5432/cantiara",
        NEON_LOCAL: "false",
        SECURITY_EVENT_DATABASE_URL:
          "postgresql://local@127.0.0.1:5432/cantiara_security",
        SECURITY_EVENT_LOCAL: "true",
      }),
    ).toThrow("Primary development database must be Neon");
  });
});
