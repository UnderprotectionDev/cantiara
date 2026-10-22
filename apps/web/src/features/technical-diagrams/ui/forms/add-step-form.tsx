// biome-ignore-all lint/performance/noJsxPropsBind: Each small form binds its own field state.
import type { SequenceModel } from "@cantiara/api/technical-diagram-structure";
import {
  SEQUENCE_GROUP_KINDS,
  SEQUENCE_MESSAGE_KINDS,
} from "@cantiara/api/technical-diagram-structure";
import { useForm } from "@tanstack/react-form";
import { type FormEvent, useId } from "react";

import { addControlGroup, addMessage } from "../../lib/technical-diagram-edit";
import { CHOOSE, ids } from "../../lib/technical-diagram-field-options";
import {
  groupSchema,
  stepSchema,
} from "../../lib/technical-diagram-form-schemas";
import {
  EditForm,
  EditSubmit,
  SelectField,
  TextField,
} from "../components/diagram-form-fields";

/**
 * The Add message and Add control group forms share one message draft: a
 * control group wraps the message being drafted, so both submit one form state.
 */
export function AddStepForms({
  disabled,
  model,
  onSave,
}: {
  disabled: boolean;
  model: SequenceModel;
  onSave: (model: SequenceModel) => void;
}) {
  const form = useForm({
    defaultValues: {
      condition: "",
      from: "",
      groupKind: SEQUENCE_GROUP_KINDS[0] as string,
      label: "",
      messageKind: "Sync",
      to: "",
    },
    onSubmit: ({ value, formApi, meta }) => {
      const schema = meta === "group" ? groupSchema : stepSchema;
      if (!schema.safeParse(value).success) {
        return;
      }
      const draft = {
        from: value.from,
        label: value.label.trim(),
        messageKind: value.messageKind,
        to: value.to,
      } as Parameters<typeof addMessage>[1];
      if (meta === "group") {
        onSave(
          addControlGroup(
            model,
            {
              condition: value.condition.trim(),
              groupKind: value.groupKind as "Alt" | "Opt" | "Loop",
            },
            draft,
          ),
        );
        formApi.setFieldValue("condition", "");
      } else {
        onSave(addMessage(model, draft));
      }
      formApi.setFieldValue("label", "");
    },
    onSubmitMeta: "message" as "group" | "message",
  });
  const participants = [CHOOSE, ...ids(model.participants)];
  const groupHelpId = useId();
  const submitAs =
    (meta: "group" | "message") => (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      event.stopPropagation();
      form.handleSubmit(meta).catch(() => undefined);
    };
  return (
    <>
      <EditForm label="Add message" onSubmit={submitAs("message")}>
        <form.Field name="from">
          {(field) => (
            <SelectField
              field={field}
              label="Message from"
              options={participants}
            />
          )}
        </form.Field>
        <form.Field name="messageKind">
          {(field) => (
            <SelectField
              field={field}
              label="Message kind"
              options={SEQUENCE_MESSAGE_KINDS}
            />
          )}
        </form.Field>
        <form.Field name="to">
          {(field) => (
            <SelectField
              field={field}
              label="Message to"
              options={participants}
            />
          )}
        </form.Field>
        <form.Field name="label">
          {(field) => <TextField field={field} label="Message label" />}
        </form.Field>
        <form.Subscribe selector={(state) => state.values}>
          {(values) => (
            <EditSubmit
              disabled={disabled || !stepSchema.safeParse(values).success}
              label="Add message"
            />
          )}
        </form.Subscribe>
      </EditForm>
      <EditForm label="Add control group" onSubmit={submitAs("group")}>
        <p className="text-muted-foreground text-sm" id={groupHelpId}>
          A control group wraps the drafted message: fill Message from, Message
          to and Message label in the Add message form first.
        </p>
        <form.Field name="groupKind">
          {(field) => (
            <SelectField
              field={field}
              label="Group kind"
              options={SEQUENCE_GROUP_KINDS}
            />
          )}
        </form.Field>
        <form.Field name="condition">
          {(field) => <TextField field={field} label="Group condition" />}
        </form.Field>
        <form.Subscribe selector={(state) => state.values}>
          {(values) => (
            <EditSubmit
              describedBy={groupHelpId}
              disabled={disabled || !groupSchema.safeParse(values).success}
              label="Add control group"
            />
          )}
        </form.Subscribe>
      </EditForm>
    </>
  );
}
