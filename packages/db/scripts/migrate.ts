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
import { selectMigrations } from "./migration-selection";

const securityEvents = process.argv.includes("--security-events");
const prioritizationRepair = process.argv.includes(
  "--repair-prioritization-schema",
);
const databaseUrl = securityEvents
  ? process.env.SECURITY_EVENT_DATABASE_URL
  : process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error(
    securityEvents
      ? "SECURITY_EVENT_DATABASE_URL is required"
      : "DATABASE_URL is required",
  );
}

if (prioritizationRepair && securityEvents) {
  throw new Error(
    "Prioritization schema repair cannot target security-event migrations",
  );
}

const migrationsFolder = securityEvents
  ? "./src/migrations/security-events"
  : "./src/migrations";

if (securityEvents) {
  const database = createSecurityEventDb({ DATABASE_URL: databaseUrl });
  try {
    await runMigrations(database, migrationsFolder, prioritizationRepair);
  } finally {
    await database.$client.end();
  }
} else {
  const database = createDb({ DATABASE_URL: databaseUrl });
  try {
    await runMigrations(database, migrationsFolder, prioritizationRepair);
  } finally {
    await database.$client.end();
  }
}

async function runMigrations<TSchema extends Record<string, unknown>>(
  database: NeonDatabase<TSchema>,
  folder: string,
  repairPrioritizationSchema: boolean,
) {
  if (!repairPrioritizationSchema) {
    await migrate(database, { migrationsFolder: folder });
    return;
  }

  const compatibilityTag = "0054_repair_prioritization_schema";
  const repairFile = join(folder, `${compatibilityTag}.sql`);
  const journalPath = join(folder, "meta", "_journal.json");
  const journal = JSON.parse(readFileSync(journalPath, "utf8"));
  const selectedEntries = selectMigrations(journal.entries, {
    compatibilityTag,
    compatibilityOnly: true,
  });
  const temporaryFolder = mkdtempSync(
    join(tmpdir(), "cantiara-prioritization-repair-"),
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
