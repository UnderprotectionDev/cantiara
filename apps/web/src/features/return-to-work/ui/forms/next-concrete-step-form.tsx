// biome-ignore-all lint/performance/noJsxPropsBind: Forms close over their source record and field state.

import type { AccountPreferences } from "@cantiara/api/account-preferences";
import {
  nextConcreteStepSchema,
  type ReturnContext,
  type ReturnSource,
} from "@cantiara/api/return-to-work";
import { Button } from "@cantiara/ui/components/button";
import { Field, FieldLabel } from "@cantiara/ui/components/field";
import { Textarea } from "@cantiara/ui/components/textarea";
import { useForm, useSelector } from "@tanstack/react-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { commandVariables } from "@/lib/command-variables";
import { submitForm } from "@/lib/submit-form";
import { client, orpc } from "@/utils/orpc";
import { formatAccountDateTime } from "../../../account-preferences/lib/account-preferences-format";
import { ReturnSourceLink } from "../components/return-cards";

export function NextConcreteStepForm({
  context,
  preferences,
  readOnly,
  source,
}: {
  context: ReturnContext;
  preferences: AccountPreferences;
  readOnly: boolean;
  source: ReturnSource;
}) {
  const queryClient = useQueryClient();

  const save = useMutation(
    orpc.saveNextConcreteStep.mutationOptions({
      meta: { onlineWrite: true },
      mutationFn: (input) => client.saveNextConcreteStep(input),
      onSuccess: async (_, { projectId, workId }) => {
        await Promise.all(
          [
            orpc.returnToWork.queryKey({ input: { projectId } }),
            workId
              ? orpc.work.queryKey({ input: { workId } })
              : orpc.project.queryKey({ input: { projectId } }),
          ].map((queryKey) => queryClient.invalidateQueries({ queryKey })),
        );
        form.setErrorMap({ onSubmit: undefined });
        toast.success("Next concrete step saved.");
      },
    }),
  );
  const form = useForm({
    defaultValues: { nextConcreteStep: source.nextConcreteStep ?? "" },
    onSubmit: async ({ value }) => {
      form.setErrorMap({ onSubmit: undefined });
      const parsed = nextConcreteStepSchema.safeParse(value.nextConcreteStep);
      if (!parsed.success) {
        const message = "Next concrete step must be 4000 characters or fewer.";
        form.setErrorMap({ onSubmit: { form: message, fields: {} } });
        toast.error(message);
        return;
      }
      const request = {
        ...context,
        baseRevision: source.revision,
        nextConcreteStep: parsed.data || null,
      };
      try {
        await save.mutateAsync(
          commandVariables(request, save.isError ? save.variables : undefined),
        );
        form.reset({ nextConcreteStep: parsed.data ?? "" });
      } catch (failure) {
        const message =
          failure instanceof Error
            ? failure.message
            : "Next concrete step could not be saved. Try again.";
        form.setErrorMap({ onSubmit: { form: message, fields: {} } });
        toast.error(message);
      }
    },
  });
  const error = useSelector(
    form.store,
    (state): string | undefined => state.errorMap.onSubmit,
  );
  const edited = useSelector(form.store, (state) => state.isDirty);
  const fieldId = `next-concrete-step-${source.id}`;
  return (
    <form
      className="space-y-3"
      onSubmit={(event) => {
        event.preventDefault();
        event.stopPropagation();
        submitForm(form);
      }}
    >
      <form.Subscribe selector={(state) => state.isSubmitting}>
        {(isSubmitting) => (
          <form.Field name="nextConcreteStep">
            {(field) => (
              <Field>
                <FieldLabel htmlFor={fieldId}>Next concrete step</FieldLabel>
                <Textarea
                  aria-describedby={error ? `${fieldId}-error` : undefined}
                  disabled={readOnly || isSubmitting}
                  id={fieldId}
                  maxLength={4000}
                  onBlur={field.handleBlur}
                  onChange={(event) => {
                    field.handleChange(event.target.value);
                  }}
                  value={field.state.value}
                />
              </Field>
            )}
          </form.Field>
        )}
      </form.Subscribe>
      <p className="text-sm text-muted-foreground">Optional · {source.title}</p>
      <div className="flex flex-wrap items-center gap-3">
        {source.nextConcreteStepUpdatedAt !== null && (
          <time
            className="text-xs text-muted-foreground"
            dateTime={source.nextConcreteStepUpdatedAt}
          >
            {formatAccountDateTime(
              source.nextConcreteStepUpdatedAt,
              preferences,
            )}
          </time>
        )}
        <ReturnSourceLink source={source} />
        {readOnly ? null : (
          <form.Subscribe selector={(state) => state.isSubmitting}>
            {(isSubmitting) => (
              <Button disabled={isSubmitting} type="submit">
                {isSubmitting ? "Saving…" : "Save"}
              </Button>
            )}
          </form.Subscribe>
        )}
      </div>
      {error !== null && (
        <p id={`${fieldId}-error`} role="alert">
          {error}
        </p>
      )}
      {save.isSuccess && !edited && (
        <p role="status">Next concrete step saved.</p>
      )}
    </form>
  );
}
