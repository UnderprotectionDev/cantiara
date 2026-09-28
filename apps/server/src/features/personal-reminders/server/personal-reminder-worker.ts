import { log } from "evlog";
import { PgBoss } from "pg-boss";

export const PERSONAL_REMINDER_FIRE_QUEUE = "personal-reminder-fire";
const DEAD_LETTER_QUEUE = "personal-reminder-fire-dead-letter";

export function createPersonalReminderWorker({
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
      action: "personal-reminder.fire-worker",
      error: error instanceof Error ? error.message : "PgBoss worker error",
    });
  });

  async function start() {
    if (!startPromise) {
      startPromise = (async () => {
        await boss.start();
        await boss.createQueue(DEAD_LETTER_QUEUE);
        await boss.createQueue(PERSONAL_REMINDER_FIRE_QUEUE, {
          deadLetter: DEAD_LETTER_QUEUE,
          retryBackoff: true,
          retryDelay: 1,
          retryLimit: 2,
        });
        await boss.work(PERSONAL_REMINDER_FIRE_QUEUE, async () => {
          await process();
        });
        await boss.schedule(PERSONAL_REMINDER_FIRE_QUEUE, "* * * * *", null, {
          missed: "once",
        });
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
