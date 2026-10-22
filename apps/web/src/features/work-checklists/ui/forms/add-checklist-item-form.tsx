// biome-ignore-all lint/performance/noJsxPropsBind: The form binds its own item field.
import {
  type WorkChecklistItem,
  workChecklistItemSchema,
} from "@cantiara/api/work-lifecycle";
import { Button } from "@cantiara/ui/components/button";
import { Input } from "@cantiara/ui/components/input";
import { useForm } from "@tanstack/react-form";
import type { FormEvent } from "react";

export function AddChecklistItemForm({
  disabled,
  onAdd,
  workKey,
}: {
  disabled: boolean;
  onAdd: (item: WorkChecklistItem) => Promise<boolean>;
  workKey: string;
}) {
  const addItemForm = useForm({
    defaultValues: { newItem: "" },
    onSubmit: async ({ value }) => {
      const item = workChecklistItemSchema.safeParse({
        completed: false,
        id: crypto.randomUUID(),
        text: value.newItem,
      });
      if (!item.success) {
        return;
      }
      const saved = await onAdd(item.data);
      if (saved) {
        addItemForm.reset();
      }
    },
  });

  function handleAddItemSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    event.stopPropagation();
    addItemForm.handleSubmit().catch(() => undefined);
  }

  return (
    <form
      className="flex flex-wrap items-end gap-2 border-border/70 border-t pt-3"
      onSubmit={handleAddItemSubmit}
    >
      <addItemForm.Field name="newItem">
        {(field) => (
          <>
            <label
              className="min-w-48 flex-1 text-muted-foreground text-xs"
              htmlFor={`new-checklist-item-${workKey}`}
            >
              Item
              <Input
                aria-label={`New item for ${workKey}`}
                className="mt-1"
                disabled={disabled}
                id={`new-checklist-item-${workKey}`}
                maxLength={1000}
                name={field.name}
                onChange={(event) => field.handleChange(event.target.value)}
                value={field.state.value}
              />
            </label>
            <Button
              disabled={disabled || !field.state.value.trim()}
              size="sm"
              type="submit"
            >
              Add item
            </Button>
          </>
        )}
      </addItemForm.Field>
    </form>
  );
}
