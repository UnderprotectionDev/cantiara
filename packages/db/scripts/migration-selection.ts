export interface MigrationJournalEntry {
  breakpoints: boolean;
  idx: number;
  tag: string;
  version: string;
  when: number;
}

export interface MigrationSelectionOptions {
  compatibilityOnly?: boolean;
  compatibilityTag: string;
}

export function selectMigrations<TEntry extends MigrationJournalEntry>(
  entries: TEntry[],
  options: MigrationSelectionOptions,
): TEntry[] {
  if (!options.compatibilityOnly) {
    return entries;
  }

  const compatibilityEntries = entries.filter(
    (entry) => entry.tag === options.compatibilityTag,
  );

  if (compatibilityEntries.length !== 1) {
    throw new Error("Expected exactly one compatibility migration");
  }

  return compatibilityEntries;
}
