// biome-ignore-all lint/performance/noJsxPropsBind: Form field render props close over the current source record and field handlers.
import type { DocumentSection } from "@cantiara/api/documents";
import {
  createPersonalReminderInputSchema,
  type PersonalReminderAction,
  type PersonalReminderCondition,
  type PersonalReminderSourceType,
  personalReminderConditionSchema,
} from "@cantiara/api/personal-reminders";
import { Button } from "@cantiara/ui/components/button";
import { DialogFooter } from "@cantiara/ui/components/dialog";
import { Field, FieldLabel } from "@cantiara/ui/components/field";
import {
  NativeSelect,
  NativeSelectOption,
} from "@cantiara/ui/components/native-select";
import { useForm, useSelector } from "@tanstack/react-form";
import { type ReactNode, useEffect } from "react";
import { DateTimePicker } from "@/components/date-picker";
import {
  defaultFireAt,
  localDateTimeValue,
  supportsOpenCondition,
} from "@/features/personal-reminders/lib/personal-reminder-form";

type CreateReminderInput = ReturnType<
  typeof createPersonalReminderInputSchema.parse
>;

export function PersonalReminderForm({
  action,
  children,
  onCreate,
  onRetry,
  createdKey,
  pending,
  retry,
  sectionOptions,
  sourceRecordId,
  sourceRecordType,
}: {
  action: PersonalReminderAction;
  children: ReactNode;
  onCreate: (input: CreateReminderInput) => void;
  createdKey?: string;
  pending: boolean;
  retry: { fingerprint: string; key: string } | null;
  onRetry: (retry: { fingerprint: string; key: string }) => void;
  sectionOptions: readonly Pick<DocumentSection, "heading" | "id">[];
  sourceRecordId: string;
  sourceRecordType: PersonalReminderSourceType;
}) {
  const form = useForm({
    defaultValues: {
      condition: "In any case" as PersonalReminderCondition,
      fireAt: defaultFireAt(),
      sectionId: "",
    },
    onSubmit: ({ formApi, value }) => {
      const { condition, fireAt, sectionId } = value;
      const fireAtDate = new Date(fireAt);
      if (!fireAt || Number.isNaN(fireAtDate.valueOf())) {
        formApi.setErrorMap({
          onSubmit: { form: "Choose a valid time.", fields: {} },
        });
        return;
      }
      if (fireAtDate.valueOf() <= Date.now()) {
        formApi.setErrorMap({
          onSubmit: {
            form: "Reminder must be scheduled for a future time.",
            fields: {},
          },
        });
        return;
      }
      const nextCondition =
        action === "Review Later" && supportsOpenCondition(sourceRecordType)
          ? condition
          : "In any case";
      const nextSectionId =
        action === "Review Later" &&
        sourceRecordType === "Document" &&
        sectionId
          ? sectionId
          : undefined;
      const fingerprint = JSON.stringify({
        action,
        condition: nextCondition,
        fireAt: fireAtDate.toISOString(),
        sectionId: nextSectionId ?? null,
        sourceRecordId,
        sourceRecordType,
      });
      const clientIdempotencyKey =
        retry?.fingerprint === fingerprint ? retry.key : crypto.randomUUID();
      const parsed = createPersonalReminderInputSchema.safeParse({
        action,
        clientIdempotencyKey,
        condition: nextCondition,
        fireAt: fireAtDate.toISOString(),
        ...(nextSectionId ? { sectionId: nextSectionId } : {}),
        sourceRecordId,
        sourceRecordType,
      });
      if (!parsed.success) {
        formApi.setErrorMap({
          onSubmit: {
            form: parsed.error.issues[0]?.message ?? "Check the reminder.",
            fields: {},
          },
        });
        return;
      }
      onRetry({ fingerprint, key: clientIdempotencyKey });
      onCreate(parsed.data);
    },
  });
  useEffect(() => {
    if (createdKey) {
      form.setFieldValue("fireAt", defaultFireAt());
      form.setFieldValue("sectionId", "");
    }
  }, [createdKey, form]);
  const fireAt = useSelector(form.store, (state) => state.values.fireAt);
  const showCondition =
    action === "Review Later" && supportsOpenCondition(sourceRecordType);
  const showSection =
    action === "Review Later" && sourceRecordType === "Document";

  return (
    <form
      className="space-y-4"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        event.stopPropagation();
        form.handleSubmit().catch(() => undefined);
      }}
    >
      <Field>
        <FieldLabel htmlFor={`personal-reminder-when-${sourceRecordId}`}>
          When
        </FieldLabel>
        <form.Field name="fireAt">
          {(field) => (
            <DateTimePicker
              ariaLabel="When"
              id={`personal-reminder-when-${sourceRecordId}`}
              min={localDateTimeValue(new Date())}
              onChange={field.handleChange}
              required
              value={field.state.value}
            />
          )}
        </form.Field>
      </Field>
      {showSection ? (
        <Field>
          <FieldLabel htmlFor={`personal-reminder-section-${sourceRecordId}`}>
            Section
          </FieldLabel>
          <form.Field name="sectionId">
            {(field) => (
              <NativeSelect
                className="w-full"
                id={`personal-reminder-section-${sourceRecordId}`}
                name={field.name}
                onChange={(event) => field.handleChange(event.target.value)}
                value={field.state.value}
              >
                <NativeSelectOption value="">
                  Entire document
                </NativeSelectOption>
                {sectionOptions.map(({ heading, id }) => (
                  <NativeSelectOption key={id} value={id}>
                    {heading}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            )}
          </form.Field>
        </Field>
      ) : null}
      {showCondition ? (
        <Field>
          <FieldLabel htmlFor={`personal-reminder-condition-${sourceRecordId}`}>
            Condition
          </FieldLabel>
          <form.Field name="condition">
            {(field) => (
              <NativeSelect
                className="w-full"
                id={`personal-reminder-condition-${sourceRecordId}`}
                name={field.name}
                onChange={(event) => {
                  const next = personalReminderConditionSchema.safeParse(
                    event.target.value,
                  );
                  if (next.success) {
                    field.handleChange(next.data);
                  }
                }}
                value={field.state.value}
              >
                <NativeSelectOption value="In any case">
                  In any case
                </NativeSelectOption>
                <NativeSelectOption value="Only if still open">
                  Only if still open
                </NativeSelectOption>
              </NativeSelect>
            )}
          </form.Field>
        </Field>
      ) : null}
      <form.Subscribe selector={(state): unknown => state.errorMap.onSubmit}>
        {(error) =>
          typeof error === "string" ? <p role="alert">{error}</p> : null
        }
      </form.Subscribe>
      {children}
      <DialogFooter>
        <Button disabled={pending || !fireAt} type="submit">
          Set reminder
        </Button>
      </DialogFooter>
    </form>
  );
}
