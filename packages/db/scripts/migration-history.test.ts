import { describe, expect, test } from "vitest";

import { assertMigrationHistory } from "./migration-history";

const expected = [
  { folderMillis: 1000, hash: "first" },
  { folderMillis: 2000, hash: "second" },
];

describe("assertMigrationHistory", () => {
  test("accepts an applied prefix of the repository migration chain", () => {
    expect(() =>
      assertMigrationHistory(expected, [{ created_at: "1000", hash: "first" }]),
    ).not.toThrow();
  });

  test("rejects a database ahead of the current Git branch", () => {
    expect(() =>
      assertMigrationHistory(expected, [
        { created_at: "1000", hash: "first" },
        { created_at: "2000", hash: "second" },
        { created_at: "3000", hash: "third" },
      ]),
    ).toThrow("ahead of this Git branch");
  });

  test("rejects an applied migration whose SQL changed", () => {
    expect(() =>
      assertMigrationHistory(expected, [
        { created_at: "1000", hash: "changed" },
      ]),
    ).toThrow("migration history diverged at 1000");
  });

  test("rejects a gap or reordered migration", () => {
    expect(() =>
      assertMigrationHistory(expected, [
        { created_at: "2000", hash: "second" },
      ]),
    ).toThrow("migration history diverged at 1000");
  });
});
