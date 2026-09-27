export interface MigrationRecord {
  created_at: string | number;
  hash: string;
}

export function assertBaseHistory(
  actual: MigrationRecord[],
  expected: MigrationRecord[],
) {
  if (
    actual.length !== expected.length ||
    actual.some(
      (record, index) =>
        String(record.created_at) !== String(expected[index]?.created_at) ||
        record.hash !== expected[index]?.hash,
    )
  ) {
    throw new Error("Development base migrations differ from origin/main");
  }
}
