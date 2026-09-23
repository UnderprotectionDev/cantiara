// biome-ignore-all lint/performance/noJsxPropsBind: Record Action controls close over their current definition and draft field.
import {
  type CustomFieldDefinition,
  customFieldValuePayloadSchema,
  type ParsedCustomFieldValuePayload,
} from "@cantiara/api/custom-fields";
import {
  createRecordActionInputSchema,
  type RecordAction,
  type RecordActionStep,
} from "@cantiara/api/record-actions";
import {
  WORK_OPEN_STATUS_OPTIONS,
  type WorkOpenStatus,
} from "@cantiara/api/work-lifecycle";
import { Button } from "@cantiara/ui/components/button";
import { Checkbox } from "@cantiara/ui/components/checkbox";
import { Field, FieldLabel } from "@cantiara/ui/components/field";
import { Input } from "@cantiara/ui/components/input";
import {
  NativeSelect,
  NativeSelectOption,
} from "@cantiara/ui/components/native-select";
import { useForm } from "@tanstack/react-form";
import { useMemo, useState } from "react";

import { useCustomFields } from "@/features/custom-fields/hooks/use-custom-fields";
import { useRecordActions } from "@/features/record-actions/hooks/use-record-actions";

type CustomFieldValueDraft =
  | ParsedCustomFieldValuePayload
  | {
      date: string;
      kind: "date";
    };
type TextLikeCustomFieldValue = Extract<
  CustomFieldValueDraft,
  { kind: "date" | "number" | "text" }
>;

interface RecordActionDraft {
  customFieldValues: Record<string, CustomFieldValueDraft>;
  dailyFocusOperation: "" | "add" | "remove";
  name: string;
  workStatus: "" | WorkOpenStatus;
}

const EMPTY_DRAFT: RecordActionDraft = {
  customFieldValues: {},
  dailyFocusOperation: "",
  name: "",
  workStatus: "",
};

function initialCustomFieldValue(
  definition: CustomFieldDefinition,
): CustomFieldValueDraft {
  switch (definition.type) {
    case "Boolean":
      return { boolean: false, kind: "boolean" };
    case "Date":
      return { date: "", kind: "date" };
    case "Number":
      return { kind: "number", number: 0 };
    case "Single select":
      return { kind: "option", option: definition.options[0] ?? "" };
    case "Multi select":
      return { kind: "options", options: definition.options.slice(0, 1) };
    case "Text":
      return { kind: "text", text: "" };
    default:
      throw new Error("Unsupported Custom field type.");
  }
}

function draftFromAction(action: RecordAction): RecordActionDraft {
  const draft: RecordActionDraft = {
    ...EMPTY_DRAFT,
    customFieldValues: {},
    name: action.name,
  };
  for (const step of action.steps) {
    if (step.kind === "work-status") {
      draft.workStatus = step.status;
    } else if (step.kind === "daily-focus-membership") {
      draft.dailyFocusOperation = step.operation;
    } else if (step.kind === "custom-field-value") {
      draft.customFieldValues[step.definitionId] = step.value;
    }
  }
  return draft;
}

function recordActionSteps(draft: RecordActionDraft) {
  const steps: RecordActionStep[] = [];
  if (draft.workStatus) {
    steps.push({ kind: "work-status", status: draft.workStatus });
  }
  if (draft.dailyFocusOperation) {
    steps.push({
      kind: "daily-focus-membership",
      operation: draft.dailyFocusOperation,
    });
  }
  for (const [definitionId, value] of Object.entries(draft.customFieldValues)) {
    const parsed = customFieldValuePayloadSchema.safeParse(value);
    if (!parsed.success) {
      return {
        error:
          parsed.error.issues[0]?.message ?? "Check the Custom field step.",
        steps: null,
      };
    }
    steps.push({
      definitionId,
      kind: "custom-field-value",
      operation: "set",
      value: parsed.data,
    });
  }
  return { error: null, steps };
}

function customFieldValueSummary(value: ParsedCustomFieldValuePayload) {
  switch (value.kind) {
    case "boolean":
      return value.boolean ? "True" : "False";
    case "date":
      return value.date;
    case "number":
      return String(value.number);
    case "option":
      return value.option;
    case "options":
      return value.options.join(", ");
    case "text":
      return value.text;
    default:
      return "";
  }
}

function stepKey(step: RecordActionStep) {
  switch (step.kind) {
    case "work-status":
      return step.kind;
    case "daily-focus-membership":
      return step.kind;
    case "custom-field-value":
      return `${step.kind}-${step.definitionId}`;
    default:
      return "unknown-step";
  }
}

function stepSummary(
  step: RecordActionStep,
  definitions: CustomFieldDefinition[],
) {
  switch (step.kind) {
    case "work-status":
      return `Work status → ${step.status}`;
    case "daily-focus-membership":
      return `Daily Focus → ${step.operation === "add" ? "Add" : "Remove"}`;
    case "custom-field-value": {
      const definition = definitions.find(
        (candidate) => candidate.id === step.definitionId,
      );
      return `${definition?.name ?? "Custom field"} → ${customFieldValueSummary(step.value)}`;
    }
    default:
      return "Unknown step";
  }
}

export default function RecordActionEditor({
  disabled = false,
  projectId,
}: {
  disabled?: boolean;
  projectId: string;
}) {
  const recordActions = useRecordActions(projectId);
  const customFields = useCustomFields(projectId);
  const [editing, setEditing] = useState<RecordAction | null>(null);
  const [error, setError] = useState<string | null>(null);
  const definitions = useMemo(
    () =>
      (customFields.query.data ?? []).filter(
        (definition) =>
          definition.trashedAt === null &&
          definition.recordTypes.includes("Work"),
      ),
    [customFields.query.data],
  );
  const pending =
    disabled ||
    recordActions.create.isPending ||
    recordActions.update.isPending ||
    recordActions.moveToTrash.isPending;
  const form = useForm({
    defaultValues: EMPTY_DRAFT,
    onSubmit: ({ value }) => submitDraft(value),
  });

  function resetDraft() {
    form.reset(EMPTY_DRAFT);
    setEditing(null);
    setError(null);
  }

  async function submitDraft(draft: RecordActionDraft) {
    const stepResult = recordActionSteps(draft);
    if (!stepResult.steps) {
      setError(stepResult.error);
      return;
    }
    const parsed = createRecordActionInputSchema.safeParse({
      name: draft.name,
      projectId,
      steps: stepResult.steps,
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Check the Record Action.");
      return;
    }
    setError(null);
    try {
      if (editing) {
        const { projectId: _projectId, ...input } = parsed.data;
        await recordActions.update.mutateAsync({
          ...input,
          actionId: editing.id,
          baseRevision: editing.revision,
        });
      } else {
        await recordActions.create.mutateAsync(parsed.data);
      }
      resetDraft();
    } catch (mutationError) {
      setError(
        mutationError instanceof Error
          ? mutationError.message
          : "Record Action could not be saved.",
      );
    }
  }

  function editAction(action: RecordAction) {
    setEditing(action);
    setError(null);
    form.reset(draftFromAction(action));
  }

  const actions = recordActions.query.data ?? [];

  return (
    <div className="mt-3 space-y-4">
      <p className="max-w-2xl text-muted-foreground text-xs/relaxed">
        Define fixed Work status, Daily Focus, and existing Custom field steps.
        Each Record Action targets one Work record.
      </p>
      {recordActions.query.isPending ? (
        <p className="text-muted-foreground text-sm" role="status">
          Loading Record Actions…
        </p>
      ) : null}
      {recordActions.query.isError ? (
        <p className="text-destructive text-sm" role="alert">
          Record Actions could not be loaded. Try loading this page again.
        </p>
      ) : null}
      {actions.length === 0 && !recordActions.query.isPending ? (
        <p className="rounded-md border border-dashed p-4 text-muted-foreground text-sm">
          No Record Actions yet. Define the first action below.
        </p>
      ) : (
        <ul aria-label="Record Actions" className="grid gap-3">
          {actions.map((action) => (
            <li
              className="rounded-md border border-border/70 bg-card/45 p-4"
              key={action.id}
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="font-medium text-sm">{action.name}</p>
                  <ul className="mt-2 list-inside list-disc text-muted-foreground text-xs">
                    {action.steps.map((step) => (
                      <li key={stepKey(step)}>
                        {stepSummary(step, definitions)}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="flex gap-2">
                  <Button
                    disabled={pending}
                    onClick={() => editAction(action)}
                    size="xs"
                    type="button"
                    variant="outline"
                  >
                    Edit
                  </Button>
                  <Button
                    disabled={pending}
                    onClick={() =>
                      recordActions.moveToTrash.mutate(
                        {
                          actionId: action.id,
                          baseRevision: action.revision,
                        },
                        {
                          onError: (mutationError) =>
                            setError(
                              mutationError instanceof Error
                                ? mutationError.message
                                : "Record Action could not be moved to Trash.",
                            ),
                        },
                      )
                    }
                    size="xs"
                    type="button"
                    variant="ghost"
                  >
                    Move to Trash
                  </Button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      <form
        aria-label="Record Action"
        className="space-y-5 border-border/70 border-t pt-5"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          event.stopPropagation();
          form.handleSubmit().catch(() => undefined);
        }}
      >
        <div className="flex items-center justify-between gap-4">
          <h5 className="font-medium text-sm">
            {editing ? "Edit Record Action" : "Record Action"}
          </h5>
          {editing ? (
            <Button
              onClick={resetDraft}
              size="xs"
              type="button"
              variant="ghost"
            >
              Cancel
            </Button>
          ) : null}
        </div>
        <form.Field name="name">
          {(field) => (
            <Field>
              <FieldLabel htmlFor="record-action-name">Name</FieldLabel>
              <Input
                disabled={pending}
                id="record-action-name"
                onChange={(event) => field.handleChange(event.target.value)}
                value={field.state.value}
              />
            </Field>
          )}
        </form.Field>
        <fieldset className="grid gap-4 rounded-md border border-border/70 p-4 sm:grid-cols-2">
          <legend className="px-1 font-medium text-sm">Steps</legend>
          <form.Field name="workStatus">
            {(field) => (
              <Field>
                <FieldLabel htmlFor="record-action-work-status">
                  Work status
                </FieldLabel>
                <NativeSelect
                  disabled={pending}
                  id="record-action-work-status"
                  onChange={(event) =>
                    field.handleChange(
                      event.target.value as "" | WorkOpenStatus,
                    )
                  }
                  value={field.state.value}
                >
                  <NativeSelectOption value="">No change</NativeSelectOption>
                  {WORK_OPEN_STATUS_OPTIONS.map((status) => (
                    <NativeSelectOption key={status} value={status}>
                      {status}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </Field>
            )}
          </form.Field>
          <form.Field name="dailyFocusOperation">
            {(field) => (
              <Field>
                <FieldLabel htmlFor="record-action-daily-focus">
                  Daily Focus
                </FieldLabel>
                <NativeSelect
                  disabled={pending}
                  id="record-action-daily-focus"
                  onChange={(event) =>
                    field.handleChange(
                      event.target.value as "" | "add" | "remove",
                    )
                  }
                  value={field.state.value}
                >
                  <NativeSelectOption value="">No change</NativeSelectOption>
                  <NativeSelectOption value="add">Add</NativeSelectOption>
                  <NativeSelectOption value="remove">Remove</NativeSelectOption>
                </NativeSelect>
              </Field>
            )}
          </form.Field>
        </fieldset>
        <fieldset className="space-y-3 rounded-md border border-border/70 p-4">
          <legend className="px-1 font-medium text-sm">Custom field</legend>
          {definitions.length === 0 ? (
            <p className="text-muted-foreground text-xs">
              No active Custom fields are available for Work.
            </p>
          ) : (
            <form.Field name="customFieldValues">
              {(field) =>
                definitions.map((definition) => (
                  <CustomFieldStepControl
                    definition={definition}
                    disabled={pending}
                    key={definition.id}
                    onChange={(value) => {
                      const next = { ...field.state.value };
                      if (value) {
                        next[definition.id] = value;
                      } else {
                        delete next[definition.id];
                      }
                      field.handleChange(next);
                    }}
                    value={field.state.value[definition.id]}
                  />
                ))
              }
            </form.Field>
          )}
        </fieldset>
        {error ? (
          <p className="text-destructive text-sm" role="alert">
            {error}
          </p>
        ) : null}
        <Button disabled={pending} type="submit">
          {editing ? "Save changes" : "Save"}
        </Button>
      </form>
    </div>
  );
}

function CustomFieldStepControl({
  definition,
  disabled,
  onChange,
  value,
}: {
  definition: CustomFieldDefinition;
  disabled: boolean;
  onChange: (value: CustomFieldValueDraft | undefined) => void;
  value?: CustomFieldValueDraft;
}) {
  const selected = value !== undefined;
  const checkboxId = `record-action-field-${definition.id}`;
  return (
    <div className="grid gap-3 rounded-md border border-border/70 p-3 sm:grid-cols-[minmax(0,1fr)_minmax(10rem,1fr)] sm:items-center">
      <label className="flex items-center gap-2 text-sm" htmlFor={checkboxId}>
        <Checkbox
          checked={selected}
          disabled={disabled}
          id={checkboxId}
          onCheckedChange={(checked) =>
            onChange(
              checked === true
                ? initialCustomFieldValue(definition)
                : undefined,
            )
          }
        />
        {definition.name}
      </label>
      {selected && value ? (
        <CustomFieldStepValue
          definition={definition}
          disabled={disabled}
          onChange={onChange}
          value={value}
        />
      ) : null}
    </div>
  );
}

function textFieldValue(value: TextLikeCustomFieldValue) {
  switch (value.kind) {
    case "number":
      return value.number;
    case "date":
      return value.date;
    default:
      return value.text;
  }
}

function textFieldType(value: TextLikeCustomFieldValue) {
  switch (value.kind) {
    case "number":
      return "number";
    case "date":
      return "date";
    default:
      return "text";
  }
}

function withTextFieldValue(value: TextLikeCustomFieldValue, text: string) {
  switch (value.kind) {
    case "number":
      return { kind: "number" as const, number: Number(text) };
    case "date":
      return { date: text, kind: "date" as const };
    default:
      return { kind: "text" as const, text };
  }
}

function CustomFieldStepValue({
  definition,
  disabled,
  onChange,
  value,
}: {
  definition: CustomFieldDefinition;
  disabled: boolean;
  onChange: (value: CustomFieldValueDraft) => void;
  value: CustomFieldValueDraft;
}) {
  if (value.kind === "boolean") {
    const valueId = `record-action-field-${definition.id}-value`;
    return (
      <label className="flex items-center gap-2 text-sm" htmlFor={valueId}>
        <Checkbox
          checked={value.boolean}
          disabled={disabled}
          id={valueId}
          onCheckedChange={(checked) =>
            onChange({ boolean: checked === true, kind: "boolean" })
          }
        />
        Enabled
      </label>
    );
  }
  if (value.kind === "option") {
    return (
      <NativeSelect
        aria-label={definition.name}
        disabled={disabled}
        onChange={(event) =>
          onChange({ kind: "option", option: event.target.value })
        }
        value={value.option}
      >
        {definition.options.map((option) => (
          <NativeSelectOption key={option} value={option}>
            {option}
          </NativeSelectOption>
        ))}
      </NativeSelect>
    );
  }
  if (value.kind === "options") {
    return (
      <div className="flex flex-wrap gap-3">
        {definition.options.map((option, index) => {
          const optionId = `record-action-field-${definition.id}-option-${index}`;
          return (
            <label
              className="flex items-center gap-2 text-xs"
              htmlFor={optionId}
              key={option}
            >
              <Checkbox
                checked={value.options.includes(option)}
                disabled={disabled}
                id={optionId}
                onCheckedChange={(checked) => {
                  const options = checked
                    ? [...value.options, option]
                    : value.options.filter((item) => item !== option);
                  onChange({ kind: "options", options });
                }}
              />
              {option}
            </label>
          );
        })}
      </div>
    );
  }
  return (
    <Input
      aria-label={definition.name}
      disabled={disabled}
      onChange={(event) =>
        onChange(withTextFieldValue(value, event.target.value))
      }
      type={textFieldType(value)}
      value={textFieldValue(value)}
    />
  );
}
