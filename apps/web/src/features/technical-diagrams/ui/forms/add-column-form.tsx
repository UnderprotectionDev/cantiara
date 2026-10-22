// biome-ignore-all lint/performance/noJsxPropsBind: Each small form binds its own field state.
import type { DataModelModel } from "@cantiara/api/technical-diagram-structure";
import { useForm } from "@tanstack/react-form";

import { addColumn } from "../../lib/technical-diagram-edit";
import { addColumnSchema } from "../../lib/technical-diagram-form-schemas";
import {
  CheckField,
  EditForm,
  EditSubmit,
  type FieldOption,
  SelectField,
  submitForm,
  TextField,
} from "../components/diagram-form-fields";

export function AddColumnForm({
  disabled,
  model,
  onSave,
  onTableChange,
  tableOptions,
}: {
  disabled: boolean;
  model: DataModelModel;
  onSave: (model: DataModelModel) => void;
  onTableChange: (tableId: string) => void;
  tableOptions: FieldOption[];
}) {
  const form = useForm({
    defaultValues: {
      default: "",
      name: "",
      nullable: true,
      primaryKey: false,
      tableId: "",
      type: "text",
      unique: false,
    },
    onSubmit: ({ value, formApi }) => {
      if (!addColumnSchema.safeParse(value).success) {
        return;
      }
      const { tableId, ...column } = value;
      onSave(
        addColumn(model, tableId, {
          ...column,
          default: column.default.trim() || null,
          name: column.name.trim(),
        }),
      );
      formApi.setFieldValue("default", "");
      formApi.setFieldValue("name", "");
    },
  });
  return (
    <EditForm label="Add column" onSubmit={submitForm(form)}>
      <form.Field name="tableId">
        {(field) => (
          <SelectField
            field={field}
            label="Column table"
            onValueChange={onTableChange}
            options={tableOptions}
          />
        )}
      </form.Field>
      <form.Field name="name">
        {(field) => <TextField field={field} label="Column name" />}
      </form.Field>
      <form.Field name="type">
        {(field) => <TextField field={field} label="PostgreSQL type" />}
      </form.Field>
      <form.Field name="default">
        {(field) => <TextField field={field} label="Default" />}
      </form.Field>
      <form.Field name="nullable">
        {(field) => <CheckField field={field} label="Nullable" />}
      </form.Field>
      <form.Field name="primaryKey">
        {(field) => (
          <CheckField
            field={{
              handleChange: (primaryKey) => {
                field.handleChange(primaryKey);
                if (primaryKey) {
                  form.setFieldValue("nullable", false);
                }
              },
              state: field.state,
            }}
            label="Primary key"
          />
        )}
      </form.Field>
      <form.Field name="unique">
        {(field) => <CheckField field={field} label="Unique" />}
      </form.Field>
      <form.Subscribe selector={(state) => state.values}>
        {(values) => (
          <EditSubmit
            disabled={disabled || !addColumnSchema.safeParse(values).success}
            label="Add column"
          />
        )}
      </form.Subscribe>
    </EditForm>
  );
}
