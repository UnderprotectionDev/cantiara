// biome-ignore-all lint/performance/noJsxPropsBind: Form controls close over their current metric draft and mutation state.
import type { PriorityMetric } from "@cantiara/api/priority-metrics";
import { Button } from "@cantiara/ui/components/button";
import { useState } from "react";
import {
  priorityMetricRevision,
  usePriorityMetrics,
  usePriorityMetricTrashImpactPreview,
} from "@/features/priority-metrics/hooks/use-priority-metrics";
import { privateWriteNotice } from "@/features/web-macos-client/lib/support-reference";
import { SupportReferenceNotice } from "@/features/web-macos-client/ui/components/support-reference";
import { usePriorityMetricDelete } from "../../hooks/use-priority-metric-delete";
import { errorMessage } from "../../lib/error-message";
import { draftFromMetric } from "../../lib/priority-metric-draft";
import { PriorityMetricCreateForm } from "../forms/priority-metric-create-form";
import { PriorityMetricRow } from "../forms/priority-metric-edit-form";
import { PriorityMetricPermanentDeleteConfirmation } from "../forms/priority-metric-permanent-delete-form";
import { PriorityMetricMoveConfirmation } from "../forms/priority-metric-trash-form";

function PriorityMetricTrash({
  actionDisabled,
  confirmationPending,
  identityConfirmed,
  deleteTarget,
  disabled,
  metrics,
  trashTarget,
  onCancelDelete,
  onCancelTrash,
  onRequestDelete,
  onRequestConfirmation,
  onRestore,
  onSubmitDelete,
  onSubmitTrash,
  projectName,
  deleting,
  trashing,
}: {
  actionDisabled: boolean;
  confirmationPending: boolean;
  identityConfirmed: boolean;
  deleteTarget: PriorityMetric | null;
  disabled: boolean;
  deleting: boolean;
  metrics: PriorityMetric[];
  trashTarget: PriorityMetric | null;
  onCancelDelete: () => void;
  onCancelTrash: () => void;
  onRequestDelete: (metric: PriorityMetric) => void;
  onRequestConfirmation: () => void;
  onRestore: (metric: PriorityMetric) => void;
  onSubmitDelete: (typedProjectName: string) => Promise<void>;
  onSubmitTrash: () => Promise<void>;
  projectName: string;
  trashing: boolean;
}) {
  const impactPreview = usePriorityMetricTrashImpactPreview(
    trashTarget?.id ?? deleteTarget?.id ?? null,
  );
  if (metrics.length === 0 && !trashTarget && !deleteTarget) {
    return null;
  }

  return (
    <section
      aria-label="Priority metric Trash"
      className="space-y-2 border-t border-border/70 pt-4"
    >
      <h5 className="text-sm font-medium">Trash</h5>
      {trashTarget ? (
        <PriorityMetricMoveConfirmation
          disabled={disabled}
          effect={impactPreview.data}
          error={impactPreview.isError}
          loading={impactPreview.isPending}
          onCancel={onCancelTrash}
          onSubmit={onSubmitTrash}
          projectName={projectName}
          target={trashTarget}
          trashing={trashing}
        />
      ) : null}
      <ul className="space-y-2">
        {metrics.map((metric) => (
          <li
            className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-dashed bg-muted/20 p-3"
            key={metric.id}
          >
            <div className="space-y-1">
              <p className="font-medium">{metric.name}</p>
              <p className="text-sm text-muted-foreground">
                {metric.shortDescription}
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                disabled={actionDisabled}
                onClick={() => onRestore(metric)}
                size="sm"
                type="button"
                variant="outline"
              >
                Restore
              </Button>
              <Button
                disabled={actionDisabled}
                onClick={() => onRequestDelete(metric)}
                size="sm"
                type="button"
                variant="destructive"
              >
                Permanently Delete
              </Button>
            </div>
          </li>
        ))}
      </ul>
      {deleteTarget ? (
        <PriorityMetricPermanentDeleteConfirmation
          confirmationPending={confirmationPending}
          deleting={deleting}
          disabled={disabled}
          effect={impactPreview.data}
          error={impactPreview.isError}
          identityConfirmed={identityConfirmed}
          key={deleteTarget.id}
          loading={impactPreview.isPending}
          onCancel={onCancelDelete}
          onRequestConfirmation={onRequestConfirmation}
          onSubmit={onSubmitDelete}
          projectName={projectName}
          target={deleteTarget}
        />
      ) : null}
    </section>
  );
}

export default function PriorityMetricEditor({
  disabled = false,
  projectId,
  projectName,
}: {
  disabled?: boolean;
  projectId: string;
  projectName: string;
}) {
  const { create, query, restore, trash, update } =
    usePriorityMetrics(projectId);
  const permanentDelete = usePriorityMetricDelete(projectId);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [trashTarget, setTrashTarget] = useState<PriorityMetric | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<PriorityMetric | null>(null);
  const metrics = query.data ?? [];
  const activeMetrics = metrics.filter((metric) => !metric.trashedAt);
  const trashedMetrics = metrics.filter((metric) => metric.trashedAt);
  const actionDisabled =
    disabled ||
    update.isPending ||
    trash.isPending ||
    restore.isPending ||
    permanentDelete.isPending ||
    permanentDelete.confirmationPending;

  const editedMetricError =
    update.isError && update.variables?.metricId === editingId
      ? update.error
      : null;
  const [latest] = [
    { fallback: "Priority metric could not be updated.", mutation: update },
    {
      fallback: "Priority metric could not be moved to Trash.",
      mutation: trash,
    },
    { fallback: "Priority metric could not be restored.", mutation: restore },
    { fallback: "Priority metric could not be created.", mutation: create },
  ].sort(
    (first, second) => second.mutation.submittedAt - first.mutation.submittedAt,
  );
  const actionError =
    latest?.mutation.isError && latest.mutation.error !== editedMetricError
      ? errorMessage(latest.mutation.error, latest.fallback)
      : null;

  async function handlePermanentDelete(typedProjectName: string) {
    if (deleteTarget?.projectId !== projectId) {
      return;
    }
    const deleted = await permanentDelete.deleteMetric(
      priorityMetricRevision(deleteTarget),
      typedProjectName,
    );
    if (deleted) {
      closeDeleteDialog();
    }
  }

  function handleRestore(metric: PriorityMetric) {
    if (deleteTarget?.id === metric.id) {
      closeDeleteDialog();
    }
    restore.mutate(priorityMetricRevision(metric));
  }

  function openDeleteDialog(metric: PriorityMetric) {
    permanentDelete.reset();
    setTrashTarget(null);
    setDeleteTarget(metric);
  }

  function closeDeleteDialog() {
    permanentDelete.reset();
    setDeleteTarget(null);
  }

  function openTrashPreview(metric: PriorityMetric) {
    setEditingId(null);
    closeDeleteDialog();
    setTrashTarget(metric);
  }

  async function handleMoveToTrash() {
    if (!trashTarget) {
      return;
    }
    try {
      await trash.mutateAsync(priorityMetricRevision(trashTarget));
      setTrashTarget(null);
    } catch {
      // Leave the preview open so the same command can be retried.
    }
  }

  let metricContent = (
    <p className="text-sm text-muted-foreground">No priority metrics yet.</p>
  );
  if (query.data && activeMetrics.length > 0) {
    metricContent = (
      <ul aria-label="Project priority metrics" className="space-y-3">
        {activeMetrics.map((metric) => (
          <PriorityMetricRow
            disabled={actionDisabled}
            editing={editingId === metric.id}
            error={
              editingId === metric.id && editedMetricError
                ? errorMessage(
                    editedMetricError,
                    "Priority metric could not be saved.",
                  )
                : null
            }
            key={metric.id}
            metric={metric}
            onCancel={() => setEditingId(null)}
            onEdit={() => setEditingId(metric.id)}
            onRequestTrash={() => openTrashPreview(metric)}
            onSave={async (values) => {
              try {
                await update.mutateAsync({
                  ...values,
                  ...priorityMetricRevision(metric),
                  enabled: metric.enabled,
                });
                setEditingId(null);
                return true;
              } catch {
                return false;
              }
            }}
            onToggleEnabled={() =>
              update.mutate({
                ...draftFromMetric(metric),
                ...priorityMetricRevision(metric),
                enabled: !metric.enabled,
              })
            }
          />
        ))}
      </ul>
    );
  } else if (query.status === "pending") {
    metricContent = (
      <p className="text-sm text-muted-foreground" role="status">
        Loading Priority metrics…
      </p>
    );
  } else if (query.isError) {
    metricContent = (
      <p className="text-sm text-destructive" role="alert">
        Priority metrics could not be loaded. Try loading this page again.
      </p>
    );
  }

  return (
    <div className="mt-3 space-y-5" data-priority-metric-editor="true">
      <p className="max-w-2xl text-sm/relaxed text-muted-foreground">
        Define independent Project criteria and choose each Work value yourself.
        The five ranks stay separate and do not create a score or automatic
        order.
      </p>

      {metricContent}

      <PriorityMetricTrash
        actionDisabled={actionDisabled}
        confirmationPending={permanentDelete.confirmationPending}
        deleteTarget={deleteTarget}
        deleting={permanentDelete.isPending}
        disabled={disabled}
        identityConfirmed={permanentDelete.identityConfirmed}
        metrics={trashedMetrics}
        onCancelDelete={closeDeleteDialog}
        onCancelTrash={() => setTrashTarget(null)}
        onRequestConfirmation={permanentDelete.confirmIdentity}
        onRequestDelete={openDeleteDialog}
        onRestore={handleRestore}
        onSubmitDelete={handlePermanentDelete}
        onSubmitTrash={handleMoveToTrash}
        projectName={projectName}
        trashing={trash.isPending}
        trashTarget={trashTarget}
      />

      {permanentDelete.error ? (
        <>
          <p className="text-sm text-destructive" role="alert">
            {permanentDelete.error.message}
          </p>
          <SupportReferenceNotice
            failure={privateWriteNotice(permanentDelete.error)}
          />
        </>
      ) : null}
      {actionError ? (
        <p className="text-sm text-destructive" role="alert">
          {actionError}
        </p>
      ) : null}

      <PriorityMetricCreateForm
        disabled={disabled}
        isPending={create.isPending}
        onCreate={(input) => create.mutateAsync(input)}
        projectId={projectId}
      />
    </div>
  );
}
