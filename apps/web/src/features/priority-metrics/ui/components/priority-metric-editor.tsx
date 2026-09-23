// biome-ignore-all lint/performance/noJsxPropsBind: Form controls close over their current metric draft and mutation state.
import {
  createPriorityMetricInputSchema,
  PRIORITY_METRIC_RANKS,
  type PriorityMetric,
  type PriorityMetricRankDescriptions,
} from "@cantiara/api/priority-metrics";
import { Button } from "@cantiara/ui/components/button";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@cantiara/ui/components/field";
import { Input } from "@cantiara/ui/components/input";
import { Textarea } from "@cantiara/ui/components/textarea";
import { type FormEvent, useState } from "react";
import { requestGitHubIdentityGrant } from "@/features/account-access/lib/github-identity-confirmation";

import {
  priorityMetricRevision,
  usePriorityMetrics,
  usePriorityMetricTrashImpactPreview,
} from "@/features/priority-metrics/hooks/use-priority-metrics";

interface PriorityMetricDraft {
  name: string;
  rankDescriptions: PriorityMetricRankDescriptions;
  shortDescription: string;
}

const EMPTY_RANK_DESCRIPTIONS: PriorityMetricRankDescriptions = {
  High: "",
  Low: "",
  Medium: "",
  "Very high": "",
  "Very low": "",
};

const EMPTY_DRAFT: PriorityMetricDraft = {
  name: "",
  rankDescriptions: EMPTY_RANK_DESCRIPTIONS,
  shortDescription: "",
};

function draftFromMetric(metric: PriorityMetric): PriorityMetricDraft {
  return {
    name: metric.name,
    rankDescriptions: { ...metric.rankDescriptions },
    shortDescription: metric.shortDescription,
  };
}

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

export function PriorityMetricTrashImpact({
  effect,
  mode,
  projectName,
}: {
  effect: {
    attachedExternalSurfaceCount: number;
    dependentRuleCount: number;
    dependentViewCount: number;
    storedWorkValueCount: number;
  };
  mode: "move-to-trash" | "permanent-delete";
  projectName: string;
}) {
  const count = effect.storedWorkValueCount;
  const valueLabel = `saved Work ${count === 1 ? "value" : "values"}`;
  return (
    <div className="mt-1 space-y-1 text-muted-foreground text-sm">
      {mode === "move-to-trash" ? (
        <p>
          {count} {valueLabel} {count === 1 ? "remains" : "remain"} recoverable
          for 30 days in {projectName}.
        </p>
      ) : (
        <p>
          This permanently deletes the criterion and {count} {valueLabel} in{" "}
          {projectName}.
        </p>
      )}
      <p>
        Dependent views: {effect.dependentViewCount}. Dependent rules:{" "}
        {effect.dependentRuleCount}. Attached External Surfaces:{" "}
        {effect.attachedExternalSurfaceCount}.
      </p>
    </div>
  );
}

interface PriorityMetricTrashEffect {
  attachedExternalSurfaceCount: number;
  dependentRuleCount: number;
  dependentViewCount: number;
  storedWorkValueCount: number;
}

function PriorityMetricImpactStatus({
  effect,
  error,
  loading,
  mode,
  projectName,
}: {
  effect: PriorityMetricTrashEffect | undefined;
  error: boolean;
  loading: boolean;
  mode: "move-to-trash" | "permanent-delete";
  projectName: string;
}) {
  let message: string;
  if (loading) {
    message =
      mode === "move-to-trash"
        ? "Loading the Trash effect…"
        : "Loading the permanent deletion effect…";
  } else {
    message =
      mode === "move-to-trash"
        ? "The Trash effect could not be loaded. Try again before moving this criterion."
        : "The deletion effect could not be loaded. Try again before deleting.";
  }
  if (effect) {
    return (
      <PriorityMetricTrashImpact
        effect={effect}
        mode={mode}
        projectName={projectName}
      />
    );
  }
  return (
    <p
      className={
        error
          ? "mt-1 text-destructive text-sm"
          : "mt-1 text-muted-foreground text-sm"
      }
      role={error ? "alert" : "status"}
    >
      {message}
    </p>
  );
}

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

function PriorityMetricPermanentDeleteConfirmation({
  confirmationPending,
  deleteGrant,
  deleting,
  disabled,
  effect,
  error,
  loading,
  onCancel,
  onProjectNameChange,
  onRequestConfirmation,
  onSubmit,
  projectName,
  target,
  typedProjectName,
}: {
  confirmationPending: boolean;
  deleteGrant: string | null;
  deleting: boolean;
  disabled: boolean;
  effect: PriorityMetricTrashEffect | undefined;
  error: boolean;
  loading: boolean;
  onCancel: () => void;
  onProjectNameChange: (value: string) => void;
  onRequestConfirmation: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  projectName: string;
  target: PriorityMetric;
  typedProjectName: string;
}) {
  return (
    <form
      aria-label="Permanently Delete priority metric"
      className="space-y-3 rounded-md border border-destructive/40 bg-destructive/5 p-4"
      onSubmit={onSubmit}
    >
      <div>
        <h6 className="font-medium text-sm">
          Permanently Delete {target.name}?
        </h6>
        <PriorityMetricImpactStatus
          effect={effect}
          error={error}
          loading={loading}
          mode="permanent-delete"
          projectName={projectName}
        />
        <p className="mt-1 text-muted-foreground text-sm">
          Confirm GitHub Identity and type the Project name to continue.
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          disabled={disabled || confirmationPending}
          onClick={onRequestConfirmation}
          type="button"
          variant="outline"
        >
          Confirm GitHub Identity
        </Button>
        {deleteGrant ? (
          <span className="text-muted-foreground text-sm" role="status">
            GitHub identity confirmed.
          </span>
        ) : null}
      </div>
      <label
        className="block space-y-1 text-sm"
        htmlFor="priority-metric-delete-project-name"
      >
        <span>Type the Project name to confirm</span>
        <Input
          autoComplete="off"
          disabled={disabled || deleting}
          id="priority-metric-delete-project-name"
          onChange={(event) => onProjectNameChange(event.target.value)}
          value={typedProjectName}
        />
      </label>
      <div className="flex gap-2">
        <Button
          disabled={
            disabled ||
            deleting ||
            !deleteGrant ||
            !effect ||
            typedProjectName.trim() !== projectName
          }
          type="submit"
          variant="destructive"
        >
          Permanently Delete
        </Button>
        <Button
          disabled={deleting}
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
  onProjectNameChange,
  onRequestDelete,
  onRequestConfirmation,
  onRestore,
  onSubmitDelete,
  onSubmitTrash,
  projectName,
  typedProjectName,
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
  onProjectNameChange: (value: string) => void;
  onRequestDelete: (metric: PriorityMetric) => void;
  onRequestConfirmation: () => void;
  onRestore: (metric: PriorityMetric) => void;
  onSubmitDelete: (event: FormEvent<HTMLFormElement>) => void;
  onSubmitTrash: (event: FormEvent<HTMLFormElement>) => void;
  projectName: string;
  typedProjectName: string;
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
          loading={impactPreview.isPending}
          onCancel={onCancelDelete}
          onProjectNameChange={onProjectNameChange}
          onRequestConfirmation={onRequestConfirmation}
          onSubmit={onSubmitDelete}
          projectName={projectName}
          target={deleteTarget}
          typedProjectName={typedProjectName}
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
  const [draft, setDraft] = useState<PriorityMetricDraft>(EMPTY_DRAFT);
  const [formError, setFormError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [trashTarget, setTrashTarget] = useState<PriorityMetric | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<PriorityMetric | null>(null);
  const [typedProjectName, setTypedProjectName] = useState("");
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

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = createPriorityMetricInputSchema.safeParse({
      ...draft,
      projectId,
    });
    if (!parsed.success) {
      setFormError(parsed.error.issues[0]?.message ?? "Check the form.");
      return;
    }
    setFormError(null);
    setActionError(null);
    try {
      await create.mutateAsync(parsed.data);
      setDraft(EMPTY_DRAFT);
    } catch (error) {
      setActionError(
        errorMessage(error, "Priority metric could not be created."),
      );
    }
  }

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

  async function handlePermanentDelete(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
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
      setTypedProjectName("");
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
      setTypedProjectName("");
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
    setTypedProjectName("");
    setDeleteGrant(null);
  }

  function closeDeleteDialog() {
    setDeleteTarget(null);
    setTypedProjectName("");
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
        onProjectNameChange={setTypedProjectName}
        onRequestConfirmation={requestDeleteConfirmation}
        onRequestDelete={openDeleteDialog}
        onRestore={handleRestore}
        onSubmitDelete={handlePermanentDelete}
        onSubmitTrash={handleMoveToTrash}
        projectName={projectName}
        trashing={trash.isPending}
        trashTarget={trashTarget}
        typedProjectName={typedProjectName}
      />

      {actionError ? (
        <p className="text-destructive text-sm" role="alert">
          {actionError}
        </p>
      ) : null}

      <form
        aria-label="Add priority metric"
        className="space-y-4 border-border/70 border-t pt-5"
        noValidate
        onSubmit={handleCreate}
      >
        <h5 className="font-medium text-sm">Add metric</h5>
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="priority-metric-name">Name</FieldLabel>
            <Input
              disabled={disabled || create.isPending}
              id="priority-metric-name"
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  name: event.target.value,
                }))
              }
              value={draft.name}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="priority-metric-short-description">
              Short description
            </FieldLabel>
            <Textarea
              disabled={disabled || create.isPending}
              id="priority-metric-short-description"
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  shortDescription: event.target.value,
                }))
              }
              value={draft.shortDescription}
            />
          </Field>
          <RankDescriptionsFields
            disabled={disabled || create.isPending}
            idPrefix="priority-metric-new"
            onChange={(rank, value) =>
              setDraft((current) => ({
                ...current,
                rankDescriptions: {
                  ...current.rankDescriptions,
                  [rank]: value,
                },
              }))
            }
            rankDescriptions={draft.rankDescriptions}
          />
        </FieldGroup>
        {formError ? (
          <p className="text-destructive text-sm" role="alert">
            {formError}
          </p>
        ) : null}
        <Button disabled={disabled || create.isPending} type="submit">
          Add metric
        </Button>
      </form>
    </div>
  );
}

function PriorityMetricRow({
  disabled,
  editing,
  error,
  metric,
  onCancel,
  onEdit,
  onRequestTrash,
  onSave,
  onToggleEnabled,
}: {
  disabled: boolean;
  editing: boolean;
  error: string | null;
  metric: PriorityMetric;
  onCancel: () => void;
  onEdit: () => void;
  onRequestTrash: (metric: PriorityMetric) => void;
  onSave: (draft: PriorityMetricDraft) => Promise<boolean>;
  onToggleEnabled: () => Promise<void>;
}) {
  const [draft, setDraft] = useState(() => draftFromMetric(metric));
  const [validationError, setValidationError] = useState<string | null>(null);

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = createPriorityMetricInputSchema.safeParse({
      ...draft,
      projectId: metric.projectId,
    });
    if (!parsed.success) {
      setValidationError(parsed.error.issues[0]?.message ?? "Check the form.");
      return;
    }
    setValidationError(null);
    if (await onSave(parsed.data)) {
      setDraft({
        name: parsed.data.name,
        rankDescriptions: parsed.data.rankDescriptions,
        shortDescription: parsed.data.shortDescription,
      });
    }
  }

  return (
    <li className="rounded-md border border-border/70 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h5 className="font-medium">{metric.name}</h5>
          <p className="text-muted-foreground text-sm">
            {metric.shortDescription}
          </p>
          <p className="text-muted-foreground text-xs">
            {metric.enabled ? "Enabled" : "Disabled"}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            disabled={disabled}
            onClick={onToggleEnabled}
            size="xs"
            type="button"
            variant="outline"
          >
            {metric.enabled ? "Disable" : "Enable"}
          </Button>
          <Button
            disabled={disabled}
            onClick={() => {
              setDraft(draftFromMetric(metric));
              setValidationError(null);
              onEdit();
            }}
            size="xs"
            type="button"
            variant="outline"
          >
            Edit
          </Button>
          <Button
            disabled={disabled}
            onClick={() => onRequestTrash(metric)}
            size="xs"
            type="button"
            variant="outline"
          >
            Move to Trash
          </Button>
        </div>
      </div>
      {editing ? (
        <form
          aria-label={`Edit ${metric.name}`}
          className="mt-4 space-y-4 border-t pt-4"
          noValidate
          onSubmit={handleSave}
        >
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor={`priority-metric-name-${metric.id}`}>
                Name
              </FieldLabel>
              <Input
                disabled={disabled}
                id={`priority-metric-name-${metric.id}`}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    name: event.target.value,
                  }))
                }
                value={draft.name}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor={`priority-metric-description-${metric.id}`}>
                Short description
              </FieldLabel>
              <Textarea
                disabled={disabled}
                id={`priority-metric-description-${metric.id}`}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    shortDescription: event.target.value,
                  }))
                }
                value={draft.shortDescription}
              />
            </Field>
            <RankDescriptionsFields
              disabled={disabled}
              idPrefix={`priority-metric-${metric.id}`}
              onChange={(rank, value) =>
                setDraft((current) => ({
                  ...current,
                  rankDescriptions: {
                    ...current.rankDescriptions,
                    [rank]: value,
                  },
                }))
              }
              rankDescriptions={draft.rankDescriptions}
            />
          </FieldGroup>
          {validationError ? (
            <p className="text-destructive text-sm" role="alert">
              {validationError}
            </p>
          ) : null}
          {error ? (
            <p className="text-destructive text-sm" role="alert">
              {error}
            </p>
          ) : null}
          <div className="flex gap-2">
            <Button disabled={disabled} size="xs" type="submit">
              Save
            </Button>
            <Button
              disabled={disabled}
              onClick={onCancel}
              size="xs"
              type="button"
              variant="outline"
            >
              Cancel
            </Button>
          </div>
        </form>
      ) : null}
    </li>
  );
}

function RankDescriptionsFields({
  disabled,
  idPrefix,
  onChange,
  rankDescriptions,
}: {
  disabled: boolean;
  idPrefix: string;
  onChange: (rank: keyof PriorityMetricRankDescriptions, value: string) => void;
  rankDescriptions: PriorityMetricRankDescriptions;
}) {
  return (
    <fieldset className="space-y-3">
      <legend className="font-medium text-sm">Rank descriptions</legend>
      <FieldDescription>
        Add a short explanation for each fixed rank, or leave it blank.
      </FieldDescription>
      {PRIORITY_METRIC_RANKS.map((rank) => {
        const id = `${idPrefix}-${rank.toLowerCase().replaceAll(" ", "-")}`;
        return (
          <Field key={rank}>
            <FieldLabel htmlFor={id}>{rank}</FieldLabel>
            <Input
              disabled={disabled}
              id={id}
              onChange={(event) => onChange(rank, event.target.value)}
              value={rankDescriptions[rank]}
            />
          </Field>
        );
      })}
    </fieldset>
  );
}
