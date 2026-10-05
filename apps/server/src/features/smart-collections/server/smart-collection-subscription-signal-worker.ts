import { log } from "evlog";
import { PgBoss } from "pg-boss";

export const SMART_COLLECTION_SUBSCRIPTION_SIGNAL_QUEUE =
  "smart-collection-subscription-signal";
const DEAD_LETTER_QUEUE = "smart-collection-subscription-signal-dead-letter";

export function createSmartCollectionSubscriptionSignalWorker({
  connectionString,
  process,
}: {
  connectionString: string;
  process: () => Promise<number>;
}) {
  const boss = new PgBoss(connectionString);
  let startPromise: Promise<void> | undefined;

  boss.on("error", (error) => {
    log.error({
      action: "smart-collection.subscription-signal-worker",
      error: error instanceof Error ? error.message : "PgBoss worker error",
    });
  });

  async function start() {
    if (!startPromise) {
      startPromise = (async () => {
        await boss.start();
        await boss.createQueue(DEAD_LETTER_QUEUE);
        await boss.createQueue(SMART_COLLECTION_SUBSCRIPTION_SIGNAL_QUEUE, {
          deadLetter: DEAD_LETTER_QUEUE,
          retryBackoff: true,
          retryDelay: 1,
          retryLimit: 2,
        });
        await boss.work(
          SMART_COLLECTION_SUBSCRIPTION_SIGNAL_QUEUE,
          async () => {
            await process();
          },
        );
        await boss.schedule(
          SMART_COLLECTION_SUBSCRIPTION_SIGNAL_QUEUE,
          "* * * * *",
          null,
          { missed: "once" },
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
