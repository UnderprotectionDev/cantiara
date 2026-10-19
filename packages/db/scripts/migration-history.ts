import type { Pool } from "@neondatabase/serverless";
import { type MigrationMeta, readMigrationFiles } from "drizzle-orm/migrator";

interface AppliedMigration {
  created_at: number | string | null;
  hash: string;
}

export class MigrationHistoryError extends Error {
  readonly reason: "ahead" | "history-mismatch";

  constructor(reason: "ahead" | "history-mismatch", message: string) {
    super(message);
    this.reason = reason;
  }
}

function assertCanonicalHistory<
  TMigration extends Pick<MigrationMeta, "folderMillis" | "hash">,
>(expected: TMigration[], applied: AppliedMigration[]) {
  for (const [index, row] of applied.slice(0, expected.length).entries()) {
    const migration = expected[index];
    if (
      !migration ||
      Number(row.created_at) !== migration.folderMillis ||
      row.hash !== migration.hash
    ) {
      throw new MigrationHistoryError(
        "history-mismatch",
        `Database migration history diverged at ${migration?.folderMillis ?? "unknown"}`,
      );
    }
  }
  if (applied.length > expected.length) {
    throw new MigrationHistoryError(
      "ahead",
      "Database migration history is ahead of this Git branch",
    );
  }
  return { foreign: [], pending: expected.slice(applied.length) };
}

// Other Conductor workspaces apply their own migrations to the shared
// development database, and rebases may move an entry's journal timestamp.
// Development therefore identifies migrations by SQL hash; records from other
// branches are foreign. Deployment keeps the exact canonical order.
export function assertMigrationHistory<
  TMigration extends Pick<MigrationMeta, "folderMillis" | "hash">,
>(
  expected: TMigration[],
  applied: AppliedMigration[],
  { allowForeign = false } = {},
): { foreign: AppliedMigration[]; pending: TMigration[] } {
  if (!allowForeign) {
    return assertCanonicalHistory(expected, applied);
  }
  const ownHashes = new Set(expected.map((migration) => migration.hash));
  const appliedHashes = new Set(applied.map((row) => row.hash));
  const foreign = applied.filter((row) => !ownHashes.has(row.hash));
  for (const row of foreign) {
    // A record at this branch's own journal time with other SQL means an
    // applied migration was edited after it ran.
    if (
      expected.some(
        (migration) => migration.folderMillis === Number(row.created_at),
      )
    ) {
      throw new MigrationHistoryError(
        "history-mismatch",
        `Database migration history diverged at ${row.created_at}`,
      );
    }
  }
  return {
    foreign,
    pending: expected.filter((migration) => !appliedHashes.has(migration.hash)),
  };
}

export async function verifyMigrationHistory(
  pool: Pick<Pool, "query">,
  folder: string,
  options: { allowForeign?: boolean } = {},
) {
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
      throw new MigrationHistoryError(
        "history-mismatch",
        "Database has tables but no migration history",
      );
    }
    return {
      expected,
      applied: [] as AppliedMigration[],
      ...assertMigrationHistory(expected, [], options),
    };
  }

  const history = await pool.query<AppliedMigration>(
    "SELECT created_at, hash FROM drizzle.__drizzle_migrations ORDER BY created_at, id",
  );
  if (history.rows.length === 0 && Number(state.rows[0]?.public_tables) > 0) {
    throw new MigrationHistoryError(
      "history-mismatch",
      "Database has tables but no applied migrations",
    );
  }
  return {
    expected,
    applied: history.rows,
    ...assertMigrationHistory(expected, history.rows, options),
  };
}
