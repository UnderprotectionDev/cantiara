// biome-ignore-all lint/performance/noJsxPropsBind: The form binds its own SQL field.
import { Button } from "@cantiara/ui/components/button";
import { Label } from "@cantiara/ui/components/label";
import { Textarea } from "@cantiara/ui/components/textarea";
import { useId } from "react";
import type { useUpEditForm } from "../../hooks/use-up-edit-form";

/**
 * Edit the Up text before confirming. The text is re-validated by the server;
 * data SQL and statements outside the operation catalog are rejected there.
 */
export function UpEditForm({
  form,
  pending,
  upSql,
}: {
  form: ReturnType<typeof useUpEditForm>;
  pending: boolean;
  upSql: string;
}) {
  const fieldId = useId();
  return (
    <form
      className="space-y-2"
      onSubmit={(event) => {
        event.preventDefault();
        form.setErrorMap({ onSubmit: undefined });
        form.handleSubmit({ currentSql: upSql }).catch(() => undefined);
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
              value={field.state.value ?? upSql}
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
          onClick={() => form.reset()}
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
