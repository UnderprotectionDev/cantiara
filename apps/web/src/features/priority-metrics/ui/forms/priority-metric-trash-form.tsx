// biome-ignore-all lint/performance/noJsxPropsBind: The confirmation closes over its current mutation state.
import type { PriorityMetric } from "@cantiara/api/priority-metrics";
import { Button } from "@cantiara/ui/components/button";
import { useForm } from "@tanstack/react-form";
import type { SubmitEvent } from "react";
import {
  PriorityMetricImpactStatus,
  type PriorityMetricTrashEffect,
} from "../components/priority-metric-impact";

export function PriorityMetricMoveConfirmation({
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
  onSubmit: () => Promise<void>;
  projectName: string;
  target: PriorityMetric;
  trashing: boolean;
}) {
  const trashForm = useForm({
    defaultValues: {},
    onSubmit: async () => onSubmit(),
  });

  function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    event.stopPropagation();
    trashForm.handleSubmit().catch(() => undefined);
  }

  return (
    <form
      aria-label="Move priority metric to Trash"
      className="space-y-3 rounded-md border border-border/70 bg-muted/20 p-4"
      onSubmit={handleSubmit}
    >
      <div>
        <h6 className="text-sm font-medium">Move {target.name} to Trash?</h6>
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
