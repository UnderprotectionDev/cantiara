import type {
  DisposableDatabase,
  DisposableDatabasePort,
} from "@cantiara/api/schema-static-validation";
import type { DisposableConnection } from "@cantiara/db/disposable-connection";

const NEON_API = "https://console.neon.tech/api/v2";

export interface NeonDisposableConfig {
  apiKey: string;
  branchId: string;
  projectId: string;
}

interface NeonDisposableDependencies {
  connect: (connectionString: string) => Promise<DisposableConnection>;
  fetch?: typeof fetch;
  /** Replaced in tests; waits between Neon operation polls. */
  pause?: (milliseconds: number) => Promise<void>;
  /** Replaced in tests for deterministic names. */
  randomSuffix?: () => string;
}

class NeonApiError extends Error {}

/**
 * Port adapter that proves SQL on a database created for this run only. It
 * lives in a dedicated Neon validation branch (never the product, staging or
 * a user target), pins the production PostgreSQL major, installs only the
 * matrix extensions inside the disposable database, and drops the database
 * and its role afterwards. The connection string never leaves this module.
 */
export function createNeonDisposableDatabase(
  config: NeonDisposableConfig,
  dependencies: NeonDisposableDependencies,
): DisposableDatabasePort {
  const request = dependencies.fetch ?? fetch;
  const pause =
    dependencies.pause ??
    ((milliseconds) => new Promise((done) => setTimeout(done, milliseconds)));
  const suffix =
    dependencies.randomSuffix ??
    (() => crypto.randomUUID().replaceAll("-", "").slice(0, 16));
  const branch = `${NEON_API}/projects/${encodeURIComponent(config.projectId)}/branches/${encodeURIComponent(config.branchId)}`;

  async function call(method: string, url: string, body?: unknown) {
    const response = await request(url, {
      body: body === undefined ? undefined : JSON.stringify(body),
      headers: {
        accept: "application/json",
        authorization: `Bearer ${config.apiKey}`,
        ...(body === undefined ? {} : { "content-type": "application/json" }),
      },
      method,
    });
    if (!response.ok) {
      throw new NeonApiError(`Neon API ${method} failed (${response.status}).`);
    }
    return (await response.json()) as {
      operations?: Array<{ id: string; status: string }>;
      uri?: string;
    };
  }

  async function settle(result: Awaited<ReturnType<typeof call>>) {
    for (const operation of result.operations ?? []) {
      for (let attempt = 0; attempt < 60; attempt += 1) {
        // biome-ignore lint/performance/noAwaitInLoops: Polling must wait for the previous status.
        const polled = (await call(
          "GET",
          `${NEON_API}/projects/${encodeURIComponent(config.projectId)}/operations/${operation.id}`,
        )) as { operation?: { status: string } };
        const status = polled.operation?.status;
        if (status === "finished") {
          break;
        }
        if (status === "failed" || status === "cancelled") {
          throw new NeonApiError("Neon operation did not finish.");
        }
        await pause(500);
      }
    }
  }

  return {
    async run(options, work) {
      const name = `cantiara_val_${suffix()}`;
      let roleCreated = false;
      let databaseCreated = false;
      let outcome: { error: unknown } | { value: unknown } | undefined;
      let connection: DisposableConnection | undefined;
      try {
        await settle(await call("POST", `${branch}/roles`, { role: { name } }));
        roleCreated = true;
        await settle(
          await call("POST", `${branch}/databases`, {
            database: { name, owner_name: name },
          }),
        );
        databaseCreated = true;
        const { uri } = await call(
          "GET",
          `${NEON_API}/projects/${encodeURIComponent(config.projectId)}/connection_uri?${new URLSearchParams(
            {
              branch_id: config.branchId,
              database_name: name,
              pooled: "false",
              role_name: name,
            },
          )}`,
        );
        if (!uri) {
          throw new NeonApiError("Neon returned no connection.");
        }
        connection = await dependencies.connect(uri);
        const major = await connection.serverMajor();
        if (major !== options.postgresMajor) {
          throw new Error(
            `The validation branch runs PostgreSQL ${major}, not the pinned ${options.postgresMajor}.`,
          );
        }
        for (const extension of options.extensions) {
          // biome-ignore lint/performance/noAwaitInLoops: Setup statements run in order on one connection.
          await connection.execute(
            `CREATE EXTENSION IF NOT EXISTS ${extension};`,
          );
        }
        const database: DisposableDatabase = {
          execute: (sql) => connection?.execute(sql) ?? Promise.resolve(),
        };
        outcome = { value: await work(database) };
      } catch (error) {
        outcome = { error };
      } finally {
        await connection?.close().catch(() => undefined);
      }
      let destroyed = true;
      if (databaseCreated) {
        destroyed =
          (await call("DELETE", `${branch}/databases/${name}`)
            .then(settle)
            .then(() => true)
            .catch(() => false)) && destroyed;
      }
      if (roleCreated) {
        destroyed =
          (await call("DELETE", `${branch}/roles/${name}`)
            .then(settle)
            .then(() => true)
            .catch(() => false)) && destroyed;
      }
      if (outcome && "error" in outcome) {
        throw outcome.error;
      }
      return { destroyed, value: (outcome as { value: never }).value };
    },
  };
}
