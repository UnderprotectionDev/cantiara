// biome-ignore-all lint/performance/noJsxPropsBind: Form field render props close over current field handlers.
import { createTagInputSchema } from "@cantiara/api/tags";
import { Button } from "@cantiara/ui/components/button";
import { Input } from "@cantiara/ui/components/input";
import { Label } from "@cantiara/ui/components/label";
import { useForm } from "@tanstack/react-form";
import type { FormEvent } from "react";

export function CreateTagForm({
  error,
  onCreate,
  onValidationError,
  pending,
}: {
  error: string | null;
  onCreate: (name: string) => Promise<unknown>;
  onValidationError: (message: string | null) => void;
  pending: boolean;
}) {
  const form = useForm({
    defaultValues: { name: "" },
    onSubmit: async ({ value, formApi }) => {
      const parsed = createTagInputSchema.safeParse({ name: value.name });
      if (!parsed.success) {
        onValidationError(
          parsed.error.issues[0]?.message ?? "Check the tag name.",
        );
        return;
      }
      onValidationError(null);
      try {
        await onCreate(parsed.data.name);
      } catch {
        return;
      }
      formApi.reset();
    },
  });

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    event.stopPropagation();
    form.handleSubmit().catch(() => undefined);
  }

  return (
    <form
      aria-label="Create tag"
      className="grid gap-3 border-border/70 border-b pb-6 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end"
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
        <p className="text-destructive text-sm" role="alert">
          {error}
        </p>
      ) : null}
    </form>
  );
}
