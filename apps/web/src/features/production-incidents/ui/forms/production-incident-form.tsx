// biome-ignore-all lint/performance/noJsxPropsBind: Fields bind to their own form state.

import { Button } from "@cantiara/ui/components/button";
import { Input } from "@cantiara/ui/components/input";
import { Textarea } from "@cantiara/ui/components/textarea";
import { useForm } from "@tanstack/react-form";
import { type FormEvent, useState } from "react";
import {
  EMPTY_PRODUCTION_INCIDENT_DRAFT,
  PRODUCTION_INCIDENT_TEXT_FIELDS,
  type ProductionIncidentDraft,
  type ProductionIncidentFormValues,
  productionIncidentFormSchema,
} from "../../lib/production-incident-form";

const SUBMIT_LABEL = {
  create: "Record Production Incident",
  edit: "Save changes",
} as const;

/**
 * Create or edit a Production Incident: a title, when it happened and the
 * optional impact, detection, resolution, root cause and learning texts. A
 * new incident starts `Open`; the form never creates a Bug, Risk or Work.
 */
export function ProductionIncidentForm({
  draft = EMPTY_PRODUCTION_INCIDENT_DRAFT,
  mode,
  onCancel,
  onSubmit,
  timeZone,
}: {
  draft?: ProductionIncidentDraft;
  mode: "create" | "edit";
  onCancel?: () => void;
  onSubmit: (values: ProductionIncidentFormValues) => Promise<unknown>;
  /** Account time zone; the occurrence time is entered and shown in it. */
  timeZone: string;
}) {
  const [error, setError] = useState<string | null>(null);
  const form = useForm({
    defaultValues: draft,
    onSubmit: async ({ value }) => {
      setError(null);
      const parsed = productionIncidentFormSchema(timeZone).safeParse(value);
      if (!parsed.success) {
        setError("Enter a title and when the incident began.");
        return;
      }
      try {
        await onSubmit(parsed.data);
      } catch {
        setError(
          mode === "create"
            ? "Production Incident could not be created. Retry; your text is kept here."
            : "Production Incident could not be saved. Reload and try again.",
        );
      }
    },
  });
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    event.stopPropagation();
    form.handleSubmit().catch(() => undefined);
  }
  return (
    <form
      aria-label={
        mode === "create" ? "Record Production Incident" : "Edit incident"
      }
      className="space-y-4"
      onSubmit={submit}
    >
      {error ? (
        <p className="text-destructive text-sm" role="alert">
          {error}
        </p>
      ) : null}
      <form.Subscribe selector={(state) => state.isSubmitting}>
        {(isSubmitting) => (
          <>
            <form.Field name="title">
              {(field) => (
                <label
                  className="grid gap-2 text-sm"
                  htmlFor="production-incident-title"
                >
                  Title
                  <Input
                    disabled={isSubmitting}
                    id="production-incident-title"
                    maxLength={255}
                    name="title"
                    onBlur={field.handleBlur}
                    onChange={(event) => field.handleChange(event.target.value)}
                    required
                    value={field.state.value}
                  />
                </label>
              )}
            </form.Field>
            <form.Field name="occurredAt">
              {(field) => (
                <label
                  className="grid gap-2 text-sm"
                  htmlFor="production-incident-occurred-at"
                >
                  Occurred at
                  <Input
                    disabled={isSubmitting}
                    id="production-incident-occurred-at"
                    name="occurredAt"
                    onBlur={field.handleBlur}
                    onChange={(event) => field.handleChange(event.target.value)}
                    required
                    type="datetime-local"
                    value={field.state.value}
                  />
                </label>
              )}
            </form.Field>
            {PRODUCTION_INCIDENT_TEXT_FIELDS.map(({ label, name }) => (
              <form.Field key={name} name={name}>
                {(field) => (
                  <label
                    className="grid gap-2 text-sm"
                    htmlFor={`production-incident-${name}`}
                  >
                    {label} (optional)
                    <Textarea
                      disabled={isSubmitting}
                      id={`production-incident-${name}`}
                      maxLength={20_000}
                      name={name}
                      onBlur={field.handleBlur}
                      onChange={(event) =>
                        field.handleChange(event.target.value)
                      }
                      value={field.state.value}
                    />
                  </label>
                )}
              </form.Field>
            ))}
            <p className="text-muted-foreground text-sm">
              {mode === "create"
                ? "Starts as Open. A Production Incident is a record, not a Bug: it pages no one and creates no Bug, Risk or Work."
                : "Saving changes the record only; it does not change a linked record."}
            </p>
            <div className="flex flex-wrap gap-3">
              <Button disabled={isSubmitting} type="submit">
                {isSubmitting ? "Saving…" : SUBMIT_LABEL[mode]}
              </Button>
              {onCancel ? (
                <Button
                  disabled={isSubmitting}
                  onClick={onCancel}
                  type="button"
                  variant="outline"
                >
                  Cancel
                </Button>
              ) : null}
            </div>
          </>
        )}
      </form.Subscribe>
    </form>
  );
}
