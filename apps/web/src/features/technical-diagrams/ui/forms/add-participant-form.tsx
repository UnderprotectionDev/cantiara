// biome-ignore-all lint/performance/noJsxPropsBind: Each small form binds its own field state.
import type { SequenceModel } from "@cantiara/api/technical-diagram-structure";
import { SEQUENCE_PARTICIPANT_KINDS } from "@cantiara/api/technical-diagram-structure";
import { useForm } from "@tanstack/react-form";

import { addParticipant } from "../../lib/technical-diagram-edit";
import {
  type ArchitectureBindOption,
  bindKey,
} from "../../lib/technical-diagram-field-options";
import { addParticipantSchema } from "../../lib/technical-diagram-form-schemas";
import {
  EditForm,
  EditSubmit,
  SelectField,
  submitForm,
  TextField,
} from "../components/diagram-form-fields";

export function AddParticipantForm({
  bindOptions,
  disabled,
  model,
  onSave,
}: {
  bindOptions: ArchitectureBindOption[];
  disabled: boolean;
  model: SequenceModel;
  onSave: (model: SequenceModel) => void;
}) {
  const form = useForm({
    defaultValues: {
      bind: "",
      kind: SEQUENCE_PARTICIPANT_KINDS[0] as string,
      label: "",
    },
    onSubmit: ({ value, formApi }) => {
      if (!addParticipantSchema.safeParse(value).success) {
        return;
      }
      const option = bindOptions.find((item) => bindKey(item) === value.bind);
      onSave(
        addParticipant(model, {
          bind: option
            ? {
                boundLabel: option.boundLabel,
                diagramId: option.diagramId,
                nodeId: option.nodeId,
                versionId: option.versionId ?? null,
              }
            : null,
          kind: value.kind as SequenceModel["participants"][number]["kind"],
          label: value.label.trim(),
        }),
      );
      formApi.setFieldValue("label", "");
      formApi.setFieldValue("bind", "");
    },
  });
  return (
    <EditForm label="Add participant" onSubmit={submitForm(form)}>
      <form.Field name="label">
        {(field) => <TextField field={field} label="Participant label" />}
      </form.Field>
      <form.Field name="kind">
        {(field) => (
          <SelectField
            field={field}
            label="Participant kind"
            options={SEQUENCE_PARTICIPANT_KINDS}
          />
        )}
      </form.Field>
      <form.Field name="bind">
        {(field) => (
          <SelectField
            field={field}
            label="Bind to Architecture node"
            options={[
              { label: "No bind", value: "" },
              ...bindOptions.map((option) => ({
                label: `${option.diagramTitle} / ${option.boundLabel}${
                  option.versionId
                    ? ` (Diagram Version ${option.versionName ?? option.versionId})`
                    : " (live node, no Diagram Version)"
                }`,
                value: bindKey(option),
              })),
            ]}
          />
        )}
      </form.Field>
      <form.Subscribe selector={(state) => state.values}>
        {(values) => (
          <EditSubmit
            disabled={
              disabled || !addParticipantSchema.safeParse(values).success
            }
            label="Add participant"
          />
        )}
      </form.Subscribe>
    </EditForm>
  );
}
