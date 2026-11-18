// biome-ignore-all lint/performance/noJsxPropsBind: Draft controls update their owning form field.
import type {
  ExternalExecutionHandoffRelatedWork,
  PreviewExternalExecutionHandoffReconcileInput,
} from "@cantiara/api/external-handoffs";
import { Button } from "@cantiara/ui/components/button";
import { Field, FieldLabel } from "@cantiara/ui/components/field";
import {
  NativeSelect,
  NativeSelectOption,
} from "@cantiara/ui/components/native-select";

type RelationDraft =
  PreviewExternalExecutionHandoffReconcileInput["proposedRelations"][number];
export function HandoffRelationFields({
  disabled,
  value,
  onChange,
  relatedWorks,
}: {
  disabled: boolean;
  value: RelationDraft[];
  onChange: (value: RelationDraft[]) => void;
  relatedWorks: readonly ExternalExecutionHandoffRelatedWork[];
}) {
  return (
    <fieldset className="space-y-3 rounded-sm border border-border/70 p-3">
      <legend className="px-1 text-xs font-medium">Proposed relations</legend>
      {value.map((relation) => (
        <div
          className="grid gap-2 sm:grid-cols-[1fr_2fr_auto]"
          key={relation.id}
        >
          <Field>
            <FieldLabel htmlFor={`handoff-relation-kind-${relation.id}`}>
              Relation
            </FieldLabel>
            <NativeSelect
              disabled={disabled}
              id={`handoff-relation-kind-${relation.id}`}
              onChange={(event) =>
                onChange(
                  value.map((item) =>
                    item.id === relation.id
                      ? {
                          ...item,
                          kind: event.target.value as RelationDraft["kind"],
                        }
                      : item,
                  ),
                )
              }
              value={relation.kind}
            >
              <NativeSelectOption value="Related">Related</NativeSelectOption>
              <NativeSelectOption value="Origin">Origin</NativeSelectOption>
              <NativeSelectOption value="Blocks">Blocks</NativeSelectOption>
              <NativeSelectOption value="Blocked by">
                Blocked by
              </NativeSelectOption>
            </NativeSelect>
          </Field>
          <Field>
            <FieldLabel htmlFor={`handoff-related-work-${relation.id}`}>
              Related Work
            </FieldLabel>
            <NativeSelect
              disabled={disabled || relatedWorks.length === 0}
              id={`handoff-related-work-${relation.id}`}
              onChange={(event) =>
                onChange(
                  value.map((item) =>
                    item.id === relation.id
                      ? {
                          ...item,
                          targetWorkId: event.target.value,
                        }
                      : item,
                  ),
                )
              }
              value={relation.targetWorkId}
            >
              {relatedWorks.map((candidate) => (
                <NativeSelectOption key={candidate.id} value={candidate.id}>
                  {candidate.key} · {candidate.title}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </Field>
          <Button
            disabled={disabled}
            onClick={() =>
              onChange(value.filter((item) => item.id !== relation.id))
            }
            size="sm"
            type="button"
            variant="outline"
          >
            Remove proposed relation
          </Button>
        </div>
      ))}
      <Button
        disabled={disabled || relatedWorks.length === 0 || value.length >= 25}
        onClick={() =>
          onChange([
            ...value,
            {
              id: crypto.randomUUID(),
              kind: "Related",
              targetWorkId: relatedWorks[0]?.id ?? "",
            },
          ])
        }
        size="sm"
        type="button"
        variant="outline"
      >
        Add proposed relation
      </Button>
    </fieldset>
  );
}
