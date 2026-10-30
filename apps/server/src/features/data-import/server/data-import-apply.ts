import { randomUUID } from "node:crypto";

import {
  applyImportInputSchema,
  cancelImportInputSchema,
  IMPORT_FINALIZING_LABEL,
  IMPORT_MAX_ROWS,
  type ImportCancelResult,
  type ImportCatalogType,
  ImportConflictError,
  type ImportFamily,
  type ImportReceipt,
  ImportReceiptNotFoundError,
  type ImportRefusalCode,
  ImportRefusedError,
  type ImportScope,
  reopenImportReceiptInputSchema,
} from "@cantiara/api/data-import";
import {
  fingerprintMutationPayload,
  type MutationAtomicContract,
  type MutationCommand,
  type MutationPayload,
  type MutationRollbackReason,
} from "@cantiara/api/mutation-and-undo";
import {
  type MutationBarrierChecks,
  MutationConflictError,
  MutationFinalizingError,
  type MutationSourceVerifier,
} from "@cantiara/api/mutation-contract";

import type {
  AnalyzedImport,
  ImportScopeFacts,
  ImportStagingStore,
} from "./data-import";

/** The actor of every import finalize; the account it acts for travels with it. */
export const IMPORT_ACTOR_ID = "data-import";

export interface ImportFinalRow {
  originKey: string | null;
  /** The living record an update-existing row targets. */
  recordId: string | null;
  rowNumber: number;
  /** Untruncated mapped values: exactly what Apply writes. */
  values: Record<string, string>;
}

/** The exact set the founder saw: nothing else is ever written. */
export interface ImportFinalSet {
  catalogType: ImportCatalogType | null;
  /** Rows still on `Resolve conflict`. */
  conflicts: number;
  counts: ImportReceipt["counts"];
  creates: ImportFinalRow[];
  family: ImportFamily;
  fileName: string;
  fingerprint: string;
  /** Rows that are invalid and not dropped. */
  invalid: number;
  /** Product fields (and `custom:` fields) a column is mapped to. */
  mappedFields: string[];
  /** Provider/file scope of the origin keys; null when the file has none. */
  provenance: string | null;
  scope: ImportScope;
  scopeLabel: string;
  updates: ImportFinalRow[];
}

export type ImportRecordType = ImportCatalogType | "Document";

export interface ImportWriteRecord {
  id: string;
  originKey: string | null;
  recordType: ImportRecordType;
  values: Record<string, string>;
}

export interface ImportWriteUpdate {
  originKey: string | null;
  recordId: string;
  recordType: ImportRecordType;
  values: Record<string, string>;
}

/** Everything the commit barrier writes in one transaction. */
export interface ImportWritePlan {
  accountId: string;
  creates: ImportWriteRecord[];
  family: ImportFamily;
  idempotencyKey: string;
  /** Provider/file scope the origin keys are kept under. */
  provenance: string | null;
  scope: ImportScope;
  updates: ImportWriteUpdate[];
}

/** The import target's value: a virtual, per-import record; the receipt keeps the summary. */
export interface ImportTargetValue {
  created: number;
  recordIds: string[];
  state: "imported" | "pending";
  updated: number;
}

export interface ImportContractOptions {
  barrierChecks: MutationBarrierChecks<ImportTargetValue>;
  sourceVerifier: MutationSourceVerifier;
}

export interface ImportReceiptStore {
  get: (accountId: string, key: string) => Promise<ImportReceipt | null>;
  put: (accountId: string, receipt: ImportReceipt) => Promise<ImportReceipt>;
}

export interface ImportApplyPorts {
  /**
   * The Mutation Contract (import-origin slice) whose target writes `plan`
   * inside the finalize transaction: records, relations and origins, or none.
   */
  contract: (
    plan: ImportWritePlan,
    options: ImportContractOptions,
  ) => MutationAtomicContract<ImportTargetValue>;
  newId?: () => string;
  receipts: ImportReceiptStore;
  /** Why this deployment cannot write the set yet; null when it can. */
  unavailable?: (set: ImportFinalSet) => string | null;
}

interface ApplyContext {
  openStaged: (
    accountId: string,
    stagingId: string,
    now: Date,
  ) => Promise<{
    analysis: AnalyzedImport;
    staged: { applyingKey?: string | null };
  }>;
  ports: {
    apply: ImportApplyPorts;
    scopes: (
      accountId: string,
      scope: ImportScope,
    ) => Promise<ImportScopeFacts | null>;
    staging: ImportStagingStore;
  };
}

const ROLLBACK_TEXT: Record<MutationRollbackReason, string> = {
  "apply-failed":
    "A record in the final set could not be written, so nothing was written.",
  authorization: "You can no longer import into this place.",
  cancelled: "The import was cancelled before the commit barrier.",
  expired: "The import took too long to commit.",
  quota: "The import is larger than the allowed size.",
  scope: "The place you chose is no longer available.",
  "stale-base-revision": "The import target changed before the commit.",
  "target-not-found": "The import target was not found.",
};

function refuse(code: ImportRefusalCode, message: string): never {
  throw new ImportRefusedError(code, message);
}

function recordTypeOf(final: ImportFinalSet): ImportRecordType {
  return final.family === "Document"
    ? "Document"
    : (final.catalogType ?? "Document");
}

function planOf(
  accountId: string,
  key: string,
  final: ImportFinalSet,
  newId: () => string,
): ImportWritePlan {
  const recordType = recordTypeOf(final);
  return {
    accountId,
    creates: final.creates.map((row) => ({
      id: newId(),
      originKey: row.originKey,
      recordType,
      values: row.values,
    })),
    family: final.family,
    idempotencyKey: key,
    provenance: final.provenance,
    scope: final.scope,
    updates: final.updates.flatMap((row) =>
      row.recordId
        ? [
            {
              originKey: row.originKey,
              recordId: row.recordId,
              recordType,
              values: row.values,
            },
          ]
        : [],
    ),
  };
}

function receiptOf(
  key: string,
  final: ImportFinalSet,
  outcome: {
    completedAt: string;
    reason?: string;
    status: ImportReceipt["status"];
    supportReference?: string;
  },
): ImportReceipt {
  const rolledBack = outcome.status === "rolled-back";
  return {
    catalogType: final.catalogType,
    completedAt: outcome.completedAt,
    counts: rolledBack
      ? {
          created: 0,
          excluded: final.counts.excluded,
          skipped: final.counts.skipped,
          updated: 0,
        }
      : final.counts,
    family: final.family,
    fileName: final.fileName,
    finalSetFingerprint: final.fingerprint,
    idempotencyKey: key,
    provenance: final.provenance,
    ...(outcome.reason ? { reason: outcome.reason } : {}),
    scopeLabel: final.scopeLabel,
    status: outcome.status,
    ...(outcome.supportReference
      ? { supportReference: outcome.supportReference }
      : {}),
  };
}

function importSourceId(accountId: string) {
  return `data-import:${accountId}`;
}

/**
 * `Apply Import` (ADR-0004): the separate confirmation of the exact previewed
 * final set. It claims the staged file, re-reads it, refuses anything that is
 * not exactly what the founder saw, then stages and finalizes one import-origin
 * Mutation Contract operation. It never mints a human base revision: the
 * command carries a verified source id, the idempotency key as delivery id and
 * the final set's payload fingerprint. The result is a durable receipt.
 */
export function createImportApply({ openStaged, ports }: ApplyContext) {
  const newId = ports.apply.newId ?? randomUUID;
  const { receipts } = ports.apply;

  function replay(existing: ImportReceipt, fingerprint: string) {
    if (existing.finalSetFingerprint !== fingerprint) {
      throw new ImportConflictError();
    }
    return {
      receipt: existing,
      replayed: true,
      status: existing.status,
    } as const;
  }

  function barrier(
    accountId: string,
    final: ImportFinalSet,
  ): ImportContractOptions {
    return {
      barrierChecks: {
        authorization: ({ actor }) =>
          actor.type === "Authorized integration" &&
          actor.actorId === IMPORT_ACTOR_ID &&
          actor.authorizingUserId === accountId,
        quota: () =>
          final.creates.length + final.updates.length <= IMPORT_MAX_ROWS,
        scope: async () =>
          (await ports.scopes(accountId, final.scope)) !== null,
      },
      sourceVerifier: {
        verify: ({ actor, source }) =>
          actor.type === "Authorized integration" &&
          source.sourceId === importSourceId(actor.authorizingUserId),
      },
    };
  }

  function refuseUnapplicable(final: ImportFinalSet) {
    if (final.invalid > 0) {
      refuse(
        "invalid-rows-remain",
        `${final.invalid} invalid row${final.invalid === 1 ? "" : "s"} must be corrected in the file or dropped before you apply.`,
      );
    }
    if (final.conflicts > 0) {
      refuse(
        "unresolved-conflict",
        "Choose Update existing or Skip for every row that needs a decision.",
      );
    }
    if (final.creates.length + final.updates.length === 0) {
      refuse("empty-final-set", "The final set has no row to write.");
    }
    const unavailable = ports.apply.unavailable?.(final);
    if (unavailable) {
      refuse("apply-unavailable", unavailable);
    }
  }

  return {
    async apply(
      accountId: string,
      rawInput: unknown,
      now = new Date(),
    ): Promise<
      | { label: typeof IMPORT_FINALIZING_LABEL; status: "finalizing" }
      | {
          receipt: ImportReceipt;
          replayed: boolean;
          status: ImportReceipt["status"];
        }
    > {
      const input = applyImportInputSchema.parse(rawInput);
      const key = input.idempotencyKey;
      const fingerprint = input.finalSetFingerprint.toLowerCase();
      const earlier = await receipts.get(accountId, key);
      if (earlier) {
        return replay(earlier, fingerprint);
      }

      const { analysis } = await openStaged(accountId, input.stagingId, now);
      const { final } = analysis;
      if (!(await ports.staging.claim(accountId, input.stagingId, key))) {
        refuse(
          "apply-in-progress",
          "Another import is already applying this file.",
        );
      }
      try {
        if (final.fingerprint !== fingerprint) {
          refuse(
            "preview-changed",
            "The final set changed since you previewed it. Review the preview again.",
          );
        }
        refuseUnapplicable(final);
      } catch (error) {
        await ports.staging.release(accountId, input.stagingId);
        throw error;
      }

      const plan = planOf(accountId, key, final, newId);
      const contract = ports.apply.contract(plan, barrier(accountId, final));
      const payload: MutationPayload = {
        catalogType: final.catalogType,
        counts: final.counts,
        family: final.family,
        finalSetFingerprint: final.fingerprint,
        provenance: final.provenance,
        scope: final.scope,
      };
      const targetId = `${importSourceId(accountId)}:${key}`;
      const command = {
        actor: {
          actorId: IMPORT_ACTOR_ID,
          authorizingUserId: accountId,
          type: "Authorized integration",
        },
        kind: "non-human",
        payload,
        source: {
          deliveryId: key,
          payloadFingerprint: await fingerprintMutationPayload(payload),
          sourceId: importSourceId(accountId),
        },
        targetId,
        targetRevision: 0,
      } satisfies MutationCommand;

      try {
        const operation = await contract.stage(command);
        const done = await contract.finalize(
          operation.id,
          () => ({
            created: plan.creates.length,
            recordIds: plan.creates.map((record) => record.id),
            state: "imported" as const,
            updated: plan.updates.length,
          }),
          command,
        );
        if (done.status === "committed") {
          const stored = await receipts.put(
            accountId,
            receiptOf(key, final, {
              completedAt: done.receipt.committedAt,
              status: "committed",
            }),
          );
          await ports.staging.remove(accountId, input.stagingId, {
            force: true,
          });
          return { receipt: stored, replayed: false, status: "committed" };
        }
        const stored = await receipts.put(
          accountId,
          receiptOf(key, final, {
            completedAt: done.receipt.completedAt,
            reason: ROLLBACK_TEXT[done.receipt.reason],
            status: "rolled-back",
            supportReference: done.receipt.id,
          }),
        );
        await ports.staging.release(accountId, input.stagingId);
        return { receipt: stored, replayed: false, status: "rolled-back" };
      } catch (error) {
        if (error instanceof MutationFinalizingError) {
          return { label: IMPORT_FINALIZING_LABEL, status: "finalizing" };
        }
        if (error instanceof MutationConflictError) {
          await ports.staging.release(accountId, input.stagingId);
          // biome-ignore lint/style/useErrorCause: The contract error carries no more than the conflict itself.
          throw new ImportConflictError();
        }
        throw error;
      }
    },

    async cancel(
      accountId: string,
      rawInput: unknown,
    ): Promise<ImportCancelResult> {
      const input = cancelImportInputSchema.parse(rawInput);
      if (input.idempotencyKey) {
        const earlier = await receipts.get(accountId, input.idempotencyKey);
        if (earlier) {
          return { receipt: earlier, status: earlier.status };
        }
      }
      const removed = await ports.staging.remove(accountId, input.stagingId, {
        force: false,
      });
      return removed === "claimed"
        ? { label: IMPORT_FINALIZING_LABEL, status: "finalizing" }
        : { status: "cancelled" };
    },

    async receipt(accountId: string, rawInput: unknown) {
      const { idempotencyKey } = reopenImportReceiptInputSchema.parse(rawInput);
      const found = await receipts.get(accountId, idempotencyKey);
      if (!found) {
        throw new ImportReceiptNotFoundError();
      }
      return found;
    },
  };
}
