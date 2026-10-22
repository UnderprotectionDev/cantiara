// biome-ignore-all lint/performance/noJsxPropsBind: Form controls close over their current metric draft and mutation state.
import type { PriorityMetric } from "@cantiara/api/priority-metrics";
import { Button } from "@cantiara/ui/components/button";
import { Input } from "@cantiara/ui/components/input";
import { useForm } from "@tanstack/react-form";
import type { FormEvent } from "react";
import {
  PriorityMetricImpactStatus,
  type PriorityMetricTrashEffect,
} from "../components/priority-metric-impact";

export function PriorityMetricPermanentDeleteConfirmation({
  confirmationPending,
  deleteGrant,
  deleting,
  disabled,
  effect,
  error,
  loading,
  onCancel,
  onRequestConfirmation,
  onSubmit,
  projectName,
  target,
}: {
  confirmationPending: boolean;
  deleteGrant: string | null;
  deleting: boolean;
  disabled: boolean;
  effect: PriorityMetricTrashEffect | undefined;
  error: boolean;
  loading: boolean;
  onCancel: () => void;
  onRequestConfirmation: () => void;
  onSubmit: (typedProjectName: string) => Promise<void>;
  projectName: string;
  target: PriorityMetric;
}) {
  const deleteForm = useForm({
    defaultValues: { typedProjectName: "" },
    onSubmit: async ({ value }) => onSubmit(value.typedProjectName),
  });

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    event.stopPropagation();
    deleteForm.handleSubmit().catch(() => undefined);
  }

  return (
    <form
      aria-label="Permanently Delete priority metric"
      className="space-y-3 rounded-md border border-destructive/40 bg-destructive/5 p-4"
      onSubmit={handleSubmit}
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
      <deleteForm.Field name="typedProjectName">
        {(field) => (
          <label
            className="block space-y-1 text-sm"
            htmlFor="priority-metric-delete-project-name"
          >
            <span>Type the Project name to confirm</span>
            <Input
              autoComplete="off"
              disabled={disabled || deleting}
              id="priority-metric-delete-project-name"
              name={field.name}
              onChange={(event) => field.handleChange(event.target.value)}
              value={field.state.value}
            />
          </label>
        )}
      </deleteForm.Field>
      <div className="flex gap-2">
        <deleteForm.Subscribe
          selector={(state) => state.values.typedProjectName}
        >
          {(typedProjectName) => (
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
          )}
        </deleteForm.Subscribe>
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
