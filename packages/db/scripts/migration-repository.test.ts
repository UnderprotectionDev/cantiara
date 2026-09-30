import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, test } from "vitest";
import { readMigrationRepository } from "./migration-repository";

const folders: string[] = [];
afterEach(() => {
  for (const folder of folders.splice(0)) {
    rmSync(folder, { recursive: true, force: true });
  }
});

test("rejects decreasing journal timestamps before Drizzle can skip SQL", () => {
  const folder = mkdtempSync(join(tmpdir(), "cantiara-migrations-"));
  folders.push(folder);
  mkdirSync(join(folder, "meta"));
  writeFileSync(
    join(folder, "meta", "_journal.json"),
    JSON.stringify({
      version: "7",
      dialect: "postgresql",
      entries: [
        {
          idx: 0,
          tag: "0000_first",
          when: 2000,
          version: "7",
          breakpoints: true,
        },
        {
          idx: 1,
          tag: "0001_second",
          when: 1000,
          version: "7",
          breakpoints: true,
        },
      ],
    }),
  );
  expect(() => readMigrationRepository(folder)).toThrow("journal order");
});

function repositoryFixture() {
  const folder = mkdtempSync(join(tmpdir(), "cantiara-migrations-"));
  folders.push(folder);
  mkdirSync(join(folder, "meta"));
  writeFileSync(join(folder, "0000_first.sql"), "SELECT 1;");
  writeFileSync(
    join(folder, "meta", "_journal.json"),
    JSON.stringify({
      version: "7",
      dialect: "postgresql",
      entries: [
        {
          idx: 0,
          tag: "0000_first",
          when: 1000,
          version: "7",
          breakpoints: true,
        },
      ],
    }),
  );
  writeFileSync(
    join(folder, "meta", "0000_snapshot.json"),
    JSON.stringify({
      id: "first",
      prevId: "00000000-0000-0000-0000-000000000000",
      version: "7",
      dialect: "postgresql",
      tables: {},
      enums: {},
    }),
  );
  return folder;
}

test("rejects snapshots that have no canonical journal entry", () => {
  const folder = repositoryFixture();
  writeFileSync(join(folder, "meta", "0001_snapshot.json"), "{}");
  expect(() => readMigrationRepository(folder)).toThrow("not in the journal");
});

test("rejects a snapshot without a schema instead of declaring it ready", () => {
  const folder = repositoryFixture();
  writeFileSync(
    join(folder, "meta", "0000_snapshot.json"),
    JSON.stringify({
      id: "first",
      prevId: "00000000-0000-0000-0000-000000000000",
      version: "7",
      dialect: "postgresql",
    }),
  );
  expect(() => readMigrationRepository(folder)).toThrow("snapshot chain");
});
