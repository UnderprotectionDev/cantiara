// biome-ignore-all lint/performance/noJsxPropsBind: Handlers bind to the session and item being reviewed.
import {
  TEST_REPORT_RESULT_LABELS,
  TEST_REPORT_RESULTS,
} from "@cantiara/api/test-report";
import type { TestResultEventKind } from "@cantiara/api/test-review";
import { Button } from "@cantiara/ui/components/button";
import {
  NativeSelect,
  NativeSelectOption,
} from "@cantiara/ui/components/native-select";
import { Textarea } from "@cantiara/ui/components/textarea";
import { useForm } from "@tanstack/react-form";
import type { FormEvent } from "react";
import { usePanelFocus } from "../../hooks/use-panel-focus";
import {
  type TestResultEventDraft,
  testResultEventFormSchema,
} from "../../lib/test-review-forms";

export default function TestResultEventForm({
  eventId,
  kind,
  onCancel,
  onConfirm,
  pending,
  sessionTestId,
  title,
}: {
  eventId: string | null;
  kind: TestResultEventKind;
  onCancel: () => void;
  onConfirm: (draft: TestResultEventDraft) => void;
  pending: boolean;
  sessionTestId: string | null;
  title: string;
}) {
  const headingRef = usePanelFocus(true);
  const needsResult = kind === "Correction" && sessionTestId !== null;
  const needsNote = kind === "Correction" && sessionTestId === null;
  const schema = testResultEventFormSchema({ needsNote, needsResult });
  const form = useForm({
    defaultValues: {
      note: "",
      reason: "",
      result: "" as (typeof TEST_REPORT_RESULTS)[number] | "",
    },
    onSubmit: ({ value }) => {
      if (!schema.safeParse(value).success) {
        return;
      }
      onConfirm({
        correctedResult: value.result === "" ? null : value.result,
        eventId,
        kind,
        note: value.note,
        reason: value.reason,
        sessionTestId,
      });
    },
  });
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    event.stopPropagation();
    form.handleSubmit().catch(() => undefined);
  }
  return (
    <section
      aria-labelledby="test-review-event-heading"
      className="space-y-3 rounded-md border border-border p-3 text-sm"
    >
      <h5
        className="font-medium outline-none"
        id="test-review-event-heading"
        ref={headingRef}
        tabIndex={-1}
      >
        {title}
      </h5>
      <p className="text-muted-foreground">
        {kind === "Redaction"
          ? "The value is replaced by a mark with time, reason and actor. It cannot be used as current evidence or export. This is not Trash."
          : "This adds a new event. The original report is not edited or deleted."}
      </p>
      <form className="space-y-3" onSubmit={handleSubmit}>
        {needsResult ? (
          <form.Field name="result">
            {(field) => (
              <div className="grid gap-2">
                <label htmlFor="test-review-event-result">
                  Corrected result
                </label>
                <NativeSelect
                  className="w-full"
                  disabled={pending}
                  id="test-review-event-result"
                  name={field.name}
                  onChange={(event) =>
                    field.handleChange(
                      event.target
                        .value as (typeof TEST_REPORT_RESULTS)[number],
                    )
                  }
                  value={field.state.value}
                >
                  <NativeSelectOption value="">
                    Choose a result
                  </NativeSelectOption>
                  {TEST_REPORT_RESULTS.map((value) => (
                    <NativeSelectOption key={value} value={value}>
                      {TEST_REPORT_RESULT_LABELS[value]}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </div>
            )}
          </form.Field>
        ) : null}
        {kind === "Correction" ? (
          <form.Field name="note">
            {(field) => (
              <div className="grid gap-2">
                <label htmlFor="test-review-event-note">
                  {needsNote ? "Corrected summary" : "Note (optional)"}
                </label>
                <Textarea
                  disabled={pending}
                  id="test-review-event-note"
                  name={field.name}
                  onChange={(event) => field.handleChange(event.target.value)}
                  rows={2}
                  value={field.state.value}
                />
              </div>
            )}
          </form.Field>
        ) : null}
        <form.Field name="reason">
          {(field) => (
            <div className="grid gap-2">
              <label htmlFor="test-review-event-reason">
                Reason (required)
              </label>
              <Textarea
                disabled={pending}
                id="test-review-event-reason"
                name={field.name}
                onChange={(event) => field.handleChange(event.target.value)}
                rows={2}
                value={field.state.value}
              />
            </div>
          )}
        </form.Field>
        <div className="flex gap-2">
          <form.Subscribe selector={(state) => state.values}>
            {(values) => (
              <Button
                disabled={pending || !schema.safeParse(values).success}
                type="submit"
              >
                {`Record ${kind === "Redaction" ? "redaction" : kind}`}
              </Button>
            )}
          </form.Subscribe>
          <Button
            disabled={pending}
            onClick={onCancel}
            type="button"
            variant="outline"
          >
            Cancel
          </Button>
        </div>
      </form>
    </section>
  );
}
