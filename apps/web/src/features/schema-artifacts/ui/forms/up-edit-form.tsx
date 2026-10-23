// biome-ignore-all lint/performance/noJsxPropsBind: The form binds its own SQL field.
import { Button } from "@cantiara/ui/components/button";
import { Label } from "@cantiara/ui/components/label";
import { Textarea } from "@cantiara/ui/components/textarea";
import { useForm } from "@tanstack/react-form";
import { useId } from "react";

import { upEditFormSchema } from "../../lib/schema-artifact-form-schemas";

/**
 * Edit the Up text before confirming. The text is re-validated by the server;
 * data SQL and statements outside the operation catalog are rejected there.
 */
export function UpEditForm({
  generated,
  onEdit,
  onReset,
  pending,
  upSql,
}: {
  generated: string;
  onEdit: (upSql: string) => void;
  onReset: () => void;
  pending: boolean;
  upSql: string;
}) {
  const fieldId = useId();
  const form = useForm({
    defaultValues: { upSql },
    onSubmit: ({ value }) => {
      if (!upEditFormSchema.safeParse(value).success) {
        return;
      }
      onEdit(value.upSql);
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
      <form.Field name="upSql">
        {(field) => (
          <>
            <Label htmlFor={fieldId}>Edit Up SQL</Label>
            <Textarea
              className="font-mono text-xs"
              id={fieldId}
              onChange={(event) => field.handleChange(event.target.value)}
              rows={8}
              value={field.state.value}
            />
          </>
        )}
      </form.Field>
      <div className="flex gap-2">
        <Button disabled={pending} size="sm" type="submit">
          Re-validate edited Up SQL
        </Button>
        <Button
          disabled={pending}
          onClick={() => {
            form.reset({ upSql: generated });
            onReset();
          }}
          size="sm"
          type="button"
          variant="outline"
        >
          Discard edit
        </Button>
      </div>
    </form>
  );
}
