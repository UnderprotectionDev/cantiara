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

import {
  priorityMetricRevision,
  usePriorityMetrics,
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

export default function PriorityMetricEditor({
  disabled = false,
  projectId,
}: {
  disabled?: boolean;
  projectId: string;
}) {
  const { create, query, update } = usePriorityMetrics(projectId);
  const [draft, setDraft] = useState<PriorityMetricDraft>(EMPTY_DRAFT);
  const [formError, setFormError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

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

  let metricContent = (
    <p className="text-muted-foreground text-sm">No priority metrics yet.</p>
  );
  if (query.data && query.data.length > 0) {
    metricContent = (
      <ul aria-label="Project priority metrics" className="space-y-3">
        {query.data.map((metric) => (
          <PriorityMetricRow
            disabled={disabled || update.isPending}
            editing={editingId === metric.id}
            error={actionError}
            key={metric.id}
            metric={metric}
            onCancel={() => setEditingId(null)}
            onEdit={() => {
              setActionError(null);
              setEditingId(metric.id);
            }}
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
  onSave,
  onToggleEnabled,
}: {
  disabled: boolean;
  editing: boolean;
  error: string | null;
  metric: PriorityMetric;
  onCancel: () => void;
  onEdit: () => void;
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
