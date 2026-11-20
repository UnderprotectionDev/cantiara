// biome-ignore-all lint/performance/noJsxPropsBind: Fields and actions bind to their own form state.

import { Button } from "@cantiara/ui/components/button";
import { useForm, useSelector } from "@tanstack/react-form";
import { type SubmitEvent, useId } from "react";
import { DateTimePicker } from "@/components/date-picker";
import { submitForm } from "@/lib/submit-form";
import { linkSharingRefusalMessage } from "../../lib/link-sharing-refusal";
import { shareExpiryFormSchema } from "../../lib/share-lifecycle";

export interface ShareExpiryAction {
  /** A clearing action sends no expiry and ignores the picker. */
  clears?: boolean;
  id: string;
  label: string;
  variant?: "default" | "outline";
}

/**
 * The optional Bağlantı süre dolumu: a date and time in the founder's profile
 * time zone. Empty means no expiry. Each action button is its own submit with
 * its own meaning (extend, reopen, reshare), never a default.
 */
export function ShareExpiryForm({
  actions,
  defaultActionId,
  disabled = false,
  initial,
  legend,
  onSubmit,
  timeZone,
}: {
  actions: readonly ShareExpiryAction[];
  /** The neutral action Enter submits (`set` expiry); without it Enter is inert. */
  defaultActionId?: string | null;
  disabled?: boolean;
  initial: string;
  legend: string;
  onSubmit: (actionId: string, expiresAt: string | null) => Promise<unknown>;
  timeZone: string;
}) {
  const id = useId();

  const form = useForm({
    defaultValues: { expiry: initial },
    onSubmit: async ({ meta, value }) => {
      form.setErrorMap({ onSubmit: undefined });
      const action = actions.find((entry) => entry.id === meta?.action);
      if (!action) {
        return;
      }
      let instant: string | null = null;
      if (!action.clears) {
        const parsed = shareExpiryFormSchema(timeZone).safeParse(value);
        if (!parsed.success) {
          form.setErrorMap({
            onSubmit: {
              form: parsed.error.issues[0]?.message ?? "Enter a valid time.",
              fields: {},
            },
          });
          return;
        }
        instant = parsed.data.expiresAt;
      }
      try {
        await onSubmit(action.id, instant);
      } catch (failure) {
        form.setErrorMap({
          onSubmit: {
            form:
              linkSharingRefusalMessage(failure) ??
              "That did not work. Try again.",
            fields: {},
          },
        });
      }
    },
    onSubmitMeta: { action: "" } as { action: string },
  });
  const error = useSelector(
    form.store,
    (state): string | undefined => state.errorMap.onSubmit,
  );
  function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    event.stopPropagation();
    // Enter in the date picker is only ever the neutral expiry save. The
    // lateral actions (Reshare with a new link, Reopen the same link) run
    // only from their own buttons, never as a default submit.
    if (disabled || !defaultActionId) {
      return;
    }
    submitForm(form, { action: defaultActionId }).catch(() => undefined);
  }
  return (
    <form aria-label={legend} className="grid gap-2" onSubmit={submit}>
      <form.Field name="expiry">
        {(field) => (
          <div className="grid gap-1 text-sm">
            <label htmlFor={`${id}-expiry`}>{legend}</label>
            <DateTimePicker
              aria-describedby={`${id}-zone${error ? ` ${id}-error` : ""}`}
              ariaLabel={legend}
              id={`${id}-expiry`}
              onChange={field.handleChange}
              value={field.state.value}
            />
            <p className="text-xs text-muted-foreground" id={`${id}-zone`}>
              Your profile time zone: {timeZone}. Leave empty for no expiry.
            </p>
          </div>
        )}
      </form.Field>
      {error ? (
        <p className="text-sm text-destructive" id={`${id}-error`} role="alert">
          {error}
        </p>
      ) : null}
      <form.Subscribe selector={(state) => state.isSubmitting}>
        {(isSubmitting) => (
          <div className="flex flex-wrap gap-2">
            {actions.map((action) => (
              <Button
                disabled={disabled || isSubmitting}
                key={action.id}
                onClick={() => {
                  submitForm(form, { action: action.id }).catch(
                    () => undefined,
                  );
                }}
                type="button"
                variant={action.variant ?? "outline"}
              >
                {action.label}
              </Button>
            ))}
          </div>
        )}
      </form.Subscribe>
    </form>
  );
}
