// biome-ignore-all lint/performance/noJsxPropsBind: Each small form binds its own field state.
import type { ArchitectureModel } from "@cantiara/api/technical-diagram-structure";
import { ARCHITECTURE_NODE_KINDS } from "@cantiara/api/technical-diagram-structure";
import { useForm } from "@tanstack/react-form";

import { addArchitectureNode } from "../../lib/technical-diagram-edit";
import { addNodeSchema } from "../../lib/technical-diagram-form-schemas";
import {
  EditForm,
  EditSubmit,
  SelectField,
  submitForm,
  TextField,
} from "../components/diagram-form-fields";

export function AddNodeForm({
  disabled,
  model,
  onSave,
}: {
  disabled: boolean;
  model: ArchitectureModel;
  onSave: (model: ArchitectureModel) => void;
}) {
  const form = useForm({
    defaultValues: { kind: ARCHITECTURE_NODE_KINDS[0] as string, label: "" },
    onSubmit: ({ value, formApi }) => {
      if (!addNodeSchema.safeParse(value).success) {
        return;
      }
      onSave(
        addArchitectureNode(model, {
          kind: value.kind as ArchitectureModel["nodes"][number]["kind"],
          label: value.label.trim(),
        }),
      );
      formApi.setFieldValue("label", "");
    },
  });
  return (
    <EditForm label="Add node" onSubmit={submitForm(form)}>
      <form.Field name="label">
        {(field) => <TextField field={field} label="Node label" />}
      </form.Field>
      <form.Field name="kind">
        {(field) => (
          <SelectField
            field={field}
            label="Node kind"
            options={ARCHITECTURE_NODE_KINDS}
          />
        )}
      </form.Field>
      <form.Subscribe selector={(state) => state.values}>
        {(values) => (
          <EditSubmit
            disabled={disabled || !addNodeSchema.safeParse(values).success}
            label="Add node"
          />
        )}
      </form.Subscribe>
    </EditForm>
  );
}
