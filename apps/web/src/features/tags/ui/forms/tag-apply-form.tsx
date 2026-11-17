// biome-ignore-all lint/performance/noJsxPropsBind: Form field render props close over current field handlers.
import { type ApplyTagInput, applyTagInputSchema } from "@cantiara/api/tags";
import { Button } from "@cantiara/ui/components/button";
import { Label } from "@cantiara/ui/components/label";
import {
  NativeSelect,
  NativeSelectOption,
} from "@cantiara/ui/components/native-select";
import { useForm } from "@tanstack/react-form";
import type { FormEvent } from "react";

export interface TagApplyChoice {
  id: string;
  name: string;
}

/** Applies one existing tag to one Work record. */
export function TagApplyForm({
  availableTags,
  onApply,
  pending,
  record,
}: {
  availableTags: readonly TagApplyChoice[];
  onApply: (input: ApplyTagInput) => Promise<unknown>;
  pending: boolean;
  record: Pick<ApplyTagInput, "projectId" | "recordId" | "recordType">;
}) {
  const form = useForm({
    defaultValues: { tagId: "" },
    onSubmit: async ({ value, formApi }) => {
      const parsed = applyTagInputSchema.safeParse({
        projectId: record.projectId,
        recordId: record.recordId,
        recordType: record.recordType,
        tagId: value.tagId,
      });
      if (!parsed.success) {
        return;
      }
      try {
        await onApply(parsed.data);
      } catch {
        // The surface shows the failure and the selection stays for a retry.
        return;
      }
      formApi.reset();
    },
  });
  const selectId = `apply-tag-${record.recordId}`;

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    event.stopPropagation();
    form.handleSubmit().catch(() => undefined);
  }

  return (
    <form
      className="flex flex-wrap items-end gap-2 border-border/70 border-t pt-3"
      noValidate
      onSubmit={submit}
    >
      <form.Field name="tagId">
        {(field) => (
          <div className="min-w-48 space-y-2">
            <Label htmlFor={selectId}>Apply tag</Label>
            <NativeSelect
              disabled={availableTags.length === 0 || pending}
              id={selectId}
              onChange={(event) => field.handleChange(event.target.value)}
              value={field.state.value}
            >
              <NativeSelectOption value="">
                {availableTags.length === 0
                  ? "No matching tags."
                  : "Select a tag"}
              </NativeSelectOption>
              {availableTags.map((tag) => (
                <NativeSelectOption key={tag.id} value={tag.id}>
                  {tag.name}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </div>
        )}
      </form.Field>
      <form.Subscribe selector={(state) => state.values.tagId}>
        {(tagId) => (
          <Button disabled={!tagId || pending} size="sm" type="submit">
            Apply tag
          </Button>
        )}
      </form.Subscribe>
    </form>
  );
}
