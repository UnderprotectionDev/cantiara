// biome-ignore-all lint/performance/noJsxPropsBind: Form field render props close over the current field handlers.
import { Button } from "@cantiara/ui/components/button";
import { Textarea } from "@cantiara/ui/components/textarea";
import { useForm } from "@tanstack/react-form";
import type { FormEvent } from "react";

import { resolveBlockerFormSchema } from "../../lib/relation-forms";

/** `Mark blocker resolved` note form; a failed resolve keeps the note for a retry. */
export function ResolveBlockerForm({
  disabled,
  onCancel,
  onResolve,
  relationId,
}: {
  disabled: boolean;
  onCancel: () => void;
  onResolve: (note?: string) => Promise<unknown>;
  relationId: string;
}) {
  const form = useForm({
    defaultValues: { note: "" },
    onSubmit: async ({ value }) => {
      const parsed = resolveBlockerFormSchema.safeParse(value);
      if (!parsed.success) {
        return;
      }
      try {
        await onResolve(parsed.data.note || undefined);
      } catch {
        // The parent mutation reports the failure in the section alert.
      }
    },
  });

  return (
    <form
      className="flex w-full flex-col gap-2 sm:max-w-sm"
      onSubmit={(event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        event.stopPropagation();
        form.handleSubmit().catch(() => undefined);
      }}
    >
      <label
        className="text-muted-foreground"
        htmlFor={`blocker-resolution-note-${relationId}`}
      >
        Note
      </label>
      <form.Field name="note">
        {(field) => (
          <Textarea
            id={`blocker-resolution-note-${relationId}`}
            maxLength={1000}
            name={field.name}
            onChange={(event) => field.handleChange(event.target.value)}
            value={field.state.value}
          />
        )}
      </form.Field>
      <div className="flex flex-wrap gap-2">
        <Button disabled={disabled} size="xs" type="submit">
          Confirm resolution
        </Button>
        <Button onClick={onCancel} size="xs" type="button" variant="outline">
          Cancel
        </Button>
      </div>
    </form>
  );
}
