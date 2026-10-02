import { Pool } from "@neondatabase/serverless";
import {
  connectMigrationTarget,
  resolveMigrationTarget,
} from "./migration-target";

export async function acquireDevelopmentPromotionLease(
  environment: Record<string, string | undefined>,
  { deployment = false } = {},
) {
  const database = await connectMigrationTarget(
    resolveMigrationTarget(environment, { deployment }),
    { queryTimeoutMs: 10_000 },
  );
  const client =
    database.$client instanceof Pool
      ? await database.$client.connect()
      : database.$client;
  let locked = false;
  const controller = new AbortController();
  const disconnect = () => controller.abort();
  client.on("error", disconnect);
  client.on("end", disconnect);
  try {
    const result = await client.query<{ locked: boolean }>(
      "SELECT pg_try_advisory_lock(1128351316, 1296648019) AS locked",
    );
    if (!result.rows[0]?.locked) {
      throw new Error("Another canonical development promotion is running");
    }
    locked = true;
  } catch (error) {
    if (database.$client instanceof Pool && "release" in client) {
      client.release(controller.signal.aborted);
    }
    await database.$client.end();
    throw error;
  }
  return {
    signal: controller.signal,
    async verify() {
      if (controller.signal.aborted) {
        throw new Error("Canonical promotion connection was lost");
      }
      await client.query("SELECT 1");
    },
    async close() {
      try {
        if (locked && !controller.signal.aborted) {
          locked = false;
          await client.query(
            "SELECT pg_advisory_unlock(1128351316, 1296648019)",
          );
        }
      } finally {
        if (database.$client instanceof Pool && "release" in client) {
          client.release(controller.signal.aborted);
        }
        if (database.$client instanceof Pool) {
          await database.$client.end();
        } else if (!controller.signal.aborted) {
          await new Promise<void>((resolve, reject) => {
            client.once("end", resolve);
            database.$client.end().then(resolve, reject);
          });
        }
      }
    },
  };
}
