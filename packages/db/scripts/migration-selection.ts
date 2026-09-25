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

const compatibilityRepairTags = {
  "--repair-external-handoff-cancellation":
    "0058_external-handoff-cancellation-compatibility",
  "--repair-external-handoff-result-reconciliation":
    "0060_external-handoff-schema-compatibility",
  "--repair-prioritization-schema": "0054_repair_prioritization_schema",
} as const;

export function migrationRepairTagFromArgs(args: readonly string[]) {
  const selectedTags = Object.entries(compatibilityRepairTags)
    .filter(([flag]) => args.includes(flag))
    .map(([, tag]) => tag);

  if (selectedTags.length > 1) {
    throw new Error("Select exactly one compatibility repair");
  }

  return selectedTags[0] ?? null;
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
