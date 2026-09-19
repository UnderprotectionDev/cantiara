// biome-ignore-all lint/performance/noJsxPropsBind: Form render props and controls close over their current field state and handlers.
import {
  CUSTOM_FIELD_RECORD_TYPE_OPTIONS,
  CUSTOM_FIELD_TYPE_OPTIONS,
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

import { useCustomFields } from "@/features/custom-fields/hooks/use-custom-fields";

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

export default function CustomFieldEditor({
  disabled = false,
  projectId,
}: {
  disabled?: boolean;
  projectId: string;
}) {
  const { create, query } = useCustomFields(projectId);
  const [formError, setFormError] = useState<string | null>(null);
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
    <CustomFieldDefinitionList definitions={query.data ?? []} />
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
              <fieldset className="space-y-2">
                <legend className="font-medium text-sm">Record types</legend>
                <FieldDescription>
                  Choose where this field is available.
                </FieldDescription>
                <div className="grid gap-2 pt-1 sm:grid-cols-2">
                  {CUSTOM_FIELD_RECORD_TYPE_OPTIONS.map((recordType) => (
                    <label
                      className="flex items-start gap-2 text-sm"
                      htmlFor={`custom-field-record-type-${recordType
                        .toLowerCase()
                        .replaceAll(" ", "-")}`}
                      key={recordType}
                    >
                      <Checkbox
                        checked={field.state.value.includes(recordType)}
                        disabled={disabled || create.isPending}
                        id={`custom-field-record-type-${recordType
                          .toLowerCase()
                          .replaceAll(" ", "-")}`}
                        onCheckedChange={(checked) =>
                          field.handleChange(
                            checked
                              ? [...field.state.value, recordType]
                              : field.state.value.filter(
                                  (value) => value !== recordType,
                                ),
                          )
                        }
                      />
                      <span>{recordType}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
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

function CustomFieldDefinitionList({
  definitions,
}: {
  definitions: readonly {
    id: string;
    name: string;
    options: readonly string[];
    recordTypes: readonly string[];
    type: string;
  }[];
}) {
  return (
    <section aria-label="Custom fields" className="space-y-3">
      <h5 className="font-medium text-sm">Custom fields</h5>
      {definitions.length === 0 ? (
        <p className="border border-dashed p-4 text-muted-foreground text-sm">
          No Custom fields yet.
        </p>
      ) : (
        <ul className="space-y-2">
          {definitions.map((definition) => (
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
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
