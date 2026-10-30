import { isSecretKey } from "@cantiara/api/data-export";
import type { Database } from "@cantiara/db";
import { describe, expect, test } from "vitest";

import { createDatabaseRecordExportSources } from "../selected-export-records-database";

// Field lists never touch the database, so no connection is needed.
const sources = createDatabaseRecordExportSources({} as Database);

const INTERNAL = [
  "revision",
  "projectId",
  "trashedAt",
  "data",
  "content",
  "consentRecordedBy",
  "accountId",
  "createdBy",
  "updatedBy",
  "actorId",
  "fingerprint",
  "accessEvidence",
  "outcomeEvidence",
];

describe("Selected Export record fields", () => {
  const entries = Object.entries(sources);

  test("registers a reader per project-scoped plain type", () => {
    expect(entries.length).toBe(12);
  });

  test.each(entries)(
    "%s exports only an allowlist, no internal column",
    (type, reader) => {
      const keys = reader.fields(type as never).map((field) => field.key);
      expect(keys.length).toBeGreaterThan(0);
      for (const key of keys) {
        expect(INTERNAL).not.toContain(key);
        expect(isSecretKey(key)).toBe(false);
      }
      expect(keys).not.toContain("id");
    },
  );

  test("Source exposes no revision", () => {
    const keys = sources.Source?.fields("Source").map((field) => field.key);
    expect(keys).not.toContain("revision");
    expect(keys).toContain("url");
  });

  test("Research Session exports its own fields, not the document blob", () => {
    const keys = sources["Research Session"]
      ?.fields("Research Session")
      .map((field) => field.key);
    expect(keys).toEqual(
      expect.arrayContaining(["title", "status", "consent"]),
    );
  });
});
