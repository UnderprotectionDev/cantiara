import { fileURLToPath } from "node:url";
import type { Pool } from "@neondatabase/serverless";
import { describe, expect, test } from "vitest";
import {
  assertMigrationHistory,
  verifyMigrationHistory,
} from "./migration-history";

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

  test("reports divergence before ahead when the known prefix is also invalid", () => {
    expect(() =>
      assertMigrationHistory(expected, [
        { created_at: "1000", hash: "changed" },
        { created_at: "2000", hash: "second" },
        { created_at: "3000", hash: "third" },
      ]),
    ).toThrow("migration history diverged at 1000");
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

test("rejects an empty migration ledger when public tables already exist", async () => {
  const client = {
    query: <Row>(query: string) => {
      if (query.includes("to_regclass('drizzle.__drizzle_migrations')")) {
        return { rows: [{ has_history: true, public_tables: "1" }] as Row[] };
      }
      if (query.includes("FROM drizzle.__drizzle_migrations")) {
        return { rows: [] as Row[] };
      }
      throw new Error(`Unexpected migration history query: ${query}`);
    },
  } as unknown as Pick<Pool, "query">;

  await expect(
    verifyMigrationHistory(
      client,
      fileURLToPath(new URL("../src/migrations/", import.meta.url)),
    ),
  ).rejects.toMatchObject({ reason: "history-mismatch" });
});
