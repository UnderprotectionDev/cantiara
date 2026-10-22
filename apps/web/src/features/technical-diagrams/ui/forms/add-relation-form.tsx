// biome-ignore-all lint/performance/noJsxPropsBind: Each small form binds its own field state.
import type { DataModelModel } from "@cantiara/api/technical-diagram-structure";
import {
  DATA_MODEL_CARDINALITIES,
  REFERENTIAL_ACTIONS,
} from "@cantiara/api/technical-diagram-structure";
import { useForm } from "@tanstack/react-form";

import { addRelation } from "../../lib/technical-diagram-edit";
import { addRelationSchema } from "../../lib/technical-diagram-form-schemas";
import {
  EditForm,
  EditSubmit,
  type FieldOption,
  SelectField,
  submitForm,
} from "../components/diagram-form-fields";

export function AddRelationForm({
  columnsOf,
  disabled,
  model,
  onSave,
  tableOptions,
}: {
  columnsOf: (tableId: string) => FieldOption[];
  disabled: boolean;
  model: DataModelModel;
  onSave: (model: DataModelModel) => void;
  tableOptions: FieldOption[];
}) {
  const form = useForm({
    defaultValues: {
      cardinality: DATA_MODEL_CARDINALITIES[1] as string,
      fromColumnId: "",
      fromTableId: "",
      onDelete: "NO ACTION",
      onUpdate: "NO ACTION",
      toColumnId: "",
      toTableId: "",
    },
    onSubmit: ({ value }) => {
      if (!addRelationSchema.safeParse(value).success) {
        return;
      }
      onSave(addRelation(model, value as Parameters<typeof addRelation>[1]));
    },
  });
  return (
    <EditForm label="Add relation" onSubmit={submitForm(form)}>
      <form.Field name="fromTableId">
        {(field) => (
          <SelectField
            field={field}
            label="From table"
            onValueChange={() => form.setFieldValue("fromColumnId", "")}
            options={tableOptions}
          />
        )}
      </form.Field>
      <form.Subscribe selector={(state) => state.values.fromTableId}>
        {(fromTableId) => (
          <form.Field name="fromColumnId">
            {(field) => (
              <SelectField
                field={field}
                label="From column"
                options={columnsOf(fromTableId)}
              />
            )}
          </form.Field>
        )}
      </form.Subscribe>
      <form.Field name="toTableId">
        {(field) => (
          <SelectField
            field={field}
            label="To table"
            onValueChange={() => form.setFieldValue("toColumnId", "")}
            options={tableOptions}
          />
        )}
      </form.Field>
      <form.Subscribe selector={(state) => state.values.toTableId}>
        {(toTableId) => (
          <form.Field name="toColumnId">
            {(field) => (
              <SelectField
                field={field}
                label="To column"
                options={columnsOf(toTableId)}
              />
            )}
          </form.Field>
        )}
      </form.Subscribe>
      <form.Field name="cardinality">
        {(field) => (
          <SelectField
            field={field}
            label="Cardinality"
            options={DATA_MODEL_CARDINALITIES}
          />
        )}
      </form.Field>
      <form.Field name="onDelete">
        {(field) => (
          <SelectField
            field={field}
            label="On delete"
            options={REFERENTIAL_ACTIONS}
          />
        )}
      </form.Field>
      <form.Field name="onUpdate">
        {(field) => (
          <SelectField
            field={field}
            label="On update"
            options={REFERENTIAL_ACTIONS}
          />
        )}
      </form.Field>
      <form.Subscribe selector={(state) => state.values}>
        {(values) => (
          <EditSubmit
            disabled={disabled || !addRelationSchema.safeParse(values).success}
            label="Add relation"
          />
        )}
      </form.Subscribe>
    </EditForm>
  );
}
