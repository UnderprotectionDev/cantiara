// biome-ignore-all lint/performance/noJsxPropsBind: Form render props and controls close over their current field state and handlers.
import {
  CUSTOM_FIELD_RECORD_TYPE_OPTIONS,
  CUSTOM_FIELD_TYPE_OPTIONS,
  type CustomFieldDefinition,
  type CustomFieldRecordType,
  type CustomFieldType,
  createCustomFieldInputSchema,
} from "@cantiara/api/custom-fields";
import { Button } from "@cantiara/ui/components/button";
import { Checkbox } from "@cantiara/ui/components/checkbox";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@cantiara/ui/components/field";
import { Input } from "@cantiara/ui/components/input";
import {
  NativeSelect,
  NativeSelectOption,
} from "@cantiara/ui/components/native-select";
import { Textarea } from "@cantiara/ui/components/textarea";
import { useForm } from "@tanstack/react-form";
import { type FormEvent, useState } from "react";

import {
  type DefinitionRevisionArgs,
  useCustomFields,
} from "@/features/custom-fields/hooks/use-custom-fields";

interface CustomFieldFormValues {
  name: string;
  optionsText: string;
  recordTypes: CustomFieldRecordType[];
  type: CustomFieldType;
}

const INITIAL_VALUES: CustomFieldFormValues = {
  name: "",
  optionsText: "",
  recordTypes: [],
  type: "Text",
};

function optionsFromText(value: string) {
  return value
    .split("\n")
    .map((option) => option.trim())
    .filter(
      (option, index, options) => option && options.indexOf(option) === index,
    );
}

function isSelectType(type: CustomFieldType) {
  return type === "Single select" || type === "Multi select";
}

function errorMessage(error: unknown) {
  return error instanceof Error
    ? error.message
    : "Custom field could not be created.";
}

function recordTypeInputId(recordType: string) {
  return `custom-field-record-type-${recordType
    .toLowerCase()
    .replaceAll(" ", "-")}`;
}

function RecordTypesFieldset({
  disabled,
  name,
  onCheckedChange,
  selected,
}: {
  disabled: boolean;
  name: string;
  onCheckedChange: (
    recordType: CustomFieldRecordType,
    checked: boolean,
  ) => void;
  selected: readonly string[];
}) {
  return (
    <fieldset className="space-y-2">
      <legend className="font-medium text-sm">{name}</legend>
      <FieldDescription>Choose where this field is available.</FieldDescription>
      <div className="grid gap-2 pt-1 sm:grid-cols-2">
        {CUSTOM_FIELD_RECORD_TYPE_OPTIONS.map((recordType) => (
          <label
            className="flex items-start gap-2 text-sm"
            htmlFor={recordTypeInputId(recordType)}
            key={recordType}
          >
            <Checkbox
              checked={selected.includes(recordType)}
              disabled={disabled}
              id={recordTypeInputId(recordType)}
              onCheckedChange={(checked) =>
                onCheckedChange(recordType, checked === true)
              }
            />
            <span>{recordType}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export default function CustomFieldEditor({
  disabled = false,
  projectId,
}: {
  disabled?: boolean;
  projectId: string;
}) {
  const { create, deletePermanently, moveToTrash, query, restore, update } =
    useCustomFields(projectId);
  const [formError, setFormError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const form = useForm({
    defaultValues: INITIAL_VALUES,
    onSubmit: async ({ value }) => {
      const parsed = createCustomFieldInputSchema.safeParse({
        name: value.name,
        options: optionsFromText(value.optionsText),
        projectId,
        recordTypes: value.recordTypes,
        type: value.type,
      });
      if (!parsed.success) {
        setFormError(parsed.error.issues[0]?.message ?? "Check the form.");
        return;
      }

      setFormError(null);
      try {
        await create.mutateAsync(parsed.data);
        form.reset();
      } catch {
        // The mutation error is rendered below and remains available for retry.
      }
    },
  });
  let definitionContent = (
    <CustomFieldDefinitionList
      definitions={query.data ?? []}
      disabled={
        disabled ||
        update.isPending ||
        moveToTrash.isPending ||
        restore.isPending ||
        deletePermanently.isPending
      }
      editingId={editingId}
      onCancelEdit={() => setEditingId(null)}
      onDeletePermanently={async (definition) => {
        setActionError(null);
        try {
          await deletePermanently.mutateAsync(revisionArgs(definition));
        } catch (error) {
          setActionError(errorMessage(error));
        }
      }}
      onEdit={setEditingId}
      onMoveToTrash={async (definition) => {
        setActionError(null);
        try {
          await moveToTrash.mutateAsync(revisionArgs(definition));
        } catch (error) {
          setActionError(errorMessage(error));
        }
      }}
      onRestore={async (definition) => {
        setActionError(null);
        try {
          await restore.mutateAsync(revisionArgs(definition));
        } catch (error) {
          setActionError(errorMessage(error));
        }
      }}
      onSave={async (definition, values) => {
        setActionError(null);
        try {
          await update.mutateAsync({
            baseRevision: definition.revision,
            definitionId: definition.id,
            name: values.name,
            options: values.options,
            recordTypes: values.recordTypes,
          });
          setEditingId(null);
        } catch (error) {
          setActionError(errorMessage(error));
        }
      }}
    />
  );
  if (query.isPending) {
    definitionContent = (
      <p className="text-muted-foreground text-sm" role="status">
        Loading Custom fields…
      </p>
    );
  } else if (query.isError) {
    definitionContent = (
      <p className="text-destructive text-sm" role="alert">
        Custom fields could not be loaded. Try loading this page again.
      </p>
    );
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    event.stopPropagation();
    form.handleSubmit().catch(() => undefined);
  }

  return (
    <div className="mt-3 space-y-6" data-custom-field-editor="true">
      <div className="space-y-1">
        <p className="text-muted-foreground text-xs/relaxed">
          Define structured fields that live in this Project and appear only on
          the selected record types.
        </p>
        <p className="text-muted-foreground text-xs/relaxed">
          Select options stay with this Project and are not Tags.
        </p>
      </div>

      {definitionContent}

      {actionError ? (
        <p className="text-destructive text-sm" role="alert">
          {actionError}
        </p>
      ) : null}

      <form
        aria-label="Add custom field"
        className="space-y-5 border-border/70 border-t pt-5"
        noValidate
        onSubmit={handleSubmit}
      >
        <FieldGroup>
          <form.Field name="name">
            {(field) => (
              <Field>
                <FieldLabel htmlFor="custom-field-name">Field name</FieldLabel>
                <Input
                  disabled={disabled || create.isPending}
                  id="custom-field-name"
                  name={field.name}
                  onChange={(event) => field.handleChange(event.target.value)}
                  value={field.state.value}
                />
              </Field>
            )}
          </form.Field>

          <form.Field name="type">
            {(field) => (
              <Field>
                <FieldLabel htmlFor="custom-field-type">Type</FieldLabel>
                <NativeSelect
                  disabled={disabled || create.isPending}
                  id="custom-field-type"
                  name={field.name}
                  onChange={(event) =>
                    field.handleChange(event.target.value as CustomFieldType)
                  }
                  value={field.state.value}
                >
                  {CUSTOM_FIELD_TYPE_OPTIONS.map((type) => (
                    <NativeSelectOption key={type} value={type}>
                      {type}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </Field>
            )}
          </form.Field>

          <form.Subscribe selector={(state) => state.values.type}>
            {(type) =>
              isSelectType(type) ? (
                <form.Field name="optionsText">
                  {(field) => (
                    <Field>
                      <FieldLabel htmlFor="custom-field-options">
                        Options
                      </FieldLabel>
                      <Textarea
                        disabled={disabled || create.isPending}
                        id="custom-field-options"
                        name={field.name}
                        onChange={(event) =>
                          field.handleChange(event.target.value)
                        }
                        placeholder="One option per line"
                        rows={3}
                        value={field.state.value}
                      />
                      <FieldDescription>
                        Add one option per line.
                      </FieldDescription>
                    </Field>
                  )}
                </form.Field>
              ) : null
            }
          </form.Subscribe>

          <form.Field name="recordTypes">
            {(field) => (
              <RecordTypesFieldset
                disabled={disabled || create.isPending}
                name="Record types"
                onCheckedChange={(recordType, checked) =>
                  field.handleChange(
                    checked
                      ? [...field.state.value, recordType]
                      : field.state.value.filter(
                          (value) => value !== recordType,
                        ),
                  )
                }
                selected={field.state.value}
              />
            )}
          </form.Field>
        </FieldGroup>

        {formError ? (
          <p className="text-destructive text-sm" role="alert">
            {formError}
          </p>
        ) : null}
        {create.isError ? (
          <p className="text-destructive text-sm" role="alert">
            {errorMessage(create.error)}
          </p>
        ) : null}
        <form.Subscribe selector={(state) => state.isSubmitting}>
          {(isSubmitting) => (
            <Button
              disabled={disabled || isSubmitting || create.isPending}
              type="submit"
            >
              {isSubmitting || create.isPending
                ? "Adding…"
                : "Add custom field"}
            </Button>
          )}
        </form.Subscribe>
      </form>
    </div>
  );
}

function DefinitionActions({
  definition,
  disabled,
  onDeletePermanently,
  onEdit,
  onMoveToTrash,
  onRestore,
}: {
  definition: CustomFieldDefinition;
  disabled: boolean;
  onDeletePermanently: (definition: CustomFieldDefinition) => Promise<void>;
  onEdit: (definitionId: string) => void;
  onMoveToTrash: (definition: CustomFieldDefinition) => Promise<void>;
  onRestore: (definition: CustomFieldDefinition) => Promise<void>;
}) {
  if (definition.trashedAt) {
    return (
      <div className="mt-2 flex flex-wrap gap-2">
        <Button
          disabled={disabled}
          onClick={() => onRestore(definition).catch(() => undefined)}
          size="sm"
          type="button"
          variant="outline"
        >
          Restore
        </Button>
        <Button
          disabled={disabled}
          onClick={() => onDeletePermanently(definition).catch(() => undefined)}
          size="sm"
          type="button"
          variant="destructive"
        >
          Permanently Delete
        </Button>
      </div>
    );
  }

  return (
    <div className="mt-2 flex flex-wrap gap-2">
      <Button
        onClick={() => onEdit(definition.id)}
        size="sm"
        type="button"
        variant="outline"
      >
        Edit
      </Button>
      <Button
        disabled={disabled}
        onClick={() => onMoveToTrash(definition).catch(() => undefined)}
        size="sm"
        type="button"
        variant="outline"
      >
        Move to Trash
      </Button>
    </div>
  );
}

function CustomFieldDefinitionList({
  definitions,
  disabled,
  editingId,
  onCancelEdit,
  onDeletePermanently,
  onEdit,
  onMoveToTrash,
  onRestore,
  onSave,
}: {
  definitions: readonly CustomFieldDefinition[];
  disabled: boolean;
  editingId: string | null;
  onCancelEdit: () => void;
  onDeletePermanently: (definition: CustomFieldDefinition) => Promise<void>;
  onEdit: (definitionId: string) => void;
  onMoveToTrash: (definition: CustomFieldDefinition) => Promise<void>;
  onRestore: (definition: CustomFieldDefinition) => Promise<void>;
  onSave: (
    definition: CustomFieldDefinition,
    values: {
      name: string;
      options: string[];
      recordTypes: CustomFieldRecordType[];
    },
  ) => Promise<void>;
}) {
  const activeDefinitions = definitions.filter(
    (definition) => !definition.trashedAt,
  );
  const trashedDefinitions = definitions.filter(
    (definition) => definition.trashedAt,
  );

  return (
    <section aria-label="Custom fields" className="space-y-3">
      <h5 className="font-medium text-sm">Custom fields</h5>
      {definitions.length === 0 ? (
        <p className="border border-dashed p-4 text-muted-foreground text-sm">
          No Custom fields yet.
        </p>
      ) : (
        <ul className="space-y-2">
          {activeDefinitions.map((definition) => (
            <li className="border bg-background p-3" key={definition.id}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-medium">{definition.name}</span>
                <span className="text-muted-foreground">{definition.type}</span>
              </div>
              <p className="mt-1 text-muted-foreground text-xs/relaxed">
                Available on: {definition.recordTypes.join(", ")}
              </p>
              {definition.options.length > 0 ? (
                <p className="mt-1 text-muted-foreground text-xs/relaxed">
                  Options: {definition.options.join(", ")}
                </p>
              ) : null}
              <DefinitionActions
                definition={definition}
                disabled={disabled}
                onDeletePermanently={onDeletePermanently}
                onEdit={onEdit}
                onMoveToTrash={onMoveToTrash}
                onRestore={onRestore}
              />
              {editingId === definition.id ? (
                <CustomFieldEditForm
                  definition={definition}
                  disabled={disabled}
                  onCancel={() => onCancelEdit()}
                  onSave={onSave}
                />
              ) : null}
            </li>
          ))}
        </ul>
      )}

      {trashedDefinitions.length > 0 ? (
        <div className="space-y-2 border-border/70 border-t pt-3">
          <h5 className="font-medium text-sm">Trash</h5>
          <ul className="space-y-2">
            {trashedDefinitions.map((definition) => (
              <li
                className="border border-dashed bg-muted/20 p-3"
                key={definition.id}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium">{definition.name}</span>
                  <span className="text-muted-foreground">
                    {definition.type}
                  </span>
                </div>
                <DefinitionActions
                  definition={definition}
                  disabled={disabled}
                  onDeletePermanently={onDeletePermanently}
                  onEdit={onEdit}
                  onMoveToTrash={onMoveToTrash}
                  onRestore={onRestore}
                />
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}

function CustomFieldEditForm({
  definition,
  disabled,
  onCancel,
  onSave,
}: {
  definition: CustomFieldDefinition;
  disabled: boolean;
  onCancel: () => void;
  onSave: (
    definition: CustomFieldDefinition,
    values: {
      name: string;
      options: string[];
      recordTypes: CustomFieldRecordType[];
    },
  ) => Promise<void>;
}) {
  const form = useForm({
    defaultValues: {
      name: definition.name,
      optionsText: definition.options.join("\n"),
      recordTypes: definition.recordTypes as CustomFieldRecordType[],
    },
    onSubmit: async ({ value }) => {
      await onSave(definition, {
        name: value.name,
        options: optionsFromText(value.optionsText),
        recordTypes: value.recordTypes,
      });
    },
  });

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    event.stopPropagation();
    form.handleSubmit().catch(() => undefined);
  }

  return (
    <form
      aria-label={`Edit ${definition.name}`}
      className="mt-3 space-y-4 border-border/70 border-t pt-3"
      noValidate
      onSubmit={handleSubmit}
    >
      <form.Field name="name">
        {(field) => (
          <Field>
            <FieldLabel htmlFor={`custom-field-edit-name-${definition.id}`}>
              Field name
            </FieldLabel>
            <Input
              disabled={disabled}
              id={`custom-field-edit-name-${definition.id}`}
              name={field.name}
              onChange={(event) => field.handleChange(event.target.value)}
              value={field.state.value}
            />
          </Field>
        )}
      </form.Field>

      <Field>
        <FieldLabel htmlFor={`custom-field-edit-type-${definition.id}`}>
          Type
        </FieldLabel>
        <Input
          disabled
          id={`custom-field-edit-type-${definition.id}`}
          value={definition.type}
        />
        <FieldDescription>
          The type cannot change after creation.
        </FieldDescription>
      </Field>

      {isSelectType(definition.type) ? (
        <form.Field name="optionsText">
          {(field) => (
            <Field>
              <FieldLabel
                htmlFor={`custom-field-edit-options-${definition.id}`}
              >
                Options
              </FieldLabel>
              <Textarea
                disabled={disabled}
                id={`custom-field-edit-options-${definition.id}`}
                name={field.name}
                onChange={(event) => field.handleChange(event.target.value)}
                placeholder="One option per line"
                rows={3}
                value={field.state.value}
              />
              <FieldDescription>
                Removing an option clears the stored values that used it.
              </FieldDescription>
            </Field>
          )}
        </form.Field>
      ) : null}

      <form.Field name="recordTypes">
        {(field) => (
          <RecordTypesFieldset
            disabled={disabled}
            name="Record types"
            onCheckedChange={(recordType, checked) =>
              field.handleChange(
                checked
                  ? [...field.state.value, recordType]
                  : field.state.value.filter((value) => value !== recordType),
              )
            }
            selected={field.state.value}
          />
        )}
      </form.Field>

      <div className="flex gap-2">
        <Button disabled={disabled} type="submit">
          Save
        </Button>
        <Button
          disabled={disabled}
          onClick={onCancel}
          type="button"
          variant="outline"
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}

function revisionArgs(
  definition: CustomFieldDefinition,
): DefinitionRevisionArgs {
  return { baseRevision: definition.revision, definitionId: definition.id };
}
