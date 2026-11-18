// biome-ignore-all lint/performance/noJsxPropsBind: Draft controls update their owning form field.
import type { PreviewExternalExecutionHandoffReconcileInput } from "@cantiara/api/external-handoffs";
import { Button } from "@cantiara/ui/components/button";
import { Field, FieldLabel } from "@cantiara/ui/components/field";
import { Input } from "@cantiara/ui/components/input";
import {
  NativeSelect,
  NativeSelectOption,
} from "@cantiara/ui/components/native-select";
import { Textarea } from "@cantiara/ui/components/textarea";

type FollowUpWorkDraft =
  PreviewExternalExecutionHandoffReconcileInput["followUpWorks"][number];
export function HandoffFollowUpFields({
  disabled,
  value,
  onChange,
}: {
  disabled: boolean;
  value: FollowUpWorkDraft[];
  onChange: (value: FollowUpWorkDraft[]) => void;
}) {
  return (
    <>
      {value.map((followUpWork) => (
        <fieldset
          className="grid gap-3 rounded-sm border border-border/70 p-3 sm:grid-cols-2"
          key={followUpWork.id}
        >
          <legend className="px-1 text-xs font-medium">Follow-up Work</legend>
          <Field>
            <FieldLabel htmlFor={`handoff-follow-up-title-${followUpWork.id}`}>
              Title
            </FieldLabel>
            <Input
              disabled={disabled}
              id={`handoff-follow-up-title-${followUpWork.id}`}
              onChange={(event) =>
                onChange(
                  value.map((item) =>
                    item.id === followUpWork.id
                      ? { ...item, title: event.target.value }
                      : item,
                  ),
                )
              }
              value={followUpWork.title}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor={`handoff-follow-up-type-${followUpWork.id}`}>
              Type
            </FieldLabel>
            <NativeSelect
              disabled={disabled}
              id={`handoff-follow-up-type-${followUpWork.id}`}
              onChange={(event) =>
                onChange(
                  value.map((item) =>
                    item.id === followUpWork.id
                      ? {
                          ...item,
                          type: event.target.value as FollowUpWorkDraft["type"],
                        }
                      : item,
                  ),
                )
              }
              value={followUpWork.type}
            >
              <NativeSelectOption value="Task">Task</NativeSelectOption>
              <NativeSelectOption value="Bug">Bug</NativeSelectOption>
              <NativeSelectOption value="Feature">Feature</NativeSelectOption>
              <NativeSelectOption value="Research">Research</NativeSelectOption>
              <NativeSelectOption value="Improvement">
                Improvement
              </NativeSelectOption>
            </NativeSelect>
          </Field>
          <Field className="sm:col-span-2">
            <FieldLabel
              htmlFor={`handoff-follow-up-description-${followUpWork.id}`}
            >
              Description
            </FieldLabel>
            <Textarea
              disabled={disabled}
              id={`handoff-follow-up-description-${followUpWork.id}`}
              onChange={(event) =>
                onChange(
                  value.map((item) =>
                    item.id === followUpWork.id
                      ? { ...item, description: event.target.value }
                      : item,
                  ),
                )
              }
              rows={3}
              value={followUpWork.description ?? ""}
            />
          </Field>
          <Button
            className="sm:col-span-2 sm:justify-self-start"
            disabled={disabled}
            onClick={() =>
              onChange(value.filter((item) => item.id !== followUpWork.id))
            }
            size="sm"
            type="button"
            variant="outline"
          >
            Remove follow-up Work
          </Button>
        </fieldset>
      ))}
      <Button
        disabled={disabled || value.length >= 25}
        onClick={() =>
          onChange([
            ...value,
            {
              description: null,
              id: crypto.randomUUID(),
              title: "",
              type: "Task",
            },
          ])
        }
        size="sm"
        type="button"
        variant="outline"
      >
        Add follow-up Work
      </Button>
    </>
  );
}
