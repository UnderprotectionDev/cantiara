// biome-ignore-all lint/performance/noJsxPropsBind: Form field render props close over the current field handlers.
import { Button } from "@cantiara/ui/components/button";
import { Input } from "@cantiara/ui/components/input";
import { useForm } from "@tanstack/react-form";
import type { FormEvent } from "react";

import { addBulkClusterFormSchema } from "../../lib/bulk-cluster-form";

export function AddBulkClusterForm({
  disabled,
  onAdd,
}: {
  disabled: boolean;
  onAdd: (name: string) => void;
}) {
  const form = useForm({
    defaultValues: { name: "" },
    onSubmit: ({ formApi, value }) => {
      const parsed = addBulkClusterFormSchema.safeParse(value);
      if (!parsed.success) {
        return;
      }
      onAdd(parsed.data.name);
      formApi.reset();
    },
  });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    event.stopPropagation();
    form.handleSubmit().catch(() => undefined);
  }

  return (
    <form className="flex flex-wrap items-end gap-2" onSubmit={submit}>
      <form.Field name="name">
        {(field) => (
          <label className="grid gap-1 text-sm" htmlFor="bulk-cluster-name">
            New cluster name
            <Input
              id="bulk-cluster-name"
              name={field.name}
              onChange={(event) => field.handleChange(event.target.value)}
              placeholder="Name a cluster"
              value={field.state.value}
            />
          </label>
        )}
      </form.Field>
      <form.Subscribe selector={(state) => state.values.name}>
        {(name) => (
          <Button
            disabled={disabled || !name.trim()}
            type="submit"
            variant="outline"
          >
            Add cluster
          </Button>
        )}
      </form.Subscribe>
    </form>
  );
}
