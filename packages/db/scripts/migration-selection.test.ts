import { describe, expect, test } from "vitest";

import {
  migrationRepairTagsFromArgs,
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
  {
    breakpoints: true,
    idx: 4,
    tag: "0060_external-handoff-schema-compatibility",
    version: "7",
    when: 5,
  },
  {
    breakpoints: true,
    idx: 5,
    tag: "0069_backlog-reappear-attention-signal",
    version: "7",
    when: 6,
  },
  {
    breakpoints: true,
    idx: 6,
    tag: "0070_silent_iron_fist",
    version: "7",
    when: 7,
  },
  {
    breakpoints: true,
    idx: 7,
    tag: "0071_demonic_wendigo",
    version: "7",
    when: 8,
  },
  {
    breakpoints: true,
    idx: 8,
    tag: "0072_medical_mojo",
    version: "7",
    when: 9,
  },
];

describe("selectMigrations", () => {
  test("keeps the full migration list for the normal migration path", () => {
    expect(
      selectMigrations(migrations, {
        compatibilityTags: ["0054_repair_prioritization_schema"],
      }),
    ).toBe(migrations);
  });

  test("selects only the requested compatibility migration in repair mode", () => {
    expect(
      selectMigrations(migrations, {
        compatibilityTags: ["0054_repair_prioritization_schema"],
        compatibilityOnly: true,
      }),
    ).toEqual([migrations[2]]);
  });

  test("fails closed if the compatibility migration is absent or ambiguous", () => {
    expect(() =>
      selectMigrations(migrations, {
        compatibilityTags: ["missing"],
        compatibilityOnly: true,
      }),
    ).toThrow("Expected exactly one compatibility migration");

    expect(() =>
      selectMigrations([...migrations, migrations[2]], {
        compatibilityTags: ["0054_repair_prioritization_schema"],
        compatibilityOnly: true,
      }),
    ).toThrow("Expected exactly one compatibility migration");
  });

  test("selects one named compatibility repair and rejects conflicting modes", () => {
    expect(
      migrationRepairTagsFromArgs([
        "migrate.ts",
        "--repair-external-handoff-cancellation",
      ]),
    ).toEqual(["0058_external-handoff-cancellation-compatibility"]);
    expect(
      migrationRepairTagsFromArgs([
        "migrate.ts",
        "--repair-external-handoff-result-reconciliation",
      ]),
    ).toEqual(["0060_external-handoff-schema-compatibility"]);
    expect(migrationRepairTagsFromArgs(["migrate.ts"])).toBeNull();
    expect(() =>
      migrationRepairTagsFromArgs([
        "--repair-prioritization-schema",
        "--repair-external-handoff-cancellation",
      ]),
    ).toThrow("Select exactly one compatibility repair");
    expect(() =>
      migrationRepairTagsFromArgs([
        "--repair-external-handoff-result-reconciliation",
        "--repair-external-handoff-cancellation",
      ]),
    ).toThrow("Select exactly one compatibility repair");
  });

  test("selects the pending roadmap tail without replaying alternate status migrations", () => {
    expect(
      migrationRepairTagsFromArgs(["migrate.ts", "--repair-roadmap-history"]),
    ).toEqual([
      "0069_backlog-reappear-attention-signal",
      "0070_silent_iron_fist",
      "0071_demonic_wendigo",
      "0072_medical_mojo",
    ]);
    expect(
      selectMigrations(migrations, {
        compatibilityTags: [
          "0069_backlog-reappear-attention-signal",
          "0070_silent_iron_fist",
          "0071_demonic_wendigo",
          "0072_medical_mojo",
        ],
        compatibilityOnly: true,
      }),
    ).toEqual(migrations.slice(5));
  });
});
