import { confirmMigrationArtifactInputSchema } from "@cantiara/api/schema-migration-artifact";
import { expect, test } from "vitest";

import {
  confirmArtifactFormSchema,
  upEditFormSchema,
} from "../schema-artifact-form-schemas";

test("the up edit form follows the confirm contract's edited up SQL rule", () => {
  const contract = confirmMigrationArtifactInputSchema.shape.editedUpSql;
  for (const upSql of [
    "",
    "select 1;",
    "x".repeat(500_000),
    "x".repeat(500_001),
  ]) {
    expect(upEditFormSchema.safeParse({ upSql }).success).toBe(
      contract.safeParse(upSql).success,
    );
  }
});

test("the confirm form follows the confirm contract's destructive and supersedes rules", () => {
  const cases = [
    { confirmedDestructiveOperationIds: ["op-1"], supersedes: null },
    { confirmedDestructiveOperationIds: [""], supersedes: null },
    { confirmedDestructiveOperationIds: [], supersedes: "" },
    { confirmedDestructiveOperationIds: [], supersedes: "artifact-1" },
  ];
  const contract = confirmMigrationArtifactInputSchema.pick({
    confirmedDestructiveOperationIds: true,
    supersedes: true,
  });
  for (const value of cases) {
    expect(confirmArtifactFormSchema.safeParse(value).success).toBe(
      contract.safeParse(value).success,
    );
  }
});

test("the form schemas are taken from the confirm contract, not restated", () => {
  expect(confirmArtifactFormSchema.shape.supersedes).toBe(
    confirmMigrationArtifactInputSchema.shape.supersedes,
  );
});
