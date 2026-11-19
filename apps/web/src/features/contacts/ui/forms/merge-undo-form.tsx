// biome-ignore-all lint/performance/noJsxPropsBind: The confirmation sends the founder's local answer.

import {
  type MergeUndoPreview,
  type MergeUndoResolution,
  mergeUndoResolutionSchema,
} from "@cantiara/api/contacts";
import {
  RadioGroup,
  RadioGroupItem,
} from "@cantiara/ui/components/radio-group";
import { useForm } from "@tanstack/react-form";
import type { SubmitEvent } from "react";
import { mergeUndoFormSchema } from "../../lib/merge-undo-form";

const RESOLUTIONS = mergeUndoResolutionSchema.options;

/**
 * Confirm Undo Merge: the answer for a field changed since the merge, then an
 * explicit confirmation. Nothing is written before the founder confirms.
 */
export function MergeUndoForm({
  conflict,
  onCancel,
  onConfirm,
  pending,
}: {
  conflict: MergeUndoPreview["conflicts"][number] | undefined;
  onCancel: () => void;
  onConfirm: (resolution: MergeUndoResolution | null) => void;
  pending: boolean;
}) {
  const form = useForm({
    defaultValues: { resolution: "" as MergeUndoResolution | "" },
    onSubmit: ({ value }) => {
      const parsed = mergeUndoFormSchema(conflict !== undefined).safeParse(
        value,
      );
      // Confirm Undo Merge stays disabled until a changed field has an answer.
      if (!parsed.success) {
        return;
      }
      onConfirm(parsed.data.resolution || null);
    },
  });

  function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    event.stopPropagation();
    form.handleSubmit().catch(() => undefined);
  }

  return (
    <form className="space-y-3" onSubmit={submit}>
      {conflict ? (
        <fieldset className="space-y-1">
          <legend className="font-medium">
            {conflict.field} changed after the merge
          </legend>
          <p>
            Now {conflict.currentValue ?? "empty"}; before the merge{" "}
            {conflict.previousValue ?? "empty"}.
          </p>
          <form.Field name="resolution">
            {(field) => (
              <RadioGroup
                name="display-name-resolution"
                onValueChange={(value) =>
                  field.handleChange(
                    RESOLUTIONS.find((item) => item === value) ?? "",
                  )
                }
                value={field.state.value}
              >
                {RESOLUTIONS.map((option, index) => (
                  <label
                    className="flex items-center gap-2"
                    htmlFor={`display-name-resolution-${index}`}
                    key={option}
                  >
                    <RadioGroupItem
                      id={`display-name-resolution-${index}`}
                      value={option}
                    />
                    {option}
                  </label>
                ))}
              </RadioGroup>
            )}
          </form.Field>
        </fieldset>
      ) : null}
      <form.Subscribe selector={(state) => state.values.resolution}>
        {(resolution) => (
          <div className="flex gap-3">
            <button
              className="rounded-md bg-primary px-3 py-2 text-primary-foreground disabled:opacity-50"
              disabled={
                pending || (conflict !== undefined && resolution === "")
              }
              type="submit"
            >
              Confirm Undo Merge
            </button>
            <button
              className="rounded-md border px-3 py-2"
              onClick={onCancel}
              type="button"
            >
              Cancel
            </button>
          </div>
        )}
      </form.Subscribe>
    </form>
  );
}
