import { expect, test } from "vitest";
import {
  assertSchemaSnapshot,
  checkMigrationSources,
} from "./check-migrations";

test("detects source changes not represented in the latest migration snapshot", async () => {
  const repository = await checkMigrationSources(true);
  const changed = structuredClone(repository.snapshot);
  const table = changed.tables["public.security_event"];
  if (!table) {
    throw new Error("Security event snapshot is required");
  }
  table.columns = Object.fromEntries(
    Object.entries(table.columns).filter(([name]) => name !== "actor_alias"),
  );
  expect(() => assertSchemaSnapshot(repository.snapshot, changed)).toThrow(
    "Source schema differs",
  );
});

test("checks the configured primary schema including the Mutation Contract tables", async () => {
  const repository = await checkMigrationSources();
  expect(repository.snapshot.tables["public.mutation_receipt"]).toBeDefined();
});
