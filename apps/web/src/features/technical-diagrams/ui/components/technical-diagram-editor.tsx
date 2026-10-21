// biome-ignore-all lint/performance/noJsxPropsBind: Each small form binds its own field state.

import type {
  ArchitectureModel,
  DataModelModel,
  SequenceModel,
} from "@cantiara/api/technical-diagram-structure";
import {
  ARCHITECTURE_LINK_KINDS,
  ARCHITECTURE_NODE_KINDS,
  DATA_MODEL_CARDINALITIES,
  REFERENTIAL_ACTIONS,
  SEQUENCE_GROUP_KINDS,
  SEQUENCE_MESSAGE_KINDS,
  SEQUENCE_PARTICIPANT_KINDS,
} from "@cantiara/api/technical-diagram-structure";
import type { TechnicalDiagramSource } from "@cantiara/api/technical-diagrams";
import { Button } from "@cantiara/ui/components/button";
import { useForm } from "@tanstack/react-form";
import { type FormEvent, useId, useState } from "react";
import { z } from "zod";

import {
  addArchitectureLink,
  addArchitectureNode,
  addColumn,
  addControlGroup,
  addIndex,
  addMessage,
  addParticipant,
  addRelation,
  addTable,
  removeArchitectureNode,
  removeParticipant,
  removeStep,
  removeTable,
} from "../../lib/technical-diagram-edit";
import {
  CheckField,
  EditForm,
  EditSubmit,
  type FieldOption,
  SelectField,
  submitForm,
  TextField,
} from "./diagram-form-fields";

export interface ArchitectureBindOption {
  boundLabel: string;
  diagramId: string;
  diagramTitle: string;
  nodeId: string;
  /** Set when the node belongs to an exact Diagram Version; null is the live node. */
  versionId?: string | null;
  versionName?: string;
}

const bindKey = (option: ArchitectureBindOption) =>
  `${option.diagramId}:${option.nodeId}:${option.versionId ?? ""}`;

interface EditorProps {
  /** Exact Architecture nodes a Sequence lifeline may bind. */
  bindOptions: ArchitectureBindOption[];
  diagram: TechnicalDiagramSource;
  disabled: boolean;
  onSave: (model: TechnicalDiagramSource["model"]) => void;
}

const required = z.string().trim().min(1);
const chosen = z.string().min(1);

const ids = (items: { id: string; label?: string; name?: string }[]) =>
  items.map((item) => ({
    label: item.label ?? item.name ?? item.id,
    value: item.id,
  }));

const CHOOSE: FieldOption = { label: "Choose", value: "" };

const addNodeSchema = z.object({ kind: z.string(), label: required });
const addLinkSchema = z.object({ from: chosen, kind: z.string(), to: chosen });

function AddNodeForm({
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
      onSave(
        addArchitectureNode(model, {
          kind: value.kind as ArchitectureModel["nodes"][number]["kind"],
          label: value.label.trim(),
        }),
      );
      formApi.setFieldValue("label", "");
    },
    validators: { onChange: addNodeSchema },
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

function AddLinkForm({
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
    onSubmit: ({ value }) =>
      onSave(
        addArchitectureLink(model, {
          from: value.from,
          kind: value.kind as ArchitectureModel["links"][number]["kind"],
          to: value.to,
        }),
      ),
    validators: { onChange: addLinkSchema },
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

function ArchitectureEditor({
  disabled,
  model,
  onSave,
}: {
  disabled: boolean;
  model: ArchitectureModel;
  onSave: (model: ArchitectureModel) => void;
}) {
  return (
    <div className="space-y-2">
      <AddNodeForm disabled={disabled} model={model} onSave={onSave} />
      <AddLinkForm
        disabled={disabled}
        model={model}
        nodes={ids(model.nodes)}
        onSave={onSave}
      />
      <ul aria-label="Remove nodes" className="flex flex-wrap gap-2">
        {model.nodes.map((node) => (
          <li key={node.id}>
            <Button
              disabled={disabled}
              onClick={() => onSave(removeArchitectureNode(model, node.id))}
              size="sm"
              type="button"
              variant="outline"
            >
              Remove {node.label}
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}

const addTableSchema = z.object({ name: required });
const addColumnSchema = z.object({
  default: z.string(),
  name: required,
  nullable: z.boolean(),
  primaryKey: z.boolean(),
  tableId: chosen,
  type: z.string(),
  unique: z.boolean(),
});
const addIndexSchema = z.object({
  columnId: chosen,
  name: required,
  unique: z.boolean(),
});
const addRelationSchema = z.object({
  cardinality: z.string(),
  fromColumnId: chosen,
  fromTableId: chosen,
  onDelete: z.string(),
  onUpdate: z.string(),
  toColumnId: chosen,
  toTableId: chosen,
});

function AddTableForm({
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
      onSave(addTable(model, value.name.trim()));
      formApi.reset();
    },
    validators: { onChange: addTableSchema },
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

function AddColumnForm({
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
    validators: { onChange: addColumnSchema },
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

function AddIndexForm({
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
      onSave(addIndex(model, tableId, { ...value, name: value.name.trim() }));
      formApi.setFieldValue("name", "");
    },
    validators: { onChange: addIndexSchema },
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

function AddRelationForm({
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
    onSubmit: ({ value }) =>
      onSave(addRelation(model, value as Parameters<typeof addRelation>[1])),
    validators: { onChange: addRelationSchema },
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

function DataModelEditor({
  disabled,
  model,
  onSave,
}: {
  disabled: boolean;
  model: DataModelModel;
  onSave: (model: DataModelModel) => void;
}) {
  // The table the column and index forms act on; a transient selection.
  const [tableId, setTableId] = useState("");
  const tableOptions = [CHOOSE, ...ids(model.tables)];
  const columnsOf = (id: string) => [
    CHOOSE,
    ...ids(model.tables.find((table) => table.id === id)?.columns ?? []),
  ];
  return (
    <div className="space-y-2">
      <AddTableForm disabled={disabled} model={model} onSave={onSave} />
      <AddColumnForm
        disabled={disabled}
        model={model}
        onSave={onSave}
        onTableChange={setTableId}
        tableOptions={tableOptions}
      />
      <AddIndexForm
        columnsOf={columnsOf}
        disabled={disabled}
        model={model}
        onSave={onSave}
        tableId={tableId}
      />
      <AddRelationForm
        columnsOf={columnsOf}
        disabled={disabled}
        model={model}
        onSave={onSave}
        tableOptions={tableOptions}
      />
      <ul aria-label="Remove tables" className="flex flex-wrap gap-2">
        {model.tables.map((table) => (
          <li key={table.id}>
            <Button
              disabled={disabled}
              onClick={() => onSave(removeTable(model, table.id))}
              size="sm"
              type="button"
              variant="outline"
            >
              Remove {table.name}
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}

const addParticipantSchema = z.object({
  bind: z.string(),
  kind: z.string(),
  label: required,
});
const stepSchema = z.object({
  condition: z.string(),
  from: chosen,
  groupKind: z.string(),
  label: required,
  messageKind: z.string(),
  to: chosen,
});
const groupSchema = stepSchema.extend({ condition: required });

function AddParticipantForm({
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
    validators: { onChange: addParticipantSchema },
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

/**
 * The Add message and Add control group forms share one message draft: a
 * control group wraps the message being drafted, so both submit one form state.
 */
function AddStepForms({
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

function SequenceEditor({
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
  return (
    <div className="space-y-2">
      <AddParticipantForm
        bindOptions={bindOptions}
        disabled={disabled}
        model={model}
        onSave={onSave}
      />
      <AddStepForms disabled={disabled} model={model} onSave={onSave} />
      <ul
        aria-label="Remove steps and participants"
        className="flex flex-wrap gap-2"
      >
        {model.participants.map((participant) => (
          <li key={participant.id}>
            <Button
              disabled={disabled}
              onClick={() => onSave(removeParticipant(model, participant.id))}
              size="sm"
              type="button"
              variant="outline"
            >
              Remove {participant.label}
            </Button>
          </li>
        ))}
        {model.steps.map((step) => (
          <li key={step.id}>
            <Button
              disabled={disabled}
              onClick={() => onSave(removeStep(model, step.id))}
              size="sm"
              type="button"
              variant="outline"
            >
              Remove step {step.kind === "Group" ? step.condition : step.label}
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Edits the typed canonical model; External Source Link has none to edit. */
export function TechnicalDiagramEditor({
  bindOptions,
  diagram,
  disabled,
  onSave,
}: EditorProps) {
  if (diagram.authorityMode === "External Source Link") {
    return (
      <p className="text-muted-foreground text-sm">
        The structural model stays in the external tool.
      </p>
    );
  }
  const { model } = diagram;
  return (
    <section aria-label="Edit structural model" className="space-y-2">
      <h4 className="font-medium">Edit structural model</h4>
      {"nodes" in model ? (
        <ArchitectureEditor disabled={disabled} model={model} onSave={onSave} />
      ) : null}
      {"tables" in model ? (
        <DataModelEditor disabled={disabled} model={model} onSave={onSave} />
      ) : null}
      {"participants" in model ? (
        <SequenceEditor
          bindOptions={bindOptions}
          disabled={disabled}
          model={model}
          onSave={onSave}
        />
      ) : null}
    </section>
  );
}
