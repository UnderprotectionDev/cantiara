// biome-ignore-all lint/performance/noJsxPropsBind: Controls bind to the Planned Test Case form fields.

import {
  PLANNED_TEST_CASE_LABEL,
  PLANNED_TEST_CHANGE_KINDS,
  type PlannedTestChangeKind,
} from "@cantiara/api/planned-tests";
import { Button } from "@cantiara/ui/components/button";
import { Input } from "@cantiara/ui/components/input";
import {
  RadioGroup,
  RadioGroupItem,
} from "@cantiara/ui/components/radio-group";
import { Textarea } from "@cantiara/ui/components/textarea";
import { useForm, useSelector } from "@tanstack/react-form";
import { type SubmitEvent, useEffect, useRef } from "react";
import { submitForm } from "@/lib/submit-form";
import { errorText } from "../../lib/error-text";
import {
  type CaseFormValues,
  parseCaseForm,
} from "../../lib/planned-test-form";
import {
  type LoadRelationTargets,
  PlannedTestRelationsField,
} from "./planned-test-relations-field-form";

export type SubmitCase = (values: CaseFormValues) => Promise<unknown>;

const TEXT_FIELDS = [
  { label: "Title", name: "title", rows: 1 },
  { label: "Purpose", name: "purpose", rows: 3 },
  { label: "Scope", name: "scope", rows: 3 },
  { label: "Preconditions", name: "preconditions", rows: 3 },
  { label: "Expected behavior", name: "expectedBehavior", rows: 3 },
  { label: "Notes (optional)", name: "notes", rows: 3 },
] as const;

/**
 * One form for both the first version and every later one. A later version
 * carries the full definition plus how it changed, so the version difference
 * stays explainable; there is no result, status or step field to fill in.
 */
export function CaseForm({
  focusOnMount,
  heading,
  idPrefix,
  initial,
  loadTargets,
  onCancel,
  onSubmit,
  projectId,
  showChangeKind,
  submitLabel,
}: {
  focusOnMount: boolean;
  heading: string;
  idPrefix: string;
  initial: CaseFormValues;
  loadTargets: LoadRelationTargets;
  onCancel?: () => void;
  onSubmit: SubmitCase;
  projectId: string;
  showChangeKind: boolean;
  submitLabel: string;
}) {
  const firstField = useRef<HTMLInputElement | HTMLTextAreaElement>(null);
  useEffect(() => {
    if (focusOnMount) {
      firstField.current?.focus();
    }
  }, [focusOnMount]);
  const resetPicker = useRef<(() => void) | null>(null);
  const form = useForm({
    defaultValues: initial,
    onSubmit: async ({ value, formApi }) => {
      form.setErrorMap({ onSubmit: undefined });
      const parsed = parseCaseForm(value, showChangeKind);
      if (!parsed.ok) {
        form.setErrorMap({ onSubmit: { form: parsed.message, fields: {} } });
        return;
      }
      try {
        await onSubmit(value);
        formApi.reset();
        resetPicker.current?.();
      } catch (caught) {
        form.setErrorMap({
          onSubmit: {
            form: errorText(
              caught,
              `${PLANNED_TEST_CASE_LABEL} was not saved.`,
            ),
            fields: {},
          },
        });
      }
    },
  });
  const error = useSelector(
    form.store,
    (state): string | undefined => state.errorMap.onSubmit,
  );
  function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    submitForm(form).catch(() => undefined);
  }
  return (
    <form
      aria-label={heading}
      className="space-y-4 rounded-lg border border-border/70 p-5"
      onSubmit={submit}
    >
      <h3 className="font-medium">{heading}</h3>
      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      <form.Subscribe selector={(state) => state.isSubmitting}>
        {(pending) => (
          <>
            {showChangeKind ? (
              <form.Field name="changeKind">
                {(field) => (
                  <fieldset className="space-y-2">
                    <legend className="text-sm">Change kind</legend>
                    <RadioGroup
                      disabled={pending}
                      name={`${idPrefix}-change-kind`}
                      onValueChange={(value) =>
                        field.handleChange(value as PlannedTestChangeKind)
                      }
                      value={field.state.value}
                    >
                      {PLANNED_TEST_CHANGE_KINDS.map((kind) => (
                        <label
                          className="flex items-center gap-2 text-sm"
                          htmlFor={`${idPrefix}-kind-${kind}`}
                          key={kind}
                        >
                          <RadioGroupItem
                            id={`${idPrefix}-kind-${kind}`}
                            value={kind}
                          />
                          {kind}
                        </label>
                      ))}
                    </RadioGroup>
                  </fieldset>
                )}
              </form.Field>
            ) : null}
            {TEXT_FIELDS.map((spec, index) => (
              <form.Field key={spec.name} name={spec.name}>
                {(field) => (
                  <div className="grid gap-2 text-sm">
                    <label htmlFor={`${idPrefix}-${spec.name}`}>
                      {spec.label}
                    </label>
                    {spec.name === "title" ? (
                      <Input
                        disabled={pending}
                        id={`${idPrefix}-${spec.name}`}
                        maxLength={255}
                        onBlur={field.handleBlur}
                        onChange={(event) =>
                          field.handleChange(event.target.value)
                        }
                        ref={
                          index === 0
                            ? (firstField as React.Ref<HTMLInputElement>)
                            : undefined
                        }
                        required
                        value={field.state.value}
                      />
                    ) : (
                      <Textarea
                        disabled={pending}
                        id={`${idPrefix}-${spec.name}`}
                        onBlur={field.handleBlur}
                        onChange={(event) =>
                          field.handleChange(event.target.value)
                        }
                        required={spec.name !== "notes"}
                        rows={spec.rows}
                        value={field.state.value}
                      />
                    )}
                  </div>
                )}
              </form.Field>
            ))}
            <form.Field name="relations">
              {(field) => (
                <PlannedTestRelationsField
                  idPrefix={idPrefix}
                  loadTargets={loadTargets}
                  onChange={field.handleChange}
                  projectId={projectId}
                  resetRef={resetPicker}
                  value={field.state.value}
                />
              )}
            </form.Field>
            <div className="flex flex-wrap gap-2">
              <Button disabled={pending} type="submit">
                {submitLabel}
              </Button>
              {onCancel ? (
                <Button
                  disabled={pending}
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
