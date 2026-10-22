// biome-ignore-all lint/performance/noJsxPropsBind: Form field render props close over the current field handlers.
import type { WorkStatusLabel } from "@cantiara/api/project-shell";
import {
  WORK_CLOSURE_RESULT_OPTIONS,
  WORK_STATUS_OPTIONS,
  type WorkClosureResult,
  type WorkStatus,
} from "@cantiara/api/work-lifecycle";
import { Field, FieldLabel } from "@cantiara/ui/components/field";
import {
  NativeSelect,
  NativeSelectOption,
} from "@cantiara/ui/components/native-select";
import { Textarea } from "@cantiara/ui/components/textarea";
import { useForm } from "@tanstack/react-form";
import type { FormEvent } from "react";
import { getWorkStatusLabel } from "@/components/work-status-form";
import {
  type BulkEditStatusFormInput,
  bulkEditStatusFormSchema,
} from "../../lib/bulk-edit-form";

export const BULK_EDIT_STATUS_FORM_ID = "bulk-edit-status-form";

export const BULK_EDIT_STATUS_FORM_DEFAULTS: {
  closureReason: string;
  closureResult: WorkClosureResult;
  targetStatus: WorkStatus | "";
} = {
  closureReason: "",
  closureResult: "Completed",
  targetStatus: "",
};

/**
 * The `Bulk Edit` Status fields. The dialog's `Preview` button submits this
 * form through its id; `displayed` shows a running operation's frozen values.
 */
export default function BulkEditStatusForm({
  disabled,
  displayed,
  onClosureReasonChange,
  onClosureResultChange,
  onPreview,
  onStatusChange,
  workStatusLabels,
}: {
  disabled: boolean;
  displayed: {
    closureReason: string | null;
    closureResult: WorkClosureResult;
    targetStatus: WorkStatus;
  } | null;
  onClosureReasonChange: (reason: string) => void;
  onClosureResultChange: (result: WorkClosureResult) => void;
  onPreview: (input: BulkEditStatusFormInput) => void;
  onStatusChange: (status: WorkStatus | "") => void;
  workStatusLabels: readonly WorkStatusLabel[];
}) {
  const form = useForm({
    defaultValues: BULK_EDIT_STATUS_FORM_DEFAULTS,
    onSubmit: ({ value }) => {
      const parsed = bulkEditStatusFormSchema.safeParse(value);
      if (parsed.success) {
        onPreview(parsed.data);
      }
    },
  });
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    event.stopPropagation();
    form.handleSubmit().catch(() => undefined);
  }

  return (
    <form className="contents" id={BULK_EDIT_STATUS_FORM_ID} onSubmit={submit}>
      <form.Field
        listeners={{ onChange: ({ value }) => onStatusChange(value) }}
        name="targetStatus"
      >
        {(field) => (
          <Field>
            <FieldLabel htmlFor="bulk-edit-status">Status</FieldLabel>
            <NativeSelect
              aria-label="Status"
              disabled={disabled}
              id="bulk-edit-status"
              onChange={(event) =>
                field.handleChange(event.target.value as WorkStatus | "")
              }
              value={displayed?.targetStatus ?? field.state.value}
            >
              <NativeSelectOption value="">Select status</NativeSelectOption>
              {WORK_STATUS_OPTIONS.map((workStatus) => (
                <NativeSelectOption key={workStatus} value={workStatus}>
                  {getWorkStatusLabel(workStatus, workStatusLabels)}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </Field>
        )}
      </form.Field>

      <form.Subscribe selector={(state) => state.values.targetStatus}>
        {(targetStatus) =>
          (displayed?.targetStatus ?? targetStatus) === "Closed" ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <form.Field
                listeners={{
                  onChange: ({ value }) => onClosureResultChange(value),
                }}
                name="closureResult"
              >
                {(field) => (
                  <Field>
                    <FieldLabel htmlFor="bulk-edit-closure-result">
                      Closure result
                    </FieldLabel>
                    <NativeSelect
                      aria-label="Closure result"
                      disabled={disabled}
                      id="bulk-edit-closure-result"
                      onChange={(event) =>
                        field.handleChange(
                          event.target.value as WorkClosureResult,
                        )
                      }
                      value={displayed?.closureResult ?? field.state.value}
                    >
                      {WORK_CLOSURE_RESULT_OPTIONS.map((result) => (
                        <NativeSelectOption key={result} value={result}>
                          {result}
                        </NativeSelectOption>
                      ))}
                    </NativeSelect>
                  </Field>
                )}
              </form.Field>
              <form.Field
                listeners={{
                  onChange: ({ value }) => onClosureReasonChange(value),
                }}
                name="closureReason"
              >
                {(field) => (
                  <Field>
                    <FieldLabel htmlFor="bulk-edit-reason">Reason</FieldLabel>
                    <Textarea
                      aria-label="Reason"
                      disabled={disabled}
                      id="bulk-edit-reason"
                      maxLength={2000}
                      onChange={(event) =>
                        field.handleChange(event.target.value)
                      }
                      value={displayed?.closureReason ?? field.state.value}
                    />
                  </Field>
                )}
              </form.Field>
            </div>
          ) : null
        }
      </form.Subscribe>
    </form>
  );
}
