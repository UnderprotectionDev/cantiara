// biome-ignore-all lint/performance/noJsxPropsBind: Controls bind to the form fields and the draft Session Tests.
import {
  SESSION_TEST_REPORT_LABEL,
  TEST_REPORT_EXECUTOR_TYPE_LABELS,
  TEST_REPORT_EXECUTOR_TYPES,
  TEST_REPORT_RESULT_LABELS,
  TEST_SESSION_LABEL,
  type TestReportExecutorType,
  type TestReportResult,
} from "@cantiara/api/test-report";
import { Button } from "@cantiara/ui/components/button";
import { Input } from "@cantiara/ui/components/input";
import {
  NativeSelect,
  NativeSelectOption,
} from "@cantiara/ui/components/native-select";
import { Textarea } from "@cantiara/ui/components/textarea";
import { useForm, useStore } from "@tanstack/react-form";
import { type FormEvent, useState } from "react";
import { DateTimePicker } from "@/components/date-picker";
import { refusalText } from "../../lib/refusal-text";
import {
  EMPTY_SESSION_TEST,
  EMPTY_TEST_SESSION_FORM,
  parseTestSessionForm,
  RESULT_OPTIONS,
  type TestSessionFormValues,
} from "../../lib/test-report-form";

export type RecordTestSession = (
  values: TestSessionFormValues,
) => Promise<unknown>;

export default function TestSessionRecordForm({
  onRecord,
}: {
  onRecord: RecordTestSession;
}) {
  const [error, setError] = useState<string>();
  const form = useForm({
    defaultValues: EMPTY_TEST_SESSION_FORM,
    onSubmit: async ({ value }) => {
      setError(undefined);
      const parsed = parseTestSessionForm(value);
      if (!parsed.success) {
        setError(
          parsed.error.issues[0]?.message ??
            `${TEST_SESSION_LABEL} was not saved.`,
        );
        return;
      }
      try {
        await onRecord(value);
        form.reset();
      } catch (caught) {
        setError(refusalText(caught, `${TEST_SESSION_LABEL} was not saved.`));
      }
    },
  });
  const pending = useStore(form.store, (state) => state.isSubmitting);
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    event.stopPropagation();
    form.handleSubmit().catch(() => undefined);
  }
  return (
    <form
      aria-label={`Record ${TEST_SESSION_LABEL}`}
      className="space-y-4 rounded-lg border border-border/70 p-5"
      onSubmit={submit}
    >
      <h3 className="font-medium">{`Record ${TEST_SESSION_LABEL}`}</h3>
      <p className="text-muted-foreground text-xs">
        Nothing is recorded until you save. A reported result is history, not
        verified product acceptance.
      </p>
      {error ? (
        <p className="text-destructive text-sm" role="alert">
          {error}
        </p>
      ) : null}
      <div className="grid gap-2 text-sm">
        <label htmlFor="test-session-executor-type">Executor type</label>
        <form.Field name="executorType">
          {(field) => (
            <NativeSelect
              className="w-full"
              disabled={pending}
              id="test-session-executor-type"
              name={field.name}
              onChange={(event) =>
                field.handleChange(event.target.value as TestReportExecutorType)
              }
              value={field.state.value}
            >
              {TEST_REPORT_EXECUTOR_TYPES.map((type) => (
                <NativeSelectOption key={type} value={type}>
                  {TEST_REPORT_EXECUTOR_TYPE_LABELS[type]}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          )}
        </form.Field>
      </div>
      <div className="grid gap-2 text-sm">
        <label htmlFor="test-session-executor-name">Executor</label>
        <form.Field name="executorName">
          {(field) => (
            <Input
              disabled={pending}
              id="test-session-executor-name"
              maxLength={255}
              name={field.name}
              onChange={(event) => field.handleChange(event.target.value)}
              required
              value={field.state.value}
            />
          )}
        </form.Field>
      </div>
      <div className="grid gap-2 text-sm">
        <label htmlFor="test-session-executor-version">Executor version</label>
        <form.Field name="executorVersion">
          {(field) => (
            <Input
              disabled={pending}
              id="test-session-executor-version"
              maxLength={255}
              name={field.name}
              onChange={(event) => field.handleChange(event.target.value)}
              value={field.state.value}
            />
          )}
        </form.Field>
      </div>
      <div className="grid gap-2 text-sm">
        <label htmlFor="test-session-reported-at">Reported at</label>
        <form.Field name="reportedAt">
          {(field) => (
            <DateTimePicker
              ariaLabel="Reported at"
              disabled={pending}
              id="test-session-reported-at"
              onChange={field.handleChange}
              value={field.state.value}
            />
          )}
        </form.Field>
      </div>
      <div className="grid gap-2 text-sm">
        <label htmlFor="test-session-summary">Summary</label>
        <form.Field name="summary">
          {(field) => (
            <Textarea
              disabled={pending}
              id="test-session-summary"
              name={field.name}
              onChange={(event) => field.handleChange(event.target.value)}
              rows={3}
              value={field.state.value}
            />
          )}
        </form.Field>
      </div>
      <form.Field mode="array" name="tests">
        {(testsField) => (
          <>
            {testsField.state.value.map((_test, index) => (
              <fieldset
                className="space-y-3 rounded-md border border-border/60 p-4"
                // biome-ignore lint/suspicious/noArrayIndexKey: Drafts have no id and keep their order.
                key={index}
              >
                <legend className="px-1 font-medium text-sm">{`${SESSION_TEST_REPORT_LABEL} ${index + 1}`}</legend>
                <div className="grid gap-2 text-sm">
                  <label htmlFor={`test-session-test-${index}-title`}>
                    {`${SESSION_TEST_REPORT_LABEL} ${index + 1} title`}
                  </label>
                  <form.Field name={`tests[${index}].title`}>
                    {(field) => (
                      <Input
                        disabled={pending}
                        id={`test-session-test-${index}-title`}
                        maxLength={255}
                        name={field.name}
                        onChange={(event) =>
                          field.handleChange(event.target.value)
                        }
                        required
                        value={field.state.value}
                      />
                    )}
                  </form.Field>
                </div>
                <div className="grid gap-2 text-sm">
                  <label htmlFor={`test-session-test-${index}-result`}>
                    {`${SESSION_TEST_REPORT_LABEL} ${index + 1} result`}
                  </label>
                  <form.Field name={`tests[${index}].result`}>
                    {(field) => (
                      <NativeSelect
                        className="w-full"
                        disabled={pending}
                        id={`test-session-test-${index}-result`}
                        name={field.name}
                        onChange={(event) =>
                          field.handleChange(
                            event.target.value as TestReportResult,
                          )
                        }
                        value={field.state.value}
                      >
                        {RESULT_OPTIONS.map((result) => (
                          <NativeSelectOption key={result} value={result}>
                            {TEST_REPORT_RESULT_LABELS[result]}
                          </NativeSelectOption>
                        ))}
                      </NativeSelect>
                    )}
                  </form.Field>
                </div>
                <div className="grid gap-2 text-sm">
                  <label htmlFor={`test-session-test-${index}-notes`}>
                    {`${SESSION_TEST_REPORT_LABEL} ${index + 1} notes`}
                  </label>
                  <form.Field name={`tests[${index}].notes`}>
                    {(field) => (
                      <Textarea
                        disabled={pending}
                        id={`test-session-test-${index}-notes`}
                        name={field.name}
                        onChange={(event) =>
                          field.handleChange(event.target.value)
                        }
                        rows={2}
                        value={field.state.value}
                      />
                    )}
                  </form.Field>
                </div>
                {testsField.state.value.length > 1 ? (
                  <Button
                    disabled={pending}
                    onClick={() => testsField.removeValue(index)}
                    size="sm"
                    type="button"
                    variant="outline"
                  >
                    {`Remove ${SESSION_TEST_REPORT_LABEL} ${index + 1}`}
                  </Button>
                ) : null}
              </fieldset>
            ))}
            <div className="flex flex-wrap gap-2">
              <Button
                disabled={pending}
                onClick={() => testsField.pushValue({ ...EMPTY_SESSION_TEST })}
                type="button"
                variant="outline"
              >
                {`Add ${SESSION_TEST_REPORT_LABEL}`}
              </Button>
              <Button disabled={pending} type="submit">
                {`Record ${TEST_SESSION_LABEL}`}
              </Button>
            </div>
          </>
        )}
      </form.Field>
    </form>
  );
}
