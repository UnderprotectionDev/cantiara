// biome-ignore-all lint/performance/noJsxPropsBind: Work-owned handoff controls close over their Work and form state.
import {
  type CancelExternalExecutionHandoffInput,
  cancelExternalExecutionHandoffInputSchema,
} from "@cantiara/api/external-handoffs";
import { Button } from "@cantiara/ui/components/button";
import { Field, FieldLabel } from "@cantiara/ui/components/field";
import { Textarea } from "@cantiara/ui/components/textarea";
import { useForm } from "@tanstack/react-form";
import { useRef, useState } from "react";
import { errorMessage } from "../../lib/error-message";

export function CancelHandoffForm({
  handoffId,
  onCancel,
  pending,
}: {
  handoffId: string;
  onCancel: (input: CancelExternalExecutionHandoffInput) => Promise<unknown>;
  pending: boolean;
}) {
  const [error, setError] = useState<string | null>(null);
  const retryInput = useRef<{
    clientEventId: string;
    reason: string;
  } | null>(null);
  const form = useForm({
    defaultValues: { reason: "" },
    onSubmit: async ({ value }) => {
      setError(null);
      const reason = value.reason.trim();
      const clientEventId =
        retryInput.current?.reason === reason
          ? retryInput.current.clientEventId
          : crypto.randomUUID();
      const parsed = cancelExternalExecutionHandoffInputSchema.safeParse({
        clientEventId,
        handoffId,
        reason: value.reason,
      });
      if (!parsed.success) {
        setError(
          parsed.error.issues[0]?.message ?? "Check the cancellation reason.",
        );
        return;
      }
      retryInput.current = { clientEventId, reason: parsed.data.reason };
      try {
        await onCancel(parsed.data);
        retryInput.current = null;
        form.reset();
      } catch (cancelError) {
        setError(errorMessage(cancelError));
      }
    },
  });

  return (
    <form
      aria-label="Cancel Handoff"
      className="space-y-2 rounded-sm border border-border/70 bg-card/45 p-3"
      onSubmit={async (event) => {
        event.preventDefault();
        event.stopPropagation();
        await form.handleSubmit();
      }}
    >
      <form.Field name="reason">
        {(field) => (
          <Field>
            <FieldLabel htmlFor={`handoff-cancel-reason-${handoffId}`}>
              Reason
            </FieldLabel>
            <Textarea
              disabled={pending}
              id={`handoff-cancel-reason-${handoffId}`}
              onChange={(event) => field.handleChange(event.target.value)}
              required
              rows={2}
              value={field.state.value}
            />
          </Field>
        )}
      </form.Field>
      {error ? (
        <p className="text-destructive text-xs" role="alert">
          {error}
        </p>
      ) : null}
      <Button disabled={pending} size="sm" type="submit" variant="outline">
        Cancel Handoff
      </Button>
    </form>
  );
}
