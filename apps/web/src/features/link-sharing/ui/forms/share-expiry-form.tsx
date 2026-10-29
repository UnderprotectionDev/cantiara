// biome-ignore-all lint/performance/noJsxPropsBind: Fields and actions bind to their own form state.

import { Button } from "@cantiara/ui/components/button";
import { useForm } from "@tanstack/react-form";
import { type FormEvent, useId, useState } from "react";
import { DateTimePicker } from "@/components/date-picker";
import { expiryInstant, isFutureInstant } from "../../lib/share-lifecycle";

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
  initial,
  legend,
  onSubmit,
  timeZone,
}: {
  actions: readonly ShareExpiryAction[];
  initial: string;
  legend: string;
  onSubmit: (actionId: string, expiresAt: string | null) => Promise<unknown>;
  timeZone: string;
}) {
  const id = useId();
  const [error, setError] = useState<string | null>(null);
  const form = useForm({
    defaultValues: { expiry: initial },
    onSubmit: async ({ meta, value }) => {
      setError(null);
      const action = actions.find((entry) => entry.id === meta?.action);
      if (!action) {
        return;
      }
      let instant: string | null = null;
      if (!action.clears) {
        try {
          instant = expiryInstant(value.expiry, timeZone);
        } catch (failure) {
          setError(
            failure instanceof RangeError
              ? failure.message
              : "Enter a valid time.",
          );
          return;
        }
        if (!isFutureInstant(instant)) {
          setError("Choose a time in the future.");
          return;
        }
      }
      try {
        await onSubmit(action.id, instant);
      } catch {
        setError("That did not work. Try again.");
      }
    },
    onSubmitMeta: { action: "" } as { action: string },
  });
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    event.stopPropagation();
    const first = actions.find((entry) => !entry.clears);
    form.handleSubmit({ action: first?.id ?? "" }).catch(() => undefined);
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
            <p className="text-muted-foreground text-xs" id={`${id}-zone`}>
              Your profile time zone: {timeZone}. Leave empty for no expiry.
            </p>
          </div>
        )}
      </form.Field>
      {error ? (
        <p className="text-destructive text-sm" id={`${id}-error`} role="alert">
          {error}
        </p>
      ) : null}
      <form.Subscribe selector={(state) => state.isSubmitting}>
        {(isSubmitting) => (
          <div className="flex flex-wrap gap-2">
            {actions.map((action) => (
              <Button
                disabled={isSubmitting}
                key={action.id}
                onClick={() => {
                  form
                    .handleSubmit({ action: action.id })
                    .catch(() => undefined);
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
