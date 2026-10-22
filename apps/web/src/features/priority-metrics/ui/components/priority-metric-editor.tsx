// biome-ignore-all lint/performance/noJsxPropsBind: Form controls close over their current metric draft and mutation state.
import {
  createPriorityMetricInputSchema,
  type PriorityMetric,
} from "@cantiara/api/priority-metrics";
import { Button } from "@cantiara/ui/components/button";
import { type FormEvent, useState } from "react";
import { requestGitHubIdentityGrant } from "@/features/account-access/lib/github-identity-confirmation";

import {
  priorityMetricRevision,
  usePriorityMetrics,
  usePriorityMetricTrashImpactPreview,
} from "@/features/priority-metrics/hooks/use-priority-metrics";
import { errorMessage } from "../../lib/error-message";
import { draftFromMetric } from "../../lib/priority-metric-draft";
import { PriorityMetricCreateForm } from "../forms/priority-metric-create-form";
import { PriorityMetricRow } from "../forms/priority-metric-edit-form";
import { PriorityMetricPermanentDeleteConfirmation } from "../forms/priority-metric-permanent-delete-form";
import {
  PriorityMetricImpactStatus,
  type PriorityMetricTrashEffect,
} from "./priority-metric-impact";

function PriorityMetricMoveConfirmation({
  disabled,
  effect,
  error,
  loading,
  onCancel,
  onSubmit,
  projectName,
  target,
  trashing,
}: {
  disabled: boolean;
  effect: PriorityMetricTrashEffect | undefined;
  error: boolean;
  loading: boolean;
  onCancel: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  projectName: string;
  target: PriorityMetric;
  trashing: boolean;
}) {
  return (
    <form
      aria-label="Move priority metric to Trash"
      className="space-y-3 rounded-md border border-border/70 bg-muted/20 p-4"
      onSubmit={onSubmit}
    >
      <div>
        <h6 className="font-medium text-sm">Move {target.name} to Trash?</h6>
        <PriorityMetricImpactStatus
          effect={effect}
          error={error}
          loading={loading}
          mode="move-to-trash"
          projectName={projectName}
        />
      </div>
      <div className="flex gap-2">
        <Button
          disabled={disabled || trashing || !effect}
          type="submit"
          variant="outline"
        >
          Move to Trash
        </Button>
        <Button
          disabled={trashing}
          onClick={onCancel}
          type="button"
          variant="outline"
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}

function PriorityMetricTrash({
  actionDisabled,
  confirmationPending,
  deleteGrant,
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
  deleteGrant: string | null;
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
  onSubmitTrash: (event: FormEvent<HTMLFormElement>) => void;
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
      className="space-y-2 border-border/70 border-t pt-4"
    >
      <h5 className="font-medium text-sm">Trash</h5>
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
              <p className="text-muted-foreground text-sm">
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
          deleteGrant={deleteGrant}
          deleting={deleting}
          disabled={disabled}
          effect={impactPreview.data}
          error={impactPreview.isError}
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
  const { create, deletePermanently, query, restore, trash, update } =
    usePriorityMetrics(projectId);
  const [formError, setFormError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [trashTarget, setTrashTarget] = useState<PriorityMetric | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<PriorityMetric | null>(null);
  const [deleteGrant, setDeleteGrant] = useState<string | null>(null);
  const [confirmationPending, setConfirmationPending] = useState(false);
  const metrics = query.data ?? [];
  const activeMetrics = metrics.filter((metric) => !metric.trashedAt);
  const trashedMetrics = metrics.filter((metric) => metric.trashedAt);
  const actionDisabled =
    disabled ||
    update.isPending ||
    trash.isPending ||
    restore.isPending ||
    deletePermanently.isPending ||
    confirmationPending;

  async function requestDeleteConfirmation() {
    setActionError(null);
    setConfirmationPending(true);
    try {
      const grant = await requestGitHubIdentityGrant("early-permanent-delete");
      setDeleteGrant(grant);
    } catch (error) {
      setActionError(
        errorMessage(error, "Confirm GitHub Identity could not be completed."),
      );
    } finally {
      setConfirmationPending(false);
    }
  }

  async function handlePermanentDelete(typedProjectName: string) {
    if (!(deleteTarget && deleteGrant)) {
      return;
    }
    setActionError(null);
    try {
      await deletePermanently.mutateAsync({
        ...priorityMetricRevision(deleteTarget),
        grant: deleteGrant,
        projectId,
        typedProjectName,
      });
      setDeleteTarget(null);
      setDeleteGrant(null);
    } catch (error) {
      setActionError(
        errorMessage(
          error,
          "Priority metric could not be permanently deleted.",
        ),
      );
    }
  }

  async function handleRestore(metric: PriorityMetric) {
    setActionError(null);
    if (deleteTarget?.id === metric.id) {
      setDeleteTarget(null);
      setDeleteGrant(null);
    }
    try {
      await restore.mutateAsync(priorityMetricRevision(metric));
    } catch (error) {
      setActionError(
        errorMessage(error, "Priority metric could not be restored."),
      );
    }
  }

  function openDeleteDialog(metric: PriorityMetric) {
    setActionError(null);
    setDeleteTarget(metric);
    setDeleteGrant(null);
  }

  function closeDeleteDialog() {
    setDeleteTarget(null);
    setDeleteGrant(null);
    setActionError(null);
  }

  function openTrashPreview(metric: PriorityMetric) {
    setActionError(null);
    setEditingId(null);
    setDeleteTarget(null);
    setTrashTarget(metric);
  }

  async function handleMoveToTrash(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!trashTarget) {
      return;
    }
    setActionError(null);
    try {
      await trash.mutateAsync(priorityMetricRevision(trashTarget));
      setTrashTarget(null);
    } catch (error) {
      setActionError(
        errorMessage(error, "Priority metric could not be moved to Trash."),
      );
    }
  }

  let metricContent = (
    <p className="text-muted-foreground text-sm">No priority metrics yet.</p>
  );
  if (query.data && activeMetrics.length > 0) {
    metricContent = (
      <ul aria-label="Project priority metrics" className="space-y-3">
        {activeMetrics.map((metric) => (
          <PriorityMetricRow
            disabled={actionDisabled}
            editing={editingId === metric.id}
            error={actionError}
            key={metric.id}
            metric={metric}
            onCancel={() => setEditingId(null)}
            onEdit={() => {
              setActionError(null);
              setEditingId(metric.id);
            }}
            onRequestTrash={() => openTrashPreview(metric)}
            onSave={async (values) => {
              setActionError(null);
              try {
                const parsed = createPriorityMetricInputSchema.safeParse({
                  ...values,
                  projectId,
                });
                if (!parsed.success) {
                  setActionError(
                    parsed.error.issues[0]?.message ?? "Check the form.",
                  );
                  return false;
                }
                await update.mutateAsync({
                  name: parsed.data.name,
                  rankDescriptions: parsed.data.rankDescriptions,
                  shortDescription: parsed.data.shortDescription,
                  ...priorityMetricRevision(metric),
                  enabled: metric.enabled,
                });
                setEditingId(null);
                setFormError(null);
                return true;
              } catch (error) {
                setActionError(
                  errorMessage(error, "Priority metric could not be saved."),
                );
                return false;
              }
            }}
            onToggleEnabled={async () => {
              setActionError(null);
              try {
                await update.mutateAsync({
                  ...draftFromMetric(metric),
                  ...priorityMetricRevision(metric),
                  enabled: !metric.enabled,
                });
              } catch (error) {
                setActionError(
                  errorMessage(error, "Priority metric could not be updated."),
                );
              }
            }}
          />
        ))}
      </ul>
    );
  } else if (query.isPending) {
    metricContent = (
      <p className="text-muted-foreground text-sm" role="status">
        Loading Priority metrics…
      </p>
    );
  } else if (query.isError) {
    metricContent = (
      <p className="text-destructive text-sm" role="alert">
        Priority metrics could not be loaded. Try loading this page again.
      </p>
    );
  }

  return (
    <div className="mt-3 space-y-5" data-priority-metric-editor="true">
      <p className="max-w-2xl text-muted-foreground text-sm/relaxed">
        Define independent Project criteria and choose each Work value yourself.
        The five ranks stay separate and do not create a score or automatic
        order.
      </p>

      {metricContent}

      <PriorityMetricTrash
        actionDisabled={actionDisabled}
        confirmationPending={confirmationPending}
        deleteGrant={deleteGrant}
        deleteTarget={deleteTarget}
        deleting={deletePermanently.isPending}
        disabled={disabled}
        metrics={trashedMetrics}
        onCancelDelete={closeDeleteDialog}
        onCancelTrash={() => setTrashTarget(null)}
        onRequestConfirmation={requestDeleteConfirmation}
        onRequestDelete={openDeleteDialog}
        onRestore={handleRestore}
        onSubmitDelete={handlePermanentDelete}
        onSubmitTrash={handleMoveToTrash}
        projectName={projectName}
        trashing={trash.isPending}
        trashTarget={trashTarget}
      />

      {actionError ? (
        <p className="text-destructive text-sm" role="alert">
          {actionError}
        </p>
      ) : null}

      <PriorityMetricCreateForm
        disabled={disabled}
        formError={formError}
        isPending={create.isPending}
        onActionError={setActionError}
        onCreate={(input) => create.mutateAsync(input)}
        onFormError={setFormError}
        projectId={projectId}
      />
    </div>
  );
}
