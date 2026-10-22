// biome-ignore-all lint/performance/noJsxPropsBind: Form field render props require closures over current field handlers.
import {
  createDocumentInputSchema,
  type Document,
  documentTypeSchema,
} from "@cantiara/api/documents";
import { Button } from "@cantiara/ui/components/button";
import { Input } from "@cantiara/ui/components/input";
import { Label } from "@cantiara/ui/components/label";
import {
  NativeSelect,
  NativeSelectOption,
} from "@cantiara/ui/components/native-select";
import { Textarea } from "@cantiara/ui/components/textarea";
import { useForm } from "@tanstack/react-form";
import type { FormEvent } from "react";

export interface ConflictResultValues {
  body: string;
  title: string;
  type: Document["type"];
}

export const conflictResultSchema = createDocumentInputSchema.pick({
  body: true,
  title: true,
  type: true,
});

/** The result a Conflict Draft comparison edits before Apply parts. */
export default function DocumentConflictResultForm({
  disabled,
  initial,
  onApply,
  onCreateDocument,
  onDelete,
}: {
  disabled: boolean;
  initial: ConflictResultValues;
  onApply: (values: ConflictResultValues) => void;
  onCreateDocument: (values: ConflictResultValues) => void;
  onDelete: (values: ConflictResultValues) => void;
}) {
  const form = useForm({
    defaultValues: initial,
    onSubmit: ({ value }) => {
      if (conflictResultSchema.safeParse(value).success) {
        onApply(value);
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
        <Label htmlFor="conflict-result-title">Title</Label>
        <form.Field name="title">
          {(field) => (
            <Input
              id="conflict-result-title"
              name={field.name}
              onChange={(event) => field.handleChange(event.target.value)}
              value={field.state.value}
            />
          )}
        </form.Field>
        <Label htmlFor="conflict-result-type">Type</Label>
        <form.Field name="type">
          {(field) => (
            <NativeSelect
              id="conflict-result-type"
              name={field.name}
              onChange={(event) =>
                field.handleChange(documentTypeSchema.parse(event.target.value))
              }
              value={field.state.value}
            >
              {documentTypeSchema.options.map((type) => (
                <NativeSelectOption key={type} value={type}>
                  {type}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          )}
        </form.Field>
        <Label htmlFor="conflict-result-body">Markdown source</Label>
        <form.Field name="body">
          {(field) => (
            <Textarea
              className="min-h-40 font-mono"
              id="conflict-result-body"
              name={field.name}
              onChange={(event) => field.handleChange(event.target.value)}
              value={field.state.value}
            />
          )}
        </form.Field>
        <div className="flex flex-wrap gap-2">
          <form.Subscribe selector={(state) => state.values.title}>
            {(title) => (
              <Button disabled={!title.trim()} type="submit">
                Apply parts
              </Button>
            )}
          </form.Subscribe>
          <Button
            onClick={() => onCreateDocument(form.state.values)}
            type="button"
            variant="outline"
          >
            Create Document
          </Button>
          <Button
            onClick={() => onDelete(form.state.values)}
            type="button"
            variant="destructive"
          >
            Delete
          </Button>
        </div>
      </fieldset>
    </form>
  );
}
