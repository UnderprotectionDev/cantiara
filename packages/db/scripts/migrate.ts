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
import { migrate } from "drizzle-orm/neon-serverless/migrator";
import { checkMigrationSources } from "./check-migrations";
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
import { inspectDatabaseSchema } from "./schema-inspection";

async function verifyAppliedSchema(
  client: Client | PoolClient,
  folder: string,
  repository: Awaited<ReturnType<typeof checkMigrationSources>>,
  compatibilityTag: string | null,
) {
  const verified = await verifyMigrationHistory(client, folder);
  if (verified.applied.length === repository.entries.length) {
    const issues = await inspectDatabaseSchema(
      client,
      repository.snapshot,
      true,
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
    const history = await verifyMigrationHistory(client, folder);
    let selectedFolder = folder;
    if (compatibilityTag) {
      const selected = selectMigrations(repository.entries, {
        compatibilityTag,
        compatibilityOnly: true,
      });
      const [entry] = selected;
      if (!entry) {
        throw new Error("Compatibility migration is missing");
      }
      if (
        entry.idx >= history.applied.length &&
        entry.idx !== history.applied.length
      ) {
        throw new Error(
          "Compatibility repair cannot skip unapplied canonical migrations",
        );
      }
      temporaryFolder = mkdtempSync(
        join(tmpdir(), "cantiara-migration-repair-"),
      );
      mkdirSync(join(temporaryFolder, "meta"));
      copyFileSync(
        join(folder, `${compatibilityTag}.sql`),
        join(temporaryFolder, `${compatibilityTag}.sql`),
      );
      writeFileSync(
        join(temporaryFolder, "meta", "_journal.json"),
        JSON.stringify({
          version: "7",
          dialect: "postgresql",
          entries: selected.map((migrationEntry, index) => ({
            ...migrationEntry,
            idx: index,
          })),
        }),
      );
      selectedFolder = temporaryFolder;
    }
    await migrate(database, { migrationsFolder: selectedFolder });
    const verified = await verifyAppliedSchema(
      client,
      folder,
      repository,
      compatibilityTag,
    );
    console.log(
      `${securityEvents ? "Security events" : "Primary"}: ${verified.applied.length}/${repository.entries.length} canonical migrations verified`,
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
        /^(Another migration|Compatibility|Migration schema verification|Migration history|Application and migration targets differ|Source schema differs|Invalid migration|Missing migration|Migration snapshot|Migration target must|Local migration requires|Deployment migration requires)/.test(
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
