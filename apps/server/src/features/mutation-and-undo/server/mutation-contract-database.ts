import {
  type MutationActor,
  type MutationContract,
  type MutationHistoryEntry,
  type MutationOrigin,
  type MutationPayload,
  type MutationReceipt,
  type MutationTarget,
  mutationActorSchema,
  mutationOriginSchema,
} from "@cantiara/api/mutation-and-undo";
import type { Database } from "@cantiara/db";
import {
  mutationHistory,
  mutationReceipt,
  mutationTarget,
} from "@cantiara/db/schema/mutation";
import { and, eq } from "drizzle-orm";

import {
  createMutationContract,
  type MutationCommitInput,
  type MutationCommitResult,
  type MutationContractOptions,
  type MutationContractStore,
  type MutationIdempotencyKey,
} from "./mutation-contract";

type MutationReceiptRecord = typeof mutationReceipt.$inferSelect;
type MutationTargetRecord = typeof mutationTarget.$inferSelect;

export type MutationDatabaseExecutor = Pick<
  Database,
  "insert" | "select" | "update"
>;

export interface MutationDatabaseTargetAdapter<TValue> {
  find: (
    executor: MutationDatabaseExecutor,
    targetId: string,
    lock: boolean,
  ) => Promise<MutationTarget<TValue> | null>;
  update: (
    executor: MutationDatabaseExecutor,
    input: {
      committedAt: Date;
      expectedRevision: number;
      nextValue: TValue;
      targetId: string;
    },
  ) => Promise<MutationTarget<TValue> | null>;
}

function toActor(
  record: Pick<
    MutationReceiptRecord,
    "actorId" | "actorType" | "authorizingUserId"
  >,
): MutationActor {
  return mutationActorSchema.parse({
    actorId: record.actorId,
    ...(record.authorizingUserId
      ? { authorizingUserId: record.authorizingUserId }
      : {}),
    type: record.actorType,
  });
}

function toOrigin(
  record: Pick<
    MutationReceiptRecord,
    "clientIdempotencyKey" | "deliveryId" | "originKind" | "sourceId"
  >,
): MutationOrigin {
  if (record.originKind === "human" && record.clientIdempotencyKey) {
    return mutationOriginSchema.parse({
      clientIdempotencyKey: record.clientIdempotencyKey,
      kind: "human",
    });
  }

  if (record.originKind === "source" && record.sourceId && record.deliveryId) {
    return mutationOriginSchema.parse({
      deliveryId: record.deliveryId,
      kind: "source",
      sourceId: record.sourceId,
    });
  }

  throw new Error("Mutation receipt has an invalid origin.");
}

function toReceipt<TValue>(
  record: MutationReceiptRecord,
): MutationReceipt<TValue> {
  return {
    actor: toActor(record),
    committedAt: record.committedAt.toISOString(),
    id: record.id,
    nextValue: record.nextValue as TValue,
    origin: toOrigin(record),
    payloadFingerprint: record.payloadFingerprint,
    previousValue: record.previousValue as TValue,
    revision: record.revision,
    targetId: record.targetId,
  };
}

function toTarget<TValue>(
  record: MutationTargetRecord,
): MutationTarget<TValue> {
  return {
    id: record.id,
    revision: record.revision,
    value: record.value as TValue,
  };
}

function createMutationTargetAdapter<
  TValue,
>(): MutationDatabaseTargetAdapter<TValue> {
  return {
    async find(executor, targetId, lock) {
      const query = executor
        .select()
        .from(mutationTarget)
        .where(eq(mutationTarget.id, targetId))
        .limit(1);
      const records = lock ? await query.for("update") : await query;
      const [record] = records;
      return record ? toTarget<TValue>(record) : null;
    },

    async update(executor, input) {
      const [record] = await executor
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
      return record ? toTarget<TValue>(record) : null;
    },
  };
}

async function findReceipt(
  database: MutationDatabaseExecutor,
  key: MutationIdempotencyKey,
): Promise<MutationReceiptRecord | null> {
  const [record] = await database
    .select()
    .from(mutationReceipt)
    .where(
      and(
        eq(mutationReceipt.idempotencyScope, key.scope),
        eq(mutationReceipt.idempotencyKey, key.key),
      ),
    )
    .limit(1);
  return record ?? null;
}

function sourceFields(origin: MutationOrigin) {
  return origin.kind === "human"
    ? { clientIdempotencyKey: origin.clientIdempotencyKey }
    : {
        deliveryId: origin.deliveryId,
        sourceId: origin.sourceId,
      };
}

function actorFields(actor: MutationActor) {
  return {
    actorId: actor.actorId,
    actorType: actor.type,
    ...(actor.type === "Authorized integration"
      ? { authorizingUserId: actor.authorizingUserId }
      : {}),
  };
}

function replayCommitResult<TValue>(
  record: MutationReceiptRecord,
  payloadFingerprint: string,
): MutationCommitResult<TValue> {
  return record.payloadFingerprint === payloadFingerprint
    ? {
        receipt: toReceipt<TValue>(record),
        status: "replayed",
      }
    : { status: "conflict" };
}

function staleCommitResult<TValue>(
  target: MutationTarget<TValue>,
): MutationCommitResult<TValue> {
  return {
    current: target,
    status: "stale",
  };
}

export interface DatabaseMutationContractOptions<TValue>
  extends Omit<MutationContractOptions<TValue>, "store"> {
  target?: MutationDatabaseTargetAdapter<TValue>;
}

export function createDatabaseMutationContract<TValue = MutationPayload>(
  database: Database,
  options: DatabaseMutationContractOptions<TValue> = {},
): MutationContract<TValue> {
  const {
    target: targetAdapter = createMutationTargetAdapter<TValue>(),
    ...contractOptions
  } = options;
  const store: MutationContractStore<TValue> = {
    async findReceipt(key) {
      const record = await findReceipt(database, key);
      return record ? toReceipt<TValue>(record) : null;
    },

    getTarget(targetId) {
      return targetAdapter.find(database, targetId, false);
    },

    commit: <TPayload extends MutationPayload>(
      input: MutationCommitInput<TValue, TPayload>,
    ) =>
      database.transaction(async (transaction) => {
        const existing = await findReceipt(transaction, input.idempotencyKey);
        if (existing) {
          return replayCommitResult<TValue>(existing, input.payloadFingerprint);
        }

        const target = await targetAdapter.find(
          transaction,
          input.targetId,
          true,
        );
        if (!target) {
          return { status: "target-not-found" as const };
        }

        const receiptAfterLock = await findReceipt(
          transaction,
          input.idempotencyKey,
        );
        if (receiptAfterLock) {
          return replayCommitResult<TValue>(
            receiptAfterLock,
            input.payloadFingerprint,
          );
        }

        if (target.revision !== input.expectedRevision) {
          return staleCommitResult<TValue>(target);
        }

        const nextValue = await input.apply({
          currentRevision: target.revision,
          currentValue: target.value as TValue,
          payload: input.payload,
        });
        const revision = target.revision + 1;
        const committedAt = new Date(input.committedAt);
        const targetUpdate = await targetAdapter.update(transaction, {
          committedAt,
          expectedRevision: input.expectedRevision,
          nextValue,
          targetId: input.targetId,
        });
        if (!targetUpdate) {
          const receiptAfterTargetConflict = await findReceipt(
            transaction,
            input.idempotencyKey,
          );
          if (receiptAfterTargetConflict) {
            return replayCommitResult<TValue>(
              receiptAfterTargetConflict,
              input.payloadFingerprint,
            );
          }
          const current = await targetAdapter.find(
            transaction,
            input.targetId,
            true,
          );
          return staleCommitResult<TValue>(current ?? target);
        }

        const receiptValues = {
          committedAt,
          expectedRevision: input.expectedRevision,
          id: input.receiptId,
          idempotencyKey: input.idempotencyKey.key,
          idempotencyScope: input.idempotencyKey.scope,
          nextValue,
          originKind: input.origin.kind,
          payloadFingerprint: input.payloadFingerprint,
          previousValue: target.value,
          revision,
          targetId: input.targetId,
          ...actorFields(input.actor),
          ...sourceFields(input.origin),
        };
        await transaction.insert(mutationReceipt).values(receiptValues);

        const historyValues: MutationHistoryEntry<TValue> = {
          actor: input.actor,
          id: input.historyId,
          nextValue,
          occurredAt: input.committedAt,
          origin: input.origin,
          payloadFingerprint: input.payloadFingerprint,
          previousValue: target.value as TValue,
          revision,
          targetId: input.targetId,
        };
        await transaction.insert(mutationHistory).values({
          occurredAt: committedAt,
          id: historyValues.id,
          nextValue: historyValues.nextValue,
          originKind: historyValues.origin.kind,
          payloadFingerprint: historyValues.payloadFingerprint,
          previousValue: historyValues.previousValue,
          revision: historyValues.revision,
          targetId: historyValues.targetId,
          ...actorFields(historyValues.actor),
          ...sourceFields(historyValues.origin),
        });

        return {
          receipt: {
            actor: input.actor,
            committedAt: input.committedAt,
            id: input.receiptId,
            nextValue,
            origin: input.origin,
            payloadFingerprint: input.payloadFingerprint,
            previousValue: target.value as TValue,
            revision,
            targetId: input.targetId,
          },
          status: "committed" as const,
        };
      }),
  };

  return createMutationContract({ ...contractOptions, store });
}
