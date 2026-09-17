import {
  type MutationActor,
  type MutationAtomicContract,
  type MutationHistoryEntry,
  type MutationOrigin,
  type MutationPayload,
  type MutationReceipt,
  type MutationRollbackReason,
  type MutationRollbackReceipt,
  type MutationTarget,
  mutationActorSchema,
  mutationOperationStatusSchema,
  mutationOriginSchema,
  mutationRollbackReasonSchema,
} from "@cantiara/api/mutation-and-undo";
import type { Database } from "@cantiara/db";
import {
  mutationHistory,
  mutationReceipt,
  mutationStaging,
  mutationTarget,
} from "@cantiara/db/schema/mutation";
import { and, eq, lte, or } from "drizzle-orm";

import {
  createMutationContract,
  MutationApplyFailedError,
  type MutationAtomicContractStore,
  type MutationBarrierContext,
  type MutationCancelInput,
  type MutationCommitInput,
  type MutationCommitResult,
  type MutationContractOptions,
  type MutationFinalizeInput,
  type MutationFinalizeResult,
  type MutationIdempotencyKey,
  type MutationStagedRecord,
  type MutationStageInput,
  type MutationStageResult,
} from "./mutation-contract";

type MutationReceiptRecord = typeof mutationReceipt.$inferSelect;
type MutationStagingRecord = typeof mutationStaging.$inferSelect;
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

function toRollbackReason(
  record: MutationStagingRecord,
): MutationRollbackReason {
  if (!record.rollbackReason) {
    throw new Error("Mutation staging has no rollback reason.");
  }
  return mutationRollbackReasonSchema.parse(record.rollbackReason);
}

function toRollbackReceipt<TValue>(
  record: MutationStagingRecord,
  current?: MutationTarget<TValue>,
): MutationRollbackReceipt<TValue> {
  if (!record.completedAt) {
    throw new Error("Mutation rollback has no completion time.");
  }

  const recordedCurrent =
    current ??
    (record.rollbackCurrentRevision !== null &&
    record.rollbackCurrentValue !== null
      ? {
          id: record.targetId,
          revision: record.rollbackCurrentRevision,
          value: record.rollbackCurrentValue as TValue,
        }
      : undefined);

  return {
    actor: toActor(record),
    completedAt: record.completedAt.toISOString(),
    ...(recordedCurrent ? { current: recordedCurrent } : {}),
    expectedRevision: record.expectedRevision,
    id: record.receiptId,
    idempotencyKey: {
      key: record.idempotencyKey,
      scope: record.idempotencyScope,
    },
    operationId: record.id,
    origin: toOrigin(record),
    payloadFingerprint: record.payloadFingerprint,
    reason: toRollbackReason(record),
    status: "rolled-back",
    targetId: record.targetId,
  };
}

const STAGED_PAYLOAD_MARKER = "__cantiaraMutationPayload" as const;

interface StagedPayloadEnvelope {
  value: MutationPayload;
  [STAGED_PAYLOAD_MARKER]: true;
}

function encodeStagedPayload(payload: MutationPayload): StagedPayloadEnvelope {
  return {
    [STAGED_PAYLOAD_MARKER]: true,
    value: payload,
  };
}

function decodeStagedPayload(payload: unknown): MutationPayload | undefined {
  if (payload === null) {
    return undefined;
  }

  if (
    typeof payload === "object" &&
    (payload as Record<string, unknown>)[STAGED_PAYLOAD_MARKER] === true &&
    "value" in payload
  ) {
    return (payload as StagedPayloadEnvelope).value;
  }

  return payload as MutationPayload;
}

function toStagedRecord<TValue>(
  record: MutationStagingRecord,
  receipt: MutationReceipt<TValue> | null = null,
  current?: MutationTarget<TValue>,
): MutationStagedRecord<TValue> {
  const rollbackReceipt =
    record.status === "rolled-back" ? toRollbackReceipt(record, current) : null;

  return {
    actor: toActor(record),
    completedAt: record.completedAt?.toISOString() ?? null,
    expectedRevision: record.expectedRevision,
    expiresAt: record.expiresAt.toISOString(),
    historyId: record.historyId,
    id: record.id,
    idempotencyKey: {
      key: record.idempotencyKey,
      scope: record.idempotencyScope,
    },
    origin: toOrigin(record),
    payload: decodeStagedPayload(record.payload),
    payloadFingerprint: record.payloadFingerprint,
    receipt,
    receiptId: record.receiptId,
    rollbackReceipt,
    stagedAt: record.stagedAt.toISOString(),
    status: mutationOperationStatusSchema.parse(record.status),
    targetId: record.targetId,
  };
}

function stagedRecordFromReceipt<TValue>(
  receipt: MutationReceipt<TValue>,
): MutationStagedRecord<TValue> {
  return {
    actor: receipt.actor,
    completedAt: receipt.committedAt,
    expectedRevision: receipt.revision - 1,
    expiresAt: receipt.committedAt,
    historyId: receipt.id,
    id: receipt.id,
    idempotencyKey:
      receipt.origin.kind === "human"
        ? {
            key: receipt.origin.clientIdempotencyKey,
            scope: `human:${receipt.actor.actorId}:${receipt.targetId}`,
          }
        : {
            key: receipt.origin.deliveryId,
            scope: `source:${receipt.origin.sourceId}:${receipt.targetId}`,
          },
    origin: receipt.origin,
    payload: undefined,
    payloadFingerprint: receipt.payloadFingerprint,
    receipt,
    receiptId: receipt.id,
    rollbackReceipt: null,
    stagedAt: receipt.committedAt,
    status: "committed",
    targetId: receipt.targetId,
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

async function findReceiptById(
  database: MutationDatabaseExecutor,
  receiptId: string,
): Promise<MutationReceiptRecord | null> {
  const [record] = await database
    .select()
    .from(mutationReceipt)
    .where(eq(mutationReceipt.id, receiptId))
    .limit(1);
  return record ?? null;
}

async function findStaging(
  database: MutationDatabaseExecutor,
  operationId: string,
  lock: boolean,
): Promise<MutationStagingRecord | null> {
  const query = database
    .select()
    .from(mutationStaging)
    .where(eq(mutationStaging.id, operationId))
    .limit(1);
  const records = lock ? await query.for("update") : await query;
  const [record] = records;
  return record ?? null;
}

async function findStagingByKey(
  database: MutationDatabaseExecutor,
  key: MutationIdempotencyKey,
  lock: boolean,
): Promise<MutationStagingRecord | null> {
  const query = database
    .select()
    .from(mutationStaging)
    .where(
      and(
        eq(mutationStaging.idempotencyScope, key.scope),
        eq(mutationStaging.idempotencyKey, key.key),
      ),
    )
    .limit(1);
  const records = lock ? await query.for("update") : await query;
  const [record] = records;
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

async function barrierCheck<TValue>(
  check:
    | ((
        context: MutationBarrierContext<TValue, MutationDatabaseExecutor>,
      ) => boolean | Promise<boolean>)
    | undefined,
  context: MutationBarrierContext<TValue, MutationDatabaseExecutor>,
) {
  if (!check) {
    return false;
  }

  try {
    return await check(context);
  } catch {
    return false;
  }
}

async function rollbackStaging<TValue>(
  executor: MutationDatabaseExecutor,
  record: MutationStagingRecord,
  input: MutationCancelInput,
  current?: MutationTarget<TValue>,
): Promise<MutationFinalizeResult<TValue>> {
  const [updated] = await executor
    .update(mutationStaging)
    .set({
      completedAt: new Date(input.completedAt),
      payload: null,
      rollbackCurrentRevision: current?.revision ?? null,
      rollbackCurrentValue: current?.value ?? null,
      rollbackReason: input.reason,
      status: "rolled-back",
    })
    .where(
      and(
        eq(mutationStaging.id, record.id),
        eq(mutationStaging.status, record.status),
      ),
    )
    .returning();

  const rollbackRecord =
    updated ??
    ({
      ...record,
      completedAt: new Date(input.completedAt),
      payload: null,
      rollbackCurrentRevision: current?.revision ?? null,
      rollbackCurrentValue: current?.value ?? null,
      rollbackReason: input.reason,
      status: "rolled-back",
    } satisfies MutationStagingRecord);
  const receipt = toRollbackReceipt(rollbackRecord, current);
  return {
    operation: toStagedRecord(rollbackRecord, null, current),
    receipt,
    status: "rolled-back",
  };
}

async function resultFromStaging<TValue>(
  executor: MutationDatabaseExecutor,
  record: MutationStagingRecord,
): Promise<MutationFinalizeResult<TValue>> {
  if (record.status === "finalizing") {
    return { operationId: record.id, status: "finalizing" };
  }

  if (record.status === "rolled-back") {
    const receipt = toRollbackReceipt<TValue>(record);
    return {
      operation: toStagedRecord(record, null),
      receipt,
      status: "rolled-back",
    };
  }

  if (record.status === "committed") {
    const receiptRecord = await findReceiptById(executor, record.receiptId);
    if (!receiptRecord) {
      throw new Error("Committed mutation staging has no commit receipt.");
    }
    const receipt = toReceipt<TValue>(receiptRecord);
    return {
      operation: toStagedRecord(record, receipt),
      receipt,
      status: "committed",
    };
  }

  throw new Error("Mutation staging has an unknown status.");
}

async function stageResultFromRecord<TValue>(
  executor: MutationDatabaseExecutor,
  record: MutationStagingRecord,
): Promise<MutationStageResult<TValue>> {
  if (record.status === "committed") {
    const result = await resultFromStaging<TValue>(executor, record);
    if (result.status !== "committed") {
      throw new Error("Committed mutation staging has an invalid result.");
    }
    return result;
  }

  if (record.status === "rolled-back") {
    const result = await resultFromStaging<TValue>(executor, record);
    if (result.status !== "rolled-back") {
      throw new Error("Rolled-back mutation staging has an invalid result.");
    }
    return result;
  }

  return {
    operation: toStagedRecord(record),
    status: record.status === "finalizing" ? "finalizing" : "staged",
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

async function commitResultFromStaging<TValue>(
  executor: MutationDatabaseExecutor,
  record: MutationStagingRecord,
  payloadFingerprint: string,
): Promise<MutationCommitResult<TValue>> {
  if (record.status !== "committed") {
    return { status: "conflict" };
  }

  const receipt = await findReceiptById(executor, record.receiptId);
  return receipt
    ? replayCommitResult<TValue>(receipt, payloadFingerprint)
    : { status: "conflict" };
}

function mutationRollbackInput(
  operationId: string,
  completedAt: string,
  reason: MutationRollbackReason,
): MutationCancelInput {
  return { completedAt, operationId, reason };
}

function staleCommitResult<TValue>(
  target: MutationTarget<TValue>,
): MutationCommitResult<TValue> {
  return {
    current: target,
    status: "stale",
  };
}

function stagedInputMatches<TValue, TPayload extends MutationPayload>(
  record: MutationStagingRecord,
  input: MutationFinalizeInput<TValue, TPayload, MutationDatabaseExecutor>,
) {
  return (
    record.expectedRevision === input.expectedRevision &&
    record.idempotencyKey === input.idempotencyKey.key &&
    record.idempotencyScope === input.idempotencyKey.scope &&
    record.payloadFingerprint === input.payloadFingerprint &&
    record.targetId === input.targetId
  );
}

export interface DatabaseMutationContractOptions<TValue>
  extends Omit<
    MutationContractOptions<TValue, MutationDatabaseExecutor>,
    "store"
  > {
  target?: MutationDatabaseTargetAdapter<TValue>;
}

export function createDatabaseMutationContract<TValue = MutationPayload>(
  database: Database,
  options: DatabaseMutationContractOptions<TValue> = {},
): MutationAtomicContract<TValue> {
  const {
    target: targetAdapter = createMutationTargetAdapter<TValue>(),
    ...contractOptions
  } = options;
  const store: MutationAtomicContractStore<TValue, MutationDatabaseExecutor> = {
    async findReceipt(key) {
      const record = await findReceipt(database, key);
      return record ? toReceipt<TValue>(record) : null;
    },

    getTarget(targetId) {
      return targetAdapter.find(database, targetId, false);
    },

    findStagedOperation: async (operationId) => {
      const record = await findStaging(database, operationId, false);
      if (!record) {
        const receiptRecord = await findReceiptById(database, operationId);
        return receiptRecord
          ? stagedRecordFromReceipt(toReceipt<TValue>(receiptRecord))
          : null;
      }

      const receiptRecord =
        record.status === "committed"
          ? await findReceiptById(database, record.receiptId)
          : null;
      return toStagedRecord(
        record,
        receiptRecord ? toReceipt<TValue>(receiptRecord) : null,
      );
    },

    stage: <TPayload extends MutationPayload>(
      input: MutationStageInput<TPayload>,
    ) =>
      // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: Idempotency lookup and staging insertion must stay in one transaction.
      database.transaction(async (transaction) => {
        const existingStaging = await findStagingByKey(
          transaction,
          input.idempotencyKey,
          true,
        );
        if (existingStaging) {
          if (existingStaging.payloadFingerprint !== input.payloadFingerprint) {
            return { status: "conflict" as const };
          }
          return stageResultFromRecord<TValue>(transaction, existingStaging);
        }

        const existingReceipt = await findReceipt(
          transaction,
          input.idempotencyKey,
        );
        if (existingReceipt) {
          return existingReceipt.payloadFingerprint === input.payloadFingerprint
            ? {
                operation: stagedRecordFromReceipt(
                  toReceipt<TValue>(existingReceipt),
                ),
                status: "committed" as const,
              }
            : { status: "conflict" as const };
        }

        const [inserted] = await transaction
          .insert(mutationStaging)
          .values({
            ...actorFields(input.actor),
            expectedRevision: input.expectedRevision,
            expiresAt: new Date(input.expiresAt),
            historyId: input.historyId,
            id: input.operationId,
            idempotencyKey: input.idempotencyKey.key,
            idempotencyScope: input.idempotencyKey.scope,
            originKind: input.origin.kind,
            payload: encodeStagedPayload(input.payload),
            payloadFingerprint: input.payloadFingerprint,
            receiptId: input.receiptId,
            stagedAt: new Date(input.stagedAt),
            targetId: input.targetId,
            ...sourceFields(input.origin),
          })
          .onConflictDoNothing()
          .returning();

        const record =
          inserted ??
          (await findStagingByKey(transaction, input.idempotencyKey, true));
        if (!record) {
          throw new Error("Mutation staging could not be created.");
        }
        if (record.payloadFingerprint !== input.payloadFingerprint) {
          return { status: "conflict" as const };
        }
        return stageResultFromRecord<TValue>(transaction, record);
      }),

    finalize: async <TPayload extends MutationPayload>(
      input: MutationFinalizeInput<TValue, TPayload, MutationDatabaseExecutor>,
    ) => {
      // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: Preparation keeps staging state transitions in one transaction.
      const preparation = await database.transaction(async (transaction) => {
        const record = await findStaging(transaction, input.operationId, true);
        if (!record) {
          throw new Error("Mutation operation was not found.");
        }

        if (!stagedInputMatches(record, input)) {
          return {
            kind: "result" as const,
            result: { status: "conflict" as const },
          };
        }

        if (record.status === "finalizing") {
          return { kind: "prepared" as const };
        }

        if (record.status !== "staged") {
          return {
            kind: "result" as const,
            result: await resultFromStaging<TValue>(transaction, record),
          };
        }

        const [finalizing] = await transaction
          .update(mutationStaging)
          .set({ status: "finalizing" })
          .where(
            and(
              eq(mutationStaging.id, input.operationId),
              eq(mutationStaging.status, "staged"),
            ),
          )
          .returning();
        if (!finalizing) {
          const current = await findStaging(
            transaction,
            input.operationId,
            true,
          );
          if (!current) {
            throw new Error("Mutation operation was not found.");
          }
          if (current.status === "finalizing") {
            return { kind: "prepared" as const };
          }
          return {
            kind: "result" as const,
            result: await resultFromStaging<TValue>(transaction, current),
          };
        }
        return { kind: "prepared" as const };
      });

      if (preparation.kind === "result") {
        return preparation.result;
      }

      // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: Finalization keeps the barrier checks and receipt writes in one transaction.
      return database.transaction(async (transaction) => {
        const record = await findStaging(transaction, input.operationId, true);
        if (!record) {
          throw new Error("Mutation operation was not found.");
        }

        if (!stagedInputMatches(record, input)) {
          return { status: "conflict" as const };
        }
        if (record.status !== "finalizing") {
          return resultFromStaging<TValue>(transaction, record);
        }

        const committedAt = new Date(input.committedAt);
        if (record.expiresAt <= committedAt) {
          return rollbackStaging(
            transaction,
            record,
            mutationRollbackInput(
              input.operationId,
              input.committedAt,
              "expired",
            ),
          );
        }

        const target = await targetAdapter.find(
          transaction,
          input.targetId,
          true,
        );
        if (!target) {
          return rollbackStaging(
            transaction,
            record,
            mutationRollbackInput(
              input.operationId,
              input.committedAt,
              "target-not-found",
            ),
          );
        }

        const barrierContext: MutationBarrierContext<
          TValue,
          MutationDatabaseExecutor
        > = {
          actor: input.actor,
          expectedRevision: input.expectedRevision,
          idempotencyKey: input.idempotencyKey,
          operationId: input.operationId,
          origin: input.origin,
          payload: input.payload,
          payloadFingerprint: input.payloadFingerprint,
          target,
          targetId: input.targetId,
          transaction,
        };
        if (
          !(await barrierCheck(
            input.barrierChecks?.authorization,
            barrierContext,
          ))
        ) {
          return rollbackStaging(
            transaction,
            record,
            mutationRollbackInput(
              input.operationId,
              input.committedAt,
              "authorization",
            ),
          );
        }
        if (!(await barrierCheck(input.barrierChecks?.scope, barrierContext))) {
          return rollbackStaging(
            transaction,
            record,
            mutationRollbackInput(
              input.operationId,
              input.committedAt,
              "scope",
            ),
          );
        }
        if (!(await barrierCheck(input.barrierChecks?.quota, barrierContext))) {
          return rollbackStaging(
            transaction,
            record,
            mutationRollbackInput(
              input.operationId,
              input.committedAt,
              "quota",
            ),
          );
        }

        if (target.revision !== input.expectedRevision) {
          return rollbackStaging(
            transaction,
            record,
            mutationRollbackInput(
              input.operationId,
              input.committedAt,
              "stale-base-revision",
            ),
            target,
          );
        }

        const nextValue = await input.apply({
          currentRevision: target.revision,
          currentValue: target.value as TValue,
          payload: input.payload,
        });
        const revision = target.revision + 1;
        let targetUpdate: MutationTarget<TValue> | null;
        try {
          targetUpdate = await targetAdapter.update(transaction, {
            committedAt,
            expectedRevision: input.expectedRevision,
            nextValue,
            targetId: input.targetId,
          });
        } catch (cause) {
          throw new MutationApplyFailedError(cause, { cause });
        }
        if (!targetUpdate) {
          const current = await targetAdapter.find(
            transaction,
            input.targetId,
            true,
          );
          return rollbackStaging(
            transaction,
            record,
            mutationRollbackInput(
              input.operationId,
              input.committedAt,
              "stale-base-revision",
            ),
            current ?? target,
          );
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

        await transaction.insert(mutationHistory).values({
          occurredAt: committedAt,
          id: input.historyId,
          nextValue,
          originKind: input.origin.kind,
          payloadFingerprint: input.payloadFingerprint,
          previousValue: target.value as TValue,
          revision,
          targetId: input.targetId,
          ...actorFields(input.actor),
          ...sourceFields(input.origin),
        });

        const [completed] = await transaction
          .update(mutationStaging)
          .set({
            completedAt: committedAt,
            payload: null,
            status: "committed",
          })
          .where(
            and(
              eq(mutationStaging.id, input.operationId),
              eq(mutationStaging.status, "finalizing"),
            ),
          )
          .returning();
        if (!completed) {
          throw new Error("Mutation staging could not be finalized.");
        }

        const receipt: MutationReceipt<TValue> = {
          actor: input.actor,
          committedAt: input.committedAt,
          id: input.receiptId,
          nextValue,
          origin: input.origin,
          payloadFingerprint: input.payloadFingerprint,
          previousValue: target.value as TValue,
          revision,
          targetId: input.targetId,
        };
        return {
          operation: toStagedRecord(completed, receipt),
          receipt,
          status: "committed" as const,
        };
      });
    },

    cancel: (input: MutationCancelInput) =>
      database.transaction(async (transaction) => {
        const record = await findStaging(transaction, input.operationId, true);
        if (!record) {
          const receiptRecord = await findReceiptById(
            transaction,
            input.operationId,
          );
          if (!receiptRecord) {
            throw new Error("Mutation operation was not found.");
          }
          return {
            operationId: input.operationId,
            status: "finalizing" as const,
          };
        }
        if (record.status === "committed") {
          return { operationId: record.id, status: "finalizing" as const };
        }
        if (record.status === "finalizing") {
          return input.reason === "apply-failed"
            ? rollbackStaging(transaction, record, input)
            : { operationId: record.id, status: "finalizing" as const };
        }
        if (record.status === "rolled-back") {
          return resultFromStaging<TValue>(transaction, record);
        }
        return rollbackStaging(transaction, record, input);
      }),

    cleanupExpired: async (at) => {
      const now = at ?? new Date();
      const expired = await database
        .update(mutationStaging)
        .set({
          completedAt: now,
          payload: null,
          rollbackReason: "expired",
          status: "rolled-back",
        })
        .where(
          and(
            or(
              eq(mutationStaging.status, "staged"),
              eq(mutationStaging.status, "finalizing"),
            ),
            lte(mutationStaging.expiresAt, now),
          ),
        )
        .returning({ id: mutationStaging.id });
      return expired.length;
    },

    commit: <TPayload extends MutationPayload>(
      input: MutationCommitInput<TValue, TPayload>,
    ) =>
      // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: Direct commit keeps idempotency, target, receipt, and history writes in one transaction.
      database.transaction(async (transaction) => {
        const existing = await findReceipt(transaction, input.idempotencyKey);
        if (existing) {
          return replayCommitResult<TValue>(existing, input.payloadFingerprint);
        }

        const existingStaging = await findStagingByKey(
          transaction,
          input.idempotencyKey,
          true,
        );
        if (existingStaging) {
          return commitResultFromStaging<TValue>(
            transaction,
            existingStaging,
            input.payloadFingerprint,
          );
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

        const stagingAfterLock = await findStagingByKey(
          transaction,
          input.idempotencyKey,
          true,
        );
        if (stagingAfterLock) {
          return commitResultFromStaging<TValue>(
            transaction,
            stagingAfterLock,
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

  return createMutationContract<TValue, MutationDatabaseExecutor>({
    ...contractOptions,
    store,
  });
}
