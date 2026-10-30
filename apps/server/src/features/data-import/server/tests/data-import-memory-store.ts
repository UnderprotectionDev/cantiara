// biome-ignore-all lint/performance/noAwaitInLoops: the three barrier checks run in order, as in the contract.
import { randomBytes } from "node:crypto";

import type { ImportReceipt } from "@cantiara/api/data-import";
import type {
  MutationPayload,
  MutationReceipt,
  MutationRollbackReceipt,
} from "@cantiara/api/mutation-and-undo";
import {
  createMutationContract,
  MutationApplyFailedError,
  type MutationAtomicContractStore,
  type MutationFinalizeResult,
  type MutationStagedRecord,
} from "@cantiara/api/mutation-contract";

import type {
  DataImportPorts,
  ImportOriginState,
  StagedImport,
} from "../data-import";
import type {
  ImportApplyPorts,
  ImportTargetValue,
  ImportWritePlan,
} from "../data-import-apply";
import {
  createImportSealer,
  type ImportKeyRing,
} from "../data-import-envelope";

/** Everything a preview must leave untouched. */
export interface PrimaryFacts {
  records: string[];
  relations: string[];
  searchIndex: string[];
}

export interface WrittenRecord {
  id: string;
  originKey: string | null;
  recordType: string;
  values: Record<string, string>;
}

export interface WrittenOrigin {
  originKey: string;
  provenance: string;
  recordId: string;
}

function scopeLabel(kind: "project" | "wiki" | "workspace") {
  if (kind === "project") {
    return "Project Atlas";
  }
  return kind === "wiki" ? "Wiki" : "Workspace";
}

const PENDING: ImportTargetValue = {
  created: 0,
  recordIds: [],
  state: "pending",
  updated: 0,
};

/**
 * A transactional in-memory Mutation Contract store and primary store: the
 * finalize write runs inside the barrier and is restored when any write
 * throws, the way the PostgreSQL adapter rolls back its transaction.
 */
function createMemoryApply(options: {
  failOnValue?: string;
  gate: { current: Promise<void> | null };
  plans: Map<string, ImportWritePlan>;
  primary: {
    origins: WrittenOrigin[];
    records: WrittenRecord[];
    relations: string[];
  };
}) {
  const staged = new Map<string, MutationStagedRecord<ImportTargetValue>>();
  const receipts = new Map<string, MutationReceipt<ImportTargetValue>>();
  const keyOf = ({ key, scope }: { key: string; scope: string }) =>
    `${scope}:${key}`;

  function rollback(
    record: MutationStagedRecord<ImportTargetValue>,
    reason: MutationRollbackReceipt["reason"],
    completedAt: string,
  ): MutationFinalizeResult<ImportTargetValue> {
    record.completedAt = completedAt;
    record.payload = undefined;
    record.rollbackReceipt = {
      actor: record.actor,
      completedAt,
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

  function writePlan(plan: ImportWritePlan) {
    const before = {
      origins: [...options.primary.origins],
      records: [...options.primary.records],
      relations: [...options.primary.relations],
    };
    try {
      for (const record of plan.creates) {
        if (
          options.failOnValue &&
          Object.values(record.values).includes(options.failOnValue)
        ) {
          throw new Error("The store refused one record.");
        }
        options.primary.records.push({
          id: record.id,
          originKey: record.originKey,
          recordType: record.recordType,
          values: record.values,
        });
        if (record.originKey && plan.provenance) {
          options.primary.origins.push({
            originKey: record.originKey,
            provenance: plan.provenance,
            recordId: record.id,
          });
        }
      }
    } catch (cause) {
      options.primary.origins = before.origins;
      options.primary.records = before.records;
      options.primary.relations = before.relations;
      throw new MutationApplyFailedError(cause, { cause });
    }
  }

  const store: MutationAtomicContractStore<ImportTargetValue> = {
    cancel(input) {
      const record = staged.get(input.operationId);
      if (!record) {
        throw new Error("Mutation operation was not found.");
      }
      if (record.status === "staged" || record.status === "finalizing") {
        return Promise.resolve(
          rollback(record, input.reason, input.completedAt),
        );
      }
      return Promise.resolve({
        operationId: record.id,
        status: "finalizing" as const,
      });
    },
    cleanupExpired: () => Promise.resolve(0),
    commit: () => Promise.reject(new Error("Import never uses commit.")),
    async finalize(input) {
      const record = staged.get(input.operationId);
      if (!record) {
        throw new Error("Mutation operation was not found.");
      }
      if (record.status === "committed" && record.receipt) {
        return {
          operation: record,
          receipt: record.receipt,
          status: "committed" as const,
        };
      }
      if (record.status === "rolled-back" && record.rollbackReceipt) {
        return {
          operation: record,
          receipt: record.rollbackReceipt,
          status: "rolled-back" as const,
        };
      }
      if (record.status === "finalizing") {
        return {
          operationId: record.id,
          status: "finalizing" as const,
        };
      }
      record.status = "finalizing";
      await options.gate.current;
      const context = {
        actor: input.actor,
        expectedRevision: input.expectedRevision,
        idempotencyKey: input.idempotencyKey,
        operationId: input.operationId,
        origin: input.origin,
        payload: input.payload,
        payloadFingerprint: input.payloadFingerprint,
        target: { id: input.targetId, revision: 0, value: PENDING },
        targetId: input.targetId,
      };
      for (const reason of ["authorization", "scope", "quota"] as const) {
        const check = input.barrierChecks?.[reason];
        if (!(check && (await check(context)))) {
          return rollback(record, reason, input.committedAt);
        }
      }
      const nextValue = await input.apply({
        committedAt: input.committedAt,
        currentRevision: 0,
        currentValue: PENDING,
        payload: input.payload,
      });
      const plan = options.plans.get(input.idempotencyKey.key);
      if (!plan) {
        throw new Error("No import plan for this operation.");
      }
      writePlan(plan);
      const receipt: MutationReceipt<ImportTargetValue> = {
        actor: input.actor,
        committedAt: input.committedAt,
        id: input.receiptId,
        nextValue,
        origin: input.origin,
        payloadFingerprint: input.payloadFingerprint,
        previousValue: PENDING,
        revision: 1,
        targetId: input.targetId,
      };
      receipts.set(keyOf(input.idempotencyKey), receipt);
      record.completedAt = input.committedAt;
      record.payload = undefined;
      record.receipt = receipt;
      record.status = "committed";
      return { operation: record, receipt, status: "committed" as const };
    },
    findReceipt: (key) => Promise.resolve(receipts.get(keyOf(key)) ?? null),
    findReceiptById: (id) =>
      Promise.resolve(
        [...receipts.values()].find((receipt) => receipt.id === id) ?? null,
      ),
    findStagedOperation: (id) => Promise.resolve(staged.get(id) ?? null),
    getTarget: (id) => Promise.resolve({ id, revision: 0, value: PENDING }),
    stage<TPayload extends MutationPayload>(
      input: Parameters<
        MutationAtomicContractStore<ImportTargetValue>["stage"]
      >[0] & { payload: TPayload },
    ) {
      const existing = [...staged.values()].find(
        (candidate) =>
          keyOf(candidate.idempotencyKey) === keyOf(input.idempotencyKey),
      );
      if (existing) {
        return Promise.resolve(
          existing.payloadFingerprint === input.payloadFingerprint
            ? { operation: existing, status: existing.status }
            : { status: "conflict" as const },
        );
      }
      const record: MutationStagedRecord<ImportTargetValue> = {
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
      };
      staged.set(record.id, record);
      return Promise.resolve({ operation: record, status: "staged" as const });
    },
  };
  return store;
}

export function createMemoryDataImport(options: {
  accountId: string;
  customFieldNames?: readonly string[];
  /** A value whose record the store refuses, to prove the full rollback. */
  failOnValue?: string;
  origins?: Record<string, ImportOriginState>;
  primary?: PrimaryFacts;
  /** Why Apply cannot write the set, as the PostgreSQL adapter reports it. */
  unavailable?: string;
}) {
  const staged = new Map<string, StagedImport>();
  const primary: PrimaryFacts = options.primary ?? {
    records: ["Risk:r1"],
    relations: ["r1->w1"],
    searchIndex: ["r1"],
  };
  const frozen = JSON.stringify(primary);
  const written = {
    origins: [] as WrittenOrigin[],
    records: [] as WrittenRecord[],
    relations: [] as string[],
  };
  const importReceipts = new Map<string, ImportReceipt>();
  const gate: { current: Promise<void> | null } = { current: null };
  const plans = new Map<string, ImportWritePlan>();
  const store = createMemoryApply({
    failOnValue: options.failOnValue,
    gate,
    plans,
    primary: written,
  });
  const ring: ImportKeyRing = {
    currentVersion: 1,
    keys: new Map([[1, randomBytes(32)]]),
  };
  let counter = 0;
  const apply: ImportApplyPorts = {
    contract: (plan, contractOptions) => {
      plans.set(plan.idempotencyKey, plan);
      let ids = 0;
      return createMutationContract<ImportTargetValue>({
        barrierChecks: contractOptions.barrierChecks,
        createId: () => {
          ids += 1;
          return `${plan.idempotencyKey}-id-${ids}`;
        },
        sourceVerifier: contractOptions.sourceVerifier,
        store,
      });
    },
    newId: () => {
      counter += 1;
      return `record-${counter}`;
    },
    receipts: {
      get: (accountId, key) =>
        Promise.resolve(importReceipts.get(`${accountId}:${key}`) ?? null),
      put: (accountId, receipt) => {
        const id = `${accountId}:${receipt.idempotencyKey}`;
        const kept = importReceipts.get(id) ?? receipt;
        importReceipts.set(id, kept);
        return Promise.resolve(kept);
      },
    },
    unavailable: () => options.unavailable ?? null,
  };
  const ports: DataImportPorts = {
    apply,
    newId: () => {
      counter += 1;
      return `staging-${counter}`;
    },
    origins: (_accountId, _scope, query) =>
      Promise.resolve(
        new Map(
          query.keys.flatMap((key) => {
            const state = options.origins?.[key];
            return state ? [[key, state] as const] : [];
          }),
        ),
      ),
    scopes: (accountId, scope) => {
      if (accountId !== options.accountId) {
        return Promise.resolve(null);
      }
      if (scope.kind === "project" && scope.projectId !== "project-1") {
        return Promise.resolve(null);
      }
      return Promise.resolve({
        customFieldNames:
          scope.kind === "project" ? (options.customFieldNames ?? []) : [],
        label: scopeLabel(scope.kind),
      });
    },
    sealer: createImportSealer(ring),
    staging: {
      claim: (accountId, id, key) => {
        const row = staged.get(id);
        if (!row || row.accountId !== accountId) {
          return Promise.resolve(false);
        }
        if (row.applyingKey && row.applyingKey !== key) {
          return Promise.resolve(false);
        }
        row.applyingKey = key;
        return Promise.resolve(true);
      },
      get: (accountId, id) => {
        const row = staged.get(id);
        return Promise.resolve(row?.accountId === accountId ? row : null);
      },
      purgeExpired: (now) => {
        let removed = 0;
        for (const [id, row] of staged) {
          if (row.expiresAt.getTime() <= now.getTime()) {
            staged.delete(id);
            removed += 1;
          }
        }
        return Promise.resolve(removed);
      },
      put: (row) => {
        staged.set(row.id, row);
        return Promise.resolve();
      },
      release: (accountId, id) => {
        const row = staged.get(id);
        if (row?.accountId === accountId) {
          row.applyingKey = null;
        }
        return Promise.resolve();
      },
      remove: (accountId, id, { force }) => {
        const row = staged.get(id);
        if (!row || row.accountId !== accountId) {
          return Promise.resolve("missing" as const);
        }
        if (row.applyingKey && !force) {
          return Promise.resolve("claimed" as const);
        }
        staged.delete(id);
        return Promise.resolve("removed" as const);
      },
    },
  };
  return {
    /** Holds the next finalize at the commit barrier until `open` is called. */
    holdBarrier: () => {
      let open: () => void = () => undefined;
      gate.current = new Promise<void>((resolve) => {
        open = () => {
          gate.current = null;
          resolve();
        };
      });
      return open;
    },
    ports,
    primaryUnchanged: () => JSON.stringify(primary) === frozen,
    staged,
    written,
  };
}
