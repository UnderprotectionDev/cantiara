import { expect, test } from "vitest";
import { diagnoseDatabase } from "./doctor";
import { resolveMigrationTarget } from "./migration-target";

test("development diagnosis resolves the configured Neon target", () => {
  const target = resolveMigrationTarget({
    DATABASE_URL:
      "postgres://app:secret@ep-development-pooler.neon.tech/cantiara",
  });
  expect(target.databaseUrl).toBe(
    "postgres://app:secret@ep-development.neon.tech/cantiara",
  );
  expect(target.local).toBe(false);
});

test("deployment migration requires its explicit command", () => {
  expect(() =>
    resolveMigrationTarget(
      {
        DATABASE_URL: "postgres://app:secret@ep-production.neon.tech/cantiara",
      },
      { deployment: true },
    ),
  ).toThrow("explicit deployment command");
});

test("security-event diagnosis keeps its separate configured target", () => {
  const target = resolveMigrationTarget(
    {
      DATABASE_URL: "postgres://app:secret@ep-primary.neon.tech/cantiara",
      SECURITY_EVENT_DATABASE_URL:
        "postgres://security:secret@ep-security-pooler.neon.tech/events",
    },
    { securityEvents: true },
  );
  expect(target.databaseUrl).toBe(
    "postgres://security:secret@ep-security.neon.tech/events",
  );
  expect(target.local).toBe(false);
});

test("reports mismatched application and migration targets without leaking credentials", async () => {
  const result = await diagnoseDatabase({
    DATABASE_URL:
      "postgres://app:private-secret@ep-primary-pooler.neon.tech/cantiara",
    DATABASE_URL_UNPOOLED:
      "postgres://app:other-secret@ep-other.neon.tech/cantiara",
  });
  expect(result.reason).toBe("target-mismatch");
  expect(JSON.stringify(result)).not.toContain("private-secret");
  expect(JSON.stringify(result)).not.toContain("other-secret");
});

test("reports invalid connection URLs without echoing parser errors", async () => {
  const result = await diagnoseDatabase({
    DATABASE_URL: "not-a-url-private-secret",
  });
  expect(result.reason).toBe("target-mismatch");
  expect(JSON.stringify(result)).not.toContain("private-secret");
});
