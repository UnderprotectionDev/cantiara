export interface MigrationJournalEntry {
  breakpoints: boolean;
  idx: number;
  tag: string;
  version: string;
  when: number;
}

export interface MigrationSelectionOptions {
  compatibilityOnly?: boolean;
  compatibilityTags: readonly string[];
}

const compatibilityRepairTags = {
  "--repair-external-handoff-cancellation": [
    "0058_external-handoff-cancellation-compatibility",
  ],
  "--repair-external-handoff-result-reconciliation": [
    "0060_external-handoff-schema-compatibility",
  ],
  "--repair-prioritization-schema": ["0054_repair_prioritization_schema"],
  "--repair-roadmap-history": [
    "0069_backlog-reappear-attention-signal",
    "0070_silent_iron_fist",
    "0071_demonic_wendigo",
    "0072_medical_mojo",
  ],
} as const;

export function migrationRepairTagsFromArgs(args: readonly string[]) {
  const selectedRepairs = Object.entries(compatibilityRepairTags)
    .filter(([flag]) => args.includes(flag))
    .map(([, tags]) => tags);

  if (selectedRepairs.length > 1) {
    throw new Error("Select exactly one compatibility repair");
  }

  return selectedRepairs[0] ?? null;
}

export function selectMigrations<TEntry extends MigrationJournalEntry>(
  entries: TEntry[],
  options: MigrationSelectionOptions,
): TEntry[] {
  if (!options.compatibilityOnly) {
    return entries;
  }

  const compatibilityEntries = options.compatibilityTags.map((tag) => {
    const matches = entries.filter((candidate) => candidate.tag === tag);
    const [selected] = matches;
    if (matches.length !== 1 || !selected) {
      throw new Error(`Expected exactly one compatibility migration: ${tag}`);
    }
    return selected;
  });
  if (
    !compatibilityEntries.length ||
    compatibilityEntries.some(
      (entry, index) =>
        index > 0 && entry.idx <= compatibilityEntries[index - 1].idx,
    )
  ) {
    throw new Error("Compatibility migrations must be in journal order");
  }

  return compatibilityEntries;
}
