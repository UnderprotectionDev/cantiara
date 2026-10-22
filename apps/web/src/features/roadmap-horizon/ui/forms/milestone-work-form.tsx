// biome-ignore-all lint/performance/noJsxPropsBind: Milestone controls bind to the current Project and record.

import type { WorkProfile } from "@cantiara/api/work-lifecycle";
import { Button } from "@cantiara/ui/components/button";
import {
  NativeSelect,
  NativeSelectOption,
} from "@cantiara/ui/components/native-select";
import { useForm } from "@tanstack/react-form";
import type { FormEvent } from "react";
import { milestoneWorkRelationFormSchema } from "../../lib/milestone-forms";

export function MilestoneWorkPicker({
  disabled,
  milestoneId,
  onPreview,
  onSelect,
  works,
}: {
  disabled: boolean;
  milestoneId: string;
  onPreview: (workId: string) => void;
  onSelect: () => void;
  works: WorkProfile[];
}) {
  const form = useForm({
    defaultValues: { workId: works[0]?.id ?? "" },
    onSubmit: ({ value }) => {
      const parsed = milestoneWorkRelationFormSchema.safeParse(value);
      if (parsed.success) {
        onPreview(parsed.data.workId);
      }
    },
  });

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    event.stopPropagation();
    form.handleSubmit().catch(() => undefined);
  }

  return (
    <form
      className="flex flex-wrap items-end gap-2"
      noValidate
      onSubmit={handleSubmit}
    >
      <form.Field name="workId">
        {(field) => (
          <label
            className="grid gap-1 text-xs"
            htmlFor={`milestone-work-${milestoneId}`}
          >
            Work
            <NativeSelect
              className="min-h-10"
              disabled={disabled}
              id={`milestone-work-${milestoneId}`}
              name={field.name}
              onChange={(event) => {
                field.handleChange(event.target.value);
                onSelect();
              }}
              value={field.state.value}
            >
              {works.map((work) => (
                <NativeSelectOption key={work.id} value={work.id}>
                  {work.key} · {work.title}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </label>
        )}
      </form.Field>
      <form.Subscribe selector={(state) => state.values.workId}>
        {(workId) => (
          <Button
            disabled={!workId || disabled}
            size="sm"
            type="submit"
            variant="outline"
          >
            Preview relation
          </Button>
        )}
      </form.Subscribe>
    </form>
  );
}
