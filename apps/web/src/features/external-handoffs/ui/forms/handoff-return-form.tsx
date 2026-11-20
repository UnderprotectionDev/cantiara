// biome-ignore-all lint/performance/noJsxPropsBind: Work-owned handoff controls close over their Work and form state.

import {
  externalExecutionHandoffResultInputSchema,
  type RecordExternalExecutionHandoffReturnInput,
} from "@cantiara/api/external-handoffs";
import { Button } from "@cantiara/ui/components/button";
import { Field, FieldLabel } from "@cantiara/ui/components/field";
import { Textarea } from "@cantiara/ui/components/textarea";
import { useForm, useSelector } from "@tanstack/react-form";
import { submitForm } from "@/lib/submit-form";
import { errorMessage } from "../../lib/error-message";

function lines(value: string) {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

export function HandoffReturnForm({
  disabled,
  handoffId,
  onRecordReturn,
}: {
  disabled: boolean;
  handoffId: string;
  onRecordReturn: (
    input: RecordExternalExecutionHandoffReturnInput,
  ) => Promise<unknown>;
}) {
  const id = `handoff-return-${handoffId}`;
  const form = useForm({
    defaultValues: {
      changedAssumptions: "",
      executorSummary: "",
      externalLinks: "",
      openQuestions: "",
      producedEvidence: "",
    },
    onSubmit: async ({ value }) => {
      form.setErrorMap({ onSubmit: undefined });
      const parsed = externalExecutionHandoffResultInputSchema.safeParse({
        changedAssumptions: lines(value.changedAssumptions),
        executorSummary: value.executorSummary,
        externalLinks: lines(value.externalLinks),
        openQuestions: lines(value.openQuestions),
        producedEvidence: lines(value.producedEvidence),
      });
      if (!parsed.success) {
        form.setErrorMap({
          onSubmit: {
            form:
              parsed.error.issues[0]?.message ?? "Check the return details.",
            fields: {},
          },
        });
        return;
      }
      try {
        await onRecordReturn({
          ...parsed.data,
          clientEventId: crypto.randomUUID(),
          handoffId,
        });
      } catch (submitError) {
        form.setErrorMap({
          onSubmit: { form: errorMessage(submitError), fields: {} },
        });
      }
    },
  });
  const error = useSelector(
    form.store,
    (state): string | undefined => state.errorMap.onSubmit,
  );

  return (
    <form
      aria-label="Record return"
      className="space-y-3 rounded-md border border-border/70 bg-card/45 p-3"
      onSubmit={async (event) => {
        event.preventDefault();
        event.stopPropagation();
        await submitForm(form);
      }}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <form.Field name="executorSummary">
          {(field) => (
            <Field>
              <FieldLabel htmlFor={`${id}-summary`}>
                Executor summary
              </FieldLabel>
              <Textarea
                disabled={disabled}
                id={`${id}-summary`}
                onChange={(event) => field.handleChange(event.target.value)}
                required
                rows={3}
                value={field.state.value}
              />
            </Field>
          )}
        </form.Field>
        <form.Field name="changedAssumptions">
          {(field) => (
            <Field>
              <FieldLabel htmlFor={`${id}-assumptions`}>
                Changed assumptions
              </FieldLabel>
              <Textarea
                disabled={disabled}
                id={`${id}-assumptions`}
                onChange={(event) => field.handleChange(event.target.value)}
                rows={3}
                value={field.state.value}
              />
            </Field>
          )}
        </form.Field>
        <form.Field name="producedEvidence">
          {(field) => (
            <Field>
              <FieldLabel htmlFor={`${id}-evidence`}>
                Produced evidence
              </FieldLabel>
              <Textarea
                disabled={disabled}
                id={`${id}-evidence`}
                onChange={(event) => field.handleChange(event.target.value)}
                rows={3}
                value={field.state.value}
              />
            </Field>
          )}
        </form.Field>
        <form.Field name="externalLinks">
          {(field) => (
            <Field>
              <FieldLabel htmlFor={`${id}-links`}>
                Permitted external links
              </FieldLabel>
              <Textarea
                disabled={disabled}
                id={`${id}-links`}
                onChange={(event) => field.handleChange(event.target.value)}
                rows={3}
                value={field.state.value}
              />
            </Field>
          )}
        </form.Field>
        <form.Field name="openQuestions">
          {(field) => (
            <Field className="sm:col-span-2">
              <FieldLabel htmlFor={`${id}-questions`}>
                Open questions
              </FieldLabel>
              <Textarea
                disabled={disabled}
                id={`${id}-questions`}
                onChange={(event) => field.handleChange(event.target.value)}
                rows={3}
                value={field.state.value}
              />
            </Field>
          )}
        </form.Field>
      </div>
      {error ? (
        <p className="text-xs text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      <Button disabled={disabled} size="sm" type="submit">
        Record return
      </Button>
    </form>
  );
}
