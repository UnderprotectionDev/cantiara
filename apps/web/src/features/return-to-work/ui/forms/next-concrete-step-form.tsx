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
import { useForm } from "@tanstack/react-form";
import { useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { client } from "@/utils/orpc";
import { formatAccountDateTime } from "../../../account-preferences/lib/account-preferences-format";
import { runOnlineOnlyWrite } from "../../../web-macos-client/store/client-shell";
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
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const pending = useRef<{ fingerprint: string; key: string } | null>(null);
  const form = useForm({
    defaultValues: { nextConcreteStep: source.nextConcreteStep ?? "" },
    onSubmit: async ({ value }) => {
      setError(null);
      setSaved(false);
      const parsed = nextConcreteStepSchema.safeParse(value.nextConcreteStep);
      if (!parsed.success) {
        const message = "Next concrete step must be 4000 characters or fewer.";
        setError(message);
        toast.error(message);
        return;
      }
      const request = {
        ...context,
        baseRevision: source.revision,
        nextConcreteStep: parsed.data || null,
      };
      const fingerprint = JSON.stringify(request);
      const attempt =
        pending.current?.fingerprint === fingerprint
          ? pending.current
          : { fingerprint, key: crypto.randomUUID() };
      pending.current = attempt;
      try {
        await runOnlineOnlyWrite(() =>
          client.saveNextConcreteStep({
            ...request,
            clientIdempotencyKey: attempt.key,
          }),
        );
        pending.current = null;
        await queryClient.invalidateQueries();
        form.reset({ nextConcreteStep: parsed.data ?? "" });
        setSaved(true);
        toast.success("Next concrete step saved.");
      } catch (failure) {
        const message =
          failure instanceof Error
            ? failure.message
            : "Next concrete step could not be saved. Try again.";
        setError(message);
        toast.error(message);
      }
    },
  });
  const fieldId = `next-concrete-step-${source.id}`;
  return (
    <form
      className="space-y-3"
      onSubmit={(event) => {
        event.preventDefault();
        event.stopPropagation();
        form.handleSubmit();
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
                    setSaved(false);
                  }}
                  value={field.state.value}
                />
              </Field>
            )}
          </form.Field>
        )}
      </form.Subscribe>
      <p className="text-muted-foreground text-sm">Optional · {source.title}</p>
      <div className="flex flex-wrap items-center gap-3">
        {source.nextConcreteStepUpdatedAt !== null && (
          <time
            className="text-muted-foreground text-xs"
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
      {saved === true && <p role="status">Next concrete step saved.</p>}
    </form>
  );
}
