import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type { NeonDatabase } from "drizzle-orm/neon-serverless";
import { migrate } from "drizzle-orm/neon-serverless/migrator";
import { createDb } from "../src/index";
import { resolveSecurityEventDatabaseUrl } from "../src/security-event-database-url";
import {
  createLocalSecurityEventDb,
  createSecurityEventDb,
} from "../src/security-events";
import {
  assertNeonMigrationTarget,
  migrationConnectionString,
} from "./migration-connection";
import { verifyMigrationHistory } from "./migration-history";
import {
  migrationRepairTagFromArgs,
  selectMigrations,
} from "./migration-selection";

const securityEvents = process.argv.includes("--security-events");
const deployment = process.argv.includes("--deployment");
const localSecurityEvents =
  securityEvents && process.env.SECURITY_EVENT_LOCAL === "true";
const securityEventDatabaseUrl = resolveSecurityEventDatabaseUrl(process.env);
if (deployment && process.env.CANTIARA_DEPLOY_MIGRATION !== "true") {
  throw new Error(
    "Deployment migration requires its explicit deployment command",
  );
}
if (!(deployment || localSecurityEvents)) {
  assertNeonMigrationTarget(
    securityEvents ? securityEventDatabaseUrl : process.env.DATABASE_URL,
  );
}
const compatibilityRepairTag = migrationRepairTagFromArgs(process.argv);
const databaseUrl = migrationConnectionString(
  securityEvents ? securityEventDatabaseUrl : process.env.DATABASE_URL,
  securityEvents
    ? process.env.SECURITY_EVENT_DATABASE_URL_UNPOOLED
    : process.env.DATABASE_URL_UNPOOLED,
  {
    useLocalPostgres: process.env.NEON_LOCAL === "true" || localSecurityEvents,
  },
);

if (!databaseUrl) {
  throw new Error(
    securityEvents
      ? "SECURITY_EVENT_DATABASE_URL is required"
      : "DATABASE_URL is required",
  );
}

if (compatibilityRepairTag && securityEvents) {
  throw new Error(
    "Compatibility repairs cannot target security-event migrations",
  );
}

const migrationsFolder = securityEvents
  ? "./src/migrations/security-events"
  : "./src/migrations";

if (securityEvents) {
  const database = localSecurityEvents
    ? await createLocalSecurityEventDb({
        DATABASE_URL: databaseUrl,
        proxyAddress: process.env.NEON_LOCAL_PROXY,
      })
    : createSecurityEventDb({ DATABASE_URL: databaseUrl });
  try {
    await runLockedMigrations(
      database,
      migrationsFolder,
      compatibilityRepairTag,
      localSecurityEvents,
    );
  } finally {
    await database.$client.end();
  }
} else {
  const database = createDb({ DATABASE_URL: databaseUrl });
  try {
    await runLockedMigrations(
      database,
      migrationsFolder,
      compatibilityRepairTag,
    );
  } finally {
    await database.$client.end();
  }
}

async function runLockedMigrations<TSchema extends Record<string, unknown>>(
  database: NeonDatabase<TSchema>,
  folder: string,
  compatibilityTag: string | null,
  clientAlreadyConnected = false,
) {
  const client = clientAlreadyConnected
    ? database.$client
    : await database.$client.connect();
  let locked = false;
  try {
    const result = await client.query<{ locked: boolean }>(
      "SELECT pg_try_advisory_lock(1128351316, 1296648018) AS locked",
    );
    locked = result.rows[0]?.locked === true;
    if (!locked) {
      throw new Error("Another migration is running on this database");
    }
    if (!compatibilityTag) {
      await verifyMigrationHistory(database.$client, folder);
    }
    await runMigrations(database, folder, compatibilityTag);
  } finally {
    try {
      if (locked) {
        await client.query("SELECT pg_advisory_unlock(1128351316, 1296648018)");
      }
    } finally {
      if ("release" in client) {
        client.release();
      }
    }
  }
}

async function runMigrations<TSchema extends Record<string, unknown>>(
  database: NeonDatabase<TSchema>,
  folder: string,
  compatibilityTag: string | null,
) {
  if (!compatibilityTag) {
    await migrate(database, { migrationsFolder: folder });
    return;
  }

  const repairFile = join(folder, `${compatibilityTag}.sql`);
  const journalPath = join(folder, "meta", "_journal.json");
  const journal = JSON.parse(readFileSync(journalPath, "utf8"));
  const selectedEntries = selectMigrations(journal.entries, {
    compatibilityTag,
    compatibilityOnly: true,
  });
  const temporaryFolder = mkdtempSync(
    join(tmpdir(), "cantiara-migration-repair-"),
  );

  try {
    mkdirSync(join(temporaryFolder, "meta"), { recursive: true });
    copyFileSync(repairFile, join(temporaryFolder, `${compatibilityTag}.sql`));
    writeFileSync(
      join(temporaryFolder, "meta", "_journal.json"),
      JSON.stringify(
        {
          ...journal,
          entries: selectedEntries.map((entry, idx) => ({ ...entry, idx })),
        },
        null,
        2,
      ),
    );
    await migrate(database, { migrationsFolder: temporaryFolder });
  } finally {
    rmSync(temporaryFolder, { recursive: true, force: true });
  }
}
