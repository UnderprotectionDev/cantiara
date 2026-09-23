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
import { useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useClientShellConnection } from "@/features/web-macos-client/hooks/use-client-shell";
import { runOnlineOnlyWrite } from "@/features/web-macos-client/store/client-shell";
import { getWorkStatusLabel } from "@/features/work-lifecycle/ui/forms/work-status-form";
import { client, orpc, projectWorksQueryPrefix } from "@/utils/orpc";

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

interface BulkEditRecordSnapshot {
  closePreview: WorkClosePreview | null;
  work: WorkProfile;
}

interface BulkEditPreview {
  closureReason: string | null;
  closureResult: WorkClosureResult;
  inputSignature: string;
  records: BulkEditRecordSnapshot[];
  targetStatus: WorkStatus;
}

interface BulkEditResult {
  key: string;
  message?: string;
  status: "Failed" | "Succeeded";
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

function mutationErrorMessage(error: unknown) {
  return error instanceof Error && error.message
    ? error.message
    : "Work could not be updated. Try again.";
}

export default function BulkEditDialog({
  archived,
  onOpenChange,
  open,
  projectId,
  selectedWorks,
  workStatusLabels,
}: {
  archived: boolean;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  projectId: string;
  selectedWorks: readonly WorkProfile[];
  workStatusLabels: readonly WorkStatusLabel[];
}) {
  const connection = useClientShellConnection();
  const queryClient = useQueryClient();
  const [targetStatus, setTargetStatus] = useState<WorkStatus | "">("");
  const [closureResult, setClosureResult] =
    useState<WorkClosureResult>("Completed");
  const [closureReason, setClosureReason] = useState("");
  const [preview, setPreview] = useState<BulkEditPreview | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [progress, setProgress] = useState<{
    completed: number;
    total: number;
  } | null>(null);
  const [results, setResults] = useState<BulkEditResult[] | null>(null);
  const currentSignature = useMemo(
    () => inputSignature(selectedWorks),
    [selectedWorks],
  );
  const previewMatchesCurrentInput =
    preview !== null &&
    preview.inputSignature === currentSignature &&
    preview.targetStatus === targetStatus &&
    (targetStatus !== "Closed" ||
      (preview.closureResult === closureResult &&
        preview.closureReason === (closureReason.trim() || null)));
  const changedRecords =
    preview?.records.filter(
      ({ work }) => work.status !== preview.targetStatus,
    ) ?? [];
  const hasWarnings = changedRecords.some(
    ({ closePreview }) =>
      closePreview !== null && hasClosureWarnings(closePreview),
  );

  function handleOpenChange(nextOpen: boolean) {
    if (isApplying) {
      return;
    }
    if (!nextOpen) {
      setTargetStatus("");
      setClosureResult("Completed");
      setClosureReason("");
      setPreview(null);
      setPreviewError(null);
      setProgress(null);
      setResults(null);
    }
    onOpenChange(nextOpen);
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
      setPreview({
        closureReason: closureReason.trim() || null,
        closureResult,
        inputSignature: inputSignature(selectedWorks),
        records: selectedWorks.map((work) => ({
          closePreview: closePreviews.get(work.id) ?? null,
          work,
        })),
        targetStatus,
      });
    } catch (error) {
      setPreview(null);
      setPreviewError(mutationErrorMessage(error));
    } finally {
      setIsPreviewing(false);
    }
  }

  async function applyStatusToWork(
    record: BulkEditRecordSnapshot,
    currentPreview: BulkEditPreview,
  ) {
    const { closePreview, work } = record;
    const nextStatus = currentPreview.targetStatus;
    if (work.status === nextStatus) {
      return;
    }
    const mutationEnvelope = {
      baseRevision: work.revision,
      clientIdempotencyKey: crypto.randomUUID(),
      workId: work.id,
    };
    if (nextStatus === "Closed") {
      if (work.status !== "Closed") {
        await runOnlineOnlyWrite(() =>
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
      }
      return;
    }
    if (work.status === "Closed") {
      await runOnlineOnlyWrite(() =>
        client.reopenWork({
          ...mutationEnvelope,
          confirmed: true,
          status: nextStatus as WorkOpenStatus,
        }),
      );
      return;
    }
    await runOnlineOnlyWrite(() =>
      client.updateWorkStatus({ ...mutationEnvelope, status: nextStatus }),
    );
  }

  async function apply() {
    if (
      preview === null ||
      !previewMatchesCurrentInput ||
      changedRecords.length === 0
    ) {
      return;
    }
    const previewToApply = preview;
    setPreviewError(null);
    setResults([]);
    setProgress({ completed: 0, total: previewToApply.records.length });
    setIsApplying(true);
    const nextResults: Array<BulkEditResult | undefined> = Array.from(
      { length: previewToApply.records.length },
      () => undefined,
    );
    let nextRecordIndex = 0;
    let completed = 0;

    async function applyNextRecord(): Promise<void> {
      const recordIndex = nextRecordIndex;
      nextRecordIndex += 1;
      const record = previewToApply.records[recordIndex];
      if (!record) {
        return;
      }
      try {
        await applyStatusToWork(record, previewToApply);
        nextResults[recordIndex] = {
          key: record.work.key,
          status: "Succeeded",
        };
      } catch (error) {
        nextResults[recordIndex] = {
          key: record.work.key,
          message: mutationErrorMessage(error),
          status: "Failed",
        };
      }
      completed += 1;
      setResults(
        nextResults.filter(
          (result): result is BulkEditResult => result !== undefined,
        ),
      );
      setProgress({ completed, total: previewToApply.records.length });
      await applyNextRecord();
    }

    try {
      await Promise.all(
        Array.from(
          {
            length: Math.min(
              BULK_EDIT_CONCURRENCY,
              previewToApply.records.length,
            ),
          },
          () => applyNextRecord(),
        ),
      );
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
        ...previewToApply.records.map(({ work }) =>
          queryClient.invalidateQueries({
            queryKey: orpc.work.queryOptions({
              input: { workId: work.id },
            }).queryKey,
          }),
        ),
      ]);
    } finally {
      setIsApplying(false);
    }
  }

  return (
    <Dialog onOpenChange={handleOpenChange} open={open}>
      <DialogContent
        className="max-h-[85vh] max-w-2xl overflow-y-auto"
        showCloseButton={false}
      >
        <DialogHeader>
          <DialogTitle>Bulk Edit</DialogTitle>
          <DialogDescription>
            Update the Status on {selectedWorks.length} selected Work records.
            Only selected Work will be changed.
          </DialogDescription>
        </DialogHeader>

        <Field>
          <FieldLabel htmlFor="bulk-edit-status">Status</FieldLabel>
          <NativeSelect
            aria-label="Status"
            disabled={isApplying}
            id="bulk-edit-status"
            onChange={(event) => {
              setTargetStatus(event.target.value as WorkStatus | "");
              setPreviewError(null);
              setProgress(null);
              setResults(null);
            }}
            value={targetStatus}
          >
            <NativeSelectOption value="">Select status</NativeSelectOption>
            {WORK_STATUS_OPTIONS.map((status) => (
              <NativeSelectOption key={status} value={status}>
                {getWorkStatusLabel(status, workStatusLabels)}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </Field>

        {targetStatus === "Closed" ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="bulk-edit-closure-result">
                Closure result
              </FieldLabel>
              <NativeSelect
                aria-label="Closure result"
                disabled={isApplying}
                id="bulk-edit-closure-result"
                onChange={(event) => {
                  setClosureResult(event.target.value as WorkClosureResult);
                  setProgress(null);
                  setResults(null);
                }}
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
                disabled={isApplying}
                id="bulk-edit-reason"
                maxLength={2000}
                onChange={(event) => {
                  setClosureReason(event.target.value);
                  setProgress(null);
                  setResults(null);
                }}
                value={closureReason}
              />
            </Field>
          </div>
        ) : null}

        {preview ? (
          <section aria-label="Preview" className="space-y-3">
            <h3 className="font-medium text-sm">Preview</h3>
            {results === null && !previewMatchesCurrentInput ? (
              <p className="text-muted-foreground text-xs">
                Preview again before applying these changes.
              </p>
            ) : null}
            {changedRecords.length === 0 ? (
              <p className="text-muted-foreground text-xs">
                No changes to apply.
              </p>
            ) : (
              <ul className="max-h-64 space-y-2 overflow-y-auto rounded-md border p-3">
                {changedRecords.map(({ closePreview, work }) => (
                  <li className="space-y-1 text-xs" key={work.id}>
                    <p className="font-medium">
                      {work.key} · {work.title}
                    </p>
                    <p className="text-muted-foreground">
                      {getWorkStatusLabel(work.status, workStatusLabels)} →{" "}
                      {getWorkStatusLabel(
                        preview.targetStatus,
                        workStatusLabels,
                      )}
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
                          {closePreview.closureCheck.activeBlockers.map(
                            (item) => (
                              <li key={item.id}>{item.label}</li>
                            ),
                          )}
                        </ul>
                      </div>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </section>
        ) : null}

        {previewError ? (
          <p className="text-destructive text-sm" role="alert">
            {previewError}
          </p>
        ) : null}

        {progress ? (
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
                <li className="text-xs" key={result.key}>
                  <span className="font-medium">{result.key}</span>:{" "}
                  {result.status}
                  {result.message ? (
                    <span className="ml-2 text-destructive">
                      {result.message}
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <DialogFooter>
          <Button
            disabled={isApplying}
            onClick={() => handleOpenChange(false)}
            type="button"
            variant="outline"
          >
            Cancel
          </Button>
          <Button
            disabled={
              connection === "offline" ||
              isPreviewing ||
              isApplying ||
              !targetStatus
            }
            onClick={buildPreview}
            type="button"
            variant="outline"
          >
            Preview
          </Button>
          {preview ? (
            <Button
              disabled={
                connection === "offline" ||
                isApplying ||
                isPreviewing ||
                !previewMatchesCurrentInput ||
                changedRecords.length === 0 ||
                results !== null
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
