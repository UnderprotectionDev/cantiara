// biome-ignore-all lint/performance/noJsxPropsBind: Form field render props close over the current field handlers.
import {
  RELEASE_EVIDENCE_ADD_ITEM_LABEL,
  RELEASE_EVIDENCE_CHECKLIST_LABEL,
} from "@cantiara/api/release-evidence";
import { Button } from "@cantiara/ui/components/button";
import { Input } from "@cantiara/ui/components/input";
import { useForm } from "@tanstack/react-form";
import { useId, useState } from "react";
import { z } from "zod";

const checklistTextSchema = z.string().trim().min(1).max(500);

export function AddChecklistItemForm({
  disabled,
  onAdd,
}: {
  disabled: boolean;
  onAdd: (text: string) => Promise<unknown>;
}) {
  const [error, setError] = useState<string>();
  const inputId = useId();
  const form = useForm({
    defaultValues: { text: "" },
    onSubmit: async ({ formApi, value }) => {
      setError(undefined);
      const parsed = checklistTextSchema.safeParse(value.text);
      if (!parsed.success) {
        setError("Write the checklist item first.");
        return;
      }
      try {
        await onAdd(parsed.data);
        formApi.reset();
      } catch (caught) {
        setError(
          caught instanceof Error && caught.message
            ? caught.message
            : "The item was not saved.",
        );
      }
    },
  });
  return (
    <form
      className="flex flex-wrap items-end gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        event.stopPropagation();
        form.handleSubmit().catch(() => undefined);
      }}
    >
      <form.Field name="text">
        {(field) => (
          <div className="grid gap-1 text-sm">
            <label className="font-medium" htmlFor={inputId}>
              {`${RELEASE_EVIDENCE_CHECKLIST_LABEL} item`}
            </label>
            <Input
              disabled={disabled}
              id={inputId}
              maxLength={500}
              onBlur={field.handleBlur}
              onChange={(event) => field.handleChange(event.target.value)}
              value={field.state.value}
            />
          </div>
        )}
      </form.Field>
      <Button disabled={disabled} type="submit">
        {RELEASE_EVIDENCE_ADD_ITEM_LABEL}
      </Button>
      {error ? (
        <p className="basis-full text-sm" role="alert">
          {error}
        </p>
      ) : null}
    </form>
  );
}
