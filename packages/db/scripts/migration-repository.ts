import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { readMigrationFiles } from "drizzle-orm/migrator";
import type { MigrationJournalEntry } from "./migration-selection";

export interface MigrationSnapshot {
  dialect: string;
  enums: Record<string, { name: string; schema: string; values: string[] }>;
  id: string;
  policies?: unknown;
  prevId: string;
  roles?: unknown;
  schemas?: unknown;
  sequences?: unknown;
  tables: Record<
    string,
    {
      name: string;
      schema: string;
      columns: Record<
        string,
        {
          name: string;
          type: string;
          primaryKey: boolean;
          notNull: boolean;
          default?: unknown;
        }
      >;
      compositePrimaryKeys: Record<string, { name: string; columns: string[] }>;
      foreignKeys: Record<
        string,
        {
          name: string;
          tableTo: string;
          schemaTo?: string;
          columnsFrom: string[];
          columnsTo: string[];
          onDelete?: string;
          onUpdate?: string;
        }
      >;
      uniqueConstraints: Record<
        string,
        { name: string; columns: string[]; nullsNotDistinct?: boolean }
      >;
      checkConstraints: Record<string, { name: string; value: string }>;
      indexes: Record<
        string,
        {
          name: string;
          isUnique: boolean;
          method: string;
          where?: string;
          columns: {
            expression: string;
            asc: boolean;
            nulls: string;
            opclass?: string;
          }[];
        }
      >;
    }
  >;
  version: string;
  views?: unknown;
}

const migrationTagPattern = /^\d{4}_[a-zA-Z0-9_-]+$/;

function journalTags(entries: MigrationJournalEntry[]) {
  if (!Array.isArray(entries) || entries.length === 0) {
    throw new Error("Migration journal is empty or invalid");
  }
  const tags = new Set<string>();
  for (const [index, entry] of entries.entries()) {
    if (
      entry.idx !== index ||
      !Number.isSafeInteger(entry.when) ||
      entry.when <= 0 ||
      (index > 0 && entry.when <= (entries[index - 1]?.when ?? 0)) ||
      !migrationTagPattern.test(entry.tag) ||
      tags.has(entry.tag)
    ) {
      throw new Error(`Invalid migration journal order at entry ${index}`);
    }
    tags.add(entry.tag);
  }
  return tags;
}

function assertSnapshot(
  snapshot: MigrationSnapshot | undefined,
  previousId: string,
  identities: Set<string>,
  tag: string,
): asserts snapshot is MigrationSnapshot {
  if (
    snapshot?.version !== "7" ||
    snapshot.dialect !== "postgresql" ||
    !snapshot.tables ||
    !snapshot.enums ||
    snapshot.prevId !== previousId ||
    !snapshot.id ||
    identities.has(snapshot.id)
  ) {
    throw new Error(`Migration snapshot chain diverged at ${tag}`);
  }
}

export function readMigrationRepository(folder: string) {
  const journal: { entries: MigrationJournalEntry[] } = JSON.parse(
    readFileSync(join(folder, "meta", "_journal.json"), "utf8"),
  );
  const tags = journalTags(journal.entries);
  for (const name of readdirSync(folder)) {
    if (name.endsWith(".sql") && !tags.has(name.slice(0, -4))) {
      throw new Error(`Migration SQL is not in the journal: ${name}`);
    }
  }
  const snapshotNames = new Set(
    journal.entries.map(
      (entry) => `${String(entry.idx).padStart(4, "0")}_snapshot.json`,
    ),
  );
  for (const name of readdirSync(join(folder, "meta"))) {
    if (name.endsWith("_snapshot.json") && !snapshotNames.has(name)) {
      throw new Error(`Migration snapshot is not in the journal: ${name}`);
    }
  }
  let previousId = "00000000-0000-0000-0000-000000000000";
  let snapshot: MigrationSnapshot | undefined;
  const identities = new Set<string>();
  for (const entry of journal.entries) {
    const path = join(
      folder,
      "meta",
      `${String(entry.idx).padStart(4, "0")}_snapshot.json`,
    );
    if (!existsSync(path)) {
      throw new Error(`Missing migration snapshot for ${entry.tag}`);
    }
    snapshot = JSON.parse(readFileSync(path, "utf8"));
    assertSnapshot(snapshot, previousId, identities, entry.tag);
    identities.add(snapshot.id);
    previousId = snapshot.id;
  }
  if (!snapshot) {
    throw new Error("Migration snapshot is required");
  }
  return {
    entries: journal.entries,
    migrations: readMigrationFiles({ migrationsFolder: folder }),
    snapshot,
  };
}
