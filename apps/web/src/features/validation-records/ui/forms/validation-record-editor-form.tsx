// biome-ignore-all lint/performance/noJsxPropsBind: Controls bind to the selected record and form field.
import type { ProjectSourceRecord } from "@cantiara/api/project-source-records";
import { Button } from "@cantiara/ui/components/button";
import { Checkbox } from "@cantiara/ui/components/checkbox";
import { Input } from "@cantiara/ui/components/input";
import { Textarea } from "@cantiara/ui/components/textarea";
import { useForm, useSelector } from "@tanstack/react-form";
import type { SubmitEvent } from "react";

import {
  isConflictError,
  isValidationContextRecord,
  type Save,
  type ValidationRecord,
  validationRecordFormSchema,
} from "../../lib/validation-record";

const fields = [
  { name: "title", label: "Title", maxLength: 255 },
  { name: "method", label: "Method", maxLength: 100_000 },
  { name: "result", label: "Result", maxLength: 100_000 },
] as const;

export function ValidationRecordEditor({
  record,
  counterparts,
  onSave,
  onCancel,
  saveError,
  savePending = false,
}: {
  record?: ValidationRecord;
  counterparts: ProjectSourceRecord[];
  onSave: Save;
  onCancel: () => void;
  saveError?: unknown;
  savePending?: boolean;
}) {
  const conflict = isConflictError(saveError);
  const form = useForm({
    defaultValues: {
      baseRecord: record,
      title: record?.title ?? "",
      method: record?.method ?? "",
      result: record?.result ?? "",
      context: record?.context ?? [],
    },
    validators: {
      onSubmit: ({ value: { baseRecord: _baseRecord, ...value } }) =>
        validationRecordFormSchema.safeParse(value).success
          ? undefined
          : "Enter a Title and Method before saving.",
    },
    onSubmit: async ({ value: { baseRecord, ...value } }) => {
      await onSave(
        { ...value, result: value.result.trim() || null },
        baseRecord,
      );
    },
  });
  const formError = useSelector(form.store, (state) => state.errorMap.onSubmit);
  let error = formError;
  if (!error && saveError) {
    error = conflict
      ? "Validation Record or Related context changed. Cancel and reopen before saving. Your text is kept here."
      : "Validation Record could not be saved. Retry or reload to check for changes. Your text is kept here.";
  }
  function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    form.handleSubmit().catch(() => undefined);
  }
  const submitLabel = error && !conflict ? "Retry" : "Save";
  return (
    <form
      className="space-y-4 rounded-lg border border-border/70 p-5"
      onSubmit={submit}
    >
      <h3 className="font-medium">Validation Record</h3>
      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      <form.Subscribe selector={(state) => state.isSubmitting || savePending}>
        {(pending) => (
          <>
            {fields.map(({ name, label, maxLength }) => (
              <form.Field key={name} name={name}>
                {(field) => (
                  <div className="grid gap-2 text-sm">
                    <label htmlFor={`validation-${name}`}>
                      {label}
                      {name === "result" ? " (optional)" : ""}
                    </label>
                    {name === "title" ? (
                      <Input
                        autoFocus
                        disabled={pending}
                        id={`validation-${name}`}
                        maxLength={maxLength}
                        onBlur={field.handleBlur}
                        onChange={(event) =>
                          field.handleChange(event.target.value)
                        }
                        required
                        value={field.state.value}
                      />
                    ) : (
                      <Textarea
                        disabled={pending}
                        id={`validation-${name}`}
                        maxLength={maxLength}
                        onBlur={field.handleBlur}
                        onChange={(event) =>
                          field.handleChange(event.target.value)
                        }
                        required={name === "method"}
                        value={field.state.value}
                      />
                    )}
                  </div>
                )}
              </form.Field>
            ))}
            <form.Field name="context">
              {(field) => (
                <fieldset className="space-y-2" disabled={pending}>
                  <legend className="text-sm font-medium">Related</legend>
                  {counterparts
                    .filter(isValidationContextRecord)
                    .map((source) => (
                      <label
                        className="flex min-h-11 items-center gap-3 text-sm"
                        htmlFor={`validation-context-${source.sourceType.replaceAll(" ", "-")}-${source.id}`}
                        key={`${source.sourceType}:${source.id}`}
                      >
                        <Checkbox
                          checked={field.state.value.some(
                            (link) =>
                              link.sourceType === source.sourceType &&
                              link.sourceId === source.id,
                          )}
                          id={`validation-context-${source.sourceType.replaceAll(" ", "-")}-${source.id}`}
                          onCheckedChange={(checked) => {
                            field.handleChange(
                              checked
                                ? [
                                    ...field.state.value,
                                    {
                                      sourceType: source.sourceType,
                                      sourceId: source.id,
                                    },
                                  ]
                                : field.state.value.filter(
                                    (link) =>
                                      !(
                                        link.sourceType === source.sourceType &&
                                        link.sourceId === source.id
                                      ),
                                  ),
                            );
                          }}
                        />
                        <span>
                          {source.sourceType}: {source.title}
                        </span>
                      </label>
                    ))}
                  {counterparts.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      No context records available.
                    </p>
                  ) : null}
                </fieldset>
              )}
            </form.Field>
            <p className="text-sm text-muted-foreground">
              Saving a Result keeps related Assumption, Open Question and
              Decision life unchanged.
            </p>
            <div className="flex gap-2">
              <Button disabled={pending || conflict} type="submit">
                {pending ? "Saving…" : <span>{submitLabel}</span>}
              </Button>
              <Button
                disabled={pending}
                onClick={onCancel}
                type="button"
                variant="outline"
              >
                Cancel
              </Button>
            </div>
          </>
        )}
      </form.Subscribe>
    </form>
  );
}
