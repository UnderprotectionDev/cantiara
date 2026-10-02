import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { Pool } from "@neondatabase/serverless";
import { verifyMigrationHistory } from "./migration-history";
import { readMigrationRepository } from "./migration-repository";
import {
  connectMigrationTarget,
  resolveMigrationTarget,
} from "./migration-target";
import { inspectDatabaseSchema } from "./schema-inspection";

export async function verifyBaselineDatabase(
  environment: Record<string, string | undefined>,
  files: Map<string, Buffer>,
  { deployment = false } = {},
) {
  const folder = mkdtempSync(join(tmpdir(), "cantiara-baseline-"));
  let database: Awaited<ReturnType<typeof connectMigrationTarget>> | undefined;
  try {
    for (const [path, content] of files) {
      const file = join(folder, path);
      mkdirSync(dirname(file), { recursive: true });
      writeFileSync(file, content);
    }
    const repository = readMigrationRepository(folder);
    database = await connectMigrationTarget(
      resolveMigrationTarget(environment, { deployment }),
    );
    const client =
      database.$client instanceof Pool
        ? await database.$client.connect()
        : database.$client;
    try {
      await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
      await client.query("SET LOCAL statement_timeout = '10s'");
      const lock = await client.query<{ locked: boolean }>(
        "SELECT pg_try_advisory_xact_lock_shared(1128351316, 1296648018) AS locked",
      );
      if (!lock.rows[0]?.locked) {
        throw new Error("Baseline migration is still running");
      }
      const history = await verifyMigrationHistory(client, folder);
      if (history.applied.length !== repository.entries.length) {
        throw new Error("Canonical baseline has pending migrations");
      }
      const issues = await inspectDatabaseSchema(
        client,
        repository.snapshot,
        true,
      );
      if (issues.length) {
        throw new Error(
          `Canonical baseline schema differs: ${issues.join("; ")}`,
        );
      }
      await client.query("ROLLBACK");
    } finally {
      if (database.$client instanceof Pool && "release" in client) {
        client.release();
      }
    }
  } finally {
    await database?.$client.end();
    rmSync(folder, { recursive: true, force: true });
  }
}
