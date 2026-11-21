// biome-ignore-all lint/performance/noJsxPropsBind: Decision controls bind to their current record and form field.

import { Button } from "@cantiara/ui/components/button";
import { Input } from "@cantiara/ui/components/input";
import { Textarea } from "@cantiara/ui/components/textarea";
import { useForm, useSelector } from "@tanstack/react-form";
import type { SubmitEvent } from "react";
import { isWriteConflict } from "@/lib/mutation-messages";
import { submitForm } from "@/lib/submit-form";
import {
  decisionFormSchema,
  decisionWithdrawFormSchema,
} from "../../lib/decision-form";
import type {
  DecisionDraft,
  DecisionRecord,
} from "../components/project-decisions-panel";

const FIELDS = [
  { name: "title", label: "Title", maxLength: 255, required: true },
  {
    name: "decision",
    label: "Decision text",
    maxLength: 20_000,
    required: true,
  },
  { name: "rationale", label: "Rationale", maxLength: 20_000, required: false },
] as const;

export function DecisionEditor({
  record,
  withdrawing = false,
  onSave,
  onCancel,
  writeError,
}: {
  record?: DecisionRecord;
  withdrawing?: boolean;
  onSave: (draft: DecisionDraft, record?: DecisionRecord) => Promise<unknown>;
  onCancel: () => void;
  writeError?: unknown;
}) {
  const conflict = isWriteConflict(writeError);
  const writeMessage = conflict
    ? "Decision changed. Cancel and reopen before saving again. Your text is kept here."
    : "Decision could not be saved. Retry, or reload to check for changes. Your text is kept here.";
  const form = useForm({
    defaultValues: {
      baseRecord: record,
      title: record?.title ?? "",
      decision: record?.decision ?? "",
      rationale: withdrawing ? "" : (record?.rationale ?? ""),
    },
    onSubmit: async ({ value: { baseRecord, ...value } }) => {
      form.setErrorMap({ onSubmit: undefined });
      const parsed = (
        withdrawing ? decisionWithdrawFormSchema : decisionFormSchema
      ).safeParse(value);
      if (!parsed.success) {
        form.setErrorMap({
          onSubmit: { form: parsed.error.issues[0]?.message, fields: {} },
        });
        return;
      }
      await onSave(value, baseRecord);
    },
  });
  const validationError = useSelector(
    form.store,
    (state): string | undefined => state.errorMap.onSubmit,
  );
  const error = writeError ? writeMessage : validationError;
  function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    event.stopPropagation();
    submitForm(form).catch(() => undefined);
  }
  return (
    <form
      className="space-y-4 rounded-lg border border-border/70 p-5"
      onSubmit={submit}
    >
      <h3 className="font-medium">{withdrawing ? "Withdraw" : "Decision"}</h3>
      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      <form.Subscribe selector={(state) => state.isSubmitting}>
        {(pending) => (
          <>
            {FIELDS.filter(
              ({ name }) => !withdrawing || name === "rationale",
            ).map(({ name, label, required, maxLength }) => (
              <form.Field key={name} name={name}>
                {(field) => (
                  <div className="grid gap-2 text-sm">
                    <label htmlFor={`decision-${name}`}>
                      {label}
                      {required ? "" : " (optional)"}
                    </label>
                    {name === "title" ? (
                      <Input
                        disabled={pending}
                        id={`decision-${name}`}
                        maxLength={maxLength}
                        onBlur={field.handleBlur}
                        onChange={(event) =>
                          field.handleChange(event.target.value)
                        }
                        required={required}
                        value={field.state.value}
                      />
                    ) : (
                      <Textarea
                        disabled={pending}
                        id={`decision-${name}`}
                        maxLength={maxLength}
                        onBlur={field.handleBlur}
                        onChange={(event) =>
                          field.handleChange(event.target.value)
                        }
                        required={required}
                        value={field.state.value}
                      />
                    )}
                  </div>
                )}
              </form.Field>
            ))}
            <div className="flex flex-wrap gap-2">
              <Button disabled={pending || conflict} type="submit">
                {pending ? "Saving…" : null}
                {!pending && withdrawing ? "Withdraw" : null}
                {pending || withdrawing ? null : "Save"}
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
