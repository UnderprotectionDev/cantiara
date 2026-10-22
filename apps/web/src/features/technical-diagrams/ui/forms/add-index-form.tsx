// biome-ignore-all lint/performance/noJsxPropsBind: Each small form binds its own field state.
import type { DataModelModel } from "@cantiara/api/technical-diagram-structure";
import { useForm } from "@tanstack/react-form";

import { addIndex } from "../../lib/technical-diagram-edit";
import { addIndexSchema } from "../../lib/technical-diagram-form-schemas";
import {
  CheckField,
  EditForm,
  EditSubmit,
  type FieldOption,
  SelectField,
  submitForm,
  TextField,
} from "../components/diagram-form-fields";

export function AddIndexForm({
  columnsOf,
  disabled,
  model,
  onSave,
  tableId,
}: {
  columnsOf: (tableId: string) => FieldOption[];
  disabled: boolean;
  model: DataModelModel;
  onSave: (model: DataModelModel) => void;
  tableId: string;
}) {
  const form = useForm({
    defaultValues: { columnId: "", name: "", unique: false },
    onSubmit: ({ value, formApi }) => {
      if (!addIndexSchema.safeParse(value).success) {
        return;
      }
      onSave(addIndex(model, tableId, { ...value, name: value.name.trim() }));
      formApi.setFieldValue("name", "");
    },
  });
  return (
    <EditForm label="Add index" onSubmit={submitForm(form)}>
      <form.Field name="columnId">
        {(field) => (
          <SelectField
            field={field}
            label="Index column"
            options={columnsOf(tableId)}
          />
        )}
      </form.Field>
      <form.Field name="name">
        {(field) => <TextField field={field} label="Index name" />}
      </form.Field>
      <form.Field name="unique">
        {(field) => <CheckField field={field} label="Unique index" />}
      </form.Field>
      <form.Subscribe selector={(state) => state.values}>
        {(values) => (
          <EditSubmit
            disabled={
              disabled || !tableId || !addIndexSchema.safeParse(values).success
            }
            label="Add index"
          />
        )}
      </form.Subscribe>
    </EditForm>
  );
}
