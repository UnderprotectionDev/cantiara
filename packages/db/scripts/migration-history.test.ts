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

describe("migrations applied from other branches", () => {
  test("accepts interleaved migrations from other branches in development", () => {
    expect(
      assertMigrationHistory(
        expected,
        [
          { created_at: "1000", hash: "first" },
          { created_at: "1500", hash: "other-branch" },
          { created_at: "2000", hash: "second" },
          { created_at: "2500", hash: "another-branch" },
        ],
        { allowForeign: true },
      ),
    ).toEqual({
      foreign: [
        { created_at: "1500", hash: "other-branch" },
        { created_at: "2500", hash: "another-branch" },
      ],
      pending: [],
    });
  });

  test("keeps own pending migrations applicable after newer foreign ones", () => {
    expect(
      assertMigrationHistory(
        expected,
        [
          { created_at: "1000", hash: "first" },
          { created_at: "2500", hash: "other-branch" },
        ],
        { allowForeign: true },
      ).pending,
    ).toEqual([{ folderMillis: 2000, hash: "second" }]);
  });

  test("recognizes an applied migration whose journal time moved during a rebase", () => {
    expect(
      assertMigrationHistory(
        expected,
        [
          { created_at: "1000", hash: "first" },
          { created_at: "1200", hash: "second" },
        ],
        { allowForeign: true },
      ),
    ).toEqual({ foreign: [], pending: [] });
  });

  test("rejects own migration SQL edited after it was applied", () => {
    expect(() =>
      assertMigrationHistory(
        expected,
        [
          { created_at: "1000", hash: "first" },
          { created_at: "2000", hash: "edited-second" },
        ],
        { allowForeign: true },
      ),
    ).toThrow("migration history diverged at 2000");
  });

  test("strict history treats foreign migrations as divergence or ahead", () => {
    expect(() =>
      assertMigrationHistory(expected, [
        { created_at: "1000", hash: "first" },
        { created_at: "1500", hash: "other-branch" },
        { created_at: "2000", hash: "second" },
      ]),
    ).toThrow("migration history diverged at 2000");
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
