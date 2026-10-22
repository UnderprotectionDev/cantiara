// biome-ignore-all lint/performance/noJsxPropsBind: Risk controls bind to the current record and form field.

import { RISK_LIFE_OPTIONS } from "@cantiara/api/project-source-records";
import { Button } from "@cantiara/ui/components/button";
import { Input } from "@cantiara/ui/components/input";
import {
  NativeSelect,
  NativeSelectOption,
} from "@cantiara/ui/components/native-select";
import { Textarea } from "@cantiara/ui/components/textarea";
import { useForm } from "@tanstack/react-form";
import { type FormEvent, useState } from "react";
import { type RiskRecord, riskFormSchema } from "../../lib/risk-form";

export interface RiskDraft {
  description: string;
  impact: string;
  life: RiskRecord["life"];
  probability: string;
  rationale: string;
  response: string;
  title: string;
}

export const FIELDS = [
  { name: "title", label: "Title" },
  { name: "description", label: "Description" },
  { name: "impact", label: "Impact" },
  { name: "probability", label: "Probability" },
  { name: "response", label: "Response/mitigation" },
  { name: "rationale", label: "Rationale" },
] as const;

export function RiskEditor({
  record,
  changingStatus = false,
  onSave,
  onCancel,
}: {
  record?: RiskRecord;
  changingStatus?: boolean;
  onSave: (draft: RiskDraft, record?: RiskRecord) => Promise<unknown>;
  onCancel: () => void;
}) {
  const [baseRecord] = useState(record);
  const [error, setError] = useState<string>();
  const [conflict, setConflict] = useState(false);
  const form = useForm({
    defaultValues: {
      title: baseRecord?.title ?? "",
      description: baseRecord?.description ?? "",
      impact: baseRecord?.impact ?? "",
      probability: baseRecord?.probability ?? "",
      response: baseRecord?.response ?? "",
      rationale: baseRecord?.rationale ?? "",
      life: baseRecord?.life ?? "Open",
    } satisfies RiskDraft,
    onSubmit: async ({ value }) => {
      setError(undefined);
      const parsed = riskFormSchema({
        baseLife: baseRecord?.life,
        changingStatus,
      }).safeParse(value);
      if (!parsed.success) {
        setError(parsed.error.issues[0]?.message ?? "Check the form.");
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
            ? "Risk changed. Cancel and reopen before saving again. Your text is kept here."
            : "Risk could not be saved. Retry, or reload to check for changes. Your text is kept here.",
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
      <h3 className="font-medium">{changingStatus ? "Status" : "Risk"}</h3>
      {error ? (
        <p className="text-destructive text-sm" role="alert">
          {error}
        </p>
      ) : null}
      <form.Subscribe selector={(state) => state.isSubmitting}>
        {(pending) => (
          <>
            {changingStatus ? (
              <form.Field name="life">
                {(field) => (
                  <div className="grid gap-2 text-sm">
                    <label htmlFor="risk-life">Status</label>
                    <NativeSelect
                      className="w-full"
                      disabled={pending}
                      id="risk-life"
                      onBlur={field.handleBlur}
                      onChange={(event) => {
                        const life = RISK_LIFE_OPTIONS.find(
                          (option) => option === event.target.value,
                        );
                        if (life) {
                          field.handleChange(life);
                        }
                      }}
                      value={field.state.value}
                    >
                      {RISK_LIFE_OPTIONS.map((life) => (
                        <NativeSelectOption key={life} value={life}>
                          {life}
                        </NativeSelectOption>
                      ))}
                    </NativeSelect>
                    <p className="text-muted-foreground">
                      A known Risk remains recorded when accepted.
                    </p>
                  </div>
                )}
              </form.Field>
            ) : null}
            <form.Subscribe selector={(state) => state.values.life}>
              {(life) =>
                FIELDS.filter(({ name }) =>
                  changingStatus
                    ? name === "rationale"
                    : name !== "rationale" || Boolean(baseRecord),
                ).map(({ name, label }) => (
                  <form.Field key={name} name={name}>
                    {(field) => (
                      <div className="grid gap-2 text-sm">
                        <label htmlFor={`risk-${name}`}>{label}</label>
                        {name === "title" ? (
                          <Input
                            disabled={pending}
                            id={`risk-${name}`}
                            maxLength={255}
                            onBlur={field.handleBlur}
                            onChange={(event) =>
                              field.handleChange(event.target.value)
                            }
                            required
                            value={field.state.value}
                          />
                        ) : (
                          <Textarea
                            disabled={
                              pending ||
                              (changingStatus &&
                                name === "rationale" &&
                                life !== "Accepted")
                            }
                            id={`risk-${name}`}
                            maxLength={100_000}
                            onBlur={field.handleBlur}
                            onChange={(event) =>
                              field.handleChange(event.target.value)
                            }
                            value={field.state.value}
                          />
                        )}
                      </div>
                    )}
                  </form.Field>
                ))
              }
            </form.Subscribe>
            <div className="flex flex-wrap gap-2">
              <Button disabled={pending || conflict} type="submit">
                {pending ? "Saving…" : "Save"}
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
