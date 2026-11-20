// biome-ignore-all lint/performance/noJsxPropsBind: Work type controls close over their current Work state.

import type { AccountPreferences } from "@cantiara/api/account-preferences";
import type { CompletionEffectsPreferences } from "@cantiara/api/completion-effects";
import type {
  ProjectShellConfiguration,
  WorkStatusLabel,
} from "@cantiara/api/project-shell";
import {
  WORK_TYPE_OPTIONS,
  type WorkMergeResult,
  type WorkProfile,
  type WorkType,
} from "@cantiara/api/work-lifecycle";
import { Button } from "@cantiara/ui/components/button";
import {
  NativeSelect,
  NativeSelectOption,
} from "@cantiara/ui/components/native-select";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "@tanstack/react-router";
import { useSelector } from "@tanstack/react-store";
import { useEffect, useRef, useState } from "react";
import ActiveWorkingSetControl from "@/components/active-working-set-control";
import { ExportListAction } from "@/components/export-list-action";
import FavoriteControl from "@/components/favorite-control";
import WorkStatusForm, {
  type WorkStatusActionRequest,
} from "@/components/work-status-form";
import { useBulkWorkSelection } from "@/features/bulk-editing/hooks/use-bulk-work-selection";
import BulkEditDialog, {
  WorkSelectionCheckbox,
} from "@/features/bulk-editing/ui/components/bulk-edit-dialog";
import useUserInitiatedWorkSuccess, {
  type UserInitiatedWorkCloseOutcome,
} from "@/features/completion-effects/hooks/use-user-initiated-work-success";
import { customFieldItemsForRecord } from "@/features/custom-fields/lib/custom-field-record-items";
import CustomFieldValuesForm from "@/features/custom-fields/ui/components/custom-field-values-form";
import {
  groupRecordIdsByType,
  scopeForProjects,
  WORK_LIST_EXPORT_FIELDS,
} from "@/features/data-export/lib/export-handoff";
import EvidenceFlowPanel from "@/features/evidence/ui/components/evidence-flow-panel";
import ExternalExecutionHandoff from "@/features/external-handoffs/ui/components/external-execution-handoff";
import WorkReviewLaterControl from "@/features/personal-reminders/ui/components/work-review-later-control";
import {
  priorityMetricItemsForWork,
  usePriorityMetricProjectValues,
} from "@/features/priority-metrics/hooks/use-priority-metrics";
import PriorityMetricValuesForm from "@/features/priority-metrics/ui/components/priority-metric-values-form";
import { useRecordActionRunner } from "@/features/record-actions/hooks/use-record-action-runner";
import {
  RecordActionButtons,
  RecordActionRunDialog,
} from "@/features/record-actions/ui/components/record-action-runner";
import WorkRelations from "@/features/relations/ui/components/work-relations";
import WorkNotNowControl from "@/features/roadmap-horizon/ui/components/work-not-now-control";
import TestSummarySurface from "@/features/test-review/ui/components/test-summary-surface";
import { useClientShellConnection } from "@/features/web-macos-client/hooks/use-client-shell";
import WorkChecklistEditor from "@/features/work-checklists/ui/components/work-checklist-editor";
import WorkContextCard from "@/features/work-context/ui/components/work-context-card";
import WorkDuplicateAction from "@/features/work-templates/ui/components/work-duplicate-action";
import { commandVariables } from "@/lib/command-variables";
import { fetchCurrentWork } from "@/lib/fetch-current-work";
import { mutationErrorMessage } from "@/lib/mutation-messages";
import {
  client,
  completionEffectsPreferencesQueryOptions,
  invalidateSmartCollectionMembership,
  orpc,
  projectWorksQueryPrefix,
} from "@/utils/orpc";
import WorkMergeForm from "../forms/work-merge-form";
import WorkRecreateForm from "../forms/work-recreate-form";

export default function ProjectWorkList({
  accountId,
  accountFormattingPreferences,
  projectId,
  statusActionRequest,
  onStatusActionRequestHandled,
  workContextLayouts,
  workStatusLabels,
}: {
  accountId?: string;
  accountFormattingPreferences: AccountPreferences;
  projectId: string;
  statusActionRequest: WorkStatusActionRequest | null;
  onStatusActionRequestHandled: (requestId: string) => void;
  workContextLayouts: ProjectShellConfiguration["workContextLayouts"];
  workStatusLabels: readonly WorkStatusLabel[];
}) {
  const activeHash = useLocation({ select: ({ hash }) => hash });
  const handledWorkHash = useRef<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const bulkWorkSelection = useBulkWorkSelection();
  const [isBulkEditOpen, setIsBulkEditOpen] = useState(false);
  const [lastMergeResult, setLastMergeResult] =
    useState<WorkMergeResult | null>(null);
  const [mergeUndoError, setMergeUndoError] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const connection = useClientShellConnection();
  const query = useQuery(
    orpc.projectWorks.queryOptions({
      input: { archived: showArchived, projectId },
    }),
  );
  const completionEffectsPreferencesQuery = useQuery(
    completionEffectsPreferencesQueryOptions(accountId),
  );
  const completionEffectsPreferences: CompletionEffectsPreferences | null =
    completionEffectsPreferencesQuery.data ?? null;
  const completionFeedback = useUserInitiatedWorkSuccess({
    accountId,
    preferences: completionEffectsPreferences,
  });
  const recordActionRunner = useRecordActionRunner(projectId);
  const allProjectWorksQuery = useQuery(
    orpc.projectWorks.queryOptions({
      input: { archived: "all", projectId },
    }),
  );
  useEffect(() => {
    if (!allProjectWorksQuery.data) {
      return;
    }
    const workId = workIdFromHash(activeHash);
    const workHashKey = `${projectId}:${activeHash}`;
    if (!workId || handledWorkHash.current === workHashKey) {
      return;
    }
    handledWorkHash.current = workHashKey;
    const targetWork = allProjectWorksQuery.data.find(
      (work) => work.id === workId,
    );
    if (targetWork) {
      setShowArchived(targetWork.archivedAt !== null);
    }
  }, [activeHash, allProjectWorksQuery.data, projectId]);
  useEffect(() => {
    if (
      !activeHash ||
      query.isPending ||
      query.isError ||
      typeof window === "undefined" ||
      !query.data.some(
        (work) => `work-${encodeURIComponent(work.id)}` === activeHash,
      )
    ) {
      return;
    }
    const frame = window.requestAnimationFrame(() => {
      document.getElementById(activeHash)?.scrollIntoView({
        block: "start",
        behavior: "auto",
      });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [activeHash, query.data, query.isError, query.isPending]);
  // One Project-scoped read feeds every Work row's Custom field values; the
  // per-record form renders from these prefetched items without its own query.
  const customFieldValuesQuery = useQuery(
    orpc.customFieldProjectValues.queryOptions({
      input: { projectId, recordType: "Work" },
    }),
  );
  const priorityMetricValues = usePriorityMetricProjectValues(projectId);
  const undoMerge = useMutation(
    orpc.undoWorkMerge.mutationOptions({
      meta: { onlineWrite: true },
      mutationFn: (input) => client.undoWorkMerge(input),
      onError: (error) => {
        setMergeUndoError(
          mutationErrorMessage(error, "Work merge could not be undone."),
        );
      },
      onSuccess: async () => {
        setMergeUndoError(null);
        setLastMergeResult(null);
        await Promise.all([
          queryClient.invalidateQueries({
            queryKey: projectWorksQueryPrefix,
          }),
          queryClient.invalidateQueries({
            queryKey: orpc.projectWorks.queryOptions({
              input: { archived: false, projectId },
            }).queryKey,
          }),
          queryClient.invalidateQueries({
            queryKey: orpc.projectWorks.queryOptions({
              input: { archived: true, projectId },
            }).queryKey,
          }),
        ]);
      },
    }),
  );
  const preparingUndo = useRef(false);
  async function confirmUndoMerge() {
    if (!lastMergeResult || undoMerge.isPending || preparingUndo.current) {
      return;
    }
    preparingUndo.current = true;
    try {
      const failed = undoMerge.isError ? undoMerge.variables : undefined;
      if (failed?.mergeId === lastMergeResult.mergeId) {
        await undoMerge.mutateAsync(failed);
      } else {
        const work = await fetchCurrentWork(
          queryClient,
          lastMergeResult.work.id,
        );
        await undoMerge.mutateAsync(
          commandVariables({
            baseRevision: work.revision,
            mergeId: lastMergeResult.mergeId,
            survivingWorkId: work.id,
          }),
        );
      }
    } catch (error) {
      setMergeUndoError(
        mutationErrorMessage(error, "Work merge could not be undone."),
      );
    } finally {
      preparingUndo.current = false;
    }
  }

  if (query.status === "pending" || allProjectWorksQuery.isPending) {
    return <p className="mt-2 text-sm text-muted-foreground">Loading Work…</p>;
  }

  if (query.isError || allProjectWorksQuery.isError) {
    return (
      <p className="mt-2 text-sm text-destructive" role="alert">
        Work is unavailable. Try loading this page again.
      </p>
    );
  }

  return (
    <div className="mt-5 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/70 pb-3">
        <h3 className="text-sm font-medium">Work records</h3>
        <div className="flex flex-wrap items-center gap-3">
          <BulkEditSelectionControls
            archived={showArchived}
            onCloseOutcome={completionFeedback.handleCloseOutcome}
            onOpenChange={setIsBulkEditOpen}
            open={isBulkEditOpen}
            projectId={projectId}
            selection={bulkWorkSelection}
            workItems={query.data}
            workStatusLabels={workStatusLabels}
          />
          <Button
            aria-pressed={showArchived}
            onClick={() => {
              bulkWorkSelection.clearSelection();
              setIsBulkEditOpen(false);
              setShowArchived((current) => !current);
            }}
            size="sm"
            type="button"
            variant={showArchived ? "secondary" : "outline"}
          >
            Archived
          </Button>
        </div>
      </div>
      {recordActionRunner.actionsError ? (
        <p className="text-sm text-destructive" role="alert">
          Record Actions could not be loaded. Try loading this page again.
        </p>
      ) : null}
      {lastMergeResult ? (
        <div className="flex flex-wrap items-center gap-3 rounded-md border border-primary/25 bg-primary/5 px-3 py-2 text-sm text-muted-foreground">
          <p role="status">
            Origin: {lastMergeResult.retiredIdentity.key} →{" "}
            {lastMergeResult.work.key}
          </p>
          <Button
            disabled={undoMerge.isPending}
            onClick={confirmUndoMerge}
            size="xs"
            type="button"
            variant="outline"
          >
            Undo
          </Button>
          {mergeUndoError ? (
            <p className="text-xs text-destructive" role="alert">
              {mergeUndoError}
            </p>
          ) : null}
        </div>
      ) : null}
      {query.data.length === 0 ? (
        <p className="text-sm/relaxed text-muted-foreground">
          {showArchived ? "No archived Work." : "No Work yet."}
        </p>
      ) : (
        <ul aria-label={showArchived ? "Archived Work list" : "Work list"}>
          {query.data.map((work) => (
            <li
              className="relative isolate mb-3 grid gap-4 rounded-lg border border-border/70 bg-card/40 px-4 py-4 transition-colors last:mb-0 hover:bg-card"
              id={`work-${encodeURIComponent(work.id)}`}
              key={work.id}
            >
              <div className="flex min-w-0 flex-wrap items-start justify-between gap-4">
                <div className="flex min-w-0 items-start gap-3">
                  <WorkSelectionCheckbox
                    selection={bulkWorkSelection}
                    workId={work.id}
                    workKey={work.key}
                  />
                  <p className="min-w-0 text-sm font-medium">
                    <span className="text-muted-foreground">{work.key}</span>{" "}
                    {work.title}
                  </p>
                </div>
                <div className="flex shrink-0 flex-wrap items-center gap-2">
                  <FavoriteControl
                    sourceRecordId={work.id}
                    sourceRecordType="Work"
                  />
                  <WorkReviewLaterControl work={work} />
                  <WorkNotNowControl work={work} />
                  <ActiveWorkingSetControl
                    archived={work.archivedAt !== null}
                    member={{
                      id: work.id,
                      kind: "Work",
                      label: `${work.key} ${work.title}`,
                      projectId,
                    }}
                  />
                </div>
              </div>
              <WorkContextCard
                projectWorks={allProjectWorksQuery.data ?? query.data}
                work={work}
                workContextLayouts={workContextLayouts}
                workStatusLabels={workStatusLabels}
              />
              <ExternalExecutionHandoff work={work} />
              <EvidenceFlowPanel
                projectId={projectId}
                recordId={work.id}
                type="Work"
              />
              {priorityMetricValues.query.isError ? (
                <p className="text-sm text-destructive" role="alert">
                  Priority metrics are unavailable. Try loading this page again.
                </p>
              ) : null}
              <PriorityMetricValuesForm
                items={priorityMetricItemsForWork(
                  priorityMetricValues.query.data,
                  work.id,
                )}
                projectId={projectId}
                workId={work.id}
                workKey={work.key}
              />
              <WorkChecklistEditor work={work} />
              <CustomFieldValues
                connection={connection}
                error={customFieldValuesQuery.isError}
                formattingPreferences={accountFormattingPreferences}
                items={
                  customFieldValuesQuery.data
                    ? customFieldItemsForRecord(
                        customFieldValuesQuery.data,
                        work.id,
                      )
                    : undefined
                }
                work={work}
              />
              <WorkRelations
                candidates={query.data.filter(
                  (candidate) => candidate.id !== work.id,
                )}
                formattingPreferences={accountFormattingPreferences}
                work={work}
              />
              {work.type === "Feature" ? (
                <TestSummarySurface
                  projectId={projectId}
                  scope={{ id: work.id, kind: "Feature" }}
                />
              ) : null}
              <div className="flex flex-wrap items-end gap-x-4 gap-y-3 border-t border-border/70 pt-3">
                {work.recreatedFrom ? (
                  <p className="basis-full text-xs text-muted-foreground">
                    Origin: {work.recreatedFrom.key}
                  </p>
                ) : null}
                <div className="flex flex-wrap items-end gap-3">
                  <WorkTypeEditor work={work} />
                  <WorkStatusForm
                    completionFeedback={completionFeedback.feedbackFor(work.id)}
                    onCloseOutcome={completionFeedback.handleCloseOutcome}
                    onRequestedStatusActionHandled={
                      onStatusActionRequestHandled
                    }
                    requestedStatusAction={
                      statusActionRequest?.workId === work.id
                        ? {
                            id: statusActionRequest.id,
                            status: statusActionRequest.status,
                          }
                        : null
                    }
                    work={work}
                    workStatusLabels={workStatusLabels}
                  />
                  <RecordActionButtons
                    actions={recordActionRunner.actions}
                    disabled={
                      connection === "offline" ||
                      work.archivedAt !== null ||
                      recordActionRunner.isPreviewing ||
                      recordActionRunner.isApplying ||
                      recordActionRunner.isUndoing
                    }
                    onStart={recordActionRunner.start}
                    work={work}
                  />
                </div>
                <div className="flex basis-full flex-wrap items-center gap-2 border-t border-border/70 pt-3 sm:basis-auto sm:border-t-0 sm:border-l sm:pt-0 sm:pl-4">
                  <WorkArchiveAction work={work} />
                  <WorkDuplicateAction work={work} />
                  <WorkMergeForm
                    candidates={query.data.filter(
                      (candidate) => candidate.id !== work.id,
                    )}
                    onMerged={setLastMergeResult}
                    work={work}
                  />
                  <WorkRecreateForm work={work} />
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
      <RecordActionRunDialog runner={recordActionRunner} />
    </div>
  );
}

function BulkEditSelectionControls({
  archived,
  onCloseOutcome,
  onOpenChange,
  open,
  projectId,
  selection,
  workItems,
  workStatusLabels,
}: {
  archived: boolean;
  onCloseOutcome: (outcome: UserInitiatedWorkCloseOutcome) => void;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  projectId: string;
  selection: ReturnType<typeof useBulkWorkSelection>;
  workItems: readonly WorkProfile[];
  workStatusLabels: readonly WorkStatusLabel[];
}) {
  const selectedWorkIds = useSelector(
    selection.store,
    (state) => state.selectedWorkIds,
  );
  const selectedWorks = workItems.filter((work) =>
    selectedWorkIds.has(work.id),
  );
  // The selection, or else every record the list shows, with its columns.
  const exportedWorks = selectedWorks.length > 0 ? selectedWorks : workItems;

  return (
    <>
      {selectedWorks.length > 0 ? (
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">
            {selectedWorks.length} selected
          </span>
          <Button onClick={() => onOpenChange(true)} size="sm" type="button">
            Bulk Edit
          </Button>
        </div>
      ) : null}
      <ExportListAction
        describe={() => ({
          filters: {},
          listedIds: exportedWorks.map((work) => work.id),
          recordIdsByType: groupRecordIdsByType(exportedWorks),
          scope: scopeForProjects([projectId]),
          view: {
            kind: "Work list",
            name: archived ? "Work records (Archived)" : "Work records",
            // The file keeps the order the list shows.
            order: "listed",
          },
          visibleFields: WORK_LIST_EXPORT_FIELDS,
        })}
        label="Work records"
      />
      <BulkEditDialog
        archived={archived}
        onCloseOutcome={onCloseOutcome}
        onOpenChange={onOpenChange}
        open={open}
        projectId={projectId}
        selectedWorks={selectedWorks}
        workStatusLabels={workStatusLabels}
      />
    </>
  );
}

function workIdFromHash(hash: string) {
  if (!hash.startsWith("work-") || hash.startsWith("work-relations-")) {
    return null;
  }
  try {
    return decodeURIComponent(hash.slice("work-".length));
  } catch {
    return null;
  }
}

function CustomFieldValues({
  error,
  formattingPreferences,
  items,
  work,
  connection,
}: {
  error: boolean;
  formattingPreferences: AccountPreferences;
  items: ReturnType<typeof customFieldItemsForRecord> | undefined;
  work: WorkProfile;
  connection: ReturnType<typeof useClientShellConnection>;
}) {
  if (error) {
    return (
      <p className="text-sm text-destructive" role="alert">
        Custom field values could not be loaded. Try loading this page again.
      </p>
    );
  }
  if (!items) {
    return null;
  }
  return (
    <CustomFieldValuesForm
      disabled={connection === "offline" || work.archivedAt !== null}
      formattingPreferences={formattingPreferences}
      projectId={work.projectId}
      recordId={work.id}
      recordItems={items}
      recordType="Work"
    />
  );
}

export function WorkArchiveAction({ work }: { work: WorkProfile }) {
  const connection = useClientShellConnection();
  const queryClient = useQueryClient();
  const isArchived = work.archivedAt !== null;
  const mutation = useMutation({
    meta: { onlineWrite: true },
    mutationFn: ({
      archived,
      ...input
    }: {
      archived: boolean;
      baseRevision: number;
      clientIdempotencyKey: string;
      workId: string;
    }) => (archived ? client.unarchiveWork(input) : client.archiveWork(input)),
    onSuccess: async (savedWork) => {
      const { id: workId, projectId } = savedWork;
      await Promise.all([
        ...[
          orpc.projectWorks.queryKey({ input: { projectId } }),
          orpc.work.queryKey({ input: { workId } }),
          orpc.scopeTree.queryKey({ input: { projectId } }),
        ].map((queryKey) => queryClient.invalidateQueries({ queryKey })),
        ...invalidateSmartCollectionMembership(queryClient),
      ]);
    },
  });

  const error =
    mutation.isError && mutation.variables.workId === work.id
      ? mutationErrorMessage(
          mutation.error,
          mutation.variables.archived
            ? "Work could not be unarchived. Try again."
            : "Work could not be archived. Try again.",
        )
      : null;

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        disabled={connection === "offline" || mutation.isPending}
        onClick={() =>
          mutation.mutate(
            commandVariables(
              {
                archived: isArchived,
                baseRevision: work.revision,
                workId: work.id,
              },
              mutation.isError ? mutation.variables : undefined,
            ),
          )
        }
        size="xs"
        type="button"
        variant="outline"
      >
        {isArchived ? "Unarchive" : "Archive"}
      </Button>
      {error ? (
        <p className="text-xs text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function WorkTypeEditor({ work }: { work: WorkProfile }) {
  const connection = useClientShellConnection();
  const queryClient = useQueryClient();
  const [selectedType, setSelectedType] = useState<WorkType>(work.type);
  const selectedTypeRef = useRef(work.type);
  const updateType = useMutation(
    orpc.updateWorkType.mutationOptions({
      meta: { onlineWrite: true },
      mutationFn: (input) => client.updateWorkType(input),
      onSuccess: async (updated, { workId }) => {
        const { projectId } = updated;
        await Promise.all([
          queryClient.invalidateQueries({
            queryKey: orpc.projectWorks.queryKey({ input: { projectId } }),
          }),
          queryClient.invalidateQueries({
            queryKey: orpc.work.queryKey({ input: { workId } }),
          }),
          queryClient.invalidateQueries({
            queryKey: orpc.scopeTree.queryKey({ input: { projectId } }),
          }),
          ...invalidateSmartCollectionMembership(queryClient),
        ]);
      },
    }),
  );
  const previewTypeChange = useMutation({
    mutationKey: orpc.workTypeChangePreview.mutationKey(),
    mutationFn: (input: {
      baseRevision: number;
      type: WorkType;
      workId: string;
    }) =>
      client.workTypeChangePreview({ workId: input.workId, type: input.type }),
    onSuccess: (reviewed, { baseRevision, type, workId }) => {
      if (type === selectedTypeRef.current && !reviewed.requiresImpactPreview) {
        updateType.mutate(
          commandVariables({
            baseRevision,
            impactPreviewId: reviewed.previewId,
            type,
            workId,
          }),
        );
      }
    },
  });
  const prepared = previewTypeChange.data;
  const preview =
    !updateType.isSuccess &&
    prepared?.requiresImpactPreview &&
    prepared.nextType === selectedType
      ? prepared
      : null;
  const failure = updateType.error ?? previewTypeChange.error;
  const error = failure
    ? mutationErrorMessage(
        failure,
        "Work type could not be changed. Try again.",
      )
    : null;

  function handleTypeChange(nextType: WorkType) {
    selectedTypeRef.current = nextType;
    setSelectedType(nextType);
    const failed = updateType.isError ? updateType.variables : undefined;
    if (failed?.type === nextType && failed.workId === work.id) {
      updateType.mutate(failed);
      return;
    }
    previewTypeChange.reset();
    updateType.reset();
    if (nextType !== work.type) {
      previewTypeChange.mutate({
        baseRevision: work.revision,
        type: nextType,
        workId: work.id,
      });
    }
  }

  function confirmTypeChange() {
    if (!(preview && previewTypeChange.variables)) {
      return;
    }
    const failed = updateType.isError ? updateType.variables : undefined;
    if (failed?.impactPreviewId === preview.previewId) {
      updateType.mutate(failed);
      return;
    }
    updateType.mutate(
      commandVariables({
        baseRevision: previewTypeChange.variables.baseRevision,
        impactPreviewId: preview.previewId,
        type: preview.nextType,
        workId: preview.workId,
      }),
    );
  }

  useEffect(() => {
    selectedTypeRef.current = work.type;
    setSelectedType(work.type);
  }, [work.type]);

  const isPending = previewTypeChange.isPending || updateType.isPending;

  return (
    <div className="flex min-w-40 flex-col items-start gap-1">
      <label
        className="text-xs text-muted-foreground"
        htmlFor={`work-type-${work.id}`}
      >
        Type
      </label>
      <NativeSelect
        aria-label={`Type for ${work.key}`}
        className="w-full"
        disabled={connection === "offline" || isPending}
        id={`work-type-${work.id}`}
        onChange={(event) => handleTypeChange(event.target.value as WorkType)}
        value={error ? work.type : selectedType}
      >
        {WORK_TYPE_OPTIONS.map((type) => (
          <NativeSelectOption key={type} value={type}>
            {type}
          </NativeSelectOption>
        ))}
      </NativeSelect>
      {error ? (
        <p className="text-xs text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      {preview ? (
        <div
          aria-label="Impact preview"
          className="mt-2 w-full space-y-2 border bg-muted/20 p-3 text-left text-xs"
          role="status"
        >
          <p className="text-sm font-medium">Impact preview</p>
          <p>
            Current type: {preview.currentType}. New type: {preview.nextType}.
          </p>
          <p className="text-muted-foreground">
            Changing to or from Feature requires confirmation.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              disabled={updateType.isPending}
              onClick={confirmTypeChange}
              size="xs"
              type="button"
            >
              Confirm type change
            </Button>
            <Button
              disabled={updateType.isPending}
              onClick={() => {
                handleTypeChange(work.type);
              }}
              size="xs"
              type="button"
              variant="outline"
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
