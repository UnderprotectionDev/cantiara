// biome-ignore-all lint/performance/noJsxPropsBind: Form field render props require closures over current field handlers.
import { Button } from "@cantiara/ui/components/button";
import { DialogFooter } from "@cantiara/ui/components/dialog";
import { Input } from "@cantiara/ui/components/input";
import { Label } from "@cantiara/ui/components/label";
import { Textarea } from "@cantiara/ui/components/textarea";
import { useForm } from "@tanstack/react-form";
import type { FormEvent } from "react";
import {
  type ConflictResultValues,
  conflictResultSchema,
} from "./document-conflict-result-form";

/** The new Document a Conflict Draft can become, inside the Create Document dialog. */
export default function DocumentConflictIndependentForm({
  disabled,
  error,
  initial,
  onCancel,
  onSubmit,
}: {
  disabled: boolean;
  error: string | null;
  initial: ConflictResultValues;
  onCancel: () => void;
  onSubmit: (values: ConflictResultValues) => void;
}) {
  const form = useForm({
    defaultValues: initial,
    onSubmit: ({ value }) => {
      if (conflictResultSchema.safeParse(value).success) {
        onSubmit(value);
      }
    },
  });
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    event.stopPropagation();
    form.handleSubmit().catch(() => undefined);
  }
  return (
    <form noValidate onSubmit={submit}>
      <fieldset className="space-y-3" disabled={disabled}>
        <Label htmlFor="conflict-new-title">Title</Label>
        <form.Field name="title">
          {(field) => (
            <Input
              id="conflict-new-title"
              name={field.name}
              onChange={(event) => field.handleChange(event.target.value)}
              value={field.state.value}
            />
          )}
        </form.Field>
        <Label htmlFor="conflict-new-body">Markdown source</Label>
        <form.Field name="body">
          {(field) => (
            <Textarea
              className="min-h-40 font-mono"
              id="conflict-new-body"
              name={field.name}
              onChange={(event) => field.handleChange(event.target.value)}
              value={field.state.value}
            />
          )}
        </form.Field>
        {error ? <p role="alert">{error}</p> : null}
        <DialogFooter>
          <Button onClick={onCancel} type="button" variant="outline">
            Cancel
          </Button>
          <form.Subscribe selector={(state) => state.values.title}>
            {(title) => (
              <Button disabled={!title.trim()} type="submit">
                Create Document
              </Button>
            )}
          </form.Subscribe>
        </DialogFooter>
      </fieldset>
    </form>
  );
}
