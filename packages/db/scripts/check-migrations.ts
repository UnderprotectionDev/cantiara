import { fileURLToPath } from "node:url";
import { isDeepStrictEqual } from "node:util";
import { generateDrizzleJson } from "drizzle-kit/api";
import { primarySchemaFiles, securitySchemaFiles } from "../schema-files";
import {
  type MigrationSnapshot,
  readMigrationRepository,
} from "./migration-repository";
import {
  assertParallelSafeMigrations,
  parallelSafetyBaselines,
} from "./parallel-safety";

export function assertSchemaSnapshot(
  expected: MigrationSnapshot,
  actual: MigrationSnapshot,
) {
  const normalized: MigrationSnapshot = JSON.parse(JSON.stringify(actual));
  for (const key of [
    "tables",
    "enums",
    "schemas",
    "sequences",
    "roles",
    "policies",
    "views",
  ] as const) {
    if (!isDeepStrictEqual(expected[key], normalized[key])) {
      throw new Error(
        `Source schema differs from the latest migration snapshot (${key}); run db:generate and review the migration`,
      );
    }
  }
}

export function parallelSafetyBaseline(securityEvents: boolean) {
  return securityEvents
    ? parallelSafetyBaselines.securityEvents
    : parallelSafetyBaselines.primary;
}

export async function checkMigrationSources(securityEvents = false) {
  const folder = fileURLToPath(
    new URL(
      securityEvents
        ? "../src/migrations/security-events/"
        : "../src/migrations/",
      import.meta.url,
    ),
  );
  const repository = readMigrationRepository(folder);
  const imports: Record<string, unknown> = {};
  const modules = await Promise.all(
    (securityEvents ? securitySchemaFiles : primarySchemaFiles).map(
      (file) => import(new URL(`../${file}`, import.meta.url).href),
    ),
  );
  for (const schemaModule of modules) {
    Object.assign(imports, schemaModule);
  }
  const generated: MigrationSnapshot = JSON.parse(
    JSON.stringify(generateDrizzleJson(imports)),
  );
  assertSchemaSnapshot(repository.snapshot, generated);
  assertParallelSafeMigrations(
    repository,
    parallelSafetyBaseline(securityEvents),
  );
  return repository;
}

if (import.meta.main) {
  try {
    const repositories = await Promise.all([
      checkMigrationSources(),
      checkMigrationSources(true),
    ]);
    for (const [index, repository] of repositories.entries()) {
      console.log(
        `${index === 1 ? "Security events" : "Primary"}: ${repository.entries.length} migration files, snapshot chain, source schema and shared database safety verified`,
      );
      for (const tag of assertParallelSafeMigrations(
        repository,
        parallelSafetyBaseline(index === 1),
      )) {
        console.warn(
          `${tag} is an acknowledged contract migration; apply it only after every workspace using the shared development database runs code that no longer depends on the old schema.`,
        );
      }
    }
  } catch (error) {
    console.error(
      error instanceof Error
        ? error.message
        : "Migration repository check failed",
    );
    process.exitCode = 1;
  }
}
