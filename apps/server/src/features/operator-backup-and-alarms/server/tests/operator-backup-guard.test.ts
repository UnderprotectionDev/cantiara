import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, test } from "vitest";

const forbiddenExport =
  /\b(?:export\s+(?:const|function|type|interface)\s+\w*(?:restorePoint|RestorePoint|backupCalendar|BackupCalendar|backupSchedule|BackupSchedule|restoreBackup|RestoreBackup|founderRestore|FounderRestore|restoreFromBackup)\w*)/;
const forbiddenProcedure =
  /^\s{2,}(?:\w*(?:[Rr]estorePoint|[Bb]ackupCalendar|[Bb]ackupSchedule|[Rr]estoreBackup|[Ff]ounderRestore|[Rr]estoreFromBackup)\w*)\s*:/m;
const forbiddenImport = /workspace-exit-package|features\/trash|data-export/;
const importLine = /^\s*import\b|from\s+["']/;

const here = import.meta.dirname;
const featureDir = join(here, "..");
const serverSrc = join(here, "../../..");
const apiSrc = join(here, "../../../../../../../packages/api/src");

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      return entry.name === "tests" || entry.name === "node_modules"
        ? []
        : sourceFiles(path);
    }
    return entry.name.endsWith(".ts") && !entry.name.endsWith(".test.ts")
      ? [path]
      : [];
  });
}

describe("Operator Backup and Alarms: no user-facing backup surface", () => {
  const apiFiles = sourceFiles(apiSrc);

  test("the product API exports no restore-point, backup calendar or founder restore", () => {
    const offenders = apiFiles.filter((file) =>
      forbiddenExport.test(readFileSync(file, "utf8")),
    );
    expect(offenders).toEqual([]);
  });

  test("the router procedures name no restore-point, calendar or restore command", () => {
    const router = readFileSync(join(apiSrc, "routers/index.ts"), "utf8");
    expect(router).not.toMatch(forbiddenProcedure);
  });

  test("the product API does not import the operator backup feature", () => {
    const offenders = apiFiles.filter((file) =>
      readFileSync(file, "utf8").includes("operator-backup-and-alarms"),
    );
    expect(offenders).toEqual([]);
  });

  test("other server features do not call the operator backup", () => {
    const offenders = sourceFiles(serverSrc).filter(
      (file) =>
        !file.startsWith(featureDir) &&
        readFileSync(file, "utf8").includes("operator-backup-and-alarms"),
    );
    expect(offenders).toEqual([]);
  });
});

describe("Operator Backup and Alarms: not the exit package or Trash", () => {
  test("the backup unit does not build on the exit package, Trash or Selected Export", () => {
    const offenders = sourceFiles(featureDir).filter((file) =>
      forbiddenImport.test(
        readFileSync(file, "utf8")
          .split("\n")
          .filter((line) => importLine.test(line))
          .join("\n"),
      ),
    );
    expect(offenders).toEqual([]);
  });
});
