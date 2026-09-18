import {
  type CaptureBulkSenseMaking,
  type CaptureBulkSenseMakingValue,
  type CaptureInboxItem,
  type CaptureInboxTriageAdapter,
  captureBulkSenseMakingSchema,
  captureBulkSenseMakingValueSchema,
  captureInboxItemSchema,
  type NormalizedCaptureInput,
} from "@cantiara/api/capture-triage";
import {
  fingerprintMutationPayload,
  type MutationContract,
  type MutationPayload,
  type MutationTarget,
} from "@cantiara/api/mutation-and-undo";
import type { Database } from "@cantiara/db";
import {
  captureInboxBulkView,
  captureInboxItem,
  captureInboxOperation,
} from "@cantiara/db/schema/capture-triage";
import { mutationTarget } from "@cantiara/db/schema/mutation";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import type {
  MutationDatabaseExecutor,
  MutationDatabaseTargetAdapter,
} from "../../mutation-and-undo/server/mutation-contract-database";
import { createDatabaseMutationContract } from "../../mutation-and-undo/server/mutation-contract-database";
import {
  type CaptureInboxCompletedOperation,
  CaptureInboxError,
  type CaptureInboxMergeRecord,
  type CaptureInboxOperationStateStore,
  type CaptureInboxPreview,
  type CaptureInboxStagingStore,
  type CaptureInboxStore,
  type CaptureInboxStoredItem,
  type CaptureInboxWorkCreate,
  createCaptureInbox,
} from "./capture-inbox";

type CaptureInboxDatabaseRecord = typeof captureInboxItem.$inferSelect;
type CaptureInboxBulkViewDatabaseRecord =
  typeof captureInboxBulkView.$inferSelect;
type MutationTargetDatabaseRecord = typeof mutationTarget.$inferSelect;

const captureMutationValueSchema = z
  .object({
    accountId: z.string().trim().min(1),
    clientIdempotencyKey: z.string().trim().min(1),
    item: captureInboxItemSchema,
    payloadFingerprint: z.string().regex(/^[0-9a-f]{64}$/i),
  })
  .strict();

type CaptureMutationValue = z.infer<typeof captureMutationValueSchema>;

const CAPTURE_BULK_VIEW_TARGET_PREFIX = "capture-bulk-view:";

function captureBulkViewTargetId(accountId: string) {
  return `${CAPTURE_BULK_VIEW_TARGET_PREFIX}${accountId}`;
}

function captureBulkViewAccountId(targetId: string) {
  if (!targetId.startsWith(CAPTURE_BULK_VIEW_TARGET_PREFIX)) {
    throw new Error("Bulk sense-making mutation target is invalid.");
  }
  return targetId.slice(CAPTURE_BULK_VIEW_TARGET_PREFIX.length);
}

function toBulkSenseMaking(
  record: CaptureInboxBulkViewDatabaseRecord,
): CaptureBulkSenseMaking {
  return captureBulkSenseMakingSchema.parse({
    clusters: record.clusters,
    placements: record.placements,
    revision: record.revision,
  });
}

function toBulkSenseMakingValue(
  record: CaptureInboxBulkViewDatabaseRecord,
): CaptureBulkSenseMakingValue {
  return captureBulkSenseMakingValueSchema.parse({
    clusters: record.clusters,
    placements: record.placements,
  });
}

function emptyBulkSenseMakingValue(): CaptureBulkSenseMakingValue {
  return { clusters: [], placements: [] };
}

function defaultBulkSenseMakingTarget(
  targetId: string,
): MutationTarget<CaptureBulkSenseMakingValue> {
  return {
    id: targetId,
    revision: 0,
    value: emptyBulkSenseMakingValue(),
  };
}

export const captureInboxBulkViewMutationTarget: MutationDatabaseTargetAdapter<CaptureBulkSenseMakingValue> =
  {
    async find(executor, targetId, lock) {
      const accountId = captureBulkViewAccountId(targetId);
      const query = executor
        .select()
        .from(captureInboxBulkView)
        .where(eq(captureInboxBulkView.accountId, accountId))
        .limit(1);
      const records = lock ? await query.for("update") : await query;
      const [record] = records;
      return record
        ? {
            id: targetId,
            revision: record.revision,
            value: toBulkSenseMakingValue(record),
          }
        : defaultBulkSenseMakingTarget(targetId);
    },

    async update(executor, input) {
      const accountId = captureBulkViewAccountId(input.targetId);
      const [updated] = await executor
        .update(captureInboxBulkView)
        .set({
          clusters: input.nextValue.clusters,
          placements: input.nextValue.placements,
          revision: input.expectedRevision + 1,
          updatedAt: input.committedAt,
        })
        .where(
          and(
            eq(captureInboxBulkView.accountId, accountId),
            eq(captureInboxBulkView.revision, input.expectedRevision),
          ),
        )
        .returning();
      if (updated) {
        return {
          id: input.targetId,
          revision: updated.revision,
          value: toBulkSenseMakingValue(updated),
        };
      }

      const [inserted] = await executor
        .insert(captureInboxBulkView)
        .values({
          accountId,
          clusters: input.nextValue.clusters,
          placements: input.nextValue.placements,
          revision: input.expectedRevision + 1,
          updatedAt: input.committedAt,
        })
        .onConflictDoNothing()
        .returning();
      return inserted
        ? {
            id: input.targetId,
            revision: inserted.revision,
            value: toBulkSenseMakingValue(inserted),
          }
        : null;
    },
  };

async function removeBulkSenseMakingItem(
  executor: MutationDatabaseExecutor,
  accountId: string,
  itemId: string,
) {
  const [record] = await executor
    .select()
    .from(captureInboxBulkView)
    .where(eq(captureInboxBulkView.accountId, accountId))
    .limit(1)
    .for("update");
  if (!record) {
    return;
  }

  const current = toBulkSenseMaking(record);
  const placements = current.placements.filter(
    (placement) => placement.itemId !== itemId,
  );
  if (placements.length === current.placements.length) {
    return;
  }
  const clusterIds = new Set(
    placements.flatMap((placement) =>
      placement.clusterId ? [placement.clusterId] : [],
    ),
  );
  await executor
    .update(captureInboxBulkView)
    .set({
      clusters: current.clusters.filter((cluster) =>
        clusterIds.has(cluster.id),
      ),
      placements,
      revision: current.revision + 1,
      updatedAt: new Date(),
    })
    .where(eq(captureInboxBulkView.accountId, accountId));
}

function toCaptureInboxItem(
  record: CaptureInboxDatabaseRecord,
): CaptureInboxItem {
  return captureInboxItemSchema.parse({
    attachment: record.attachment,
    content: record.content,
    createdAt: record.createdAt.toISOString(),
    fields: record.fields,
    id: record.id,
    link: record.link,
    origin: record.origin,
    projectId: record.projectId,
    template: record.template,
  });
}

function toStoredCaptureInboxItem(
  record: CaptureInboxDatabaseRecord,
): CaptureInboxStoredItem {
  return {
    clientIdempotencyKey: record.clientIdempotencyKey,
    item: toCaptureInboxItem(record),
    payloadFingerprint: record.payloadFingerprint,
  };
}

function capturePayload(input: NormalizedCaptureInput) {
  return {
    ...(input.attachment === undefined ? {} : { attachment: input.attachment }),
    content: input.content,
    fields: input.fields,
    ...(input.link === undefined ? {} : { link: input.link }),
    ...(input.origin === undefined ? {} : { origin: input.origin }),
    projectId: input.projectId,
    template: input.template,
  };
}

function findCaptureByIdempotencyKey(
  database: Database,
  accountId: string,
  clientIdempotencyKey: string,
) {
  return database.query.captureInboxItem.findFirst({
    where: and(
      eq(captureInboxItem.accountId, accountId),
      eq(captureInboxItem.clientIdempotencyKey, clientIdempotencyKey),
    ),
  });
}

function toMutationTarget(
  record: MutationTargetDatabaseRecord,
): MutationTarget<MutationPayload> {
  return {
    id: record.id,
    revision: record.revision,
    value: record.value as MutationPayload,
  };
}

function defaultMutationTarget(
  targetId: string,
): MutationTarget<MutationPayload> {
  return { id: targetId, revision: 0, value: {} };
}

async function insertCaptureMutationValue(
  executor: MutationDatabaseExecutor,
  value: CaptureMutationValue,
) {
  const [inserted] = await executor
    .insert(captureInboxItem)
    .values({
      accountId: value.accountId,
      attachment: value.item.attachment,
      clientIdempotencyKey: value.clientIdempotencyKey,
      content: value.item.content,
      createdAt: new Date(value.item.createdAt),
      fields: value.item.fields,
      id: value.item.id,
      link: value.item.link,
      origin: value.item.origin,
      payloadFingerprint: value.payloadFingerprint,
      projectId: value.item.projectId,
      template: value.item.template,
    })
    .onConflictDoNothing({
      target: [
        captureInboxItem.accountId,
        captureInboxItem.clientIdempotencyKey,
      ],
    })
    .returning();
  if (!inserted) {
    throw new CaptureInboxError(
      "CAPTURE_IDEMPOTENCY_CONFLICT",
      "The capture key was already used for different content.",
    );
  }
}

export const captureInboxMutationTarget: MutationDatabaseTargetAdapter<MutationPayload> =
  {
    async find(executor, targetId, lock) {
      const query = executor
        .select()
        .from(mutationTarget)
        .where(eq(mutationTarget.id, targetId))
        .limit(1);
      const records = lock ? await query.for("update") : await query;
      const [record] = records;
      return record
        ? toMutationTarget(record)
        : defaultMutationTarget(targetId);
    },

    async update(executor, input) {
      const value = captureMutationValueSchema.parse(input.nextValue);
      const [updated] = await executor
        .update(mutationTarget)
        .set({
          revision: input.expectedRevision + 1,
          updatedAt: input.committedAt,
          value: input.nextValue,
        })
        .where(
          and(
            eq(mutationTarget.id, input.targetId),
            eq(mutationTarget.revision, input.expectedRevision),
          ),
        )
        .returning();
      if (updated) {
        await insertCaptureMutationValue(executor, value);
        return toMutationTarget(updated);
      }

      const [inserted] = await executor
        .insert(mutationTarget)
        .values({
          id: input.targetId,
          revision: input.expectedRevision + 1,
          value: input.nextValue,
          updatedAt: input.committedAt,
        })
        .onConflictDoNothing()
        .returning();
      if (!inserted) {
        return null;
      }
      await insertCaptureMutationValue(executor, value);
      return toMutationTarget(inserted);
    },
  };

const captureTriageMutationTarget: MutationDatabaseTargetAdapter<MutationPayload> =
  {
    async find(executor, targetId, lock) {
      const query = executor
        .select()
        .from(mutationTarget)
        .where(eq(mutationTarget.id, targetId))
        .limit(1);
      const records = lock ? await query.for("update") : await query;
      const [record] = records;
      return record
        ? toMutationTarget(record)
        : defaultMutationTarget(targetId);
    },

    async update(executor, input) {
      const [updated] = await executor
        .update(mutationTarget)
        .set({
          revision: input.expectedRevision + 1,
          updatedAt: input.committedAt,
          value: input.nextValue,
        })
        .where(
          and(
            eq(mutationTarget.id, input.targetId),
            eq(mutationTarget.revision, input.expectedRevision),
          ),
        )
        .returning();
      if (updated) {
        return toMutationTarget(updated);
      }

      const [inserted] = await executor
        .insert(mutationTarget)
        .values({
          id: input.targetId,
          revision: input.expectedRevision + 1,
          value: input.nextValue,
          updatedAt: input.committedAt,
        })
        .onConflictDoNothing()
        .returning();
      return inserted ? toMutationTarget(inserted) : null;
    },
  };

function replayExistingCapture(
  record: CaptureInboxDatabaseRecord | undefined,
  payloadFingerprint: string,
) {
  if (!record) {
    return;
  }
  if (record.payloadFingerprint !== payloadFingerprint) {
    throw new CaptureInboxError(
      "CAPTURE_IDEMPOTENCY_CONFLICT",
      "The capture key was already used for different content.",
    );
  }
  return toCaptureInboxItem(record);
}

type CaptureInboxOperationKind = "completed" | "merge" | "preview";

function operationStateId(
  accountId: string,
  kind: CaptureInboxOperationKind,
  operationKey: string,
) {
  return `capture-inbox-operation:${accountId}:${kind}:${operationKey}`;
}

function createDatabaseOperationStateStore(
  database: Database,
): CaptureInboxOperationStateStore {
  async function findState(
    accountId: string,
    kind: CaptureInboxOperationKind,
    operationKey: string,
  ) {
    const [record] = await database
      .select()
      .from(captureInboxOperation)
      .where(
        and(
          eq(captureInboxOperation.accountId, accountId),
          eq(captureInboxOperation.kind, kind),
          eq(captureInboxOperation.operationKey, operationKey),
        ),
      )
      .limit(1);
    return record;
  }

  async function saveState(
    accountId: string,
    kind: CaptureInboxOperationKind,
    operationKey: string,
    value: unknown,
    fingerprint: string,
  ) {
    await database
      .insert(captureInboxOperation)
      .values({
        accountId,
        fingerprint,
        id: operationStateId(accountId, kind, operationKey),
        kind,
        operationKey,
        value,
      })
      .onConflictDoNothing({
        target: [
          captureInboxOperation.accountId,
          captureInboxOperation.kind,
          captureInboxOperation.operationKey,
        ],
      });
  }

  async function deleteState(
    accountId: string,
    kind: CaptureInboxOperationKind,
    operationKey: string,
  ) {
    await database
      .delete(captureInboxOperation)
      .where(
        and(
          eq(captureInboxOperation.accountId, accountId),
          eq(captureInboxOperation.kind, kind),
          eq(captureInboxOperation.operationKey, operationKey),
        ),
      );
  }

  return {
    async deleteMerge(accountId, mergeId) {
      await deleteState(accountId, "merge", mergeId);
    },

    async deletePreview(accountId, previewId) {
      await deleteState(accountId, "preview", previewId);
    },

    async findCompleted<TReceipt>(
      accountId: string,
      operation: "attach" | "convert" | "delete" | "undo",
      clientIdempotencyKey: string,
    ) {
      const record = await findState(
        accountId,
        "completed",
        `${operation}:${clientIdempotencyKey}`,
      );
      if (!record) {
        return null;
      }
      return record.value as CaptureInboxCompletedOperation<TReceipt>;
    },

    async findMerge(accountId, mergeId) {
      const record = await findState(accountId, "merge", mergeId);
      return (record?.value as CaptureInboxMergeRecord) ?? null;
    },

    async findPreview(accountId, previewId) {
      const record = await findState(accountId, "preview", previewId);
      return (record?.value as CaptureInboxPreview) ?? null;
    },

    async saveCompleted<TReceipt>(
      accountId: string,
      operation: "attach" | "convert" | "delete" | "undo",
      clientIdempotencyKey: string,
      completed: CaptureInboxCompletedOperation<TReceipt>,
    ) {
      const operationKey = `${operation}:${clientIdempotencyKey}`;
      await saveState(
        accountId,
        "completed",
        operationKey,
        completed,
        completed.fingerprint,
      );
    },

    async saveMerge(merge) {
      await saveState(
        merge.accountId,
        "merge",
        merge.receipt.mergeId,
        merge,
        JSON.stringify(merge),
      );
    },

    async savePreview(preview) {
      await saveState(
        preview.accountId,
        "preview",
        preview.preview.previewId,
        preview,
        JSON.stringify(preview),
      );
    },
  } satisfies CaptureInboxOperationStateStore;
}

export function createDatabaseCaptureInbox(
  database: Database,
  workCreate: CaptureInboxWorkCreate,
  mutationContract: MutationContract<MutationPayload>,
  triageAdapter?: CaptureInboxTriageAdapter,
  stagingStore?: CaptureInboxStagingStore,
) {
  const operationState = createDatabaseOperationStateStore(database);
  const triageMutationContract =
    createDatabaseMutationContract<MutationPayload>(database, {
      target: captureTriageMutationTarget,
    });
  const bulkSenseMakingMutationContract =
    createDatabaseMutationContract<CaptureBulkSenseMakingValue>(database, {
      target: captureInboxBulkViewMutationTarget,
    });
  async function findStoredCapture(accountId: string, itemId: string) {
    const record = await database.query.captureInboxItem.findFirst({
      where: and(
        eq(captureInboxItem.accountId, accountId),
        eq(captureInboxItem.id, itemId),
      ),
    });
    return record ? toStoredCaptureInboxItem(record) : null;
  }
  const store: CaptureInboxStore = {
    bulkSenseMaking: {
      async get(accountId) {
        const record = await database.query.captureInboxBulkView.findFirst({
          where: eq(captureInboxBulkView.accountId, accountId),
        });
        return record
          ? toBulkSenseMaking(record)
          : captureBulkSenseMakingSchema.parse({
              ...emptyBulkSenseMakingValue(),
              revision: 0,
            });
      },

      async removeItem(accountId, itemId) {
        await database.transaction((transaction) =>
          removeBulkSenseMakingItem(transaction, accountId, itemId),
        );
      },

      async update(accountId, input) {
        const receipt = await bulkSenseMakingMutationContract.mutate(
          {
            actor: { actorId: accountId, type: "User" },
            baseRevision: input.baseRevision,
            clientIdempotencyKey: input.clientIdempotencyKey,
            kind: "human",
            payload: {
              clusters: input.clusters,
              placements: input.placements,
            },
            targetId: captureBulkViewTargetId(accountId),
          },
          () => ({
            clusters: input.clusters,
            placements: input.placements,
          }),
        );
        return captureBulkSenseMakingSchema.parse({
          ...receipt.nextValue,
          revision: receipt.revision,
        });
      },
    },

    async insert(accountId, input) {
      const payloadFingerprint = await fingerprintMutationPayload(
        capturePayload(input),
      );
      if (input.clientIdempotencyKey) {
        const existing = await findCaptureByIdempotencyKey(
          database,
          accountId,
          input.clientIdempotencyKey,
        );
        const replayed = replayExistingCapture(existing, payloadFingerprint);
        if (replayed) {
          return replayed;
        }
      }
      if (input.attachment && !stagingStore) {
        throw new CaptureInboxError(
          "CAPTURE_STAGING_UNAVAILABLE",
          "Capture attachments are not available yet.",
        );
      }

      const clientIdempotencyKey =
        input.clientIdempotencyKey ?? crypto.randomUUID();
      const item = captureInboxItemSchema.parse({
        ...(input.attachment === undefined
          ? {}
          : { attachment: input.attachment }),
        content: input.content,
        createdAt: new Date().toISOString(),
        fields: input.fields,
        id: crypto.randomUUID(),
        ...(input.link === undefined ? {} : { link: input.link }),
        ...(input.origin === undefined ? {} : { origin: input.origin }),
        projectId: input.projectId,
        template: input.template,
      });
      const nextValue = {
        accountId,
        clientIdempotencyKey,
        item,
        payloadFingerprint,
      } satisfies CaptureMutationValue;
      const receipt = await mutationContract.mutate(
        {
          actor: { actorId: accountId, type: "User" },
          baseRevision: 0,
          clientIdempotencyKey,
          kind: "human",
          payload: capturePayload(input),
          targetId: `capture-inbox:${accountId}:${clientIdempotencyKey}`,
        },
        () => nextValue,
      );
      return captureMutationValueSchema.parse(receipt.nextValue).item;
    },

    async consume(accountId, itemId) {
      const [candidate] = await database
        .select()
        .from(captureInboxItem)
        .where(
          and(
            eq(captureInboxItem.accountId, accountId),
            eq(captureInboxItem.id, itemId),
          ),
        )
        .limit(1);
      if (!candidate) {
        return null;
      }
      const deleted = await database.transaction(async (transaction) => {
        const [removed] = await transaction
          .delete(captureInboxItem)
          .where(
            and(
              eq(captureInboxItem.accountId, accountId),
              eq(captureInboxItem.id, itemId),
            ),
          )
          .returning();
        if (!removed) {
          return null;
        }
        await removeBulkSenseMakingItem(transaction, accountId, itemId);
        return removed;
      });
      return deleted ? toStoredCaptureInboxItem(deleted) : null;
    },

    findStored: findStoredCapture,

    async find(accountId, itemId) {
      const stored = await findStoredCapture(accountId, itemId);
      return stored?.item ?? null;
    },

    async list(accountId) {
      const records = await database.query.captureInboxItem.findMany({
        orderBy: [desc(captureInboxItem.createdAt)],
        where: eq(captureInboxItem.accountId, accountId),
      });
      return records.map(toCaptureInboxItem);
    },

    async restore(accountId, storedItem) {
      const { item } = storedItem;
      const [restored] = await database
        .insert(captureInboxItem)
        .values({
          accountId,
          attachment: item.attachment,
          clientIdempotencyKey: storedItem.clientIdempotencyKey,
          content: item.content,
          createdAt: new Date(item.createdAt),
          fields: item.fields,
          id: item.id,
          link: item.link,
          origin: item.origin,
          payloadFingerprint: storedItem.payloadFingerprint,
          projectId: item.projectId,
          template: item.template,
        })
        .onConflictDoNothing({ target: captureInboxItem.id })
        .returning();
      if (!restored) {
        throw new CaptureInboxError(
          "CAPTURE_PREVIEW_CONFLICT",
          "The Capture Inbox item could not be restored.",
        );
      }
      return toStoredCaptureInboxItem(restored);
    },
    operationState,
  };

  return createCaptureInbox({
    store,
    stagingStore,
    triageAdapter,
    triageMutationContract,
    workCreate,
  });
}
