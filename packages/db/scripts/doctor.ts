import { fileURLToPath } from "node:url";
import { type Client, Pool, type PoolClient } from "@neondatabase/serverless";
import { checkMigrationSources } from "./check-migrations";
import {
  MigrationHistoryError,
  verifyMigrationHistory,
} from "./migration-history";
import {
  connectMigrationTarget,
  resolveMigrationTarget,
} from "./migration-target";
import { inspectDatabaseSchema } from "./schema-inspection";

export interface DatabaseDiagnosis {
  details: string[];
  nextStep: string;
  reason:
    | "ready"
    | "pending"
    | "history-mismatch"
    | "schema-drift"
    | "target-mismatch"
    | "connection"
    | "permission"
    | "repository"
    | "migration-running";
}

function databaseErrorCode(error: unknown) {
  if (error === null || typeof error !== "object") {
    return "";
  }
  return "code" in error ? String(error.code) : "";
}

export async function inspectReadiness(
  client: Pick<Pool, "query">,
  repository: Awaited<ReturnType<typeof checkMigrationSources>>,
  securityEvents: boolean,
  deep: boolean,
  development = false,
): Promise<DatabaseDiagnosis> {
  const history = await verifyMigrationHistory(
    client,
    fileURLToPath(
      new URL(
        securityEvents
          ? "../src/migrations/security-events/"
          : "../src/migrations/",
        import.meta.url,
      ),
    ),
    { allowForeign: true },
  );
  const foreign =
    history.foreign.length > 0
      ? `${history.foreign.length} migrations applied from other branches are accepted after development schema compatibility checks.`
      : undefined;
  if (history.pending.length > 0) {
    const pendingHashes = new Set(
      history.pending.map((migration) => migration.hash),
    );
    const pending = repository.entries
      .filter((_, index) =>
        pendingHashes.has(history.expected[index]?.hash ?? ""),
      )
      .map((entry) => entry.tag);
    return {
      reason: "pending",
      details: [...pending, ...(foreign ? [foreign] : [])],
      nextStep: `Review pending SQL, then run bun run ${securityEvents ? "db:security:migrate" : "db:migrate"} on the verified development target.`,
    };
  }
  const tolerant = development || history.foreign.length > 0;
  const issues = await inspectDatabaseSchema(
    client,
    repository.snapshot,
    deep || tolerant,
    tolerant,
  );
  if (issues.length > 0) {
    return {
      reason: "schema-drift",
      details: issues,
      nextStep: tolerant
        ? "This branch's schema requirements are incompatible with the shared database. Reconcile the owning code and canonical migrations; do not bypass checks or use db:push."
        : "History matches but schema differs. Diagnose the cause and prepare a versioned repair; do not use db:push or edit applied SQL.",
    };
  }
  return {
    reason: "ready",
    details: [
      foreign ??
        `${history.applied.length} migrations match; ${deep || development ? "deep" : "column"} schema checks passed`,
    ],
    nextStep: "Development target is ready.",
  };
}

async function closeInspectionClient(
  client: Client | PoolClient,
  inspectionFailed: boolean,
) {
  if (inspectionFailed) {
    // A client timeout does not cancel server work. Do not queue cleanup
    // behind the batch or return its active transaction to the pool.
    if ("release" in client) {
      client.release(true);
    }
    return;
  }
  try {
    await client.query("ROLLBACK");
  } finally {
    if ("release" in client) {
      client.release();
    }
  }
}

function historyErrorDiagnosis(
  error: MigrationHistoryError,
): DatabaseDiagnosis {
  return {
    // Doctor verifies with allowForeign and never performs the strict
    // deployment check that produces "ahead".
    reason: error.reason === "ahead" ? "history-mismatch" : error.reason,
    details: [error.message],
    nextStep:
      "Bring the canonical applied migrations and owning code into this Git branch. Stop until histories match; do not reset or invent history.",
  };
}

export async function diagnoseDatabase(
  environment: Record<string, string | undefined>,
  { securityEvents = false, deep = false, development = false } = {},
): Promise<DatabaseDiagnosis> {
  let target: ReturnType<typeof resolveMigrationTarget>;
  try {
    target = resolveMigrationTarget(environment, { securityEvents });
  } catch {
    return {
      reason: "target-mismatch",
      details: [
        "Invalid database configuration or application/migration targets differ",
      ],
      nextStep:
        "Check DATABASE_URL, unpooled override and local-mode flags without sharing credentials.",
    };
  }
  let repository: Awaited<ReturnType<typeof checkMigrationSources>>;
  try {
    repository = await checkMigrationSources(securityEvents);
  } catch (error) {
    return {
      reason: "repository",
      details: [
        error instanceof Error ? error.message : "Invalid migration repository",
      ],
      nextStep:
        "Reconcile the canonical SQL/journal/snapshots; generate a migration only when source schema changes.",
    };
  }
  let database: Awaited<ReturnType<typeof connectMigrationTarget>> | undefined;
  try {
    database = await connectMigrationTarget(target, { queryTimeoutMs: 10_000 });
    const client =
      database.$client instanceof Pool
        ? await database.$client.connect()
        : database.$client;
    let inspectionFailed = false;
    try {
      await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
      await client.query("SET LOCAL statement_timeout = '10s'");
      const lock = await client.query<{ locked: boolean }>(
        "SELECT pg_try_advisory_xact_lock_shared(1128351316, 1296648018) AS locked",
      );
      if (!lock.rows[0]?.locked) {
        return {
          reason: "migration-running",
          details: ["Another migration is running on this database"],
          nextStep: "Wait for it to finish, then run db:doctor again.",
        };
      }
      return await inspectReadiness(
        client,
        repository,
        securityEvents,
        deep,
        development,
      );
    } catch (error) {
      inspectionFailed = true;
      throw error;
    } finally {
      await closeInspectionClient(client, inspectionFailed);
    }
  } catch (error) {
    if (error instanceof MigrationHistoryError) {
      return historyErrorDiagnosis(error);
    }
    const code = databaseErrorCode(error);
    const permission = ["42501", "28P01", "28000"].includes(code);
    return {
      reason: permission ? "permission" : "connection",
      details: [
        permission
          ? "Database authentication or read permission failed"
          : "Database connection or inspection failed",
      ],
      nextStep:
        "Check database access and local proxy availability. Raw connection errors are intentionally not printed.",
    };
  } finally {
    if (database?.$client instanceof Pool) {
      await database.$client.end();
    } else if (database) {
      const client = database.$client;
      await new Promise<void>((resolve, reject) => {
        client.once("end", resolve);
        client.end().then(resolve, reject);
      });
    }
  }
}

if (import.meta.main) {
  const boundaries = process.argv.includes("--security-events")
    ? [true]
    : [false, true];
  const results = await Promise.all(
    boundaries.map((securityEvents) =>
      diagnoseDatabase(process.env, {
        securityEvents,
        deep: process.argv.includes("--deep"),
        development: process.argv.includes("--development"),
      }),
    ),
  );
  for (const [index, result] of results.entries()) {
    const securityEvents = boundaries[index];
    console.log(
      `${securityEvents ? "Security events" : "Primary"}: ${result.reason}`,
    );
    for (const detail of result.details) {
      console.log(`  ${detail}`);
    }
    console.log(`  Next: ${result.nextStep}`);
    if (result.reason !== "ready") {
      process.exitCode = 1;
    }
  }
}
