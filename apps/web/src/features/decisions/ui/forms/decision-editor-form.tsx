// biome-ignore-all lint/performance/noJsxPropsBind: Decision controls bind to their current record and form field.

import { Button } from "@cantiara/ui/components/button";
import { Input } from "@cantiara/ui/components/input";
import { Textarea } from "@cantiara/ui/components/textarea";
import { useForm } from "@tanstack/react-form";
import { type FormEvent, useState } from "react";
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
}: {
  record?: DecisionRecord;
  withdrawing?: boolean;
  onSave: (draft: DecisionDraft, record?: DecisionRecord) => Promise<unknown>;
  onCancel: () => void;
}) {
  const [error, setError] = useState<string>();
  const [conflict, setConflict] = useState(false);
  const [baseRecord] = useState(record);
  const form = useForm({
    defaultValues: {
      title: baseRecord?.title ?? "",
      decision: baseRecord?.decision ?? "",
      rationale: withdrawing ? "" : (baseRecord?.rationale ?? ""),
    },
    onSubmit: async ({ value }) => {
      setError(undefined);
      const parsed = (
        withdrawing ? decisionWithdrawFormSchema : decisionFormSchema
      ).safeParse(value);
      if (!parsed.success) {
        setError(parsed.error.issues[0]?.message);
        return;
      }
      try {
        await onSave(value, baseRecord);
      } catch (saveError) {
        const changed =
          typeof saveError === "object" &&
          saveError !== null &&
          "code" in saveError &&
          saveError.code === "CONFLICT";
        setConflict(changed);
        setError(
          changed
            ? "Decision changed. Cancel and reopen before saving again. Your text is kept here."
            : "Decision could not be saved. Retry, or reload to check for changes. Your text is kept here.",
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
      className="space-y-4 rounded-lg border border-border/70 p-5"
      onSubmit={submit}
    >
      <h3 className="font-medium">{withdrawing ? "Withdraw" : "Decision"}</h3>
      {error ? (
        <p className="text-destructive text-sm" role="alert">
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
