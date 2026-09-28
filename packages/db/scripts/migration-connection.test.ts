import { describe, expect, test } from "vitest";

import {
  assertLocalPostgresTarget,
  assertNeonMigrationTarget,
  migrationConnectionString,
} from "./migration-connection";

describe("migrationConnectionString", () => {
  test("development migration requires a Neon URL", () => {
    const local = "postgres://app:secret@localhost:5432/cantiara";
    const remote = "postgres://app:secret@ep-example.neon.tech/cantiara";
    expect(() => assertNeonMigrationTarget(remote)).not.toThrow();
    expect(() => assertNeonMigrationTarget(local)).toThrow(
      "Migration target must be Neon",
    );
  });
  test("local migration mode rejects a remote URL", () => {
    expect(() =>
      assertLocalPostgresTarget(
        "postgres://app:secret@localhost:5432/cantiara",
      ),
    ).not.toThrow();
    expect(() =>
      assertLocalPostgresTarget(
        "postgres://app:secret@ep-example.neon.tech/cantiara",
      ),
    ).toThrow();
  });
  test("uses the explicit unpooled Neon connection string", () => {
    expect(
      migrationConnectionString(
        "postgres://app:secret@ep-example-pooler.us-east-2.aws.neon.tech/cantiara",
        "postgres://app:secret@ep-example.us-east-2.aws.neon.tech/cantiara",
      ),
    ).toBe("postgres://app:secret@ep-example.us-east-2.aws.neon.tech/cantiara");
  });

  test("derives the direct Neon endpoint when only a pooled URL is configured", () => {
    expect(
      migrationConnectionString(
        "postgres://app:secret@ep-example-pooler.us-east-2.aws.neon.tech/cantiara",
      ),
    ).toBe("postgres://app:secret@ep-example.us-east-2.aws.neon.tech/cantiara");
  });

  test("preserves non-Neon and local PostgreSQL connection strings", () => {
    expect(
      migrationConnectionString(
        "postgres://app:secret@localhost:5432/cantiara",
      ),
    ).toBe("postgres://app:secret@localhost:5432/cantiara");
  });

  test("preserves the local URL when local PostgreSQL mode is enabled", () => {
    const localUrl = "postgres://app:secret@127.0.0.1:5432/cantiara";
    const remoteUnpooledUrl =
      "postgres://app:secret@ep-example.us-east-2.aws.neon.tech/cantiara";

    expect(
      migrationConnectionString(localUrl, remoteUnpooledUrl, {
        useLocalPostgres: true,
      }),
    ).toBe(localUrl);
  });
});
