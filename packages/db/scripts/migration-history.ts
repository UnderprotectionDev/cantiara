import type { Pool } from "@neondatabase/serverless";
import { type MigrationMeta, readMigrationFiles } from "drizzle-orm/migrator";

interface AppliedMigration {
  created_at: number | string | null;
  hash: string;
}

export function assertMigrationHistory(
  expected: Pick<MigrationMeta, "folderMillis" | "hash">[],
  applied: AppliedMigration[],
) {
  if (applied.length > expected.length) {
    throw new Error("Database migration history is ahead of this Git branch");
  }
  for (const [index, row] of applied.entries()) {
    const migration = expected[index];
    if (
      !migration ||
      Number(row.created_at) !== migration.folderMillis ||
      row.hash !== migration.hash
    ) {
      throw new Error(
        `Database migration history diverged at ${migration?.folderMillis ?? "unknown"}`,
      );
    }
  }
}

export async function verifyMigrationHistory(pool: Pool, folder: string) {
  const expected = readMigrationFiles({ migrationsFolder: folder });
  const state = await pool.query<{
    has_history: boolean;
    public_tables: string;
  }>(`
    SELECT to_regclass('drizzle.__drizzle_migrations') IS NOT NULL AS has_history,
      (SELECT count(*) FROM information_schema.tables
       WHERE table_schema = 'public' AND table_type = 'BASE TABLE') AS public_tables
  `);
  if (!state.rows[0]?.has_history) {
    if (Number(state.rows[0]?.public_tables) > 0) {
      throw new Error("Database has tables but no migration history");
    }
    return;
  }

  const history = await pool.query<AppliedMigration>(
    "SELECT created_at, hash FROM drizzle.__drizzle_migrations ORDER BY created_at, id",
  );
  assertMigrationHistory(expected, history.rows);
}
