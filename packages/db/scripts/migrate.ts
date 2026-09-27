import { createHash } from "node:crypto";
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
  migrationRepairTagsFromArgs,
  selectMigrations,
} from "./migration-selection";

const securityEvents = process.argv.includes("--security-events");
const compatibilityRepairTags = migrationRepairTagsFromArgs(process.argv);
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

if (compatibilityRepairTags && securityEvents) {
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
    await runMigrations(database, migrationsFolder, compatibilityRepairTags);
  } finally {
    await database.$client.end();
  }
} else {
  const database = createDb({ DATABASE_URL: databaseUrl });
  try {
    await runMigrations(database, migrationsFolder, compatibilityRepairTags);
  } finally {
    await database.$client.end();
  }
}

async function runMigrations<TSchema extends Record<string, unknown>>(
  database: NeonDatabase<TSchema>,
  folder: string,
  compatibilityTags: readonly string[] | null,
) {
  if (!compatibilityTags) {
    await migrate(database, { migrationsFolder: folder });
    return;
  }

  const journalPath = join(folder, "meta", "_journal.json");
  const journal = JSON.parse(readFileSync(journalPath, "utf8"));
  const selectedEntries = selectMigrations(journal.entries, {
    compatibilityTags,
    compatibilityOnly: true,
  });
  if (compatibilityTags.includes("0069_backlog-reappear-attention-signal")) {
    await assertRoadmapHistoryRepairPreconditions(database, folder, journal);
  }
  const temporaryFolder = mkdtempSync(
    join(tmpdir(), "cantiara-migration-repair-"),
  );

  try {
    mkdirSync(join(temporaryFolder, "meta"), { recursive: true });
    for (const entry of selectedEntries) {
      copyFileSync(
        join(folder, `${entry.tag}.sql`),
        join(temporaryFolder, `${entry.tag}.sql`),
      );
    }
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

async function assertRoadmapHistoryRepairPreconditions<
  TSchema extends Record<string, unknown>,
>(
  database: NeonDatabase<TSchema>,
  folder: string,
  journal: { entries: { tag: string; when: number }[] },
) {
  const lastExpected = journal.entries.find(
    (entry) => entry.tag === "0065_work-reappear-date-compatibility",
  );
  if (!lastExpected) {
    throw new Error("Roadmap repair requires the 0065 journal entry");
  }
  const migrationHash = (tag: string) =>
    createHash("sha256")
      .update(readFileSync(join(folder, `${tag}.sql`)))
      .digest("hex");
  const ledger = await database.$client.query(
    "SELECT id, hash, created_at FROM drizzle.__drizzle_migrations ORDER BY id",
  );
  const ledgerText = `${ledger.rows
    .map((entry) => `${entry.id}\t${entry.hash}\t${entry.created_at}`)
    .join("\n")}\n`;
  // Exact 72-row shared history before the 0069–0072 repair; unknown variants fail closed.
  const expectedLedgerHash =
    "b8ebe8df532098ab56599b8248f83841eb594aedcb65e3de69f3d23d2015dd60";
  if (
    createHash("sha256").update(ledgerText).digest("hex") !== expectedLedgerHash
  ) {
    throw new Error("Roadmap repair requires the verified shared history");
  }
  const latestRow = ledger.rows.at(-1);
  if (
    Number(latestRow?.created_at) !== lastExpected.when ||
    latestRow?.hash !== migrationHash(lastExpected.tag)
  ) {
    throw new Error("Roadmap repair requires 0065 as the latest migration");
  }

  const backfillHashes = [
    migrationHash("0067_backfill-work-status-change-time"),
    migrationHash("0068_backfill-work-status-change-time-history-shapes"),
  ];
  if (
    backfillHashes.some(
      (hash) => !ledger.rows.some((record) => record.hash === hash),
    )
  ) {
    throw new Error("Roadmap repair requires both applied status backfills");
  }

  const state = await database.$client.query(`
    SELECT
      EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'work'
          AND column_name = 'status_changed_at'
          AND data_type = 'timestamp without time zone'
          AND is_nullable = 'NO' AND column_default = 'now()'
      ) AS status_column_ready,
      (
        SELECT pg_get_constraintdef(oid) FROM pg_constraint
        WHERE conrelid = 'public.work'::regclass
          AND conname = 'work_reappear_date_check'
      ) AS date_constraint,
      to_regclass('public.project_backlog_reappear_attention_signal') IS NULL AS signal_absent,
      to_regclass('public.roadmap_view') IS NULL AS view_absent,
      NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'work'
          AND column_name IN ('roadmap_horizon', 'problem_opportunity', 'expected_outcome')
      ) AS roadmap_columns_absent
  `);
  const [row] = state.rows;
  const dateConstraintHash = row?.date_constraint
    ? createHash("sha256").update(row.date_constraint).digest("hex")
    : null;
  const ready = Boolean(
    row?.status_column_ready &&
      dateConstraintHash ===
        "a705382604c215259740ea3b4b8e9a45d6515d0e7bbff853c48c233720dab870" &&
      row.signal_absent &&
      row.view_absent &&
      row.roadmap_columns_absent,
  );
  if (!ready) {
    throw new Error("Roadmap repair found an unexpected schema state");
  }
}
