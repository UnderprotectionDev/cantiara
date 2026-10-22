// biome-ignore-all lint/performance/noJsxPropsBind: Each small form binds its own field state.
import type { ArchitectureModel } from "@cantiara/api/technical-diagram-structure";
import { ARCHITECTURE_LINK_KINDS } from "@cantiara/api/technical-diagram-structure";
import { useForm } from "@tanstack/react-form";

import { addArchitectureLink } from "../../lib/technical-diagram-edit";
import { CHOOSE } from "../../lib/technical-diagram-field-options";
import { addLinkSchema } from "../../lib/technical-diagram-form-schemas";
import {
  EditForm,
  EditSubmit,
  type FieldOption,
  SelectField,
  submitForm,
} from "../components/diagram-form-fields";

export function AddLinkForm({
  disabled,
  model,
  nodes,
  onSave,
}: {
  disabled: boolean;
  model: ArchitectureModel;
  nodes: FieldOption[];
  onSave: (model: ArchitectureModel) => void;
}) {
  const form = useForm({
    defaultValues: {
      from: "",
      kind: ARCHITECTURE_LINK_KINDS[0] as string,
      to: "",
    },
    onSubmit: ({ value }) => {
      if (!addLinkSchema.safeParse(value).success) {
        return;
      }
      onSave(
        addArchitectureLink(model, {
          from: value.from,
          kind: value.kind as ArchitectureModel["links"][number]["kind"],
          to: value.to,
        }),
      );
    },
  });
  const options = [CHOOSE, ...nodes];
  return (
    <EditForm label="Add link" onSubmit={submitForm(form)}>
      <form.Field name="from">
        {(field) => (
          <SelectField field={field} label="Link from" options={options} />
        )}
      </form.Field>
      <form.Field name="kind">
        {(field) => (
          <SelectField
            field={field}
            label="Link kind"
            options={ARCHITECTURE_LINK_KINDS}
          />
        )}
      </form.Field>
      <form.Field name="to">
        {(field) => (
          <SelectField field={field} label="Link to" options={options} />
        )}
      </form.Field>
      <form.Subscribe selector={(state) => state.values}>
        {(values) => (
          <EditSubmit
            disabled={disabled || !addLinkSchema.safeParse(values).success}
            label="Add link"
          />
        )}
      </form.Subscribe>
    </EditForm>
  );
}
