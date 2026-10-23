// biome-ignore-all lint/performance/noJsxPropsBind: The form binds its own confirmation fields.
import { Button } from "@cantiara/ui/components/button";
import { Checkbox } from "@cantiara/ui/components/checkbox";
import { Label } from "@cantiara/ui/components/label";
import { useForm } from "@tanstack/react-form";
import { useId } from "react";

import { confirmArtifactFormSchema } from "../../lib/schema-artifact-form-schemas";

/**
 * Confirms the draft into an immutable Migration Artifact. Every potentially
 * destructive operation needs its own confirmation; nothing here applies SQL.
 */
export function ConfirmArtifactForm({
  destructive,
  disabled,
  onConfirm,
  supersedable,
}: {
  destructive: { id: string; label: string }[];
  disabled: boolean;
  onConfirm: (input: {
    confirmedDestructiveOperationIds: string[];
    supersedes: string | null;
  }) => void;
  supersedable: { id: string; label: string }[];
}) {
  const prefix = useId();
  const form = useForm({
    defaultValues: {
      confirmedDestructiveOperationIds: [] as string[],
      supersedes: null as string | null,
    },
    onSubmit: ({ value }) => {
      if (!confirmArtifactFormSchema.safeParse(value).success) {
        return;
      }
      onConfirm(value);
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
      <form.Field name="confirmedDestructiveOperationIds">
        {(field) => (
          <>
            {destructive.map((operation) => (
              <div className="flex items-center gap-2" key={operation.id}>
                <Checkbox
                  checked={field.state.value.includes(operation.id)}
                  id={`${prefix}-${operation.id}`}
                  onCheckedChange={(checked) =>
                    field.handleChange(
                      checked
                        ? [...field.state.value, operation.id]
                        : field.state.value.filter((id) => id !== operation.id),
                    )
                  }
                />
                <Label htmlFor={`${prefix}-${operation.id}`}>
                  {`I confirm potentially destructive ${operation.label}`}
                </Label>
              </div>
            ))}
          </>
        )}
      </form.Field>
      {supersedable.length > 0 ? (
        <form.Field name="supersedes">
          {(field) => (
            <fieldset className="space-y-1">
              <legend className="text-sm">Supersedes Migration Artifact</legend>
              <Button
                aria-pressed={field.state.value === null}
                onClick={() => field.handleChange(null)}
                size="sm"
                type="button"
                variant={field.state.value === null ? "default" : "outline"}
              >
                Supersedes none
              </Button>
              {supersedable.map((artifact) => (
                <Button
                  aria-pressed={field.state.value === artifact.id}
                  key={artifact.id}
                  onClick={() => field.handleChange(artifact.id)}
                  size="sm"
                  type="button"
                  variant={
                    field.state.value === artifact.id ? "default" : "outline"
                  }
                >
                  {`Supersedes ${artifact.label}`}
                </Button>
              ))}
            </fieldset>
          )}
        </form.Field>
      ) : null}
      <form.Subscribe
        selector={(state) => state.values.confirmedDestructiveOperationIds}
      >
        {(confirmed) => (
          <Button
            disabled={disabled || confirmed.length !== destructive.length}
            type="submit"
          >
            Confirm Migration Artifact
          </Button>
        )}
      </form.Subscribe>
    </form>
  );
}
