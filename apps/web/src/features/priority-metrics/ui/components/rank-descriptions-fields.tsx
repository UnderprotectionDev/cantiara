// biome-ignore-all lint/performance/noJsxPropsBind: Rank inputs bind to their rank key.
import {
  PRIORITY_METRIC_RANKS,
  type PriorityMetricRankDescriptions,
} from "@cantiara/api/priority-metrics";
import {
  Field,
  FieldDescription,
  FieldLabel,
} from "@cantiara/ui/components/field";
import { Input } from "@cantiara/ui/components/input";

export function RankDescriptionsFields({
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
