import {
  canonicalizeMutationPayload,
  fingerprintMutationPayload,
  type MutationActor,
  type MutationCommand,
  type MutationHistoryEntry,
  type MutationPayload,
  type MutationReceipt,
  type MutationRollbackReceipt,
  type MutationTarget,
  type NonHumanMutationActor,
} from "@cantiara/api/mutation-and-undo";
import { describe, expect, test, vi } from "vitest";
import {
  createMutationContract,
  MutationApplyFailedError,
  type MutationAtomicContractStore,
  type MutationBarrierChecks,
  type MutationBarrierContext,
  type MutationCancelInput,
  type MutationCommitInput,
  MutationConflictError,
  type MutationFinalizeInput,
  type MutationFinalizeResult,
  type MutationFinalizingError,
  type MutationIdempotencyKey,
  type MutationStagedRecord,
  type MutationStageInput,
  type MutationStageResult,
  type MutationStaleBaseRevisionError,
  MutationUndoConflictError,
  MutationUndoNotSupportedError,
  type MutationUndoPlan,
  materializeMutationUndoMetadata,
  serializeMutationUndoPlan,
} from "./mutation-contract";

interface FixtureValue {
  count?: number;
  displayName?: string;
  mainRecordId?: string;
  notes?: string;
  relationIds?: string[];
  restoredRelationIds?: string[];
  retiredIdentityRestored?: boolean;
  status?: string;
  title?: string;
  viewMetadata?: {
    collapsed?: boolean;
    color?: string;
  };
}

interface OriginCase {
  actor: MutationActor;
  label: string;
  sourceId?: string;
}

const ORIGIN_CASES = [
  {
    actor: { actorId: "account-1", type: "User" },
    label: "User",
  },
  {
    actor: { actorId: "automation-1", type: "System automation" },
    label: "System automation",
    sourceId: "automation-source-1",
  },
  {
    actor: { actorId: "github-1", type: "GitHub" },
    label: "GitHub",
    sourceId: "github-source-1",
  },
  {
    actor: {
      actorId: "integration-1",
      authorizingUserId: "account-1",
      type: "Authorized integration",
    },
    label: "Authorized integration",
    sourceId: "integration-source-1",
  },
] satisfies OriginCase[];

async function commandForOrigin(
  origin: OriginCase,
  title: string,
  revision: number,
  key: string,
): Promise<MutationCommand<{ title: string }>> {
  const payload = { title };
  if (origin.actor.type === "User") {
    return {
      actor: origin.actor,
      baseRevision: revision,
      clientIdempotencyKey: key,
      kind: "human",
      payload,
      targetId: "work-1",
    };
  }

  return {
    actor: origin.actor,
    kind: "non-human",
    payload,
    source: {
      deliveryId: key,
      payloadFingerprint: await fingerprintMutationPayload(payload),
      sourceId: origin.sourceId ?? `${key}-source`,
    },
    targetId: "work-1",
    targetRevision: revision,
  };
}

const ALLOW_BARRIER_CHECKS = {
  authorization: () => true,
  quota: () => true,
  scope: () => true,
} satisfies MutationBarrierChecks<FixtureValue>;

function createMemoryStore(initial: MutationTarget<FixtureValue>) {
  let target = initial;
  let commitQueue = Promise.resolve();
  const receipts = new Map<string, MutationReceipt<FixtureValue>>();
  const staged = new Map<string, MutationStagedRecord<FixtureValue>>();
  const stagedUndoPlans = new Map<string, MutationUndoPlan>();
  const history: MutationHistoryEntry<FixtureValue>[] = [];
  const receiptKey = ({ key, scope }: MutationIdempotencyKey) =>
    `${scope}:${key}`;

  function stagedRecordFromReceipt(
    receipt: MutationReceipt<FixtureValue>,
  ): MutationStagedRecord<FixtureValue> {
    const idempotencyKey =
      receipt.origin.kind === "human"
        ? {
            key: receipt.origin.clientIdempotencyKey,
            scope: `human:${receipt.actor.actorId}:${receipt.targetId}`,
          }
        : {
            key: receipt.origin.deliveryId,
            scope: `source:${receipt.origin.sourceId}:${receipt.targetId}`,
          };
    return {
      actor: receipt.actor,
      completedAt: receipt.committedAt,
      expectedRevision: receipt.revision - 1,
      expiresAt: receipt.committedAt,
      historyId: receipt.id,
      id: receipt.id,
      idempotencyKey,
      origin: receipt.origin,
      payload: undefined,
      payloadFingerprint: receipt.payloadFingerprint,
      receipt,
      receiptId: receipt.id,
      rollbackReceipt: null,
      stagedAt: receipt.committedAt,
      status: "committed",
      targetId: receipt.targetId,
      ...(receipt.undo ? { undo: receipt.undo } : {}),
      ...(receipt.undoOf ? { undoOf: receipt.undoOf } : {}),
    };
  }

  async function withCommitLock<TResult>(
    work: () => Promise<TResult> | TResult,
  ) {
    const previousCommit = commitQueue;
    let release: () => void = () => undefined;
    commitQueue = new Promise<void>((resolve) => {
      release = resolve;
    });
    await previousCommit;
    try {
      return await work();
    } finally {
      release();
    }
  }

  function rollback(
    record: MutationStagedRecord<FixtureValue>,
    reason: MutationRollbackReceipt["reason"],
    completedAt: string,
    current?: MutationTarget<FixtureValue>,
  ): MutationFinalizeResult<FixtureValue> {
    record.completedAt = completedAt;
    record.payload = undefined;
    record.rollbackReceipt = {
      actor: record.actor,
      completedAt,
      ...(current ? { current } : {}),
      expectedRevision: record.expectedRevision,
      id: record.receiptId,
      idempotencyKey: record.idempotencyKey,
      operationId: record.id,
      origin: record.origin,
      payloadFingerprint: record.payloadFingerprint,
      reason,
      status: "rolled-back",
      targetId: record.targetId,
    };
    record.status = "rolled-back";
    return {
      operation: record,
      receipt: record.rollbackReceipt,
      status: "rolled-back",
    };
  }

  const store: MutationAtomicContractStore<FixtureValue> = {
    findReceipt(key) {
      return Promise.resolve(receipts.get(receiptKey(key)) ?? null);
    },
    findReceiptById(receiptId) {
      return Promise.resolve(
        [...receipts.values()].find(
          (candidate) => candidate.id === receiptId,
        ) ?? null,
      );
    },
    getTarget() {
      return Promise.resolve(target);
    },
    cancel(input: MutationCancelInput) {
      return withCommitLock(() => {
        const record = staged.get(input.operationId);
        if (!record) {
          const receipt = [...receipts.values()].find(
            (candidate) => candidate.id === input.operationId,
          );
          if (!receipt) {
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
            ? rollback(record, input.reason, input.completedAt)
            : { operationId: record.id, status: "finalizing" as const };
        }
        if (record.status === "rolled-back") {
          if (!record.rollbackReceipt) {
            throw new Error("Rollback receipt is missing.");
          }
          return {
            operation: record,
            receipt: record.rollbackReceipt,
            status: "rolled-back" as const,
          };
        }
        return rollback(record, input.reason, input.completedAt);
      });
    },
    cleanupExpired(at) {
      return withCommitLock(() => {
        const now = (at ?? new Date()).toISOString();
        let cleaned = 0;
        for (const record of staged.values()) {
          if (
            (record.status === "staged" || record.status === "finalizing") &&
            record.expiresAt <= now
          ) {
            rollback(record, "expired", now);
            cleaned += 1;
          }
        }
        return cleaned;
      });
    },
    finalize<TPayload extends MutationPayload>(
      input: MutationFinalizeInput<FixtureValue, TPayload>,
    ) {
      return withCommitLock(async () => {
        const record = staged.get(input.operationId);
        if (!record) {
          throw new Error("Mutation operation was not found.");
        }
        if (record.status === "committed") {
          if (!record.receipt) {
            throw new Error("Commit receipt is missing.");
          }
          return {
            operation: record,
            receipt: record.receipt,
            status: "committed" as const,
          };
        }
        if (record.status === "rolled-back") {
          if (!record.rollbackReceipt) {
            throw new Error("Rollback receipt is missing.");
          }
          return {
            operation: record,
            receipt: record.rollbackReceipt,
            status: "rolled-back" as const,
          };
        }
        if (
          record.expectedRevision !== input.expectedRevision ||
          record.idempotencyKey.key !== input.idempotencyKey.key ||
          record.idempotencyKey.scope !== input.idempotencyKey.scope ||
          record.payloadFingerprint !== input.payloadFingerprint ||
          record.targetId !== input.targetId
        ) {
          return { status: "conflict" as const };
        }
        if (record.expiresAt <= input.committedAt) {
          return rollback(record, "expired", input.committedAt);
        }
        const stagedUndoPlan = stagedUndoPlans.get(record.id);
        const undoPlanMatches =
          !(input.undo && stagedUndoPlan) ||
          canonicalizeMutationPayload(
            serializeMutationUndoPlan(stagedUndoPlan) as MutationPayload,
          ) ===
            canonicalizeMutationPayload(
              serializeMutationUndoPlan(input.undo) as MutationPayload,
            );
        const undoOfMatches =
          !(input.undoOf && record.undoOf) || record.undoOf === input.undoOf;
        if (!(undoPlanMatches && undoOfMatches)) {
          return { status: "conflict" as const };
        }
        const undoOf = input.undoOf ?? record.undoOf;
        record.status = "finalizing";
        const barrierContext: MutationBarrierContext<FixtureValue> = {
          actor: input.actor,
          expectedRevision: input.expectedRevision,
          idempotencyKey: input.idempotencyKey,
          operationId: input.operationId,
          origin: input.origin,
          payload: input.payload,
          payloadFingerprint: input.payloadFingerprint,
          target,
          targetId: input.targetId,
        };
        const barrierResults = await Promise.all(
          (
            [
              ["authorization", input.barrierChecks?.authorization],
              ["scope", input.barrierChecks?.scope],
              ["quota", input.barrierChecks?.quota],
            ] as const
          ).map(async ([reason, check]) => {
            try {
              return {
                allowed: check ? await check(barrierContext) : true,
                reason,
              };
            } catch {
              return { allowed: false, reason };
            }
          }),
        );
        const blockedBarrier = barrierResults.find(({ allowed }) => !allowed);
        if (blockedBarrier) {
          return rollback(record, blockedBarrier.reason, input.committedAt);
        }
        if (target.revision !== input.expectedRevision) {
          return rollback(
            record,
            "stale-base-revision",
            input.committedAt,
            target,
          );
        }
        const nextValue = await input.apply({
          currentRevision: target.revision,
          currentValue: target.value,
          payload: input.payload,
        });
        const undoPlan = input.undo ?? stagedUndoPlans.get(record.id);
        let undo: MutationReceipt<FixtureValue>["undo"];
        try {
          undo = undoPlan
            ? materializeMutationUndoMetadata(undoPlan, target.value, nextValue)
            : undefined;
        } catch (cause) {
          throw new MutationApplyFailedError(cause, { cause });
        }
        const receipt: MutationReceipt<FixtureValue> = {
          actor: input.actor,
          committedAt: input.committedAt,
          id: input.receiptId,
          nextValue,
          origin: input.origin,
          payloadFingerprint: input.payloadFingerprint,
          previousValue: target.value,
          revision: target.revision + 1,
          targetId: target.id,
          ...(undo ? { undo } : {}),
          ...(undoOf ? { undoOf } : {}),
        };
        target = {
          id: target.id,
          revision: receipt.revision,
          value: nextValue,
        };
        receipts.set(receiptKey(input.idempotencyKey), receipt);
        history.push({
          actor: input.actor,
          id: input.historyId,
          nextValue,
          occurredAt: input.committedAt,
          origin: input.origin,
          payloadFingerprint: input.payloadFingerprint,
          previousValue: receipt.previousValue,
          revision: receipt.revision,
          targetId: target.id,
          ...(receipt.undo ? { undo: receipt.undo } : {}),
          ...(receipt.undoOf ? { undoOf: receipt.undoOf } : {}),
        });
        record.completedAt = input.committedAt;
        record.payload = undefined;
        record.receipt = receipt;
        if (receipt.undo) {
          record.undo = receipt.undo;
        }
        if (receipt.undoOf) {
          record.undoOf = receipt.undoOf;
        }
        record.status = "committed";
        stagedUndoPlans.delete(record.id);
        return {
          operation: record,
          receipt,
          status: "committed" as const,
        };
      });
    },
    findStagedOperation(operationId) {
      const stagedRecord = staged.get(operationId);
      if (stagedRecord) {
        return Promise.resolve(stagedRecord);
      }
      const receipt = [...receipts.values()].find(
        (candidate) => candidate.id === operationId,
      );
      return Promise.resolve(receipt ? stagedRecordFromReceipt(receipt) : null);
    },
    stage<TPayload extends MutationPayload>(
      input: MutationStageInput<TPayload>,
    ) {
      return withCommitLock(() => {
        const key = receiptKey(input.idempotencyKey);
        const existing = [...staged.values()].find(
          (candidate) => receiptKey(candidate.idempotencyKey) === key,
        );
        if (existing) {
          return existing.payloadFingerprint === input.payloadFingerprint
            ? ({
                operation: existing,
                status: existing.status,
              } as MutationStageResult<FixtureValue>)
            : { status: "conflict" as const };
        }
        const existingReceipt = receipts.get(key);
        if (existingReceipt) {
          return existingReceipt.payloadFingerprint === input.payloadFingerprint
            ? {
                operation: stagedRecordFromReceipt(existingReceipt),
                status: "committed" as const,
              }
            : { status: "conflict" as const };
        }
        const record: MutationStagedRecord<FixtureValue> = {
          actor: input.actor,
          completedAt: null,
          expectedRevision: input.expectedRevision,
          expiresAt: input.expiresAt,
          historyId: input.historyId,
          id: input.operationId,
          idempotencyKey: input.idempotencyKey,
          origin: input.origin,
          payload: input.payload,
          payloadFingerprint: input.payloadFingerprint,
          receipt: null,
          receiptId: input.receiptId,
          rollbackReceipt: null,
          stagedAt: input.stagedAt,
          status: "staged",
          targetId: input.targetId,
          ...(input.undoOf ? { undoOf: input.undoOf } : {}),
        };
        staged.set(record.id, record);
        if (input.undo) {
          stagedUndoPlans.set(record.id, input.undo as MutationUndoPlan);
        }
        return { operation: record, status: "staged" as const };
      });
    },
    commit<TPayload extends MutationPayload>(
      input: MutationCommitInput<FixtureValue, TPayload>,
    ) {
      return withCommitLock(async () => {
        const existing = receipts.get(receiptKey(input.idempotencyKey));
        if (existing) {
          return existing.payloadFingerprint === input.payloadFingerprint
            ? { receipt: existing, status: "replayed" as const }
            : { status: "conflict" as const };
        }
        const existingStaging = [...staged.values()].find(
          (candidate) =>
            receiptKey(candidate.idempotencyKey) ===
            receiptKey(input.idempotencyKey),
        );
        if (existingStaging) {
          return { status: "conflict" as const };
        }
        if (target.revision !== input.expectedRevision) {
          return { current: target, status: "stale" as const };
        }

        const nextValue = await input.apply({
          currentRevision: target.revision,
          currentValue: target.value,
          payload: input.payload,
        });
        const receipt = {
          actor: input.actor,
          committedAt: input.committedAt,
          id: input.receiptId,
          nextValue,
          origin: input.origin,
          payloadFingerprint: input.payloadFingerprint,
          previousValue: target.value,
          revision: target.revision + 1,
          targetId: target.id,
          ...(input.undo
            ? {
                undo: materializeMutationUndoMetadata(
                  input.undo,
                  target.value,
                  nextValue,
                ),
              }
            : {}),
          ...(input.undoOf ? { undoOf: input.undoOf } : {}),
        };
        target = {
          id: target.id,
          revision: receipt.revision,
          value: nextValue,
        };
        receipts.set(receiptKey(input.idempotencyKey), receipt);
        history.push({
          actor: input.actor,
          id: input.historyId,
          nextValue,
          occurredAt: input.committedAt,
          origin: input.origin,
          payloadFingerprint: input.payloadFingerprint,
          previousValue: receipt.previousValue,
          revision: receipt.revision,
          targetId: target.id,
          ...(receipt.undo ? { undo: receipt.undo } : {}),
          ...(receipt.undoOf ? { undoOf: receipt.undoOf } : {}),
        });
        return { receipt, status: "committed" as const };
      });
    },
  };
  return { getHistory: () => history, getTarget: () => target, store };
}

describe("Mutation Contract seam", () => {
  test("replays a direct receipt without running the mutation apply step", async () => {
    const memory = createMemoryStore({
      id: "work-1",
      revision: 0,
      value: { title: "Original" },
    });
    const contract = createMutationContract<FixtureValue>({
      store: memory.store,
    });
    const command = {
      actor: { actorId: "account-1", type: "User" as const },
      baseRevision: 0,
      clientIdempotencyKey: "direct-replay",
      kind: "human" as const,
      payload: { title: "Committed once" },
      targetId: "work-1",
    };
    let applyCalls = 0;
    const first = await contract.mutate(
      command,
      ({ currentValue, payload }) => {
        applyCalls += 1;
        return { ...currentValue, ...payload };
      },
    );

    const replay = await contract.replay({ ...command, baseRevision: 99 });

    await expect(
      contract.replay({
        ...command,
        payload: { title: "Changed payload" },
      }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
    expect(replay).toEqual(first);
    expect(applyCalls).toBe(1);
  });

  test("undoes a deterministic field without rewinding an unrelated later edit", async () => {
    const memory = createMemoryStore({
      id: "work-1",
      revision: 0,
      value: { status: "Open", title: "Original" },
    });
    const contract = createMutationContract({ store: memory.store });
    const edit = await contract.mutate(
      {
        actor: { actorId: "account-1", type: "User" },
        baseRevision: 0,
        clientIdempotencyKey: "title-edit",
        kind: "human",
        payload: { title: "Changed" },
        targetId: "work-1",
      },
      ({ currentValue, payload }) => ({
        ...currentValue,
        ...payload,
      }),
      { undo: { kind: "field", scope: "title" } },
    );

    await contract.mutate(
      {
        actor: { actorId: "account-1", type: "User" },
        baseRevision: 1,
        clientIdempotencyKey: "status-edit",
        kind: "human",
        payload: { status: "Closed" },
        targetId: "work-1",
      },
      ({ currentValue, payload }) => ({
        ...currentValue,
        ...payload,
      }),
    );

    const undone = await contract.undo(edit, {
      actor: { actorId: "account-1", type: "User" },
      baseRevision: 2,
      clientIdempotencyKey: "title-undo",
      kind: "human",
      payload: { undoOf: edit.id },
      targetId: "work-1",
    });

    expect(undone.undoOf).toBe(edit.id);
    expect(memory.getTarget()).toEqual({
      id: "work-1",
      revision: 3,
      value: { status: "Closed", title: "Original" },
    });
  });

  test("removes a field that did not exist before the mutation", async () => {
    const memory = createMemoryStore({
      id: "work-1",
      revision: 0,
      value: { status: "Open" },
    });
    const contract = createMutationContract({ store: memory.store });
    const edit = await contract.mutate(
      {
        actor: { actorId: "account-1", type: "User" },
        baseRevision: 0,
        clientIdempotencyKey: "new-title-edit",
        kind: "human",
        payload: { title: "Added" },
        targetId: "work-1",
      },
      ({ currentValue, payload }) => ({ ...currentValue, ...payload }),
      { undo: { kind: "field", scope: "title" } },
    );

    expect(edit.undo).toMatchObject({
      after: "Added",
      afterPresent: true,
      before: null,
      beforePresent: false,
    });

    await contract.undo(edit, {
      actor: { actorId: "account-1", type: "User" },
      baseRevision: 1,
      clientIdempotencyKey: "new-title-undo",
      kind: "human",
      payload: { undoOf: edit.id },
      targetId: "work-1",
    });

    expect(memory.getTarget().value).toEqual({ status: "Open" });
  });

  test.each([
    "field",
    "relation",
    "view-metadata",
    "atomic-transform",
  ] as const)("accepts deterministic %s Undo metadata", async (kind) => {
    const memory = createMemoryStore({
      id: "work-1",
      revision: 0,
      value: { title: "Original" },
    });
    const contract = createMutationContract({ store: memory.store });
    const edit = await contract.mutate(
      {
        actor: { actorId: "account-1", type: "User" },
        baseRevision: 0,
        clientIdempotencyKey: `deterministic-${kind}`,
        kind: "human",
        payload: { title: "Changed" },
        targetId: "work-1",
      },
      ({ currentValue, payload }) => ({ ...currentValue, ...payload }),
      { undo: { kind, scope: "title" } },
    );

    expect(edit.undo?.kind).toBe(kind);
    const undone = await contract.undo(edit, {
      actor: { actorId: "account-1", type: "User" },
      baseRevision: 1,
      clientIdempotencyKey: `deterministic-${kind}-undo`,
      kind: "human",
      payload: { undoOf: edit.id },
      targetId: "work-1",
    });

    expect(undone.undoOf).toBe(edit.id);
    expect(memory.getTarget().value).toEqual({ title: "Original" });
  });

  test("undoes a representative atomic transform without rewinding a later note", async () => {
    const memory = createMemoryStore({
      id: "work-1",
      revision: 0,
      value: { count: 1, notes: "Before" },
    });
    const contract = createMutationContract({ store: memory.store });
    const transformed = await contract.mutate(
      {
        actor: { actorId: "account-1", type: "User" },
        baseRevision: 0,
        clientIdempotencyKey: "count-transform",
        kind: "human",
        payload: { delta: 2 },
        targetId: "work-1",
      },
      ({ currentValue, payload }) => ({
        ...currentValue,
        count: (currentValue.count ?? 0) + (payload as { delta: number }).delta,
      }),
      { undo: { kind: "atomic-transform", scope: "count" } },
    );
    await contract.mutate(
      {
        actor: { actorId: "account-1", type: "User" },
        baseRevision: 1,
        clientIdempotencyKey: "later-note",
        kind: "human",
        payload: { notes: "Later" },
        targetId: "work-1",
      },
      ({ currentValue, payload }) => ({ ...currentValue, ...payload }),
    );

    await contract.undo(transformed, {
      actor: { actorId: "account-1", type: "User" },
      baseRevision: 2,
      clientIdempotencyKey: "count-transform-undo",
      kind: "human",
      payload: { undoOf: transformed.id },
      targetId: "work-1",
    });

    expect(memory.getTarget().value).toEqual({ count: 1, notes: "Later" });
  });

  test("undoes a deterministic relation without rewinding a later title", async () => {
    const memory = createMemoryStore({
      id: "work-1",
      revision: 0,
      value: { relationIds: ["related-1"], title: "Original" },
    });
    const contract = createMutationContract({ store: memory.store });
    const related = await contract.mutate(
      {
        actor: { actorId: "account-1", type: "User" },
        baseRevision: 0,
        clientIdempotencyKey: "relation-edit",
        kind: "human",
        payload: { relationIds: ["related-1", "related-2"] },
        targetId: "work-1",
      },
      ({ currentValue, payload }) => ({ ...currentValue, ...payload }),
      { undo: { kind: "relation", scope: "relationIds" } },
    );
    await contract.mutate(
      {
        actor: { actorId: "account-1", type: "User" },
        baseRevision: 1,
        clientIdempotencyKey: "later-title",
        kind: "human",
        payload: { title: "Later" },
        targetId: "work-1",
      },
      ({ currentValue, payload }) => ({ ...currentValue, ...payload }),
    );

    await contract.undo(related, {
      actor: { actorId: "account-1", type: "User" },
      baseRevision: 2,
      clientIdempotencyKey: "relation-undo",
      kind: "human",
      payload: { undoOf: related.id },
      targetId: "work-1",
    });

    expect(memory.getTarget().value).toEqual({
      relationIds: ["related-1"],
      title: "Later",
    });
  });

  test("undoes view metadata without rewinding a later title", async () => {
    const memory = createMemoryStore({
      id: "work-1",
      revision: 0,
      value: {
        title: "Original",
        viewMetadata: { collapsed: false, color: "blue" },
      },
    });
    const contract = createMutationContract({ store: memory.store });
    const metadataEdit = await contract.mutate(
      {
        actor: { actorId: "account-1", type: "User" },
        baseRevision: 0,
        clientIdempotencyKey: "view-metadata-edit",
        kind: "human",
        payload: { viewMetadata: { collapsed: true } },
        targetId: "work-1",
      },
      ({ currentValue, payload }) => ({
        ...currentValue,
        viewMetadata: {
          ...currentValue.viewMetadata,
          ...(payload as { viewMetadata: FixtureValue["viewMetadata"] })
            .viewMetadata,
        },
      }),
      { undo: { kind: "view-metadata", scope: "viewMetadata.collapsed" } },
    );
    await contract.mutate(
      {
        actor: { actorId: "account-1", type: "User" },
        baseRevision: 1,
        clientIdempotencyKey: "metadata-later-title",
        kind: "human",
        payload: { title: "Later" },
        targetId: "work-1",
      },
      ({ currentValue, payload }) => ({ ...currentValue, ...payload }),
    );

    await contract.undo(metadataEdit, {
      actor: { actorId: "account-1", type: "User" },
      baseRevision: 2,
      clientIdempotencyKey: "view-metadata-undo",
      kind: "human",
      payload: { undoOf: metadataEdit.id },
      targetId: "work-1",
    });

    expect(memory.getTarget().value).toEqual({
      title: "Later",
      viewMetadata: { collapsed: false, color: "blue" },
    });
  });

  test("stops Undo with Conflict when the same field has a newer value", async () => {
    const memory = createMemoryStore({
      id: "work-1",
      revision: 0,
      value: { title: "Original" },
    });
    const contract = createMutationContract({ store: memory.store });
    const edit = await contract.mutate(
      {
        actor: { actorId: "account-1", type: "User" },
        baseRevision: 0,
        clientIdempotencyKey: "title-edit",
        kind: "human",
        payload: { title: "First" },
        targetId: "work-1",
      },
      ({ currentValue, payload }) => ({ ...currentValue, ...payload }),
      { undo: { kind: "field", scope: "title" } },
    );
    await contract.mutate(
      {
        actor: { actorId: "account-1", type: "User" },
        baseRevision: 1,
        clientIdempotencyKey: "newer-title-edit",
        kind: "human",
        payload: { title: "Newer" },
        targetId: "work-1",
      },
      ({ currentValue, payload }) => ({ ...currentValue, ...payload }),
    );

    await expect(
      contract.undo(edit, {
        actor: { actorId: "account-1", type: "User" },
        baseRevision: 2,
        clientIdempotencyKey: "title-undo",
        kind: "human",
        payload: { undoOf: edit.id },
        targetId: "work-1",
      }),
    ).rejects.toBeInstanceOf(MutationUndoConflictError);
    await expect(
      contract.undo(edit, {
        actor: { actorId: "account-1", type: "User" },
        baseRevision: 2,
        clientIdempotencyKey: "title-undo-retry",
        kind: "human",
        payload: { undoOf: edit.id },
        targetId: "work-1",
      }),
    ).rejects.toMatchObject({
      code: "CONFLICT",
      currentRevision: 2,
      currentValue: { title: "Newer" },
      label: "Conflict",
      scope: "title",
    });
    expect(memory.getTarget().value).toEqual({ title: "Newer" });
  });

  test.each([
    "permanent-delete",
    "security-redaction",
    "external-system-mutation",
    "published-static-export",
  ])("rejects %s as an Undo class", async (kind) => {
    const memory = createMemoryStore({
      id: "work-1",
      revision: 0,
      value: { title: "Original" },
    });
    const contract = createMutationContract({ store: memory.store });

    await expect(
      contract.mutate(
        {
          actor: { actorId: "account-1", type: "User" },
          baseRevision: 0,
          clientIdempotencyKey: `forbidden-${kind}`,
          kind: "human",
          payload: { title: "Changed" },
          targetId: "work-1",
        },
        ({ currentValue, payload }) => ({ ...currentValue, ...payload }),
        { undo: { kind, scope: "title" } },
      ),
    ).rejects.toMatchObject({
      code: "UNDO_NOT_SUPPORTED",
      label: "Undo",
      reason: "forbidden-kind",
    });
    expect(memory.getTarget()).toEqual({
      id: "work-1",
      revision: 0,
      value: { title: "Original" },
    });
  });

  test("does not offer a general Undo for a mutation without deterministic metadata", async () => {
    const memory = createMemoryStore({
      id: "work-1",
      revision: 0,
      value: { title: "Original" },
    });
    const contract = createMutationContract({ store: memory.store });
    const edit = await contract.mutate(
      {
        actor: { actorId: "account-1", type: "User" },
        baseRevision: 0,
        clientIdempotencyKey: "non-undoable-edit",
        kind: "human",
        payload: { title: "Changed" },
        targetId: "work-1",
      },
      ({ currentValue, payload }) => ({ ...currentValue, ...payload }),
    );

    await expect(
      contract.undo(edit, {
        actor: { actorId: "account-1", type: "User" },
        baseRevision: 1,
        clientIdempotencyKey: "unsupported-undo",
        kind: "human",
        payload: { undoOf: edit.id },
        targetId: "work-1",
      }),
    ).rejects.toBeInstanceOf(MutationUndoNotSupportedError);
    expect(memory.getTarget().value).toEqual({ title: "Changed" });
  });

  test("uses the durable receipt instead of supplied Undo metadata", async () => {
    const memory = createMemoryStore({
      id: "work-1",
      revision: 0,
      value: { title: "Original" },
    });
    const contract = createMutationContract({ store: memory.store });
    const edit = await contract.mutate(
      {
        actor: { actorId: "account-1", type: "User" },
        baseRevision: 0,
        clientIdempotencyKey: "durable-receipt-edit",
        kind: "human",
        payload: { title: "Changed" },
        targetId: "work-1",
      },
      ({ currentValue, payload }) => ({ ...currentValue, ...payload }),
      { undo: { kind: "field", scope: "title" } },
    );

    if (!edit.undo) {
      throw new Error("Expected deterministic Undo metadata.");
    }
    const forgedReceipt = {
      ...edit,
      undo: {
        ...edit.undo,
        before: "Attacker-controlled value",
        beforePresent: true,
      },
    };

    await contract.undo(forgedReceipt, {
      actor: { actorId: "account-1", type: "User" },
      baseRevision: 1,
      clientIdempotencyKey: "durable-receipt-undo",
      kind: "human",
      payload: { undoOf: edit.id },
      targetId: "work-1",
    });

    expect(memory.getTarget().value).toEqual({ title: "Original" });
  });

  test("requires attribution metadata for merge Undo", async () => {
    const memory = createMemoryStore({
      id: "work-1",
      revision: 0,
      value: { title: "Original" },
    });
    const contract = createMutationContract({ store: memory.store });

    await expect(
      contract.mutate(
        {
          actor: { actorId: "account-1", type: "User" },
          baseRevision: 0,
          clientIdempotencyKey: "merge-without-attribution",
          kind: "human",
          payload: { title: "Changed" },
          targetId: "work-1",
        },
        ({ currentValue, payload }) => ({ ...currentValue, ...payload }),
        { undo: { kind: "merge", scope: "title" } },
      ),
    ).rejects.toMatchObject({
      code: "UNDO_NOT_SUPPORTED",
      kind: "merge",
      reason: "invalid-plan",
    });
  });

  test("passes merge attribution to a merge Undo without rewinding later unrelated values", async () => {
    const memory = createMemoryStore({
      id: "contact-survivor",
      revision: 0,
      value: {
        displayName: "Survivor",
        mainRecordId: "contact-survivor",
        notes: "Before merge",
        relationIds: ["survivor-1"],
        retiredIdentityRestored: false,
      },
    });
    const contract = createMutationContract({ store: memory.store });
    const merge = await contract.mutate(
      {
        actor: { actorId: "account-1", type: "User" },
        baseRevision: 0,
        clientIdempotencyKey: "contact-merge",
        kind: "human",
        payload: { displayName: "Merged contact" },
        targetId: "contact-survivor",
      },
      ({ currentValue, payload }) => ({
        ...currentValue,
        ...payload,
        relationIds: ["survivor-1", "feedback-1"],
      }),
      {
        undo: {
          kind: "merge",
          merge: {
            attributedRelationIds: ["feedback-1"],
            attributedValueKeys: ["displayName"],
            mergeId: "merge-1",
            retiredTargetId: "contact-retired",
          },
          scope: "displayName",
        },
      },
    );

    await contract.mutate(
      {
        actor: { actorId: "account-1", type: "User" },
        baseRevision: 1,
        clientIdempotencyKey: "contact-note",
        kind: "human",
        payload: {
          notes: "Later note",
          relationIds: ["survivor-1", "feedback-1", "later-1"],
        },
        targetId: "contact-survivor",
      },
      ({ currentValue, payload }) => ({ ...currentValue, ...payload }),
    );

    const undone = await contract.undo(
      merge,
      {
        actor: { actorId: "account-1", type: "User" },
        baseRevision: 2,
        clientIdempotencyKey: "contact-merge-undo",
        kind: "human",
        payload: { undoOf: merge.id },
        targetId: "contact-survivor",
      },
      ({ currentValue, previousValue, undo }) => ({
        ...currentValue,
        displayName: previousValue.displayName,
        mainRecordId: undo.merge?.retiredTargetId,
        relationIds: currentValue.relationIds?.filter(
          (relationId) =>
            !undo.merge?.attributedRelationIds.includes(relationId),
        ),
        retiredIdentityRestored:
          undo.merge?.retiredTargetId === "contact-retired",
        restoredRelationIds: undo.merge?.attributedRelationIds,
      }),
    );

    expect(merge.undo).toMatchObject({
      kind: "merge",
      merge: {
        attributedRelationIds: ["feedback-1"],
        attributedValueKeys: ["displayName"],
        mergeId: "merge-1",
        retiredTargetId: "contact-retired",
      },
    });
    expect(undone.undoOf).toBe(merge.id);
    expect(memory.getTarget().value).toEqual({
      displayName: "Survivor",
      mainRecordId: "contact-retired",
      notes: "Later note",
      relationIds: ["survivor-1", "later-1"],
      retiredIdentityRestored: true,
      restoredRelationIds: ["feedback-1"],
    });
  });

  test("persists deterministic Undo metadata through atomic staging", async () => {
    const memory = createMemoryStore({
      id: "work-1",
      revision: 0,
      value: { status: "Open", title: "Original" },
    });
    const contract = createMutationContract<FixtureValue>({
      barrierChecks: ALLOW_BARRIER_CHECKS,
      store: memory.store,
    });
    const command = {
      actor: { actorId: "account-1", type: "User" as const },
      baseRevision: 0,
      clientIdempotencyKey: "staged-title-edit",
      kind: "human" as const,
      payload: { title: "Changed" },
      targetId: "work-1",
    };
    const undoPlan = { kind: "field" as const, scope: "title" };
    const staged = await contract.stage(command, { undo: undoPlan });
    const committed = await contract.finalize(
      staged.id,
      ({ currentValue, payload }) => ({
        ...currentValue,
        ...(payload as Partial<FixtureValue>),
      }),
    );

    if (committed.status !== "committed") {
      throw new Error("Expected staged mutation to commit.");
    }
    expect(committed.receipt.undo).toMatchObject({
      after: "Changed",
      before: "Original",
      kind: "field",
      scope: "title",
    });
  });

  test("rejects a changed Undo plan when finalizing staged work", async () => {
    const memory = createMemoryStore({
      id: "work-1",
      revision: 0,
      value: { title: "Original" },
    });
    const contract = createMutationContract<FixtureValue>({
      barrierChecks: ALLOW_BARRIER_CHECKS,
      store: memory.store,
    });
    const command = {
      actor: { actorId: "account-1", type: "User" as const },
      baseRevision: 0,
      clientIdempotencyKey: "staged-plan-key",
      kind: "human" as const,
      payload: { title: "Changed" },
      targetId: "work-1",
    };
    const staged = await contract.stage(command, {
      undo: { kind: "field", scope: "title" },
    });

    await expect(
      contract.finalize(
        staged.id,
        ({ currentValue, payload }) => ({
          ...currentValue,
          ...(payload as Partial<FixtureValue>),
        }),
        undefined,
        { undo: { kind: "relation", scope: "title" } },
      ),
    ).rejects.toMatchObject({
      code: "CONFLICT",
      label: "Conflict",
      targetId: "work-1",
    });
  });

  test("rolls back staged work when Undo metadata cannot be materialized", async () => {
    const memory = createMemoryStore({
      id: "work-1",
      revision: 0,
      value: { title: "Original" },
    });
    const contract = createMutationContract<FixtureValue>({
      barrierChecks: ALLOW_BARRIER_CHECKS,
      store: memory.store,
    });
    const staged = await contract.stage(
      {
        actor: { actorId: "account-1", type: "User" },
        baseRevision: 0,
        clientIdempotencyKey: "invalid-materialized-undo",
        kind: "human",
        payload: { title: "Changed" },
        targetId: "work-1",
      },
      { undo: { kind: "field", scope: "title" } },
    );

    const invalidTitle = (() => "not-json") as unknown as string;
    const rollback = await contract.finalize(staged.id, () => ({
      title: invalidTitle,
    }));

    expect(rollback).toMatchObject({
      receipt: {
        operationId: staged.id,
        reason: "apply-failed",
        status: "rolled-back",
      },
      status: "rolled-back",
    });
    expect(memory.getTarget()).toEqual({
      id: "work-1",
      revision: 0,
      value: { title: "Original" },
    });
    expect(memory.getHistory()).toHaveLength(0);
  });

  test("finalizes a staged multi-step write with one commit receipt", async () => {
    const memory = createMemoryStore({
      id: "work-1",
      revision: 0,
      value: { title: "Original" },
    });
    const contract = createMutationContract<FixtureValue>({
      barrierChecks: ALLOW_BARRIER_CHECKS,
      store: memory.store,
    });
    const command = {
      actor: { actorId: "account-1", type: "User" as const },
      baseRevision: 0,
      clientIdempotencyKey: "atomic-key-1",
      kind: "human" as const,
      payload: { title: "Committed" },
      targetId: "work-1",
    };

    const staged = await contract.stage(command);
    const result = await contract.finalize(
      staged.id,
      ({
        currentValue,
        payload,
      }: {
        currentValue: FixtureValue;
        payload: { title: string };
      }) => ({
        ...currentValue,
        ...payload,
      }),
    );

    expect(staged).toMatchObject({
      status: "staged",
      targetId: "work-1",
    });
    expect(result).toMatchObject({
      receipt: {
        nextValue: { title: "Committed" },
        previousValue: { title: "Original" },
        revision: 1,
        targetId: "work-1",
      },
      status: "committed",
    });
    expect(memory.getTarget()).toEqual({
      id: "work-1",
      revision: 1,
      value: { title: "Committed" },
    });
  });

  test("returns a durable rollback receipt and leaves no partial write", async () => {
    const memory = createMemoryStore({
      id: "work-1",
      revision: 0,
      value: { title: "Original" },
    });
    const contract = createMutationContract<FixtureValue>({
      barrierChecks: ALLOW_BARRIER_CHECKS,
      store: memory.store,
    });
    const staged = await contract.stage({
      actor: { actorId: "account-1", type: "User" },
      baseRevision: 0,
      clientIdempotencyKey: "atomic-key-rollback",
      kind: "human",
      payload: { title: "Should not be visible" },
      targetId: "work-1",
    });

    const rollback = await contract.finalize(staged.id, () => {
      throw new Error("second staged step failed");
    });
    const retry = await contract.finalize<{ title: string }>(
      staged.id,
      ({ payload }) => payload,
    );

    expect(rollback).toMatchObject({
      receipt: {
        operationId: staged.id,
        reason: "apply-failed",
        status: "rolled-back",
      },
      status: "rolled-back",
    });
    expect(retry).toEqual(rollback);
    expect(memory.getTarget()).toEqual({
      id: "work-1",
      revision: 0,
      value: { title: "Original" },
    });
    expect(memory.getHistory()).toHaveLength(0);
  });

  test("does not turn an unknown store failure into an apply rollback", async () => {
    const memory = createMemoryStore({
      id: "work-1",
      revision: 0,
      value: { title: "Original" },
    });
    const cancel = vi.fn(memory.store.cancel);
    const store: MutationAtomicContractStore<FixtureValue> = {
      ...memory.store,
      cancel,
      finalize() {
        return Promise.reject(new Error("database connection failed"));
      },
    };
    const contract = createMutationContract<FixtureValue>({ store });
    const staged = await contract.stage({
      actor: { actorId: "account-1", type: "User" },
      baseRevision: 0,
      clientIdempotencyKey: "atomic-key-unknown-failure",
      kind: "human",
      payload: { title: "Unknown outcome" },
      targetId: "work-1",
    });

    await expect(
      contract.finalize<{ title: string }>(staged.id, ({ payload }) => payload),
    ).rejects.toThrow("database connection failed");
    expect(cancel).not.toHaveBeenCalled();
  });

  test("fails closed when finalization policy is not configured", async () => {
    const memory = createMemoryStore({
      id: "work-1",
      revision: 0,
      value: { title: "Original" },
    });
    const contract = createMutationContract<FixtureValue>({
      store: memory.store,
    });
    const staged = await contract.stage({
      actor: { actorId: "account-1", type: "User" },
      baseRevision: 0,
      clientIdempotencyKey: "atomic-key-no-policy",
      kind: "human",
      payload: { title: "Blocked" },
      targetId: "work-1",
    });

    const rollback = await contract.finalize<{ title: string }>(
      staged.id,
      ({ payload }) => payload,
    );

    expect(rollback).toMatchObject({
      receipt: { reason: "authorization", status: "rolled-back" },
      status: "rolled-back",
    });
  });

  test("replays a finalized operation and rejects a changed payload", async () => {
    const memory = createMemoryStore({
      id: "work-1",
      revision: 0,
      value: { title: "Original" },
    });
    const contract = createMutationContract<FixtureValue>({
      barrierChecks: ALLOW_BARRIER_CHECKS,
      store: memory.store,
    });
    const command = {
      actor: { actorId: "account-1", type: "User" as const },
      baseRevision: 0,
      clientIdempotencyKey: "atomic-key-retry",
      kind: "human" as const,
      payload: { title: "Committed once" },
      targetId: "work-1",
    };
    const staged = await contract.stage(command);
    let applyCalls = 0;

    const first = await contract.finalize<{ title: string }>(
      staged.id,
      ({ payload }) => {
        applyCalls += 1;
        return payload;
      },
    );
    const retry = await contract.finalize<{ title: string }>(
      staged.id,
      ({ payload }) => {
        applyCalls += 1;
        return payload;
      },
    );

    await expect(
      contract.finalize<{ title: string }>(
        staged.id,
        ({ payload }) => payload,
        { ...command, payload: { title: "Changed retry" } },
      ),
    ).rejects.toMatchObject({ code: "CONFLICT", label: "Conflict" });
    await expect(
      contract.stage({ ...command, payload: { title: "Changed retry" } }),
    ).rejects.toMatchObject({ code: "CONFLICT", label: "Conflict" });

    expect(retry).toEqual(first);
    expect(applyCalls).toBe(1);
    expect(memory.getHistory()).toHaveLength(1);
  });

  test("replays a direct receipt when staging retries the same operation", async () => {
    const memory = createMemoryStore({
      id: "work-1",
      revision: 0,
      value: { title: "Original" },
    });
    const contract = createMutationContract<FixtureValue>({
      barrierChecks: ALLOW_BARRIER_CHECKS,
      store: memory.store,
    });
    const command = {
      actor: { actorId: "account-1", type: "User" as const },
      baseRevision: 0,
      clientIdempotencyKey: "direct-then-staged-key",
      kind: "human" as const,
      payload: { title: "Committed directly" },
      targetId: "work-1",
    };

    const committed = await contract.mutate(command, ({ payload }) => payload);
    const staged = await contract.stage(command);
    const replay = await contract.finalize(staged.id, () => {
      throw new Error("replay must not apply");
    });

    expect(replay).toMatchObject({ receipt: committed, status: "committed" });
    await expect(contract.cancel(staged.id)).rejects.toMatchObject({
      code: "FINALIZING",
      label: "Finalizing",
    });
    expect(memory.getHistory()).toHaveLength(1);
  });

  test("does not bypass a staged operation through direct mutate", async () => {
    const memory = createMemoryStore({
      id: "work-1",
      revision: 0,
      value: { title: "Original" },
    });
    const contract = createMutationContract<FixtureValue>({
      barrierChecks: ALLOW_BARRIER_CHECKS,
      store: memory.store,
    });
    const command = {
      actor: { actorId: "account-1", type: "User" as const },
      baseRevision: 0,
      clientIdempotencyKey: "staged-direct-race",
      kind: "human" as const,
      payload: { title: "Atomic" },
      targetId: "work-1",
    };

    const staged = await contract.stage(command);

    await expect(
      contract.mutate(command, ({ payload }) => payload),
    ).rejects.toMatchObject({ code: "CONFLICT", label: "Conflict" });
    expect(memory.getTarget()).toEqual({
      id: "work-1",
      revision: 0,
      value: { title: "Original" },
    });
    expect(memory.getHistory()).toHaveLength(0);

    await expect(
      contract.finalize<{ title: string }>(staged.id, ({ payload }) => payload),
    ).resolves.toMatchObject({ status: "committed" });
  });

  test("preserves the staged actor when non-human retry metadata changes", async () => {
    const memory = createMemoryStore({
      id: "work-1",
      revision: 0,
      value: { title: "Original" },
    });
    const contract = createMutationContract<FixtureValue>({
      barrierChecks: ALLOW_BARRIER_CHECKS,
      sourceVerifier: { verify: () => true },
      store: memory.store,
    });
    const payload = { title: "From GitHub" };
    const source = {
      deliveryId: "delivery-actor-change",
      payloadFingerprint: await fingerprintMutationPayload(payload),
      sourceId: "github-source-1",
    };
    const staged = await contract.stage({
      actor: { actorId: "github-1", type: "GitHub" },
      kind: "non-human",
      payload,
      source,
      targetId: "work-1",
      targetRevision: 0,
    });

    const finalized = await contract.finalize(
      staged.id,
      ({ payload: nextValue }) => nextValue,
      {
        actor: {
          actorId: "integration-1",
          authorizingUserId: "account-1",
          type: "Authorized integration",
        },
        kind: "non-human",
        payload,
        source,
        targetId: "work-1",
        targetRevision: 0,
      },
    );

    expect(finalized).toMatchObject({
      receipt: {
        actor: { actorId: "github-1", type: "GitHub" },
      },
      status: "committed",
    });
    expect(memory.getHistory()).toMatchObject([
      { actor: { actorId: "github-1", type: "GitHub" } },
    ]);
  });

  test("finalizes a staged JSON null payload", async () => {
    const memory = createMemoryStore({
      id: "work-1",
      revision: 0,
      value: { title: "Original" },
    });
    const contract = createMutationContract<FixtureValue>({
      barrierChecks: ALLOW_BARRIER_CHECKS,
      store: memory.store,
    });
    const staged = await contract.stage({
      actor: { actorId: "account-1", type: "User" },
      baseRevision: 0,
      clientIdempotencyKey: "staged-null-payload",
      kind: "human",
      payload: null,
      targetId: "work-1",
    });

    const finalized = await contract.finalize<null>(
      staged.id,
      ({ payload }) => ({
        title: payload === null ? "Applied null payload" : "Unexpected payload",
      }),
    );

    expect(finalized).toMatchObject({
      receipt: { nextValue: { title: "Applied null payload" } },
      status: "committed",
    });
  });

  test("retries a finalizing operation after an interrupted barrier", async () => {
    const memory = createMemoryStore({
      id: "work-1",
      revision: 0,
      value: { title: "Original" },
    });
    let failOnce = true;
    const baseFinalize = memory.store.finalize;
    const store: MutationAtomicContractStore<FixtureValue> = {
      ...memory.store,
      async finalize<TPayload extends MutationPayload>(
        input: MutationFinalizeInput<FixtureValue, TPayload>,
      ): Promise<MutationFinalizeResult<FixtureValue>> {
        if (failOnce) {
          failOnce = false;
          const record = await memory.store.findStagedOperation(
            input.operationId,
          );
          if (!record) {
            throw new Error("Mutation operation was not found.");
          }
          record.status = "finalizing";
          throw new Error("database connection lost");
        }
        return baseFinalize(input);
      },
    };
    const contract = createMutationContract<FixtureValue>({
      barrierChecks: ALLOW_BARRIER_CHECKS,
      store,
    });
    const command = {
      actor: { actorId: "account-1", type: "User" as const },
      baseRevision: 0,
      clientIdempotencyKey: "retry-finalizing-operation",
      kind: "human" as const,
      payload: { title: "Retryable" },
      targetId: "work-1",
    };
    const staged = await contract.stage(command);

    await expect(
      contract.finalize<{ title: string }>(staged.id, ({ payload }) => payload),
    ).rejects.toThrow("database connection lost");
    await expect(
      contract.finalize<{ title: string }>(staged.id, ({ payload }) => payload),
    ).resolves.toMatchObject({ status: "committed" });
    expect(memory.getTarget()).toEqual({
      id: "work-1",
      revision: 1,
      value: { title: "Retryable" },
    });
  });

  test("refuses Cancel after the commit barrier with Finalizing", async () => {
    const memory = createMemoryStore({
      id: "work-1",
      revision: 0,
      value: { title: "Original" },
    });
    const contract = createMutationContract<FixtureValue>({
      barrierChecks: ALLOW_BARRIER_CHECKS,
      store: memory.store,
    });
    const staged = await contract.stage({
      actor: { actorId: "account-1", type: "User" },
      baseRevision: 0,
      clientIdempotencyKey: "atomic-key-finalizing",
      kind: "human",
      payload: { title: "Committed" },
      targetId: "work-1",
    });

    await contract.finalize<{ title: string }>(
      staged.id,
      ({ payload }) => payload,
    );

    await expect(contract.cancel(staged.id)).rejects.toMatchObject({
      code: "FINALIZING",
      label: "Finalizing",
      operationId: staged.id,
    } satisfies Partial<MutationFinalizingError>);
    expect(memory.getTarget().value).toEqual({ title: "Committed" });
  });

  test("exposes Finalizing while the commit barrier is in flight", async () => {
    const memory = createMemoryStore({
      id: "work-1",
      revision: 0,
      value: { title: "Original" },
    });
    const contract = createMutationContract<FixtureValue>({
      barrierChecks: ALLOW_BARRIER_CHECKS,
      store: memory.store,
    });
    const staged = await contract.stage({
      actor: { actorId: "account-1", type: "User" },
      baseRevision: 0,
      clientIdempotencyKey: "atomic-key-in-flight",
      kind: "human",
      payload: { title: "Committed" },
      targetId: "work-1",
    });
    let releaseApply: () => void = () => undefined;
    let signalApplyStarted: () => void = () => undefined;
    const applyStarted = new Promise<void>((resolve) => {
      signalApplyStarted = resolve;
    });
    const applyReleased = new Promise<void>((resolve) => {
      releaseApply = resolve;
    });

    const finalization = contract.finalize<{ title: string }>(
      staged.id,
      async ({ payload }) => {
        signalApplyStarted();
        await applyReleased;
        return payload;
      },
    );
    await applyStarted;
    await expect(
      memory.store.findStagedOperation(staged.id),
    ).resolves.toMatchObject({ status: "finalizing" });
    releaseApply();

    await expect(finalization).resolves.toMatchObject({ status: "committed" });
    await expect(contract.cancel(staged.id)).rejects.toMatchObject({
      code: "FINALIZING",
      label: "Finalizing",
    });
  });

  test("allows Cancel before the commit barrier and keeps the rollback receipt", async () => {
    const memory = createMemoryStore({
      id: "work-1",
      revision: 0,
      value: { title: "Original" },
    });
    const contract = createMutationContract<FixtureValue>({
      barrierChecks: ALLOW_BARRIER_CHECKS,
      store: memory.store,
    });
    const staged = await contract.stage({
      actor: { actorId: "account-1", type: "User" },
      baseRevision: 0,
      clientIdempotencyKey: "atomic-key-cancel",
      kind: "human",
      payload: { title: "Cancelled" },
      targetId: "work-1",
    });

    const cancelled = await contract.cancel(staged.id);
    const retry = await contract.finalize<{ title: string }>(
      staged.id,
      ({ payload }) => payload,
    );

    expect(cancelled).toMatchObject({
      receipt: { reason: "cancelled", status: "rolled-back" },
      status: "rolled-back",
    });
    expect(retry).toEqual(cancelled);
    expect(memory.getTarget().revision).toBe(0);
  });

  test("turns expired staging into a durable rollback receipt", async () => {
    const memory = createMemoryStore({
      id: "work-1",
      revision: 0,
      value: { title: "Original" },
    });
    const stagedAt = new Date("2026-09-17T10:00:00.000Z");
    const contract = createMutationContract<FixtureValue>({
      barrierChecks: ALLOW_BARRIER_CHECKS,
      now: () => stagedAt,
      stagingTtlMs: 1000,
      store: memory.store,
    });
    const staged = await contract.stage({
      actor: { actorId: "account-1", type: "User" },
      baseRevision: 0,
      clientIdempotencyKey: "atomic-key-expired",
      kind: "human",
      payload: { title: "Expired" },
      targetId: "work-1",
    });

    expect(
      await contract.cleanupExpired(new Date("2026-09-17T10:00:01.001Z")),
    ).toBe(1);
    const expired = await contract.finalize<{ title: string }>(
      staged.id,
      ({ payload }) => payload,
    );

    expect(expired).toMatchObject({
      receipt: { reason: "expired", status: "rolled-back" },
      status: "rolled-back",
    });
    expect(memory.getTarget().revision).toBe(0);
  });

  test("turns a stale staged base into a full rollback receipt", async () => {
    const memory = createMemoryStore({
      id: "work-1",
      revision: 0,
      value: { title: "Original" },
    });
    const contract = createMutationContract<FixtureValue>({
      barrierChecks: ALLOW_BARRIER_CHECKS,
      store: memory.store,
    });
    const staged = await contract.stage({
      actor: { actorId: "account-1", type: "User" },
      baseRevision: 0,
      clientIdempotencyKey: "atomic-key-stale",
      kind: "human",
      payload: { title: "Stale write" },
      targetId: "work-1",
    });
    await contract.mutate(
      {
        actor: { actorId: "account-1", type: "User" },
        baseRevision: 0,
        clientIdempotencyKey: "live-key",
        kind: "human",
        payload: { title: "Live update" },
        targetId: "work-1",
      },
      ({ payload }) => payload,
    );

    const rollback = await contract.finalize<{ title: string }>(
      staged.id,
      ({ payload }) => payload,
    );

    expect(rollback).toMatchObject({
      receipt: {
        current: {
          revision: 1,
          value: { title: "Live update" },
        },
        reason: "stale-base-revision",
        status: "rolled-back",
      },
      status: "rolled-back",
    });
    expect(memory.getHistory()).toHaveLength(1);
  });

  test.each(["authorization", "scope", "quota"] as const)(
    "rechecks the %s guard at the commit barrier",
    async (guard) => {
      const memory = createMemoryStore({
        id: "work-1",
        revision: 0,
        value: { title: "Original" },
      });
      const contract = createMutationContract<FixtureValue>({
        barrierChecks: {
          ...ALLOW_BARRIER_CHECKS,
          [guard]: () => false,
        },
        store: memory.store,
      });
      const staged = await contract.stage({
        actor: { actorId: "account-1", type: "User" },
        baseRevision: 0,
        clientIdempotencyKey: `atomic-key-${guard}`,
        kind: "human",
        payload: { title: "Blocked" },
        targetId: "work-1",
      });

      const rollback = await contract.finalize<{ title: string }>(
        staged.id,
        ({ payload }) => payload,
      );

      expect(rollback).toMatchObject({
        receipt: { reason: guard, status: "rolled-back" },
        status: "rolled-back",
      });
      expect(memory.getTarget().revision).toBe(0);
    },
  );

  test("fingerprints equivalent JSON payloads canonically", async () => {
    await expect(
      fingerprintMutationPayload({
        nested: { second: true, first: "value" },
        title: "Updated",
      }),
    ).resolves.toBe(
      await fingerprintMutationPayload({
        title: "Updated",
        nested: { first: "value", second: true },
      }),
    );
  });

  test("applies a human command with its base revision and client key", async () => {
    const memory = createMemoryStore({
      id: "work-1",
      revision: 0,
      value: { title: "Original" },
    });
    const contract = createMutationContract({ store: memory.store });

    const receipt = await contract.mutate(
      {
        actor: { actorId: "account-1", type: "User" },
        baseRevision: 0,
        clientIdempotencyKey: "client-key-1",
        kind: "human",
        payload: { title: "Updated" },
        targetId: "work-1",
      },
      ({ currentValue, payload }) => ({
        ...currentValue,
        ...payload,
      }),
    );

    expect(receipt).toMatchObject({
      actor: { actorId: "account-1", type: "User" },
      nextValue: { title: "Updated" },
      previousValue: { title: "Original" },
      revision: 1,
      targetId: "work-1",
    });
    expect(receipt.id).toEqual(expect.any(String));
    expect(memory.getTarget()).toEqual({
      id: "work-1",
      revision: 1,
      value: { title: "Updated" },
    });
  });

  test("returns the original receipt when a human command is retried", async () => {
    const memory = createMemoryStore({
      id: "work-1",
      revision: 0,
      value: { title: "Original" },
    });
    const contract = createMutationContract({ store: memory.store });
    let applyCalls = 0;
    const command = {
      actor: { actorId: "account-1", type: "User" as const },
      baseRevision: 0,
      clientIdempotencyKey: "client-key-1",
      kind: "human" as const,
      payload: { title: "Updated" },
      targetId: "work-1",
    };

    const first = await contract.mutate(command, ({ payload }) => {
      applyCalls += 1;
      return payload;
    });
    const retry = await contract.mutate(command, ({ payload }) => {
      applyCalls += 1;
      return payload;
    });

    expect(retry).toEqual(first);
    expect(applyCalls).toBe(1);
    expect(memory.getTarget()).toEqual({
      id: "work-1",
      revision: 1,
      value: { title: "Updated" },
    });
  });

  test("rejects a reused human key when its payload changes", async () => {
    const memory = createMemoryStore({
      id: "work-1",
      revision: 0,
      value: { title: "Original" },
    });
    const contract = createMutationContract({ store: memory.store });
    const command = {
      actor: { actorId: "account-1", type: "User" as const },
      baseRevision: 0,
      clientIdempotencyKey: "client-key-1",
      kind: "human" as const,
      payload: { title: "Updated" },
      targetId: "work-1",
    };

    await contract.mutate(command, ({ payload }) => payload);

    await expect(
      contract.mutate(
        { ...command, payload: { title: "Different update" } },
        ({ payload }) => payload,
      ),
    ).rejects.toBeInstanceOf(MutationConflictError);
    await expect(
      contract.mutate(
        { ...command, payload: { title: "Different update" } },
        ({ payload }) => payload,
      ),
    ).rejects.toMatchObject({
      code: "CONFLICT",
      label: "Conflict",
      targetId: "work-1",
    });
    expect(memory.getTarget()).toEqual({
      id: "work-1",
      revision: 1,
      value: { title: "Updated" },
    });
  });

  test("rejects a stale human base and exposes the Current value", async () => {
    const memory = createMemoryStore({
      id: "work-1",
      revision: 0,
      value: { title: "Original" },
    });
    const contract = createMutationContract({ store: memory.store });

    await contract.mutate(
      {
        actor: { actorId: "account-1", type: "User" },
        baseRevision: 0,
        clientIdempotencyKey: "client-key-1",
        kind: "human",
        payload: { title: "First update" },
        targetId: "work-1",
      },
      ({ payload }) => payload,
    );

    await expect(
      contract.mutate(
        {
          actor: { actorId: "account-1", type: "User" },
          baseRevision: 0,
          clientIdempotencyKey: "client-key-2",
          kind: "human",
          payload: { title: "Stale update" },
          targetId: "work-1",
        },
        ({ payload }) => payload,
      ),
    ).rejects.toMatchObject({
      code: "STALE_BASE_REVISION",
      currentRevision: 1,
      currentValue: { title: "First update" },
      label: "Current value",
    } satisfies Partial<MutationStaleBaseRevisionError<FixtureValue>>);
    expect(memory.getTarget()).toEqual({
      id: "work-1",
      revision: 1,
      value: { title: "First update" },
    });
  });

  test("accepts a non-human command only with a verified source", async () => {
    const memory = createMemoryStore({
      id: "work-1",
      revision: 0,
      value: { title: "Original" },
    });
    const payload = { title: "From GitHub" };
    const payloadFingerprint = await fingerprintMutationPayload(payload);
    const verifiedSources: string[] = [];
    const contract = createMutationContract({
      sourceVerifier: {
        verify: ({ actor, source }) => {
          verifiedSources.push(`${actor.type}:${source.sourceId}`);
          return source.sourceId === "github-installation-1";
        },
      },
      store: memory.store,
    });

    const receipt = await contract.mutate(
      {
        actor: { actorId: "installation-1", type: "GitHub" },
        kind: "non-human",
        payload,
        source: {
          deliveryId: "delivery-1",
          payloadFingerprint: payloadFingerprint.toUpperCase(),
          sourceId: "github-installation-1",
        },
        targetId: "work-1",
        targetRevision: 0,
      },
      ({ payload: nextValue }) => nextValue,
    );

    expect(receipt).toMatchObject({
      actor: { actorId: "installation-1", type: "GitHub" },
      nextValue: payload,
      origin: {
        deliveryId: "delivery-1",
        kind: "source",
        sourceId: "github-installation-1",
      },
      payloadFingerprint,
    });
    expect(verifiedSources).toEqual(["GitHub:github-installation-1"]);
  });

  test("returns a non-human receipt on redelivery and conflicts on a changed payload", async () => {
    const memory = createMemoryStore({
      id: "work-1",
      revision: 0,
      value: { title: "Original" },
    });
    const source = {
      sourceId: "automation-1",
      deliveryId: "delivery-1",
    };
    const contract = createMutationContract({
      sourceVerifier: { verify: () => true },
      store: memory.store,
    });
    let applyCalls = 0;
    const firstPayload = { title: "Automated update" };
    const firstCommand = {
      actor: { actorId: "rule-1", type: "System automation" as const },
      kind: "non-human" as const,
      payload: firstPayload,
      source: {
        ...source,
        payloadFingerprint: await fingerprintMutationPayload(firstPayload),
      },
      targetId: "work-1",
      targetRevision: 0,
    };

    const first = await contract.mutate(firstCommand, ({ payload }) => {
      applyCalls += 1;
      return payload;
    });
    const redelivery = await contract.mutate(firstCommand, ({ payload }) => {
      applyCalls += 1;
      return payload;
    });
    const changedPayload = { title: "Changed replay" };

    await expect(
      contract.mutate(
        {
          ...firstCommand,
          payload: changedPayload,
          source: {
            ...source,
            payloadFingerprint:
              await fingerprintMutationPayload(changedPayload),
          },
        },
        ({ payload }) => payload,
      ),
    ).rejects.toMatchObject({ code: "CONFLICT", label: "Conflict" });

    expect(redelivery).toEqual(first);
    expect(applyCalls).toBe(1);
    expect(memory.getTarget()).toMatchObject({
      revision: 1,
      value: firstPayload,
    });
  });

  test("keeps source delivery idempotency stable when actor metadata changes", async () => {
    const memory = createMemoryStore({
      id: "work-1",
      revision: 0,
      value: { title: "Original" },
    });
    const contract = createMutationContract({
      sourceVerifier: { verify: () => true },
      store: memory.store,
    });
    const payload = { title: "External update" };
    const source = {
      deliveryId: "delivery-1",
      payloadFingerprint: await fingerprintMutationPayload(payload),
      sourceId: "source-1",
    };

    const first = await contract.mutate(
      {
        actor: { actorId: "automation-1", type: "System automation" },
        kind: "non-human",
        payload,
        source,
        targetId: "work-1",
        targetRevision: 0,
      },
      ({ payload: nextValue }) => nextValue,
    );
    const redelivery = await contract.mutate(
      {
        actor: { actorId: "automation-2", type: "System automation" },
        kind: "non-human",
        payload,
        source,
        targetId: "work-1",
        targetRevision: 0,
      },
      ({ payload: nextValue }) => nextValue,
    );

    expect(redelivery).toEqual(first);
    expect(memory.getHistory()).toHaveLength(1);
  });

  test("rejects an unverified source or a payload fingerprint mismatch", async () => {
    const memory = createMemoryStore({
      id: "work-1",
      revision: 0,
      value: { title: "Original" },
    });
    const payload = { title: "External update" };
    const source = {
      deliveryId: "delivery-1",
      payloadFingerprint: await fingerprintMutationPayload(payload),
      sourceId: "unregistered-source",
    };
    const command = {
      actor: {
        actorId: "integration-1",
        type: "Authorized integration" as const,
        authorizingUserId: "account-1",
      },
      kind: "non-human" as const,
      payload,
      source,
      targetId: "work-1",
      targetRevision: 0,
    };

    await expect(
      createMutationContract({ store: memory.store }).mutate(
        command,
        ({ payload: nextValue }) => nextValue,
      ),
    ).rejects.toMatchObject({ code: "UNVERIFIED_SOURCE" });
    await expect(
      createMutationContract({
        sourceVerifier: { verify: () => true },
        store: memory.store,
      }).mutate(
        {
          ...command,
          source: { ...source, payloadFingerprint: "0".repeat(64) },
        },
        ({ payload: nextValue }) => nextValue,
      ),
    ).rejects.toMatchObject({ code: "INVALID_PAYLOAD_FINGERPRINT" });
    expect(memory.getTarget()).toEqual({
      id: "work-1",
      revision: 0,
      value: { title: "Original" },
    });
  });

  test("records all four origin classes in Kayıt geçmişi", async () => {
    const memory = createMemoryStore({
      id: "work-1",
      revision: 0,
      value: { title: "Original" },
    });
    const contract = createMutationContract({
      sourceVerifier: { verify: () => true },
      store: memory.store,
    });
    const applyTitle = ({
      currentValue,
      payload,
    }: {
      currentValue: FixtureValue;
      payload: { title: string };
    }) => ({
      ...currentValue,
      ...payload,
    });

    await contract.mutate(
      {
        actor: { actorId: "account-1", type: "User" },
        baseRevision: 0,
        clientIdempotencyKey: "human-1",
        kind: "human",
        payload: { title: "User update" },
        targetId: "work-1",
      },
      applyTitle,
    );

    const mutateFromSource = async (
      actor: NonHumanMutationActor,
      sourceId: string,
      deliveryId: string,
      targetRevision: number,
      title: string,
    ) => {
      const payload = { title };
      return contract.mutate(
        {
          actor,
          kind: "non-human",
          payload,
          source: {
            deliveryId,
            payloadFingerprint: await fingerprintMutationPayload(payload),
            sourceId,
          },
          targetId: "work-1",
          targetRevision,
        },
        applyTitle,
      );
    };

    await mutateFromSource(
      { actorId: "automation-1", type: "System automation" },
      "automation-source-1",
      "automation-delivery-1",
      1,
      "Automation update",
    );
    await mutateFromSource(
      { actorId: "github-installation-1", type: "GitHub" },
      "github-source-1",
      "github-delivery-1",
      2,
      "GitHub update",
    );
    await mutateFromSource(
      {
        actorId: "integration-1",
        authorizingUserId: "account-1",
        type: "Authorized integration",
      },
      "integration-source-1",
      "integration-delivery-1",
      3,
      "Integration update",
    );

    expect(memory.getHistory().map(({ actor }) => actor)).toEqual([
      { actorId: "account-1", type: "User" },
      { actorId: "automation-1", type: "System automation" },
      { actorId: "github-installation-1", type: "GitHub" },
      {
        actorId: "integration-1",
        authorizingUserId: "account-1",
        type: "Authorized integration",
      },
    ]);
  });

  test("rejects one of two concurrent writes from the same base", async () => {
    const memory = createMemoryStore({
      id: "work-1",
      revision: 0,
      value: { title: "Original" },
    });
    const contract = createMutationContract({ store: memory.store });
    const command = (clientIdempotencyKey: string, title: string) => ({
      actor: { actorId: "account-1", type: "User" as const },
      baseRevision: 0,
      clientIdempotencyKey,
      kind: "human" as const,
      payload: { title },
      targetId: "work-1",
    });

    const outcomes = await Promise.allSettled([
      contract.mutate(
        command("client-key-1", "First"),
        ({ payload }) => payload,
      ),
      contract.mutate(
        command("client-key-2", "Second"),
        ({ payload }) => payload,
      ),
    ]);

    expect(
      outcomes.filter(({ status }) => status === "fulfilled"),
    ).toHaveLength(1);
    expect(outcomes.filter(({ status }) => status === "rejected")).toHaveLength(
      1,
    );
    const rejected = outcomes.find(({ status }) => status === "rejected");
    expect(rejected).toMatchObject({
      reason: { code: "STALE_BASE_REVISION" },
      status: "rejected",
    });
    expect(memory.getTarget().revision).toBe(1);
    expect(memory.getHistory()).toHaveLength(1);
  });

  test("uses the target revision condition when source deliveries arrive out of order", async () => {
    const memory = createMemoryStore({
      id: "work-1",
      revision: 0,
      value: { title: "Original" },
    });
    const contract = createMutationContract({
      sourceVerifier: { verify: () => true },
      store: memory.store,
    });
    const applyTitle = ({
      payload,
    }: {
      currentValue: FixtureValue;
      payload: { title: string };
    }) => payload;
    const delivery = async (
      deliveryId: string,
      targetRevision: number,
      title: string,
    ) => {
      const payload = { title };
      return contract.mutate(
        {
          actor: { actorId: "automation-1", type: "System automation" },
          kind: "non-human",
          payload,
          source: {
            deliveryId,
            payloadFingerprint: await fingerprintMutationPayload(payload),
            sourceId: "automation-source-1",
          },
          targetId: "work-1",
          targetRevision,
        },
        applyTitle,
      );
    };

    await expect(
      delivery("delivery-2", 1, "Second delivery"),
    ).rejects.toMatchObject({
      code: "STALE_BASE_REVISION",
      currentRevision: 0,
      currentValue: { title: "Original" },
    });
    await delivery("delivery-1", 0, "First delivery");
    await delivery("delivery-2", 1, "Second delivery");

    expect(memory.getTarget()).toEqual({
      id: "work-1",
      revision: 2,
      value: { title: "Second delivery" },
    });
  });

  test.each(ORIGIN_CASES)(
    "$label retries, rejects reordered writes, and serializes concurrent writes",
    async (origin) => {
      const memory = createMemoryStore({
        id: "work-1",
        revision: 0,
        value: { title: "Original" },
      });
      const contract = createMutationContract({
        sourceVerifier: { verify: () => true },
        store: memory.store,
      });
      const applyTitle = ({ payload }: { payload: { title: string } }) =>
        payload;
      const firstCommand = await commandForOrigin(origin, "First", 0, "first");
      const first = await contract.mutate(firstCommand, applyTitle);
      const retry = await contract.mutate(firstCommand, applyTitle);

      expect(retry).toEqual(first);
      expect(memory.getHistory()).toHaveLength(1);

      const reorderedCommand = await commandForOrigin(
        origin,
        "Reordered",
        2,
        "reordered",
      );
      await expect(
        contract.mutate(reorderedCommand, applyTitle),
      ).rejects.toMatchObject({
        code: "STALE_BASE_REVISION",
        currentRevision: 1,
      });
      await contract.mutate(
        await commandForOrigin(origin, "Second", 1, "second"),
        applyTitle,
      );
      await contract.mutate(reorderedCommand, applyTitle);

      const outcomes = await Promise.allSettled([
        contract.mutate(
          await commandForOrigin(origin, "Concurrent first", 3, "parallel-1"),
          applyTitle,
        ),
        contract.mutate(
          await commandForOrigin(origin, "Concurrent second", 3, "parallel-2"),
          applyTitle,
        ),
      ]);

      expect(
        outcomes.filter(({ status }) => status === "fulfilled"),
      ).toHaveLength(1);
      expect(
        outcomes.filter(({ status }) => status === "rejected"),
      ).toHaveLength(1);
      expect(outcomes).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ status: "rejected" }),
          expect.objectContaining({ status: "fulfilled" }),
        ]),
      );
      const rejected = outcomes.find(({ status }) => status === "rejected");
      expect(rejected).toMatchObject({
        reason: { code: "STALE_BASE_REVISION" },
        status: "rejected",
      });
      expect(memory.getTarget().revision).toBe(4);
      expect(memory.getHistory()).toHaveLength(4);
    },
  );

  test("does not apply human commands without their write envelope", async () => {
    const memory = createMemoryStore({
      id: "work-1",
      revision: 0,
      value: { title: "Original" },
    });
    const contract = createMutationContract({ store: memory.store });
    const apply = ({ payload }: { payload: { title: string } }) => payload;

    await expect(
      contract.mutate(
        {
          actor: { actorId: "account-1", type: "User" },
          kind: "human",
          payload: { title: "Missing base" },
          targetId: "work-1",
        } as never,
        apply,
      ),
    ).rejects.toThrow();
    await expect(
      contract.mutate(
        {
          actor: { actorId: "account-1", type: "User" },
          baseRevision: 0,
          kind: "human",
          payload: { title: "Missing key" },
          targetId: "work-1",
        } as never,
        apply,
      ),
    ).rejects.toThrow();
    await expect(
      contract.mutate(
        {
          actor: { actorId: "automation-1", type: "System automation" },
          baseRevision: 0,
          kind: "non-human",
          payload: { title: "Fake base" },
          source: {
            deliveryId: "delivery-1",
            payloadFingerprint: await fingerprintMutationPayload({
              title: "Fake base",
            }),
            sourceId: "source-1",
          },
          targetId: "work-1",
          targetRevision: 0,
        } as never,
        apply,
      ),
    ).rejects.toThrow();
    expect(memory.getTarget()).toEqual({
      id: "work-1",
      revision: 0,
      value: { title: "Original" },
    });
  });
});
