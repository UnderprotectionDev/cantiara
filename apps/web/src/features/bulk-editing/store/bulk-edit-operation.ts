import type {
  WorkClosePreview,
  WorkClosureResult,
  WorkProfile,
  WorkStatus,
} from "@cantiara/api/work-lifecycle";
import { createStore } from "@tanstack/react-store";
import type { SupportReferenceFailure } from "@/features/web-macos-client/lib/support-reference";

export interface BulkEditRecordSnapshot {
  closePreview: WorkClosePreview | null;
  work: WorkProfile;
}

export interface BulkEditPreview {
  closureReason: string | null;
  closureResult: WorkClosureResult;
  inputSignature: string;
  records: BulkEditRecordSnapshot[];
  targetStatus: WorkStatus;
}

export interface BulkEditResult {
  failure?: SupportReferenceFailure;
  key: string;
  receiptId?: string;
  status: "Canceled" | "Failed" | "Succeeded" | "Undone";
  undoAttempts?: number;
  undoError?: SupportReferenceFailure;
  undoing?: boolean;
  workId: string;
}

export interface BulkEditOperation {
  archived: boolean;
  completed: number;
  id: string;
  nextRecordIndex: number;
  phase: "applying" | "complete" | "finalizing";
  preview: BulkEditPreview;
  projectId: string;
  results: Array<BulkEditResult | null>;
}

interface BulkEditStoreState {
  operations: BulkEditOperation[];
}

export const bulkEditOperationStore = createStore<BulkEditStoreState>({
  operations: [],
});

export function startBulkEditOperation(
  operation: Omit<
    BulkEditOperation,
    "completed" | "nextRecordIndex" | "results"
  >,
) {
  bulkEditOperationStore.setState((state) => ({
    operations: [
      ...state.operations.filter((candidate) => candidate.id !== operation.id),
      {
        ...operation,
        completed: 0,
        nextRecordIndex: 0,
        results: operation.preview.records.map(() => null),
      },
    ],
  }));
}

export function updateBulkEditOperation(
  id: string,
  update: (operation: BulkEditOperation) => BulkEditOperation,
) {
  bulkEditOperationStore.setState((state) => ({
    operations: state.operations.map((operation) =>
      operation.id === id ? update(operation) : operation,
    ),
  }));
}

export function claimBulkEditRecord(id: string) {
  let claimedIndex: number | null = null;
  updateBulkEditOperation(id, (operation) => {
    if (
      operation.phase !== "applying" ||
      operation.nextRecordIndex >= operation.preview.records.length
    ) {
      return operation;
    }
    claimedIndex = operation.nextRecordIndex;
    return { ...operation, nextRecordIndex: operation.nextRecordIndex + 1 };
  });
  return claimedIndex;
}

export function recordBulkEditResult(
  id: string,
  index: number,
  result: BulkEditResult,
) {
  updateBulkEditOperation(id, (operation) => {
    const results = [...operation.results];
    results[index] = result;
    return {
      ...operation,
      completed: results.filter((candidate) => candidate !== null).length,
      results,
    };
  });
}

export function cancelBulkEditOperation(id: string) {
  updateBulkEditOperation(id, (operation) => {
    if (operation.phase !== "applying") {
      return operation;
    }
    const results = [...operation.results];
    for (
      let index = operation.nextRecordIndex;
      index < operation.preview.records.length;
      index += 1
    ) {
      const record = operation.preview.records[index];
      if (!record) {
        continue;
      }
      results[index] =
        record.work.status === operation.preview.targetStatus
          ? {
              key: record.work.key,
              status: "Succeeded",
              workId: record.work.id,
            }
          : {
              key: record.work.key,
              status: "Canceled",
              workId: record.work.id,
            };
    }
    return {
      ...operation,
      completed: results.filter((candidate) => candidate !== null).length,
      phase: "finalizing",
      results,
    };
  });
}

export function completeBulkEditOperation(id: string) {
  updateBulkEditOperation(id, (operation) => ({
    ...operation,
    phase: "complete",
  }));
}

export function removeBulkEditOperation(id: string) {
  bulkEditOperationStore.setState((state) => ({
    operations: state.operations.filter((operation) => operation.id !== id),
  }));
}
