// biome-ignore-all lint/performance/noJsxPropsBind: Work Template controls close over the selected definition and draft field.
import type { CustomFieldDefinition } from "@cantiara/api/custom-fields";
import { WORK_TYPE_OPTIONS, type WorkType } from "@cantiara/api/work-lifecycle";
import {
  createWorkTemplateInputSchema,
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
import { format } from "date-fns";
import { useMemo, useState } from "react";

import { useCustomFields } from "@/features/custom-fields/hooks/use-custom-fields";
import { useWorkTemplates } from "@/features/work-templates/hooks/use-work-templates";

interface WorkTemplateDraft {
  checklistText: string;
  customFieldDefaults: Record<string, WorkTemplateCustomFieldValue>;
  descriptionSkeleton: string;
  name: string;
  plannedStartOffset: string;
  targetOffset: string;
  type: WorkType;
}

const EMPTY_DRAFT: WorkTemplateDraft = {
  checklistText: "",
  customFieldDefaults: {},
  descriptionSkeleton: "",
  name: "",
  plannedStartOffset: "",
  targetOffset: "",
  type: "Task",
};

function browserCalendarDate() {
  return format(new Date(), "yyyy-MM-dd");
}

function initialValue(
  definition: CustomFieldDefinition,
): WorkTemplateCustomFieldValue {
  switch (definition.type) {
    case "Boolean":
      return { boolean: false, kind: "boolean" };
    case "Number":
      return { kind: "number", number: 0 };
    case "Single select":
      return { kind: "option", option: definition.options[0] ?? "" };
    case "Multi select":
      return { kind: "options", options: definition.options.slice(0, 1) };
    default:
      return { kind: "text", text: "" };
  }
}

function offset(value: string) {
  if (value.trim() === "") {
    return;
  }
  return { offsetDays: Number(value) };
}

function draftFromTemplate(template: WorkTemplate): WorkTemplateDraft {
  return {
    checklistText: template.checklist.map((item) => item.text).join("\n"),
    customFieldDefaults: Object.fromEntries(
      template.customFieldDefaults.map((item) => [
        item.definitionId,
        item.value,
      ]),
    ),
    descriptionSkeleton: template.descriptionSkeleton ?? "",
    name: template.name,
    plannedStartOffset:
      template.relativeDates.plannedStart?.offsetDays.toString() ?? "",
    targetOffset: template.relativeDates.target?.offsetDays.toString() ?? "",
    type: template.type,
  };
}

function relativeDatesFromDraft(draft: WorkTemplateDraft) {
  return {
    plannedStart: offset(draft.plannedStartOffset),
    target: offset(draft.targetOffset),
  };
}

function customFieldLabel(
  definitions: readonly CustomFieldDefinition[],
  definitionId: string,
) {
  return (
    definitions.find((definition) => definition.id === definitionId)?.name ??
    "Unavailable Custom field"
  );
}

export function liveCustomFieldDefaults(
  defaults: Record<string, WorkTemplateCustomFieldValue>,
  definitions: readonly CustomFieldDefinition[],
) {
  const live = new Set(definitions.map((definition) => definition.id));
  return Object.entries(defaults)
    .filter(([definitionId]) => live.has(definitionId))
    .map(([definitionId, value]) => ({ definitionId, value }));
}

function datePreview(template: WorkTemplate, createDate: string) {
  return resolveWorkTemplateDates({
    createDate,
    relativeDates: template.relativeDates,
  });
}

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

export default function WorkTemplateEditor({
  disabled = false,
  previewDate = browserCalendarDate(),
  projectId,
}: {
  disabled?: boolean;
  previewDate?: string;
  projectId: string;
}) {
  const templates = useWorkTemplates(projectId);
  const customFields = useCustomFields(projectId);
  const [editing, setEditing] = useState<WorkTemplate | null>(null);
  const [error, setError] = useState<string | null>(null);
  const definitions = useMemo(
    () =>
      (customFields.query.data ?? []).filter(
        (definition) =>
          definition.trashedAt === null &&
          definition.type !== "Date" &&
          definition.recordTypes.includes("Work"),
      ),
    [customFields.query.data],
  );
  const pending =
    disabled ||
    templates.create.isPending ||
    templates.update.isPending ||
    templates.moveToTrash.isPending;
  const defaultValues = useMemo(
    () => (editing ? draftFromTemplate(editing) : EMPTY_DRAFT),
    [editing],
  );
  const form = useForm({
    defaultValues,
    onSubmit: ({ value }) => submitDraft(value),
  });

  function resetDraft() {
    form.reset(EMPTY_DRAFT);
    setEditing(null);
    setError(null);
  }

  async function submitDraft(draft: WorkTemplateDraft) {
    // Defaults for definitions that are no longer live (trashed, unbound from
    // Work, or Date typed) cannot be removed from the form, so drop them here
    // instead of making every save fail server-side. While the Custom field
    // list is unavailable the payload passes through for server validation.
    const customFieldDefaults = customFields.query.data
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
      setError(parsed.error.issues[0]?.message ?? "Check the Work Template.");
      return;
    }
    setError(null);
    try {
      if (editing) {
        const { projectId: _projectId, ...input } = parsed.data;
        await templates.update.mutateAsync({
          ...input,
          baseRevision: editing.revision,
          templateId: editing.id,
        });
      } else {
        await templates.create.mutateAsync(parsed.data);
      }
      resetDraft();
    } catch (mutationError) {
      setError(
        mutationError instanceof Error
          ? mutationError.message
          : "Work Template could not be saved.",
      );
    }
  }

  const list = templates.query.data ?? [];

  return (
    <div className="mt-3 space-y-6" data-work-template-editor="true">
      <p className="max-w-2xl text-muted-foreground text-xs/relaxed">
        Reuse a Project-specific starting point with a type, description
        skeleton, selected field defaults, checklist, and relative dates.
      </p>

      {templates.query.isPending ? (
        <p className="text-muted-foreground text-sm" role="status">
          Loading Work Templates…
        </p>
      ) : null}
      {templates.query.isError ? (
        <p className="text-destructive text-sm" role="alert">
          Work Templates could not be loaded. Try loading this page again.
        </p>
      ) : null}
      {list.length === 0 && !templates.query.isPending ? (
        <p className="rounded-md border border-dashed p-4 text-muted-foreground text-sm">
          No Work Templates yet. Define the first reusable starting point below.
        </p>
      ) : (
        <ul aria-label="Work Templates" className="grid gap-3">
          {list.map((template) => {
            const preview = datePreview(template, previewDate);
            return (
              <li
                className="rounded-md border border-border/70 bg-card/45 p-4"
                key={template.id}
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="font-medium text-sm">{template.name}</p>
                    <p className="mt-1 text-muted-foreground text-xs">
                      {template.type} · {template.checklist.length} checklist
                      item{template.checklist.length === 1 ? "" : "s"}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      disabled={pending}
                      onClick={() => {
                        setEditing(template);
                        form.reset(draftFromTemplate(template));
                        setError(null);
                      }}
                      size="xs"
                      type="button"
                      variant="outline"
                    >
                      Edit
                    </Button>
                    <Button
                      disabled={pending}
                      onClick={() =>
                        templates.moveToTrash.mutate(
                          {
                            baseRevision: template.revision,
                            templateId: template.id,
                          },
                          {
                            onError: (mutationError) =>
                              setError(
                                mutationError instanceof Error
                                  ? mutationError.message
                                  : "Work Template could not be moved to Trash.",
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
                {template.customFieldDefaults.length > 0 ? (
                  <p className="mt-3 text-muted-foreground text-xs">
                    Field defaults:{" "}
                    {template.customFieldDefaults
                      .map((item) =>
                        customFieldLabel(definitions, item.definitionId),
                      )
                      .join(", ")}
                  </p>
                ) : null}
                {preview.plannedStartDate || preview.targetDate ? (
                  <dl className="mt-4 grid gap-3 border-border/70 border-t pt-3 text-xs sm:grid-cols-3">
                    <div>
                      <dt className="text-muted-foreground">Creation day</dt>
                      <dd className="mt-1 font-medium">{previewDate}</dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">Planned start</dt>
                      <dd className="mt-1 font-medium">
                        {preview.plannedStartDate ?? "Not set"}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">Target</dt>
                      <dd className="mt-1 font-medium">
                        {preview.targetDate ?? "Not set"}
                      </dd>
                    </div>
                  </dl>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}

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
              <FieldLabel htmlFor="work-template-checklist">
                Checklist
              </FieldLabel>
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
          <legend className="font-medium text-sm">
            Selected field defaults
          </legend>
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
    </div>
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
