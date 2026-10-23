// biome-ignore-all lint/performance/noAwaitInLoops: Jobs of one fetch apply in order; a failure must retry the job, not skip it.
import { log } from "evlog";
import { type JobWithMetadata, PgBoss } from "pg-boss";

import type { GitHubWebhookInbox } from "./github-webhook-inbox";

export const GITHUB_WEBHOOK_QUEUE = "github-webhook-delivery";
export const GITHUB_WEBHOOK_DEAD_LETTER_QUEUE =
  "github-webhook-delivery-dead-letter";
export const GITHUB_WEBHOOK_RETRY_LIMIT = 5;

/** Evlog operator alarm: a dead-letter or a due rotation is an error-level event, never silent. */
export function logOperatorAlarm(alarm: {
  action: string;
  deliveryId?: string;
  detail: string;
}) {
  log.error({
    action: alarm.action,
    alarm: "operator",
    deliveryId: alarm.deliveryId,
    error: alarm.detail,
  });
}

/**
 * pg-boss worker for the webhook inbox (tech-stack: pg-boss for background
 * work). Retries with backoff; the last failed attempt dead-letters the
 * delivery with an operator alarm instead of losing it.
 */
export function createGitHubWebhookWorker({
  connectionString,
  inbox,
}: {
  connectionString: string;
  inbox: GitHubWebhookInbox;
}) {
  const boss = new PgBoss(connectionString);
  let startPromise: Promise<void> | undefined;

  boss.on("error", (error) => {
    log.error({
      action: "github.webhook-worker",
      error: error instanceof Error ? error.message : "PgBoss worker error",
    });
  });

  async function start() {
    if (!startPromise) {
      startPromise = (async () => {
        await boss.start();
        await boss.createQueue(GITHUB_WEBHOOK_DEAD_LETTER_QUEUE);
        await boss.createQueue(GITHUB_WEBHOOK_QUEUE, {
          deadLetter: GITHUB_WEBHOOK_DEAD_LETTER_QUEUE,
          retryBackoff: true,
          retryDelay: 30,
          retryLimit: GITHUB_WEBHOOK_RETRY_LIMIT,
        });
        await boss.work(
          GITHUB_WEBHOOK_QUEUE,
          { includeMetadata: true } as const,
          async (jobs: JobWithMetadata<{ deliveryId: string }>[]) => {
            for (const job of jobs) {
              await inbox.process(job.data.deliveryId, {
                final: job.retryCount >= job.retryLimit,
              });
            }
          },
        );
      })().catch((error) => {
        startPromise = undefined;
        throw error;
      });
    }
    await startPromise;
  }

  async function enqueue(deliveryId: string) {
    await start();
    await boss.send(
      GITHUB_WEBHOOK_QUEUE,
      { deliveryId },
      { singletonKey: deliveryId },
    );
  }

  async function stop() {
    await boss.stop();
    startPromise = undefined;
  }

  return { enqueue, start, stop };
}
