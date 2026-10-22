// biome-ignore-all lint/performance/noJsxPropsBind: Form controls close over their current metric draft and mutation state.
import {
  createPriorityMetricInputSchema,
  type PriorityMetric,
} from "@cantiara/api/priority-metrics";
import { Button } from "@cantiara/ui/components/button";
import { Field, FieldGroup, FieldLabel } from "@cantiara/ui/components/field";
import { Input } from "@cantiara/ui/components/input";
import { Textarea } from "@cantiara/ui/components/textarea";
import { useForm } from "@tanstack/react-form";
import { type FormEvent, useState } from "react";
import {
  draftFromMetric,
  type PriorityMetricDraft,
} from "../../lib/priority-metric-draft";
import { RankDescriptionsFields } from "../components/rank-descriptions-fields";

export function PriorityMetricRow({
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
  const [validationError, setValidationError] = useState<string | null>(null);
  const editForm = useForm({
    defaultValues: draftFromMetric(metric),
    onSubmit: async ({ value }) => {
      const parsed = createPriorityMetricInputSchema.safeParse({
        ...value,
        projectId: metric.projectId,
      });
      if (!parsed.success) {
        setValidationError(
          parsed.error.issues[0]?.message ?? "Check the form.",
        );
        return;
      }
      setValidationError(null);
      if (await onSave(parsed.data)) {
        editForm.reset({
          name: parsed.data.name,
          rankDescriptions: parsed.data.rankDescriptions,
          shortDescription: parsed.data.shortDescription,
        });
      }
    },
  });

  function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    event.stopPropagation();
    editForm.handleSubmit().catch(() => undefined);
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
              editForm.reset(draftFromMetric(metric));
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
            <editForm.Field name="name">
              {(field) => (
                <Field>
                  <FieldLabel htmlFor={`priority-metric-name-${metric.id}`}>
                    Name
                  </FieldLabel>
                  <Input
                    disabled={disabled}
                    id={`priority-metric-name-${metric.id}`}
                    name={field.name}
                    onChange={(event) => field.handleChange(event.target.value)}
                    value={field.state.value}
                  />
                </Field>
              )}
            </editForm.Field>
            <editForm.Field name="shortDescription">
              {(field) => (
                <Field>
                  <FieldLabel
                    htmlFor={`priority-metric-description-${metric.id}`}
                  >
                    Short description
                  </FieldLabel>
                  <Textarea
                    disabled={disabled}
                    id={`priority-metric-description-${metric.id}`}
                    name={field.name}
                    onChange={(event) => field.handleChange(event.target.value)}
                    value={field.state.value}
                  />
                </Field>
              )}
            </editForm.Field>
            <editForm.Subscribe
              selector={(state) => state.values.rankDescriptions}
            >
              {(rankDescriptions) => (
                <RankDescriptionsFields
                  disabled={disabled}
                  idPrefix={`priority-metric-${metric.id}`}
                  onChange={(rank, value) =>
                    editForm.setFieldValue("rankDescriptions", {
                      ...rankDescriptions,
                      [rank]: value,
                    })
                  }
                  rankDescriptions={rankDescriptions}
                />
              )}
            </editForm.Subscribe>
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
