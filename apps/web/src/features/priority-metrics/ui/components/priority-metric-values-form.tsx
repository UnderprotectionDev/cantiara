// biome-ignore-all lint/performance/noJsxPropsBind: Select handlers capture the metric and Work whose value is being edited.
import {
  PRIORITY_METRIC_RANKS,
  type PriorityMetricRank,
  type PriorityMetricValueListItem,
  priorityMetricRankSchema,
} from "@cantiara/api/priority-metrics";
import { Button } from "@cantiara/ui/components/button";
import {
  Field,
  FieldDescription,
  FieldLabel,
} from "@cantiara/ui/components/field";
import {
  NativeSelect,
  NativeSelectOption,
} from "@cantiara/ui/components/native-select";
import { useState } from "react";

import { usePriorityMetricValueMutations } from "@/features/priority-metrics/hooks/use-priority-metrics";
import { errorMessage } from "../../lib/error-message";

export default function PriorityMetricValuesForm({
  disabled = false,
  items,
  projectId,
  workId,
  workKey,
}: {
  disabled?: boolean;
  items: readonly PriorityMetricValueListItem[];
  projectId: string;
  workId: string;
  workKey: string;
}) {
  const { clearValue, setValue } = usePriorityMetricValueMutations(projectId);
  const [dismissedAt, setDismissedAt] = useState(0);
  const latest =
    setValue.submittedAt >= clearValue.submittedAt ? setValue : clearValue;
  const error =
    latest.isError &&
    latest.variables?.workId === workId &&
    latest.submittedAt !== dismissedAt
      ? latest.error
      : null;
  if (items.length === 0) {
    return null;
  }

  function updateValue(
    item: PriorityMetricValueListItem,
    rank: PriorityMetricRank | null,
  ) {
    const input = {
      baseRevision: item.valueRevision,
      metricId: item.definition.id,
      workId,
    };
    if (rank !== null) {
      setValue.mutate({ ...input, rank });
    } else if (item.value) {
      clearValue.mutate(input);
    }
  }

  return (
    <section
      aria-label={`Priority metrics for ${workKey}`}
      className="space-y-3 border-t border-border/70 pt-3"
    >
      <h4 className="text-sm font-medium">Priority metrics</h4>
      {items.map((item) => {
        const inputId = `priority-metric-value-${workId}-${item.definition.id}`;
        const selectedRank = item.value?.rank ?? null;
        return (
          <Field key={item.definition.id}>
            <FieldLabel htmlFor={inputId}>{item.definition.name}</FieldLabel>
            <FieldDescription>
              {item.definition.shortDescription}
            </FieldDescription>
            <NativeSelect
              disabled={disabled || setValue.isPending || clearValue.isPending}
              id={inputId}
              onChange={(event) => {
                const selected = event.target.value;
                if (selected === "") {
                  updateValue(item, null);
                  return;
                }
                const parsedRank = priorityMetricRankSchema.safeParse(selected);
                if (parsedRank.success) {
                  updateValue(item, parsedRank.data);
                }
              }}
              value={selectedRank ?? ""}
            >
              <NativeSelectOption value="">Unevaluated</NativeSelectOption>
              {PRIORITY_METRIC_RANKS.map((option) => (
                <NativeSelectOption key={option} value={option}>
                  {option}
                </NativeSelectOption>
              ))}
            </NativeSelect>
            {selectedRank && item.definition.rankDescriptions[selectedRank] ? (
              <FieldDescription>
                {item.definition.rankDescriptions[selectedRank]}
              </FieldDescription>
            ) : null}
          </Field>
        );
      })}
      {error ? (
        <div className="flex flex-wrap items-center gap-2" role="alert">
          <p className="text-sm text-destructive">
            {errorMessage(error, "Priority metric value could not be saved.")}
          </p>
          <Button
            disabled={setValue.isPending || clearValue.isPending}
            onClick={() => setDismissedAt(latest.submittedAt)}
            size="xs"
            type="button"
            variant="outline"
          >
            Dismiss
          </Button>
        </div>
      ) : null}
    </section>
  );
}
