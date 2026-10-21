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
import { Input } from "@cantiara/ui/components/input";
import { Label } from "@cantiara/ui/components/label";
import { type ReactNode, useId, useState } from "react";

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

interface Option {
  label: string;
  value: string;
}

function SelectField({
  label,
  onChange,
  options,
  value,
}: {
  label: string;
  onChange: (value: string) => void;
  options: readonly (Option | string)[];
  value: string;
}) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1">
      <Label htmlFor={id}>{label}</Label>
      <select
        id={id}
        onChange={(event) => onChange(event.target.value)}
        value={value}
      >
        {options.map((option) => {
          const item =
            typeof option === "string"
              ? { label: option, value: option }
              : option;
          return (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          );
        })}
      </select>
    </div>
  );
}

function TextField({
  label,
  onChange,
  value,
}: {
  label: string;
  onChange: (value: string) => void;
  value: string;
}) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        onChange={(event) => onChange(event.target.value)}
        value={value}
      />
    </div>
  );
}

function CheckField({
  checked,
  label,
  onChange,
}: {
  checked: boolean;
  label: string;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="inline-flex items-center gap-1">
      <input
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        type="checkbox"
      />
      {label}
    </label>
  );
}

function EditForm({
  children,
  disabled,
  label,
  onSubmit,
}: {
  children: ReactNode;
  disabled: boolean;
  label: string;
  onSubmit: () => void;
}) {
  return (
    <form
      aria-label={label}
      className="flex flex-wrap items-end gap-2 rounded-md border p-2"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
    >
      {children}
      <Button disabled={disabled} size="sm" type="submit">
        {label}
      </Button>
    </form>
  );
}

const ids = (items: { id: string; label?: string; name?: string }[]) =>
  items.map((item) => ({
    label: item.label ?? item.name ?? item.id,
    value: item.id,
  }));

function ArchitectureEditor({
  disabled,
  model,
  onSave,
}: {
  disabled: boolean;
  model: ArchitectureModel;
  onSave: (model: ArchitectureModel) => void;
}) {
  const [label, setLabel] = useState("");
  const [kind, setKind] = useState<string>(ARCHITECTURE_NODE_KINDS[0]);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [linkKind, setLinkKind] = useState<string>(ARCHITECTURE_LINK_KINDS[0]);
  const nodes = ids(model.nodes);
  return (
    <div className="space-y-2">
      <EditForm
        disabled={disabled || !label.trim()}
        label="Add node"
        onSubmit={() => {
          onSave(
            addArchitectureNode(model, {
              kind: kind as ArchitectureModel["nodes"][number]["kind"],
              label: label.trim(),
            }),
          );
          setLabel("");
        }}
      >
        <TextField label="Node label" onChange={setLabel} value={label} />
        <SelectField
          label="Node kind"
          onChange={setKind}
          options={ARCHITECTURE_NODE_KINDS}
          value={kind}
        />
      </EditForm>
      <EditForm
        disabled={disabled || !from || !to}
        label="Add link"
        onSubmit={() =>
          onSave(
            addArchitectureLink(model, {
              from,
              kind: linkKind as ArchitectureModel["links"][number]["kind"],
              to,
            }),
          )
        }
      >
        <SelectField
          label="Link from"
          onChange={setFrom}
          options={[{ label: "Choose", value: "" }, ...nodes]}
          value={from}
        />
        <SelectField
          label="Link kind"
          onChange={setLinkKind}
          options={ARCHITECTURE_LINK_KINDS}
          value={linkKind}
        />
        <SelectField
          label="Link to"
          onChange={setTo}
          options={[{ label: "Choose", value: "" }, ...nodes]}
          value={to}
        />
      </EditForm>
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

function DataModelEditor({
  disabled,
  model,
  onSave,
}: {
  disabled: boolean;
  model: DataModelModel;
  onSave: (model: DataModelModel) => void;
}) {
  const [tableName, setTableName] = useState("");
  const [tableId, setTableId] = useState("");
  const [column, setColumn] = useState({
    default: "",
    name: "",
    nullable: true,
    primaryKey: false,
    type: "text",
    unique: false,
  });
  const [index, setIndex] = useState({ columnId: "", name: "", unique: false });
  const [relation, setRelation] = useState({
    cardinality: DATA_MODEL_CARDINALITIES[1] as string,
    fromColumnId: "",
    fromTableId: "",
    onDelete: "NO ACTION",
    onUpdate: "NO ACTION",
    toColumnId: "",
    toTableId: "",
  });
  const tableOptions = [{ label: "Choose", value: "" }, ...ids(model.tables)];
  const columnsOf = (id: string) => [
    { label: "Choose", value: "" },
    ...ids(model.tables.find((table) => table.id === id)?.columns ?? []),
  ];
  return (
    <div className="space-y-2">
      <EditForm
        disabled={disabled || !tableName.trim()}
        label="Add table"
        onSubmit={() => {
          onSave(addTable(model, tableName.trim()));
          setTableName("");
        }}
      >
        <TextField
          label="Table name"
          onChange={setTableName}
          value={tableName}
        />
      </EditForm>
      <EditForm
        disabled={disabled || !tableId || !column.name.trim()}
        label="Add column"
        onSubmit={() => {
          onSave(
            addColumn(model, tableId, {
              ...column,
              default: column.default.trim() || null,
              name: column.name.trim(),
            }),
          );
          setColumn({ ...column, default: "", name: "" });
        }}
      >
        <SelectField
          label="Column table"
          onChange={setTableId}
          options={tableOptions}
          value={tableId}
        />
        <TextField
          label="Column name"
          onChange={(name) => setColumn({ ...column, name })}
          value={column.name}
        />
        <TextField
          label="PostgreSQL type"
          onChange={(type) => setColumn({ ...column, type })}
          value={column.type}
        />
        <TextField
          label="Default"
          onChange={(value) => setColumn({ ...column, default: value })}
          value={column.default}
        />
        <CheckField
          checked={column.nullable}
          label="Nullable"
          onChange={(nullable) => setColumn({ ...column, nullable })}
        />
        <CheckField
          checked={column.primaryKey}
          label="Primary key"
          onChange={(primaryKey) =>
            setColumn({
              ...column,
              nullable: primaryKey ? false : column.nullable,
              primaryKey,
            })
          }
        />
        <CheckField
          checked={column.unique}
          label="Unique"
          onChange={(unique) => setColumn({ ...column, unique })}
        />
      </EditForm>
      <EditForm
        disabled={disabled || !tableId || !index.columnId || !index.name.trim()}
        label="Add index"
        onSubmit={() => {
          onSave(
            addIndex(model, tableId, { ...index, name: index.name.trim() }),
          );
          setIndex({ ...index, name: "" });
        }}
      >
        <SelectField
          label="Index column"
          onChange={(columnId) => setIndex({ ...index, columnId })}
          options={columnsOf(tableId)}
          value={index.columnId}
        />
        <TextField
          label="Index name"
          onChange={(name) => setIndex({ ...index, name })}
          value={index.name}
        />
        <CheckField
          checked={index.unique}
          label="Unique index"
          onChange={(unique) => setIndex({ ...index, unique })}
        />
      </EditForm>
      <EditForm
        disabled={
          disabled ||
          !(
            relation.fromTableId &&
            relation.fromColumnId &&
            relation.toTableId &&
            relation.toColumnId
          )
        }
        label="Add relation"
        onSubmit={() =>
          onSave(
            addRelation(model, relation as Parameters<typeof addRelation>[1]),
          )
        }
      >
        <SelectField
          label="From table"
          onChange={(fromTableId) =>
            setRelation({ ...relation, fromColumnId: "", fromTableId })
          }
          options={tableOptions}
          value={relation.fromTableId}
        />
        <SelectField
          label="From column"
          onChange={(fromColumnId) =>
            setRelation({ ...relation, fromColumnId })
          }
          options={columnsOf(relation.fromTableId)}
          value={relation.fromColumnId}
        />
        <SelectField
          label="To table"
          onChange={(toTableId) =>
            setRelation({ ...relation, toColumnId: "", toTableId })
          }
          options={tableOptions}
          value={relation.toTableId}
        />
        <SelectField
          label="To column"
          onChange={(toColumnId) => setRelation({ ...relation, toColumnId })}
          options={columnsOf(relation.toTableId)}
          value={relation.toColumnId}
        />
        <SelectField
          label="Cardinality"
          onChange={(cardinality) => setRelation({ ...relation, cardinality })}
          options={DATA_MODEL_CARDINALITIES}
          value={relation.cardinality}
        />
        <SelectField
          label="On delete"
          onChange={(onDelete) => setRelation({ ...relation, onDelete })}
          options={REFERENTIAL_ACTIONS}
          value={relation.onDelete}
        />
        <SelectField
          label="On update"
          onChange={(onUpdate) => setRelation({ ...relation, onUpdate })}
          options={REFERENTIAL_ACTIONS}
          value={relation.onUpdate}
        />
      </EditForm>
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
  const [label, setLabel] = useState("");
  const [kind, setKind] = useState<string>(SEQUENCE_PARTICIPANT_KINDS[0]);
  const [bind, setBind] = useState("");
  const [message, setMessage] = useState({
    from: "",
    label: "",
    messageKind: "Sync",
    to: "",
  });
  const [group, setGroup] = useState({
    condition: "",
    groupKind: SEQUENCE_GROUP_KINDS[0] as string,
  });
  const participants = [
    { label: "Choose", value: "" },
    ...ids(model.participants),
  ];
  const draft = message as Parameters<typeof addMessage>[1];
  const messageReady = message.from && message.to && message.label.trim();
  return (
    <div className="space-y-2">
      <EditForm
        disabled={disabled || !label.trim()}
        label="Add participant"
        onSubmit={() => {
          const option = bindOptions.find((item) => bindKey(item) === bind);
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
              kind: kind as SequenceModel["participants"][number]["kind"],
              label: label.trim(),
            }),
          );
          setLabel("");
          setBind("");
        }}
      >
        <TextField
          label="Participant label"
          onChange={setLabel}
          value={label}
        />
        <SelectField
          label="Participant kind"
          onChange={setKind}
          options={SEQUENCE_PARTICIPANT_KINDS}
          value={kind}
        />
        <SelectField
          label="Bind to Architecture node"
          onChange={setBind}
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
          value={bind}
        />
      </EditForm>
      <EditForm
        disabled={disabled || !messageReady}
        label="Add message"
        onSubmit={() => {
          onSave(addMessage(model, { ...draft, label: message.label.trim() }));
          setMessage({ ...message, label: "" });
        }}
      >
        <SelectField
          label="Message from"
          onChange={(from) => setMessage({ ...message, from })}
          options={participants}
          value={message.from}
        />
        <SelectField
          label="Message kind"
          onChange={(messageKind) => setMessage({ ...message, messageKind })}
          options={SEQUENCE_MESSAGE_KINDS}
          value={message.messageKind}
        />
        <SelectField
          label="Message to"
          onChange={(to) => setMessage({ ...message, to })}
          options={participants}
          value={message.to}
        />
        <TextField
          label="Message label"
          onChange={(value) => setMessage({ ...message, label: value })}
          value={message.label}
        />
      </EditForm>
      <EditForm
        disabled={disabled || !messageReady || !group.condition.trim()}
        label="Add control group"
        onSubmit={() => {
          onSave(
            addControlGroup(
              model,
              {
                condition: group.condition.trim(),
                groupKind: group.groupKind as "Alt" | "Opt" | "Loop",
              },
              { ...draft, label: message.label.trim() },
            ),
          );
          setGroup({ ...group, condition: "" });
          setMessage({ ...message, label: "" });
        }}
      >
        <SelectField
          label="Group kind"
          onChange={(groupKind) => setGroup({ ...group, groupKind })}
          options={SEQUENCE_GROUP_KINDS}
          value={group.groupKind}
        />
        <TextField
          label="Group condition"
          onChange={(condition) => setGroup({ ...group, condition })}
          value={group.condition}
        />
      </EditForm>
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
