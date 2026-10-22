// biome-ignore-all lint/performance/noJsxPropsBind: Each small form binds its own field state.
import type { DataModelModel } from "@cantiara/api/technical-diagram-structure";
import { useForm } from "@tanstack/react-form";

import { addTable } from "../../lib/technical-diagram-edit";
import { addTableSchema } from "../../lib/technical-diagram-form-schemas";
import {
  EditForm,
  EditSubmit,
  submitForm,
  TextField,
} from "../components/diagram-form-fields";

export function AddTableForm({
  disabled,
  model,
  onSave,
}: {
  disabled: boolean;
  model: DataModelModel;
  onSave: (model: DataModelModel) => void;
}) {
  const form = useForm({
    defaultValues: { name: "" },
    onSubmit: ({ value, formApi }) => {
      if (!addTableSchema.safeParse(value).success) {
        return;
      }
      onSave(addTable(model, value.name.trim()));
      formApi.reset();
    },
  });
  return (
    <EditForm label="Add table" onSubmit={submitForm(form)}>
      <form.Field name="name">
        {(field) => <TextField field={field} label="Table name" />}
      </form.Field>
      <form.Subscribe selector={(state) => state.values}>
        {(values) => (
          <EditSubmit
            disabled={disabled || !addTableSchema.safeParse(values).success}
            label="Add table"
          />
        )}
      </form.Subscribe>
    </EditForm>
  );
}
