import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { type Client, Pool, type PoolClient } from "@neondatabase/serverless";
import type { MigrationMeta } from "drizzle-orm/migrator";
import { migrate } from "drizzle-orm/neon-serverless/migrator";
import {
  checkMigrationSources,
  parallelSafetyBaseline,
} from "./check-migrations";
import {
  MigrationHistoryError,
  verifyMigrationHistory,
} from "./migration-history";
import {
  assertMigrationArgs,
  migrationRepairTagFromArgs,
  selectMigrations,
} from "./migration-selection";
import {
  connectMigrationTarget,
  resolveMigrationTarget,
} from "./migration-target";
import { assertParallelSafeMigrations } from "./parallel-safety";
import { inspectDatabaseSchema } from "./schema-inspection";

async function verifyAppliedSchema(
  client: Client | PoolClient,
  folder: string,
  repository: Awaited<ReturnType<typeof checkMigrationSources>>,
  compatibilityTag: string | null,
  allowForeign: boolean,
) {
  const verified = await verifyMigrationHistory(client, folder, {
    allowForeign,
  });
  if (verified.pending.length === 0) {
    const issues = await inspectDatabaseSchema(
      client,
      repository.snapshot,
      true,
      verified.foreign.length > 0,
    );
    if (issues.length > 0) {
      throw new Error(
        `Migration schema verification failed: ${issues.join("; ")}`,
      );
    }
  } else if (!compatibilityTag) {
    throw new Error("Migration history is still incomplete after applying SQL");
  }
  return verified;
}

// Drizzle's migrator skips every migration older than the newest record.
// Other branches' records make that common in the shared development
// database, so development applies exactly this branch's pending SQL in one
// transaction on the locked connection.
async function applyDevelopmentMigrations(
  client: Client | PoolClient,
  pending: MigrationMeta[],
) {
  await client.query('CREATE SCHEMA IF NOT EXISTS "drizzle"');
  await client.query(
    'CREATE TABLE IF NOT EXISTS "drizzle"."__drizzle_migrations" (id SERIAL PRIMARY KEY, hash text NOT NULL, created_at bigint)',
  );
  await client.query("BEGIN");
  try {
    for (const migration of pending) {
      for (const statement of migration.sql) {
        if (statement.trim()) {
          // biome-ignore lint/performance/noAwaitInLoops: Migration statements must run in order.
          await client.query(statement);
        }
      }
      await client.query(
        'INSERT INTO "drizzle"."__drizzle_migrations" ("hash", "created_at") VALUES ($1, $2)',
        [migration.hash, migration.folderMillis],
      );
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  }
}

function compatibilityRepair(
  repository: Awaited<ReturnType<typeof checkMigrationSources>>,
  history: Awaited<ReturnType<typeof verifyMigrationHistory>>,
  compatibilityTag: string,
) {
  const [entry] = selectMigrations(repository.entries, {
    compatibilityTag,
    compatibilityOnly: true,
  });
  const migration = entry ? history.expected[entry.idx] : undefined;
  if (!(entry && migration)) {
    throw new Error("Compatibility migration is missing");
  }
  const firstPending = history.expected.findIndex((candidate) =>
    history.pending.includes(candidate),
  );
  if (firstPending !== -1 && entry.idx > firstPending) {
    throw new Error(
      "Compatibility repair cannot skip unapplied canonical migrations",
    );
  }
  return { entry, migration };
}

function compatibilityRepairFolder(
  folder: string,
  entry: ReturnType<typeof compatibilityRepair>["entry"],
) {
  const temporaryFolder = mkdtempSync(
    join(tmpdir(), "cantiara-migration-repair-"),
  );
  mkdirSync(join(temporaryFolder, "meta"));
  copyFileSync(
    join(folder, `${entry.tag}.sql`),
    join(temporaryFolder, `${entry.tag}.sql`),
  );
  writeFileSync(
    join(temporaryFolder, "meta", "_journal.json"),
    JSON.stringify({
      version: "7",
      dialect: "postgresql",
      entries: [{ ...entry, idx: 0 }],
    }),
  );
  return temporaryFolder;
}

function warnAboutContractMigrations(
  repository: Awaited<ReturnType<typeof checkMigrationSources>>,
  history: Awaited<ReturnType<typeof verifyMigrationHistory>>,
  securityEvents: boolean,
) {
  const contract = new Set(
    assertParallelSafeMigrations(
      repository,
      parallelSafetyBaseline(securityEvents),
    ),
  );
  for (const [index, entry] of repository.entries.entries()) {
    const migration = history.expected[index];
    if (
      contract.has(entry.tag) &&
      migration &&
      history.pending.includes(migration)
    ) {
      console.warn(
        `${entry.tag} is an acknowledged contract migration; other workspaces still running code that depends on the old schema will break.`,
      );
    }
  }
}

async function runMigrations() {
  assertMigrationArgs(process.argv.slice(2));
  const securityEvents = process.argv.includes("--security-events");
  const deployment = process.argv.includes("--deployment");
  const compatibilityTag = migrationRepairTagFromArgs(process.argv);
  if (compatibilityTag && securityEvents) {
    throw new Error(
      "Compatibility repairs cannot target security-event migrations",
    );
  }
  const target = resolveMigrationTarget(process.env, {
    securityEvents,
    deployment,
  });
  const repository = await checkMigrationSources(securityEvents);
  const folder = fileURLToPath(
    new URL(
      securityEvents
        ? "../src/migrations/security-events/"
        : "../src/migrations/",
      import.meta.url,
    ),
  );
  const database = await connectMigrationTarget(target);
  let temporaryFolder: string | undefined;
  let client: Client | PoolClient | undefined;
  let locked = false;
  try {
    client =
      database.$client instanceof Pool
        ? await database.$client.connect()
        : database.$client;
    const result = await client.query<{ locked: boolean }>(
      "SELECT pg_try_advisory_lock(1128351316, 1296648018) AS locked",
    );
    locked = result.rows[0]?.locked === true;
    if (!locked) {
      throw new Error(
        "Another migration or development API session is using this database. Stop development servers before applying migrations.",
      );
    }
    // Shared development databases also hold other branches' migrations;
    // deployment targets must match the canonical chain exactly.
    const allowForeign = !deployment;
    const history = await verifyMigrationHistory(client, folder, {
      allowForeign,
    });
    const repair = compatibilityTag
      ? compatibilityRepair(repository, history, compatibilityTag)
      : undefined;
    if (deployment) {
      if (repair) {
        temporaryFolder = compatibilityRepairFolder(folder, repair.entry);
      }
      await migrate(database, {
        migrationsFolder: temporaryFolder ?? folder,
      });
    } else {
      warnAboutContractMigrations(repository, history, securityEvents);
      await applyDevelopmentMigrations(
        client,
        history.pending.filter(
          (migration) => !repair || migration === repair.migration,
        ),
      );
    }
    const verified = await verifyAppliedSchema(
      client,
      folder,
      repository,
      compatibilityTag,
      allowForeign,
    );
    console.log(
      `${securityEvents ? "Security events" : "Primary"}: ${verified.expected.length - verified.pending.length}/${repository.entries.length} canonical migrations verified${verified.foreign.length > 0 ? `; ${verified.foreign.length} from other branches kept` : ""}`,
    );
  } finally {
    try {
      if (locked && client) {
        await client.query("SELECT pg_advisory_unlock(1128351316, 1296648018)");
      }
    } finally {
      if (client && "release" in client) {
        client.release();
      }
      await database.$client.end();
      if (temporaryFolder) {
        rmSync(temporaryFolder, { recursive: true, force: true });
      }
    }
  }
}

if (import.meta.main) {
  try {
    await runMigrations();
  } catch (error) {
    const safe =
      error instanceof Error &&
      (error instanceof MigrationHistoryError ||
        /^(\d{4}_[A-Za-z0-9_-]+ is not safe|Another migration|Compatibility|Migration schema verification|Migration history|Application and migration targets differ|Source schema differs|Invalid migration|Missing migration|Migration snapshot|Migration target must|Local migration requires|Deployment migration requires)/.test(
          error.message,
        ));
    console.error(
      safe
        ? error.message
        : "Migration failed. Check database configuration, permissions and reviewed SQL; raw database errors are not printed.",
    );
    process.exitCode = 1;
  }
}
