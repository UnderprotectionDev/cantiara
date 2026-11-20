// biome-ignore-all lint/performance/noJsxPropsBind: Form field render props close over current field handlers.

import { createTagInputSchema } from "@cantiara/api/tags";
import { Button } from "@cantiara/ui/components/button";
import { Input } from "@cantiara/ui/components/input";
import { Label } from "@cantiara/ui/components/label";
import { useForm, useSelector } from "@tanstack/react-form";
import type { SubmitEvent } from "react";
import { submitForm } from "@/lib/submit-form";

export function CreateTagForm({
  error: writeError,
  onCreate,
  pending,
}: {
  error: string | null;
  onCreate: (name: string) => Promise<unknown>;
  pending: boolean;
}) {
  const form = useForm({
    defaultValues: { name: "" },
    onSubmit: async ({ value, formApi }) => {
      const parsed = createTagInputSchema.safeParse({ name: value.name });
      if (!parsed.success) {
        formApi.setErrorMap({
          onSubmit: {
            form: parsed.error.issues[0]?.message ?? "Check the tag name.",
            fields: {},
          },
        });
        return;
      }
      try {
        await onCreate(parsed.data.name);
      } catch {
        return;
      }
      formApi.reset();
    },
  });

  const validationError = useSelector(
    form.store,
    (state): string | undefined => state.errorMap.onSubmit,
  );
  const error = validationError ?? writeError;

  function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    event.stopPropagation();
    submitForm(form).catch(() => undefined);
  }

  return (
    <form
      aria-label="Create tag"
      className="grid gap-3 border-b border-border/70 pb-6 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end"
      noValidate
      onSubmit={handleSubmit}
    >
      <form.Field name="name">
        {(field) => (
          <div className="space-y-2">
            <Label htmlFor="tag-name">Name</Label>
            <Input
              disabled={pending}
              id="tag-name"
              onChange={(event) => field.handleChange(event.target.value)}
              placeholder="e.g. roadmap/next"
              value={field.state.value}
            />
          </div>
        )}
      </form.Field>
      <Button disabled={pending} type="submit">
        Create tag
      </Button>
      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </form>
  );
}
