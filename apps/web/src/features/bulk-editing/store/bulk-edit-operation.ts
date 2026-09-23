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
  resultPages: readonly (readonly BulkEditResult[])[];
}

const BULK_EDIT_RESULT_PAGE_SIZE = 128;

function appendBulkEditResult(
  pages: BulkEditOperation["resultPages"],
  result: BulkEditResult,
): BulkEditOperation["resultPages"] {
  const lastPage = pages.at(-1);
  if (!lastPage || lastPage.length === BULK_EDIT_RESULT_PAGE_SIZE) {
    return [...pages, [result]];
  }
  return [...pages.slice(0, -1), [...lastPage, result]];
}

export function bulkEditResultAt(
  pages: BulkEditOperation["resultPages"],
  index: number,
) {
  return pages[Math.floor(index / BULK_EDIT_RESULT_PAGE_SIZE)]?.[
    index % BULK_EDIT_RESULT_PAGE_SIZE
  ];
}

export function findBulkEditResultIndex(
  pages: BulkEditOperation["resultPages"],
  workId: string,
) {
  let resultIndex = 0;
  for (const page of pages) {
    const indexInPage = page.findIndex((result) => result.workId === workId);
    if (indexInPage !== -1) {
      return resultIndex + indexInPage;
    }
    resultIndex += page.length;
  }
  return null;
}

export function updateBulkEditResultAt(
  pages: BulkEditOperation["resultPages"],
  index: number,
  update: (result: BulkEditResult) => BulkEditResult,
): BulkEditOperation["resultPages"] {
  const pageIndex = Math.floor(index / BULK_EDIT_RESULT_PAGE_SIZE);
  const indexInPage = index % BULK_EDIT_RESULT_PAGE_SIZE;
  const currentPage = pages[pageIndex];
  const currentResult = currentPage?.[indexInPage];
  if (!(currentPage && currentResult)) {
    return pages;
  }
  const nextPages = [...pages];
  const nextPage = [...currentPage];
  nextPage[indexInPage] = update(currentResult);
  nextPages[pageIndex] = nextPage;
  return nextPages;
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
    "completed" | "nextRecordIndex" | "resultPages"
  >,
) {
  bulkEditOperationStore.setState((state) => ({
    operations: [
      ...state.operations.filter((candidate) => candidate.id !== operation.id),
      {
        ...operation,
        completed: 0,
        nextRecordIndex: 0,
        resultPages: [],
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

export function recordBulkEditResult(id: string, result: BulkEditResult) {
  updateBulkEditOperation(id, (operation) => ({
    ...operation,
    completed: operation.completed + 1,
    resultPages: appendBulkEditResult(operation.resultPages, result),
  }));
}

export function cancelBulkEditOperation(id: string) {
  updateBulkEditOperation(id, (operation) => {
    if (operation.phase !== "applying") {
      return operation;
    }
    const { nextRecordIndex, preview } = operation;
    let { completed, resultPages } = operation;
    for (
      let index = nextRecordIndex;
      index < preview.records.length;
      index += 1
    ) {
      const record = preview.records[index];
      if (!record) {
        continue;
      }
      const result: BulkEditResult =
        record.work.status === preview.targetStatus
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
      resultPages = appendBulkEditResult(resultPages, result);
      completed += 1;
    }
    return {
      ...operation,
      completed,
      phase: "finalizing",
      resultPages,
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
