import { describe, expect, test } from "vitest";

import {
  migrationRepairTagFromArgs,
  selectMigrations,
} from "./migration-selection";

const migrations = [
  { breakpoints: true, idx: 0, tag: "001", version: "7", when: 1 },
  { breakpoints: true, idx: 1, tag: "002", version: "7", when: 2 },
  {
    breakpoints: true,
    idx: 2,
    tag: "0054_repair_prioritization_schema",
    version: "7",
    when: 3,
  },
  {
    breakpoints: true,
    idx: 3,
    tag: "0058_external-handoff-cancellation-compatibility",
    version: "7",
    when: 4,
  },
];

describe("selectMigrations", () => {
  test("keeps the full migration list for the normal migration path", () => {
    expect(
      selectMigrations(migrations, {
        compatibilityTag: "0054_repair_prioritization_schema",
      }),
    ).toBe(migrations);
  });

  test("selects only the requested compatibility migration in repair mode", () => {
    expect(
      selectMigrations(migrations, {
        compatibilityTag: "0054_repair_prioritization_schema",
        compatibilityOnly: true,
      }),
    ).toEqual([migrations[2]]);
  });

  test("fails closed if the compatibility migration is absent or ambiguous", () => {
    expect(() =>
      selectMigrations(migrations, {
        compatibilityTag: "missing",
        compatibilityOnly: true,
      }),
    ).toThrow("Expected exactly one compatibility migration");

    expect(() =>
      selectMigrations([...migrations, migrations[2]], {
        compatibilityTag: "0054_repair_prioritization_schema",
        compatibilityOnly: true,
      }),
    ).toThrow("Expected exactly one compatibility migration");
  });

  test("selects one named compatibility repair and rejects conflicting modes", () => {
    expect(
      migrationRepairTagFromArgs([
        "migrate.ts",
        "--repair-external-handoff-cancellation",
      ]),
    ).toBe("0058_external-handoff-cancellation-compatibility");
    expect(migrationRepairTagFromArgs(["migrate.ts"])).toBeNull();
    expect(() =>
      migrationRepairTagFromArgs([
        "--repair-prioritization-schema",
        "--repair-external-handoff-cancellation",
      ]),
    ).toThrow("Select exactly one compatibility repair");
  });
});
