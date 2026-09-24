import { describe, expect, test } from "vitest";

import { migrationConnectionString } from "./migration-connection";

describe("migrationConnectionString", () => {
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
});
