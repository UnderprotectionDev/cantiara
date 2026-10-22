// biome-ignore-all lint/performance/noJsxPropsBind: Forms close over their own draft fields and the current selection.
import { Button } from "@cantiara/ui/components/button";
import { Input } from "@cantiara/ui/components/input";
import { Label } from "@cantiara/ui/components/label";
import { useForm } from "@tanstack/react-form";
import { type FormEvent, useId } from "react";
import { createGroupFormSchema } from "../../lib/project-wall-narrative-forms";

export default function GroupSelectionForm({
  onGroupSelection,
  selection,
}: {
  onGroupSelection: (title: string, cardIds: string[]) => Promise<boolean>;
  selection: readonly string[];
}) {
  const id = useId();
  const form = useForm({
    defaultValues: { title: "" },
    onSubmit: async ({ formApi, value }) => {
      const parsed = createGroupFormSchema.safeParse(value);
      if (!parsed.success || selection.length === 0) {
        return;
      }
      if (await onGroupSelection(parsed.data.title, [...selection])) {
        // Only a persisted group clears the draft; a failed write keeps it.
        formApi.reset();
      }
    },
  });
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    event.stopPropagation();
    form.handleSubmit().catch(() => undefined);
  }
  return (
    <form
      aria-label="Group selection"
      className="flex flex-wrap items-end gap-2"
      onSubmit={submit}
    >
      <form.Field name="title">
        {(field) => (
          <div className="space-y-1">
            <Label htmlFor={id}>Group name</Label>
            <Input
              id={id}
              name={field.name}
              onChange={(event) => field.handleChange(event.target.value)}
              value={field.state.value}
            />
          </div>
        )}
      </form.Field>
      <form.Subscribe selector={(state) => state.values.title}>
        {(title) => (
          <Button
            disabled={title.trim() === "" || selection.length === 0}
            type="submit"
            variant="outline"
          >
            Group selection
          </Button>
        )}
      </form.Subscribe>
      <span className="text-muted-foreground text-xs">
        {selection.length} selected
      </span>
    </form>
  );
}
