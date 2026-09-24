// biome-ignore-all lint/performance/noJsxPropsBind: Bulk Editing controls operate on the selected Work snapshot.

import type { WorkStatusLabel } from "@cantiara/api/project-shell";
import {
  WORK_CLOSURE_RESULT_OPTIONS,
  WORK_STATUS_OPTIONS,
  type WorkClosePreview,
  type WorkClosureResult,
  type WorkOpenStatus,
  type WorkProfile,
  type WorkStatus,
} from "@cantiara/api/work-lifecycle";
import { Button } from "@cantiara/ui/components/button";
import { Checkbox } from "@cantiara/ui/components/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@cantiara/ui/components/dialog";
import { Field, FieldLabel } from "@cantiara/ui/components/field";
import {
  NativeSelect,
  NativeSelectOption,
} from "@cantiara/ui/components/native-select";
import { Textarea } from "@cantiara/ui/components/textarea";
import { type QueryClient, useQueryClient } from "@tanstack/react-query";
import { useStore } from "@tanstack/react-store";
import { useMemo, useState } from "react";
import type { UserInitiatedWorkCloseOutcome } from "@/features/completion-effects/hooks/use-user-initiated-work-success";
import { useClientShellConnection } from "@/features/web-macos-client/hooks/use-client-shell";
import {
  buildSupportReferenceFailure,
  type SupportReferenceFailure,
} from "@/features/web-macos-client/lib/support-reference";
import { runOnlineOnlyWrite } from "@/features/web-macos-client/store/client-shell";
import { SupportReferenceNotice } from "@/features/web-macos-client/ui/components/support-reference";
import { getWorkStatusLabel } from "@/features/work-lifecycle/ui/forms/work-status-form";
import { client, orpc, projectWorksQueryPrefix } from "@/utils/orpc";
import {
  type BulkEditOperation,
  type BulkEditPreview,
  type BulkEditRecordSnapshot,
  type BulkEditResult,
  bulkEditOperationStore,
  cancelBulkEditOperation,
  claimBulkEditRecord,
  completeBulkEditOperation,
  recordBulkEditResult,
  removeBulkEditOperation,
  startBulkEditOperation,
  updateBulkEditOperation,
} from "../../store/bulk-edit-operation";

const BULK_EDIT_CONCURRENCY = 4;

interface WorkSelectionCheckboxProps {
  checked: boolean;
  disabled?: boolean;
  onCheckedChange: (checked: boolean) => void;
  workKey: string;
}

export function WorkSelectionCheckbox({
  checked,
  disabled = false,
  onCheckedChange,
  workKey,
}: WorkSelectionCheckboxProps) {
  return (
    <Checkbox
      aria-label={`Select ${workKey}`}
      checked={checked}
      disabled={disabled}
      onCheckedChange={(nextChecked) => onCheckedChange(nextChecked === true)}
    />
  );
}

function hasClosureWarnings(preview: WorkClosePreview) {
  return (
    preview.closureCheck.activeBlockers.length > 0 ||
    preview.closureCheck.incompleteChecklistItems.length > 0
  );
}

function inputSignature(works: readonly WorkProfile[]) {
  return JSON.stringify(
    works.map(({ id, revision, status }) => ({ id, revision, status })),
  );
}

function changedPreviewRecords(preview: BulkEditPreview | null) {
  return (
    preview?.records.filter(
      ({ work }) => work.status !== preview.targetStatus,
    ) ?? []
  );
}

function previewHasClosureWarnings(preview: BulkEditPreview | null) {
  return changedPreviewRecords(preview).some(
    ({ closePreview }) =>
      closePreview !== null && hasClosureWarnings(closePreview),
  );
}

function bulkEditPreviewMatchesInput({
  closureReason,
  closureResult,
  currentSignature,
  hasOperation,
  preview,
  targetStatus,
}: {
  closureReason: string;
  closureResult: WorkClosureResult;
  currentSignature: string;
  hasOperation: boolean;
  preview: BulkEditPreview | null;
  targetStatus: WorkStatus | "";
}) {
  if (hasOperation) {
    return true;
  }
  if (
    !preview ||
    preview.inputSignature !== currentSignature ||
    preview.targetStatus !== targetStatus
  ) {
    return false;
  }
  return (
    targetStatus !== "Closed" ||
    (preview.closureResult === closureResult &&
      preview.closureReason === (closureReason.trim() || null))
  );
}

async function applyStatusToWork(
  record: BulkEditRecordSnapshot,
  currentPreview: BulkEditPreview,
  onCloseOutcome: (outcome: UserInitiatedWorkCloseOutcome) => void,
) {
  const { closePreview, work } = record;
  const nextStatus = currentPreview.targetStatus;
  if (work.status === nextStatus) {
    return null;
  }
  const mutationEnvelope = {
    baseRevision: work.revision,
    clientIdempotencyKey: crypto.randomUUID(),
    workId: work.id,
  };
  if (nextStatus === "Closed") {
    const visibleAtCloseStart = document.visibilityState === "visible";
    let result: Awaited<ReturnType<typeof client.closeWork>>;
    try {
      result = await runOnlineOnlyWrite(() =>
        client.closeWork({
          ...mutationEnvelope,
          ...(closePreview && hasClosureWarnings(closePreview)
            ? { closureCheck: "Close anyway" as const }
            : {}),
          closureResult: currentPreview.closureResult,
          ...(currentPreview.closureReason
            ? { reason: currentPreview.closureReason }
            : {}),
        }),
      );
    } catch (error) {
      if (currentPreview.closureResult === "Completed") {
        onCloseOutcome({
          clientIdempotencyKey: mutationEnvelope.clientIdempotencyKey,
          closureResult: currentPreview.closureResult,
          kind: "failed",
          workId: work.id,
        });
      }
      throw error;
    }
    if (result.closureResult === "Completed" && work.status !== "Closed") {
      onCloseOutcome({
        clientIdempotencyKey: mutationEnvelope.clientIdempotencyKey,
        kind: "completed",
        reopenStatus: work.status as WorkOpenStatus,
        visibleAtCloseStart,
        workId: work.id,
      });
    }
    return result.receiptId;
  }
  if (work.status === "Closed") {
    const result = await runOnlineOnlyWrite(() =>
      client.reopenWork({
        ...mutationEnvelope,
        confirmed: true,
        status: nextStatus as WorkOpenStatus,
      }),
    );
    return result.receiptId;
  }
  const result = await runOnlineOnlyWrite(() =>
    client.updateWorkStatus({ ...mutationEnvelope, status: nextStatus }),
  );
  return result.receiptId;
}

async function refreshBulkEditQueries(
  queryClient: QueryClient,
  {
    archived,
    projectId,
    records,
  }: {
    archived: boolean;
    projectId: string;
    records: readonly BulkEditRecordSnapshot[];
  },
) {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: projectWorksQueryPrefix }),
    queryClient.invalidateQueries({
      queryKey: orpc.projectWorks.queryOptions({
        input: { archived, projectId },
      }).queryKey,
    }),
    queryClient.invalidateQueries({
      queryKey: orpc.scopeTree.queryOptions({
        input: { projectId },
      }).queryKey,
    }),
    ...records.map(({ work }) =>
      queryClient.invalidateQueries({
        queryKey: orpc.work.queryOptions({
          input: { workId: work.id },
        }).queryKey,
      }),
    ),
  ]);
}

async function buildBulkEditPreview({
  closureReason,
  closureResult,
  selectedWorks,
  targetStatus,
}: {
  closureReason: string;
  closureResult: WorkClosureResult;
  selectedWorks: readonly WorkProfile[];
  targetStatus: WorkStatus;
}): Promise<BulkEditPreview> {
  const closePreviews = new Map<string, WorkClosePreview>();
  if (targetStatus === "Closed") {
    const worksToClose = selectedWorks.filter(
      (work) => work.status !== "Closed",
    );
    const previews = await Promise.all(
      worksToClose.map(
        async (work) =>
          [
            work.id,
            await client.workClosePreview({ workId: work.id }),
          ] as const,
      ),
    );
    for (const [workId, closePreview] of previews) {
      closePreviews.set(workId, closePreview);
    }
  }
  return {
    closureReason: closureReason.trim() || null,
    closureResult,
    inputSignature: inputSignature(selectedWorks),
    records: selectedWorks.map((work) => ({
      closePreview: closePreviews.get(work.id) ?? null,
      work,
    })),
    targetStatus,
  };
}

async function runBulkEditOperation({
  archived,
  operationId,
  onCloseOutcome,
  preview,
  projectId,
  queryClient,
}: {
  archived: boolean;
  operationId: string;
  onCloseOutcome: (outcome: UserInitiatedWorkCloseOutcome) => void;
  preview: BulkEditPreview;
  projectId: string;
  queryClient: QueryClient;
}) {
  async function applyNextRecord(): Promise<void> {
    const recordIndex = claimBulkEditRecord(operationId);
    if (recordIndex === null) {
      return;
    }
    const record = preview.records[recordIndex];
    if (record) {
      try {
        const receiptId = await applyStatusToWork(
          record,
          preview,
          onCloseOutcome,
        );
        recordBulkEditResult(operationId, recordIndex, {
          key: record.work.key,
          ...(receiptId ? { receiptId } : {}),
          status: "Succeeded",
          workId: record.work.id,
        });
      } catch (error) {
        recordBulkEditResult(operationId, recordIndex, {
          failure: buildSupportReferenceFailure(error, { kind: "mutation" }),
          key: record.work.key,
          status: "Failed",
          workId: record.work.id,
        });
      }
    }
    await applyNextRecord();
  }

  try {
    await Promise.all(
      Array.from(
        { length: Math.min(BULK_EDIT_CONCURRENCY, preview.records.length) },
        () => applyNextRecord(),
      ),
    );
    await refreshBulkEditQueries(queryClient, {
      archived,
      projectId,
      records: preview.records,
    });
  } finally {
    completeBulkEditOperation(operationId);
  }
}

async function undoBulkEditResult(
  result: BulkEditResult,
  operation: BulkEditOperation,
  queryClient: QueryClient,
) {
  if (!result.receiptId) {
    return;
  }
  const recordIndex = operation.preview.records.findIndex(
    ({ work }) => work.id === result.workId,
  );
  if (recordIndex < 0) {
    return;
  }
  updateBulkEditOperation(operation.id, (current) => {
    const nextResults = [...current.results];
    const currentResult = nextResults[recordIndex];
    if (!currentResult) {
      return current;
    }
    nextResults[recordIndex] = {
      ...currentResult,
      undoError: undefined,
      undoAttempts: (currentResult.undoAttempts ?? 0) + 1,
      undoing: true,
    };
    return { ...current, results: nextResults };
  });
  try {
    const currentWork = await client.work({ workId: result.workId });
    await runOnlineOnlyWrite(() =>
      client.undoWorkStatus({
        baseRevision: currentWork.revision,
        clientIdempotencyKey: crypto.randomUUID(),
        receiptId: result.receiptId as string,
        workId: result.workId,
      }),
    );
    await refreshBulkEditQueries(queryClient, {
      archived: operation.archived,
      projectId: operation.projectId,
      records: operation.preview.records,
    });
    updateBulkEditOperation(operation.id, (current) => {
      const nextResults = [...current.results];
      const currentResult = nextResults[recordIndex];
      if (!currentResult) {
        return current;
      }
      nextResults[recordIndex] = {
        key: currentResult.key,
        status: "Undone",
        workId: currentResult.workId,
      };
      return { ...current, results: nextResults };
    });
  } catch (error) {
    updateBulkEditOperation(operation.id, (current) => {
      const nextResults = [...current.results];
      const currentResult = nextResults[recordIndex];
      if (!currentResult) {
        return current;
      }
      const failure = buildSupportReferenceFailure(error, {
        kind: "mutation",
        retryCount: Math.max(0, (currentResult.undoAttempts ?? 1) - 1),
      });
      nextResults[recordIndex] = {
        ...currentResult,
        undoError: failure,
        undoing: false,
      };
      return { ...current, results: nextResults };
    });
  }
}

function BulkEditStatusFields({
  closureReason,
  closureResult,
  disabled,
  onClosureReasonChange,
  onClosureResultChange,
  onStatusChange,
  status,
  workStatusLabels,
}: {
  closureReason: string;
  closureResult: WorkClosureResult;
  disabled: boolean;
  onClosureReasonChange: (reason: string) => void;
  onClosureResultChange: (result: WorkClosureResult) => void;
  onStatusChange: (status: WorkStatus | "") => void;
  status: WorkStatus | "";
  workStatusLabels: readonly WorkStatusLabel[];
}) {
  return (
    <>
      <Field>
        <FieldLabel htmlFor="bulk-edit-status">Status</FieldLabel>
        <NativeSelect
          aria-label="Status"
          disabled={disabled}
          id="bulk-edit-status"
          onChange={(event) =>
            onStatusChange(event.target.value as WorkStatus | "")
          }
          value={status}
        >
          <NativeSelectOption value="">Select status</NativeSelectOption>
          {WORK_STATUS_OPTIONS.map((workStatus) => (
            <NativeSelectOption key={workStatus} value={workStatus}>
              {getWorkStatusLabel(workStatus, workStatusLabels)}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </Field>

      {status === "Closed" ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="bulk-edit-closure-result">
              Closure result
            </FieldLabel>
            <NativeSelect
              aria-label="Closure result"
              disabled={disabled}
              id="bulk-edit-closure-result"
              onChange={(event) =>
                onClosureResultChange(event.target.value as WorkClosureResult)
              }
              value={closureResult}
            >
              {WORK_CLOSURE_RESULT_OPTIONS.map((result) => (
                <NativeSelectOption key={result} value={result}>
                  {result}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </Field>
          <Field>
            <FieldLabel htmlFor="bulk-edit-reason">Reason</FieldLabel>
            <Textarea
              aria-label="Reason"
              disabled={disabled}
              id="bulk-edit-reason"
              maxLength={2000}
              onChange={(event) => onClosureReasonChange(event.target.value)}
              value={closureReason}
            />
          </Field>
        </div>
      ) : null}
    </>
  );
}

function BulkEditPreviewSection({
  preview,
  needsRefresh,
  workStatusLabels,
}: {
  needsRefresh: boolean;
  preview: BulkEditPreview | null;
  workStatusLabels: readonly WorkStatusLabel[];
}) {
  if (!preview) {
    return null;
  }
  const changedRecords = preview.records.filter(
    ({ work }) => work.status !== preview.targetStatus,
  );
  return (
    <section aria-label="Preview" className="space-y-3">
      <h3 className="font-medium text-sm">Preview</h3>
      {needsRefresh ? (
        <p className="text-muted-foreground text-xs">
          Preview again before applying these changes.
        </p>
      ) : null}
      {changedRecords.length === 0 ? (
        <p className="text-muted-foreground text-xs">No changes to apply.</p>
      ) : (
        <ul className="max-h-64 space-y-2 overflow-y-auto rounded-md border p-3">
          {changedRecords.map(({ closePreview, work }) => (
            <li className="space-y-1 text-xs" key={work.id}>
              <p className="font-medium">
                {work.key} · {work.title}
              </p>
              <p className="text-muted-foreground">
                {getWorkStatusLabel(work.status, workStatusLabels)} →{" "}
                {getWorkStatusLabel(preview.targetStatus, workStatusLabels)}
              </p>
              {preview.targetStatus === "Closed" ? (
                <p>Closure result: {preview.closureResult}</p>
              ) : null}
              {closePreview && hasClosureWarnings(closePreview) ? (
                <div className="space-y-1 border-amber-500/50 border-l-2 pl-2">
                  <p className="font-medium">Closure check</p>
                  <ul className="list-disc space-y-1 pl-4 text-muted-foreground">
                    {closePreview.closureCheck.incompleteChecklistItems.map(
                      (item) => (
                        <li key={item.id}>{item.label}</li>
                      ),
                    )}
                    {closePreview.closureCheck.activeBlockers.map((item) => (
                      <li key={item.id}>{item.label}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function BulkEditProgressSection({
  operation,
  progress,
  queryClient,
  results,
  connection,
}: {
  connection: ReturnType<typeof useClientShellConnection>;
  operation: BulkEditOperation | undefined;
  progress: { completed: number; total: number } | null;
  queryClient: QueryClient;
  results: BulkEditResult[] | null;
}) {
  if (!progress) {
    return null;
  }
  return (
    <>
      <div aria-label="Progress" className="space-y-2" role="status">
        <p className="font-medium">Progress</p>
        <progress
          aria-label="Progress"
          className="w-full accent-primary"
          max={progress.total}
          value={progress.completed}
        />
        <ul aria-label="Bulk Edit results" className="space-y-1">
          {results?.map((result) => (
            <li className="space-y-1 text-xs" key={result.workId}>
              <p>
                <span className="font-medium">{result.key}</span>:{" "}
                {result.status}
              </p>
              {result.failure ? (
                <div className="space-y-1 text-destructive">
                  <p>{result.failure.reason}</p>
                  <SupportReferenceNotice failure={result.failure} />
                </div>
              ) : null}
              {result.undoError ? (
                <div className="space-y-1 text-destructive">
                  <p>{result.undoError.reason}</p>
                  <SupportReferenceNotice failure={result.undoError} />
                </div>
              ) : null}
              {operation &&
              result.status === "Succeeded" &&
              result.receiptId &&
              (!result.undoError || result.undoError.canRetry) ? (
                <Button
                  disabled={connection === "offline" || result.undoing}
                  onClick={() => {
                    if (operation) {
                      undoBulkEditResult(result, operation, queryClient);
                    }
                  }}
                  size="xs"
                  type="button"
                  variant="outline"
                >
                  Undo
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      </div>
      {operation?.phase === "finalizing" ? (
        <p className="font-medium text-sm" role="status">
          Finalizing
        </p>
      ) : null}
    </>
  );
}

function closeBulkEditDialog(
  nextOpen: boolean,
  operation: BulkEditOperation | undefined,
  onOpenChange: (open: boolean) => void,
  resetForm: () => void,
) {
  if (nextOpen) {
    onOpenChange(true);
    return;
  }
  if (operation?.phase === "applying") {
    cancelBulkEditOperation(operation.id);
    return;
  }
  if (operation && operation.phase !== "complete") {
    return;
  }
  if (operation) {
    removeBulkEditOperation(operation.id);
  }
  resetForm();
  onOpenChange(false);
}

export default function BulkEditDialog({
  archived,
  onCloseOutcome,
  onOpenChange,
  open,
  projectId,
  selectedWorks,
  workStatusLabels,
}: {
  archived: boolean;
  onCloseOutcome: (outcome: UserInitiatedWorkCloseOutcome) => void;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  projectId: string;
  selectedWorks: readonly WorkProfile[];
  workStatusLabels: readonly WorkStatusLabel[];
}) {
  const connection = useClientShellConnection();
  const queryClient = useQueryClient();
  const operationState = useStore(bulkEditOperationStore);
  const operation = operationState.operations
    .filter((candidate) => candidate.projectId === projectId)
    .at(-1);
  const [targetStatus, setTargetStatus] = useState<WorkStatus | "">("");
  const [closureResult, setClosureResult] =
    useState<WorkClosureResult>("Completed");
  const [closureReason, setClosureReason] = useState("");
  const [preview, setPreview] = useState<BulkEditPreview | null>(null);
  const [previewError, setPreviewError] =
    useState<SupportReferenceFailure | null>(null);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [progress, setProgress] = useState<{
    completed: number;
    total: number;
  } | null>(null);
  const [results, setResults] = useState<BulkEditResult[] | null>(null);
  const displayedTargetStatus = operation?.preview.targetStatus ?? targetStatus;
  const displayedClosureResult =
    operation?.preview.closureResult ?? closureResult;
  const displayedClosureReason =
    operation?.preview.closureReason ?? closureReason;
  const displayedPreview = operation?.preview ?? preview;
  const displayedResults = operation
    ? operation.results.filter(
        (result): result is BulkEditResult => result !== null,
      )
    : results;
  const displayedProgress = operation
    ? {
        completed: operation.completed,
        total: operation.preview.records.length,
      }
    : progress;
  const currentSignature = useMemo(
    () => inputSignature(selectedWorks),
    [selectedWorks],
  );
  const previewMatchesCurrentInput = bulkEditPreviewMatchesInput({
    closureReason,
    closureResult,
    currentSignature,
    hasOperation: operation !== undefined,
    preview,
    targetStatus,
  });
  const changedRecords = changedPreviewRecords(displayedPreview);
  const hasWarnings = previewHasClosureWarnings(displayedPreview);

  function resetForm() {
    setTargetStatus("");
    setClosureResult("Completed");
    setClosureReason("");
    setPreview(null);
    setPreviewError(null);
    setProgress(null);
    setResults(null);
  }

  function handleOpenChange(nextOpen: boolean) {
    closeBulkEditDialog(nextOpen, operation, onOpenChange, resetForm);
  }

  async function buildPreview() {
    if (!targetStatus || selectedWorks.length === 0) {
      return;
    }
    setPreviewError(null);
    setIsPreviewing(true);
    setResults(null);
    setProgress(null);
    try {
      setPreview(
        await buildBulkEditPreview({
          closureReason,
          closureResult,
          selectedWorks,
          targetStatus,
        }),
      );
    } catch (error) {
      setPreview(null);
      setPreviewError(buildSupportReferenceFailure(error, { kind: "query" }));
    } finally {
      setIsPreviewing(false);
    }
  }

  function apply() {
    if (
      preview === null ||
      !previewMatchesCurrentInput ||
      changedRecords.length === 0
    ) {
      return;
    }
    const previewToApply = preview;
    const operationId = crypto.randomUUID();
    setPreviewError(null);
    setResults([]);
    setProgress({ completed: 0, total: previewToApply.records.length });
    startBulkEditOperation({
      archived,
      id: operationId,
      phase: "applying",
      preview: previewToApply,
      projectId,
    });
    runBulkEditOperation({
      archived,
      operationId,
      onCloseOutcome,
      preview: previewToApply,
      projectId,
      queryClient,
    }).catch(() => completeBulkEditOperation(operationId));
  }

  function changeStatus(status: WorkStatus | "") {
    setTargetStatus(status);
    setPreviewError(null);
    setProgress(null);
    setResults(null);
  }

  function changeClosureResult(result: WorkClosureResult) {
    setClosureResult(result);
    setProgress(null);
    setResults(null);
  }

  function changeClosureReason(reason: string) {
    setClosureReason(reason);
    setProgress(null);
    setResults(null);
  }

  return (
    <Dialog
      onOpenChange={handleOpenChange}
      open={open || operation !== undefined}
    >
      <DialogContent
        className="max-h-[85vh] max-w-2xl overflow-y-auto"
        showCloseButton={false}
      >
        <DialogHeader>
          <DialogTitle>Bulk Edit</DialogTitle>
          <DialogDescription>
            Update the Status on{" "}
            {operation?.preview.records.length ?? selectedWorks.length} selected
            Work records. Only selected Work will be changed.
          </DialogDescription>
        </DialogHeader>

        <BulkEditStatusFields
          closureReason={displayedClosureReason}
          closureResult={displayedClosureResult}
          disabled={operation !== undefined}
          onClosureReasonChange={changeClosureReason}
          onClosureResultChange={changeClosureResult}
          onStatusChange={changeStatus}
          status={displayedTargetStatus}
          workStatusLabels={workStatusLabels}
        />

        <BulkEditPreviewSection
          needsRefresh={
            displayedResults === null && !previewMatchesCurrentInput
          }
          preview={displayedPreview}
          workStatusLabels={workStatusLabels}
        />

        {previewError ? (
          <div className="space-y-1 text-sm">
            <p className="text-destructive" role="alert">
              {previewError.reason}
            </p>
            <SupportReferenceNotice failure={previewError} />
          </div>
        ) : null}

        <BulkEditProgressSection
          connection={connection}
          operation={operation}
          progress={displayedProgress}
          queryClient={queryClient}
          results={displayedResults}
        />

        <DialogFooter>
          <Button
            disabled={operation?.phase === "finalizing"}
            onClick={() => handleOpenChange(false)}
            type="button"
            variant="outline"
          >
            {operation?.phase === "finalizing" ? "Finalizing" : "Cancel"}
          </Button>
          <Button
            disabled={
              connection === "offline" ||
              isPreviewing ||
              operation !== undefined ||
              !targetStatus
            }
            onClick={buildPreview}
            type="button"
            variant="outline"
          >
            Preview
          </Button>
          {displayedPreview ? (
            <Button
              disabled={
                connection === "offline" ||
                operation !== undefined ||
                isPreviewing ||
                !previewMatchesCurrentInput ||
                changedRecords.length === 0 ||
                displayedResults !== null
              }
              onClick={apply}
              type="button"
            >
              {hasWarnings ? "Close anyway" : "Apply"}
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
