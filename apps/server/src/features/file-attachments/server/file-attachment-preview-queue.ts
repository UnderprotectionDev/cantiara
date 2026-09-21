import { log } from "evlog";
import { type JobWithMetadata, PgBoss } from "pg-boss";

import type {
  FileAttachmentPreviewJob,
  FileAttachmentPreviewProcessOptions,
  FileAttachmentPreviewSchedule,
} from "./file-attachment-preview";

export const FILE_ATTACHMENT_PREVIEW_QUEUE = "file-attachment-preview";
const FILE_ATTACHMENT_PREVIEW_DEAD_LETTER_QUEUE =
  "file-attachment-preview-dead-letter";

export interface FileAttachmentPreviewWorker {
  enqueue: FileAttachmentPreviewSchedule;
  start: () => Promise<void>;
  stop: () => Promise<void>;
}

export function createFileAttachmentPreviewWorker({
  connectionString,
  process,
}: {
  connectionString: string;
  process: (
    job: FileAttachmentPreviewJob,
    options: FileAttachmentPreviewProcessOptions,
  ) => Promise<void>;
}): FileAttachmentPreviewWorker {
  const boss = new PgBoss(connectionString);
  let startPromise: Promise<void> | undefined;

  boss.on("error", (error) => {
    log.error({
      action: "file-attachment.preview-worker",
      error: error instanceof Error ? error.message : "PgBoss worker error",
    });
  });

  async function start() {
    if (!startPromise) {
      startPromise = (async () => {
        await boss.start();
        await boss.createQueue(FILE_ATTACHMENT_PREVIEW_DEAD_LETTER_QUEUE);
        await boss.createQueue(FILE_ATTACHMENT_PREVIEW_QUEUE, {
          deadLetter: FILE_ATTACHMENT_PREVIEW_DEAD_LETTER_QUEUE,
          deleteAfterSeconds: 7 * 24 * 60 * 60,
          notify: true,
          retryBackoff: true,
          retryDelay: 1,
          retryLimit: 2,
        });
        await boss.work<FileAttachmentPreviewJob>(
          FILE_ATTACHMENT_PREVIEW_QUEUE,
          {
            batchSize: 1,
            includeMetadata: true,
            localConcurrency: 1,
            pollingIntervalSeconds: 2,
          },
          async (jobs) => {
            await Promise.all(
              (
                jobs as unknown as JobWithMetadata<FileAttachmentPreviewJob>[]
              ).map((job) =>
                process(job.data, {
                  finalAttempt: job.retryCount >= job.retryLimit,
                }),
              ),
            );
          },
        );
      })().catch((error) => {
        startPromise = undefined;
        throw error;
      });
    }
    await startPromise;
  }

  async function enqueue(job: FileAttachmentPreviewJob) {
    await start();
    await boss.send(FILE_ATTACHMENT_PREVIEW_QUEUE, job, {
      singletonKey: `${job.accountId}:${job.attachmentId}:${job.versionId}`,
      singletonSeconds: 60,
    });
  }

  async function stop() {
    await boss.stop();
    startPromise = undefined;
  }

  return { enqueue, start, stop };
}
