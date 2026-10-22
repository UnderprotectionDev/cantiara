// biome-ignore-all lint/performance/noJsxPropsBind: Form field render props close over the current field handlers.
import {
  TEST_ASSESSMENT_CONTEXT_KINDS,
  TEST_ASSESSMENT_DECISIONS,
  TEST_ASSESSMENT_LABEL,
  type TestAssessmentContextCandidate,
  type TestAssessmentContextKind,
} from "@cantiara/api/test-assessments";
import { Button } from "@cantiara/ui/components/button";
import {
  NativeSelect,
  NativeSelectOption,
} from "@cantiara/ui/components/native-select";
import { Textarea } from "@cantiara/ui/components/textarea";
import { useForm, useStore } from "@tanstack/react-form";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import {
  EMPTY_TEST_ASSESSMENT_FORM,
  type TestAssessmentFormValues,
  testAssessmentFormSchema,
} from "../../lib/test-assessment-form";

export type SubmitTestAssessment = (
  values: TestAssessmentFormValues,
) => Promise<unknown>;
export type LoadContextTargets = (
  kind: TestAssessmentContextKind,
) => Promise<TestAssessmentContextCandidate[]>;

function errorText(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

export function RecordTestAssessmentForm({
  loadContextTargets,
  onRecord,
}: {
  loadContextTargets: LoadContextTargets;
  onRecord: SubmitTestAssessment;
}) {
  const [error, setError] = useState<string>();
  const form = useForm({
    defaultValues: EMPTY_TEST_ASSESSMENT_FORM,
    onSubmit: async ({ formApi, value }) => {
      setError(undefined);
      const parsed = testAssessmentFormSchema.safeParse(value);
      if (!parsed.success) {
        setError("Choose a context and a decision.");
        return;
      }
      try {
        await onRecord(value);
        formApi.reset();
      } catch (caught) {
        setError(errorText(caught, `${TEST_ASSESSMENT_LABEL} was not saved.`));
      }
    },
  });
  const values = useStore(form.store, (state) => state.values);
  const pending = useStore(form.store, (state) => state.isSubmitting);

  const targetsQuery = useQuery({
    gcTime: 0,
    queryFn: () => loadContextTargets(values.contextKind),
    queryKey: ["test-assessment-context-targets", values.contextKind],
  });
  const targets = targetsQuery.data ?? [];
  const targetsError = targetsQuery.isError
    ? `The ${values.contextKind} list is unavailable.`
    : undefined;

  return (
    <form
      aria-label={`Record ${TEST_ASSESSMENT_LABEL}`}
      className="space-y-4 rounded-lg border border-border/70 p-5"
      onSubmit={(event) => {
        event.preventDefault();
        event.stopPropagation();
        form.handleSubmit().catch(() => undefined);
      }}
    >
      <h3 className="font-medium">{`Record ${TEST_ASSESSMENT_LABEL}`}</h3>
      <p className="text-muted-foreground text-sm">
        A dated snapshot of how you read these test records. It is optional, is
        not a score or a release gate, and is never rewritten.
      </p>
      {error ? (
        <p className="text-destructive text-sm" role="alert">
          {error}
        </p>
      ) : null}
      <div className="grid gap-2 text-sm">
        <label htmlFor="test-assessment-context-kind">Context</label>
        <form.Field name="contextKind">
          {(field) => (
            <NativeSelect
              className="w-full"
              disabled={pending}
              id="test-assessment-context-kind"
              name={field.name}
              onChange={(event) => {
                const next = TEST_ASSESSMENT_CONTEXT_KINDS.find(
                  (kind) => kind === event.target.value,
                );
                if (next) {
                  field.handleChange(next);
                  form.setFieldValue("contextId", "");
                }
              }}
              value={field.state.value}
            >
              {TEST_ASSESSMENT_CONTEXT_KINDS.map((kind) => (
                <NativeSelectOption key={kind} value={kind}>
                  {kind}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          )}
        </form.Field>
      </div>
      <div className="grid gap-2 text-sm">
        <label htmlFor="test-assessment-context">{values.contextKind}</label>
        <form.Field name="contextId">
          {(field) => (
            <NativeSelect
              className="w-full"
              disabled={pending}
              id="test-assessment-context"
              name={field.name}
              onChange={(event) => field.handleChange(event.target.value)}
              required
              value={field.state.value}
            >
              <NativeSelectOption value="">{`Choose a ${values.contextKind}`}</NativeSelectOption>
              {targets.map((target) => (
                <NativeSelectOption key={target.id} value={target.id}>
                  {target.label}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          )}
        </form.Field>
        {targetsError ? (
          <div className="flex items-center gap-2">
            <p className="text-destructive text-sm" role="alert">
              {targetsError}
            </p>
            <Button
              className="h-8 px-2 text-xs"
              onClick={() => {
                targetsQuery.refetch().catch(() => undefined);
              }}
              type="button"
              variant="outline"
            >
              Retry
            </Button>
          </div>
        ) : null}
      </div>
      {(
        [
          ["sessionIds", "Test Session ids", false],
          ["gapIds", "Test Gap ids", false],
          ["followUpWorkIds", "Follow-up Work ids", false],
        ] as const
      ).map(([fieldName, label, required]) => (
        <div className="grid gap-2 text-sm" key={fieldName}>
          <label htmlFor={`test-assessment-${fieldName}`}>{label}</label>
          <form.Field name={fieldName}>
            {(field) => (
              <Textarea
                disabled={pending}
                id={`test-assessment-${fieldName}`}
                name={field.name}
                onChange={(event) => field.handleChange(event.target.value)}
                placeholder="One id per line"
                required={required}
                rows={2}
                value={field.state.value}
              />
            )}
          </form.Field>
        </div>
      ))}
      <div className="grid gap-2 text-sm">
        <label htmlFor="test-assessment-known-limits">Known limits</label>
        <form.Field name="knownLimits">
          {(field) => (
            <Textarea
              disabled={pending}
              id="test-assessment-known-limits"
              name={field.name}
              onChange={(event) => field.handleChange(event.target.value)}
              rows={3}
              value={field.state.value}
            />
          )}
        </form.Field>
      </div>
      <div className="grid gap-2 text-sm">
        <label htmlFor="test-assessment-decision">Decision</label>
        <form.Field name="decision">
          {(field) => (
            <NativeSelect
              className="w-full"
              disabled={pending}
              id="test-assessment-decision"
              name={field.name}
              onChange={(event) => {
                const next = TEST_ASSESSMENT_DECISIONS.find(
                  (decision) => decision === event.target.value,
                );
                field.handleChange(next ?? "");
              }}
              required
              value={field.state.value}
            >
              <NativeSelectOption value="">
                Choose a decision
              </NativeSelectOption>
              {TEST_ASSESSMENT_DECISIONS.map((decision) => (
                <NativeSelectOption key={decision} value={decision}>
                  {decision}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          )}
        </form.Field>
      </div>
      <Button disabled={pending} type="submit">
        {`Record ${TEST_ASSESSMENT_LABEL}`}
      </Button>
    </form>
  );
}
