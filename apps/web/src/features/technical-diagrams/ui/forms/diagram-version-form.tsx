// biome-ignore-all lint/performance/noJsxPropsBind: The form binds its own name field.
import { Button } from "@cantiara/ui/components/button";
import { Input } from "@cantiara/ui/components/input";
import { Label } from "@cantiara/ui/components/label";
import { useForm } from "@tanstack/react-form";
import { useId } from "react";

import { versionNameSchema } from "../../lib/technical-diagram-form-schemas";

export function DiagramVersionForm({
  disabled,
  onCreate,
}: {
  disabled: boolean;
  onCreate: (name: string) => void;
}) {
  const nameId = useId();
  const form = useForm({
    defaultValues: { name: "" },
    onSubmit: ({ value, formApi }) => {
      if (!versionNameSchema.safeParse(value).success) {
        return;
      }
      onCreate(value.name.trim());
      formApi.reset();
    },
  });
  return (
    <form
      className="space-y-2"
      onSubmit={(event) => {
        event.preventDefault();
        form.handleSubmit().catch(() => undefined);
      }}
    >
      <form.Field name="name">
        {(field) => (
          <>
            <Label htmlFor={nameId}>Diagram Version name</Label>
            <Input
              id={nameId}
              onChange={(event) => field.handleChange(event.target.value)}
              required
              value={field.state.value}
            />
          </>
        )}
      </form.Field>
      <form.Subscribe selector={(state) => state.values.name}>
        {(name) => (
          <Button disabled={disabled || !name.trim()} type="submit">
            Create Diagram Version
          </Button>
        )}
      </form.Subscribe>
    </form>
  );
}
