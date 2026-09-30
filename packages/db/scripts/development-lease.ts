import { statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { type Client, Pool, type PoolClient } from "@neondatabase/serverless";
import { primarySchemaFiles, securitySchemaFiles } from "../schema-files";
import { checkMigrationSources } from "./check-migrations";
import { inspectReadiness } from "./doctor";
import { verifyMigrationHistory } from "./migration-history";
import {
  connectMigrationTarget,
  resolveMigrationTarget,
} from "./migration-target";

async function acquireBoundary(
  environment: Record<string, string | undefined>,
  securityEvents: boolean,
) {
  const repository = await checkMigrationSources(securityEvents);
  const folder = fileURLToPath(
    new URL(
      securityEvents
        ? "../src/migrations/security-events/"
        : "../src/migrations/",
      import.meta.url,
    ),
  );
  const sources = [
    ...(securityEvents ? securitySchemaFiles : primarySchemaFiles).map((path) =>
      fileURLToPath(new URL(`../${path}`, import.meta.url)),
    ),
    fileURLToPath(new URL("../schema-files.ts", import.meta.url)),
    `${folder}meta/_journal.json`,
  ];
  const fingerprint = () =>
    JSON.stringify(
      sources.map((path) => {
        const state = statSync(path);
        return [state.mtimeMs, state.size];
      }),
    );
  const originalFingerprint = fingerprint();
  const database = await connectMigrationTarget(
    resolveMigrationTarget(environment, { securityEvents }),
    { queryTimeoutMs: 10_000 },
  );
  let locked = false;
  let client: Client | PoolClient;
  try {
    client =
      database.$client instanceof Pool
        ? await database.$client.connect()
        : database.$client;
  } catch (error) {
    await database.$client.end();
    throw error;
  }
  let disconnected = false;
  const markDisconnected = () => {
    disconnected = true;
  };
  client.on("error", markDisconnected);
  client.on("end", markDisconnected);
  const close = async () => {
    try {
      if (locked && !disconnected) {
        await client.query(
          "SELECT pg_advisory_unlock_shared(1128351316, 1296648018)",
        );
      }
    } finally {
      if ("release" in client) {
        client.release(disconnected);
      }
      if (database.$client instanceof Pool) {
        await database.$client.end();
      } else if (!disconnected) {
        await new Promise<void>((resolve, reject) => {
          client.once("end", resolve);
          database.$client.end().then(resolve, reject);
        });
      }
    }
  };
  try {
    await client.query("SET statement_timeout = '10s'");
    await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
    try {
      const result = await client.query<{ locked: boolean }>(
        "SELECT pg_try_advisory_lock_shared(1128351316, 1296648018) AS locked",
      );
      locked = result.rows[0]?.locked === true;
      if (!locked) {
        throw new Error("A migration is running; development cannot start");
      }
      const diagnosis = await inspectReadiness(
        client,
        repository,
        securityEvents,
        false,
      );
      if (diagnosis.reason !== "ready") {
        throw new Error("Development database is not ready");
      }
    } finally {
      await client.query("ROLLBACK");
    }
    return {
      close,
      async verify() {
        if (disconnected) {
          throw new Error("Development database connection was lost");
        }
        if (fingerprint() !== originalFingerprint) {
          throw new Error(
            "Development schema sources changed; restart after verification",
          );
        }
        const history = await verifyMigrationHistory(client, folder);
        if (history.applied.length !== history.expected.length) {
          throw new Error("Development migration history changed");
        }
      },
    };
  } catch (error) {
    await close();
    throw error;
  }
}

export async function acquireDevelopmentLease(
  environment: Record<string, string | undefined>,
) {
  const boundaries: Awaited<ReturnType<typeof acquireBoundary>>[] = [];
  let closed = false;
  const close = async () => {
    if (closed) {
      return;
    }
    closed = true;
    const results = await Promise.allSettled(
      boundaries.map((boundary) => boundary.close()),
    );
    if (results.some((result) => result.status === "rejected")) {
      throw new Error("Development database session cleanup failed");
    }
  };
  try {
    boundaries.push(await acquireBoundary(environment, false));
    boundaries.push(await acquireBoundary(environment, true));
    return {
      close,
      async verify() {
        await Promise.all(boundaries.map((boundary) => boundary.verify()));
      },
    };
  } catch (error) {
    await close();
    throw error;
  }
}
