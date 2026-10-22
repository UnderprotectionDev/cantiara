// biome-ignore-all lint/performance/noJsxPropsBind: Remove buttons close over their record.
import type {
  ArchitectureModel,
  DataModelModel,
  SequenceModel,
} from "@cantiara/api/technical-diagram-structure";
import type { TechnicalDiagramSource } from "@cantiara/api/technical-diagrams";
import { Button } from "@cantiara/ui/components/button";
import { useState } from "react";

import {
  removeArchitectureNode,
  removeParticipant,
  removeStep,
  removeTable,
} from "../../lib/technical-diagram-edit";
import {
  type ArchitectureBindOption,
  CHOOSE,
  ids,
} from "../../lib/technical-diagram-field-options";
import { AddColumnForm } from "../forms/add-column-form";
import { AddIndexForm } from "../forms/add-index-form";
import { AddLinkForm } from "../forms/add-link-form";
import { AddNodeForm } from "../forms/add-node-form";
import { AddParticipantForm } from "../forms/add-participant-form";
import { AddRelationForm } from "../forms/add-relation-form";
import { AddStepForms } from "../forms/add-step-form";
import { AddTableForm } from "../forms/add-table-form";

interface EditorProps {
  /** Exact Architecture nodes a Sequence lifeline may bind. */
  bindOptions: ArchitectureBindOption[];
  diagram: TechnicalDiagramSource;
  disabled: boolean;
  onSave: (model: TechnicalDiagramSource["model"]) => void;
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
