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
import { createSecurityEventDb } from "../src/security-events";
import { migrationConnectionString } from "./migration-connection";
import {
  migrationRepairTagFromArgs,
  selectMigrations,
} from "./migration-selection";

const securityEvents = process.argv.includes("--security-events");
const compatibilityRepairTag = migrationRepairTagFromArgs(process.argv);
const databaseUrl = migrationConnectionString(
  securityEvents
    ? process.env.SECURITY_EVENT_DATABASE_URL
    : process.env.DATABASE_URL,
  securityEvents
    ? process.env.SECURITY_EVENT_DATABASE_URL_UNPOOLED
    : process.env.DATABASE_URL_UNPOOLED,
  { useLocalPostgres: process.env.NEON_LOCAL === "true" },
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
  const database = createSecurityEventDb({ DATABASE_URL: databaseUrl });
  try {
    await runMigrations(database, migrationsFolder, compatibilityRepairTag);
  } finally {
    await database.$client.end();
  }
} else {
  const database = createDb({ DATABASE_URL: databaseUrl });
  try {
    await runMigrations(database, migrationsFolder, compatibilityRepairTag);
  } finally {
    await database.$client.end();
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
