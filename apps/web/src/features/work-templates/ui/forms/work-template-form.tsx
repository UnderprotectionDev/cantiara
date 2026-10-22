// biome-ignore-all lint/performance/noJsxPropsBind: Work Template controls close over the selected definition and draft field.
import type { CustomFieldDefinition } from "@cantiara/api/custom-fields";
import { WORK_TYPE_OPTIONS, type WorkType } from "@cantiara/api/work-lifecycle";
import {
  createWorkTemplateInputSchema,
  type ParsedCreateWorkTemplateInput,
  resolveWorkTemplateDates,
  type WorkTemplate,
  type WorkTemplateCustomFieldValue,
  workTemplateRelativeDatesSchema,
} from "@cantiara/api/work-templates";
import { Button } from "@cantiara/ui/components/button";
import { Checkbox } from "@cantiara/ui/components/checkbox";
import {
  Field,
  FieldDescription,
  FieldLabel,
} from "@cantiara/ui/components/field";
import { Input } from "@cantiara/ui/components/input";
import {
  NativeSelect,
  NativeSelectOption,
} from "@cantiara/ui/components/native-select";
import { Textarea } from "@cantiara/ui/components/textarea";
import { useForm } from "@tanstack/react-form";

import {
  draftFromTemplate,
  EMPTY_DRAFT,
  initialValue,
  liveCustomFieldDefaults,
  offset,
  relativeDatesFromDraft,
} from "../../lib/work-template-draft";

function DraftDatePreview({
  createDate,
  plannedStartOffset,
  targetOffset,
}: {
  createDate: string;
  plannedStartOffset: string;
  targetOffset: string;
}) {
  if (!(plannedStartOffset.trim() || targetOffset.trim())) {
    return null;
  }
  const relativeDates = workTemplateRelativeDatesSchema.safeParse({
    plannedStart: offset(plannedStartOffset),
    target: offset(targetOffset),
  });
  if (!relativeDates.success) {
    return (
      <p className="text-destructive text-xs sm:col-span-2" role="alert">
        Relative dates need whole days between -3650 and 3650.
      </p>
    );
  }
  const preview = resolveWorkTemplateDates({
    createDate,
    relativeDates: relativeDates.data,
  });
  return (
    <dl
      aria-label="Resolved dates preview"
      className="grid gap-3 border-border/70 border-t pt-3 text-xs sm:col-span-2 sm:grid-cols-3"
    >
      <div>
        <dt className="text-muted-foreground">Creation day</dt>
        <dd className="mt-1 font-medium">{createDate}</dd>
      </div>
      <div>
        <dt className="text-muted-foreground">Planned start</dt>
        <dd className="mt-1 font-medium">
          {preview.plannedStartDate ?? "Not set"}
        </dd>
      </div>
      <div>
        <dt className="text-muted-foreground">Target</dt>
        <dd className="mt-1 font-medium">{preview.targetDate ?? "Not set"}</dd>
      </div>
    </dl>
  );
}

function CustomFieldDefaultControl({
  definition,
  disabled,
  onChange,
  value,
}: {
  definition: CustomFieldDefinition;
  disabled: boolean;
  onChange: (value: WorkTemplateCustomFieldValue | undefined) => void;
  value?: WorkTemplateCustomFieldValue;
}) {
  const selected = value !== undefined;
  const checkboxId = `work-template-field-${definition.id}`;
  return (
    <div className="grid gap-3 rounded-md border border-border/70 p-3 sm:grid-cols-[minmax(0,1fr)_minmax(10rem,1fr)] sm:items-center">
      <label className="flex items-center gap-2 text-sm" htmlFor={checkboxId}>
        <Checkbox
          checked={selected}
          disabled={disabled}
          id={checkboxId}
          onCheckedChange={(checked) =>
            onChange(checked === true ? initialValue(definition) : undefined)
          }
        />
        {definition.name}
      </label>
      {selected && value ? (
        <CustomFieldDefaultValue
          definition={definition}
          disabled={disabled}
          onChange={onChange}
          value={value}
        />
      ) : null}
    </div>
  );
}

function CustomFieldDefaultValue({
  definition,
  disabled,
  onChange,
  value,
}: {
  definition: CustomFieldDefinition;
  disabled: boolean;
  onChange: (value: WorkTemplateCustomFieldValue) => void;
  value: WorkTemplateCustomFieldValue;
}) {
  if (value.kind === "boolean") {
    const booleanId = `work-template-field-${definition.id}-boolean`;
    return (
      <label className="flex items-center gap-2 text-sm" htmlFor={booleanId}>
        <Checkbox
          checked={value.boolean}
          disabled={disabled}
          id={booleanId}
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
        aria-label={`${definition.name} default`}
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
          const optionId = `work-template-field-${definition.id}-option-${index}`;
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
                  if (options.length > 0) {
                    onChange({ kind: "options", options });
                  }
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
      aria-label={`${definition.name} default`}
      disabled={disabled}
      onChange={(event) =>
        onChange(
          value.kind === "number"
            ? { kind: "number", number: Number(event.target.value) }
            : { kind: "text", text: event.target.value },
        )
      }
      type={value.kind === "number" ? "number" : "text"}
      value={value.kind === "number" ? value.number : value.text}
    />
  );
}

export function WorkTemplateForm({
  customFieldsLoaded,
  definitions,
  editing,
  error,
  onCancel,
  onSave,
  onValidationError,
  pending,
  previewDate,
  projectId,
}: {
  customFieldsLoaded: boolean;
  definitions: CustomFieldDefinition[];
  editing: WorkTemplate | null;
  error: string | null;
  onCancel: () => void;
  onSave: (input: ParsedCreateWorkTemplateInput) => Promise<void>;
  onValidationError: (message: string) => void;
  pending: boolean;
  previewDate: string;
  projectId: string;
}) {
  const form = useForm({
    defaultValues: editing ? draftFromTemplate(editing) : EMPTY_DRAFT,
    onSubmit: async ({ value: draft }) => {
      // Defaults for definitions that are no longer live (trashed, unbound from
      // Work, or Date typed) cannot be removed from the form, so drop them here
      // instead of making every save fail server-side. While the Custom field
      // list is unavailable the payload passes through for server validation.
      const customFieldDefaults = customFieldsLoaded
        ? liveCustomFieldDefaults(draft.customFieldDefaults, definitions)
        : Object.entries(draft.customFieldDefaults).map(
            ([definitionId, value]) => ({ definitionId, value }),
          );
      const parsed = createWorkTemplateInputSchema.safeParse({
        checklist: draft.checklistText
          .split("\n")
          .map((text) => text.trim())
          .filter(Boolean)
          .map((text) => ({ id: crypto.randomUUID(), text })),
        customFieldDefaults,
        descriptionSkeleton: draft.descriptionSkeleton || null,
        name: draft.name,
        projectId,
        relativeDates: relativeDatesFromDraft(draft),
        type: draft.type,
      });
      if (!parsed.success) {
        onValidationError(
          parsed.error.issues[0]?.message ?? "Check the Work Template.",
        );
        return;
      }
      await onSave(parsed.data);
    },
  });
  return (
    <form
      aria-label={editing ? "Edit Work Template" : "Add Work Template"}
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
          {editing ? "Edit Work Template" : "Add Work Template"}
        </h5>
        {editing ? (
          <Button onClick={onCancel} size="xs" type="button" variant="ghost">
            Cancel
          </Button>
        ) : null}
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        <form.Field name="name">
          {(field) => (
            <Field>
              <FieldLabel htmlFor="work-template-name">Name</FieldLabel>
              <Input
                disabled={pending}
                id="work-template-name"
                onChange={(event) => field.handleChange(event.target.value)}
                value={field.state.value}
              />
            </Field>
          )}
        </form.Field>
        <form.Field name="type">
          {(field) => (
            <Field>
              <FieldLabel htmlFor="work-template-type">Type</FieldLabel>
              <NativeSelect
                disabled={pending}
                id="work-template-type"
                onChange={(event) =>
                  field.handleChange(event.target.value as WorkType)
                }
                value={field.state.value}
              >
                {WORK_TYPE_OPTIONS.map((type) => (
                  <NativeSelectOption key={type} value={type}>
                    {type}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </Field>
          )}
        </form.Field>
      </div>
      <form.Field name="descriptionSkeleton">
        {(field) => (
          <Field>
            <FieldLabel htmlFor="work-template-description">
              Description skeleton
            </FieldLabel>
            <Textarea
              disabled={pending}
              id="work-template-description"
              onChange={(event) => field.handleChange(event.target.value)}
              rows={5}
              value={field.state.value}
            />
            <FieldDescription>
              Use ordinary Work text. Placeholder syntax is not supported.
            </FieldDescription>
          </Field>
        )}
      </form.Field>
      <form.Field name="checklistText">
        {(field) => (
          <Field>
            <FieldLabel htmlFor="work-template-checklist">Checklist</FieldLabel>
            <Textarea
              disabled={pending}
              id="work-template-checklist"
              onChange={(event) => field.handleChange(event.target.value)}
              placeholder="One item per line"
              rows={4}
              value={field.state.value}
            />
          </Field>
        )}
      </form.Field>
      <fieldset className="space-y-3">
        <legend className="font-medium text-sm">Selected field defaults</legend>
        <form.Field name="customFieldDefaults">
          {(field) =>
            definitions.length === 0 ? (
              <p className="text-muted-foreground text-xs">
                Add a non-date Custom field for Work to set a default here.
              </p>
            ) : (
              definitions.map((definition) => (
                <CustomFieldDefaultControl
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
            )
          }
        </form.Field>
      </fieldset>
      <fieldset className="grid gap-4 rounded-md border border-border/70 p-4 sm:grid-cols-2">
        <legend className="px-1 font-medium text-sm">Relative dates</legend>
        <form.Field name="plannedStartOffset">
          {(field) => (
            <Field>
              <FieldLabel htmlFor="work-template-planned-start-offset">
                Planned start days from creation
              </FieldLabel>
              <Input
                disabled={pending}
                id="work-template-planned-start-offset"
                max={3650}
                min={-3650}
                onChange={(event) => field.handleChange(event.target.value)}
                type="number"
                value={field.state.value}
              />
            </Field>
          )}
        </form.Field>
        <form.Field name="targetOffset">
          {(field) => (
            <Field>
              <FieldLabel htmlFor="work-template-target-offset">
                Target days from creation
              </FieldLabel>
              <Input
                disabled={pending}
                id="work-template-target-offset"
                max={3650}
                min={-3650}
                onChange={(event) => field.handleChange(event.target.value)}
                type="number"
                value={field.state.value}
              />
            </Field>
          )}
        </form.Field>
        <form.Subscribe
          selector={(state) => ({
            plannedStartOffset: state.values.plannedStartOffset,
            targetOffset: state.values.targetOffset,
          })}
        >
          {(values) => (
            <DraftDatePreview
              createDate={previewDate}
              plannedStartOffset={values.plannedStartOffset}
              targetOffset={values.targetOffset}
            />
          )}
        </form.Subscribe>
      </fieldset>
      {error ? (
        <p className="text-destructive text-sm" role="alert">
          {error}
        </p>
      ) : null}
      <Button disabled={pending} type="submit">
        {editing ? "Save changes" : "Add Work Template"}
      </Button>
    </form>
  );
}
