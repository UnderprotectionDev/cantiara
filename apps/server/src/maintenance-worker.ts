import { log } from "evlog";
import { PgBoss } from "pg-boss";

const DEAD_LETTER_QUEUE = "maintenance-sweep-dead-letter";

export interface MaintenanceSweep {
  /** pg-boss cron expression. */
  cron: string;
  /** Queue name; also the log action suffix. */
  name: string;
  process: () => Promise<unknown>;
}

export function createMaintenanceWorker({
  connectionString,
  sweeps,
}: {
  connectionString: string;
  sweeps: readonly MaintenanceSweep[];
}) {
  const boss = new PgBoss(connectionString);
  let startPromise: Promise<void> | undefined;

  boss.on("error", (error) => {
    log.error({
      action: "maintenance.sweep-worker",
      error: error instanceof Error ? error.message : "PgBoss worker error",
    });
  });

  async function start() {
    if (!startPromise) {
      startPromise = (async () => {
        await boss.start();
        await boss.createQueue(DEAD_LETTER_QUEUE);
        await Promise.all(
          sweeps.map(async (sweep) => {
            await boss.createQueue(sweep.name, {
              deadLetter: DEAD_LETTER_QUEUE,
              retryBackoff: true,
              retryDelay: 1,
              retryLimit: 2,
            });
            await boss.work(sweep.name, async () => {
              await sweep.process();
            });
            await boss.schedule(sweep.name, sweep.cron, null, {
              missed: "once",
            });
          }),
        );
      })().catch((error) => {
        startPromise = undefined;
        throw error;
      });
    }
    await startPromise;
  }

  async function stop() {
    await boss.stop();
    startPromise = undefined;
  }

  return { start, stop };
}
