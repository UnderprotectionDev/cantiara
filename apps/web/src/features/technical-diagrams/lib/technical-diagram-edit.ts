import type {
  ArchitectureModel,
  DataModelModel,
  SequenceModel,
} from "@cantiara/api/technical-diagram-structure";

/**
 * Pure edits of the canonical structural model. Each returns a new model; the
 * server validates it again with the type's schema before saving.
 */

type Nodes = ArchitectureModel["nodes"][number];
type Links = ArchitectureModel["links"][number];
type Column = DataModelModel["tables"][number]["columns"][number];
type Relation = DataModelModel["relations"][number];
type Participant = SequenceModel["participants"][number];
type Message = Extract<SequenceModel["steps"][number], { kind: "Message" }>;
type Group = Extract<SequenceModel["steps"][number], { kind: "Group" }>;

export const newElementId = () => crypto.randomUUID();

export function addArchitectureNode(
  model: ArchitectureModel,
  node: Omit<Nodes, "id">,
): ArchitectureModel {
  return { ...model, nodes: [...model.nodes, { ...node, id: newElementId() }] };
}

export function addArchitectureLink(
  model: ArchitectureModel,
  link: Omit<Links, "label"> & { label?: string | null },
): ArchitectureModel {
  return {
    ...model,
    links: [...model.links, { ...link, label: link.label ?? null }],
  };
}

export function removeArchitectureNode(
  model: ArchitectureModel,
  nodeId: string,
): ArchitectureModel {
  return {
    links: model.links.filter(
      ({ from, to }) => from !== nodeId && to !== nodeId,
    ),
    nodes: model.nodes.filter(({ id }) => id !== nodeId),
  };
}

export function addTable(model: DataModelModel, name: string): DataModelModel {
  const id = newElementId();
  return {
    ...model,
    tables: [
      ...model.tables,
      {
        columns: [
          {
            default: null,
            id: newElementId(),
            name: "id",
            nullable: false,
            primaryKey: true,
            type: "uuid",
            unique: false,
          },
        ],
        id,
        indexes: [],
        name,
      },
    ],
  };
}

export function addColumn(
  model: DataModelModel,
  tableId: string,
  column: Omit<Column, "id">,
): DataModelModel {
  return {
    ...model,
    tables: model.tables.map((table) =>
      table.id === tableId
        ? {
            ...table,
            columns: [...table.columns, { ...column, id: newElementId() }],
          }
        : table,
    ),
  };
}

export function addIndex(
  model: DataModelModel,
  tableId: string,
  index: { columnId: string; name: string; unique: boolean },
): DataModelModel {
  return {
    ...model,
    tables: model.tables.map((table) =>
      table.id === tableId
        ? {
            ...table,
            indexes: [
              ...table.indexes,
              {
                columnIds: [index.columnId],
                id: newElementId(),
                name: index.name,
                unique: index.unique,
              },
            ],
          }
        : table,
    ),
  };
}

export function addRelation(
  model: DataModelModel,
  relation: Omit<Relation, "id">,
): DataModelModel {
  return {
    ...model,
    relations: [...model.relations, { ...relation, id: newElementId() }],
  };
}

export function removeTable(
  model: DataModelModel,
  tableId: string,
): DataModelModel {
  return {
    relations: model.relations.filter(
      ({ fromTableId, toTableId }) =>
        fromTableId !== tableId && toTableId !== tableId,
    ),
    tables: model.tables.filter(({ id }) => id !== tableId),
  };
}

export function addParticipant(
  model: SequenceModel,
  participant: Omit<Participant, "id">,
): SequenceModel {
  return {
    ...model,
    participants: [
      ...model.participants,
      { ...participant, id: newElementId() },
    ],
  };
}

export function addMessage(
  model: SequenceModel,
  message: Omit<Message, "id" | "kind">,
): SequenceModel {
  return {
    ...model,
    steps: [
      ...model.steps,
      { ...message, id: newElementId(), kind: "Message" },
    ],
  };
}

export function addControlGroup(
  model: SequenceModel,
  group: Pick<Group, "condition" | "groupKind">,
  first: Omit<Message, "id" | "kind">,
): SequenceModel {
  return {
    ...model,
    steps: [
      ...model.steps,
      {
        ...group,
        id: newElementId(),
        kind: "Group",
        steps: [{ ...first, id: newElementId(), kind: "Message" }],
      },
    ],
  };
}

export function removeStep(
  model: SequenceModel,
  stepId: string,
): SequenceModel {
  return {
    ...model,
    steps: model.steps
      .filter(({ id }) => id !== stepId)
      .map((step) =>
        step.kind === "Group"
          ? { ...step, steps: step.steps.filter(({ id }) => id !== stepId) }
          : step,
      )
      .filter((step) => step.kind !== "Group" || step.steps.length > 0),
  };
}

export function removeParticipant(
  model: SequenceModel,
  participantId: string,
): SequenceModel {
  const touches = (step: Message) =>
    step.from === participantId || step.to === participantId;
  return {
    participants: model.participants.filter(({ id }) => id !== participantId),
    steps: model.steps
      .filter((step) => step.kind === "Group" || !touches(step))
      .map((step) =>
        step.kind === "Group"
          ? { ...step, steps: step.steps.filter((inner) => !touches(inner)) }
          : step,
      )
      .filter((step) => step.kind !== "Group" || step.steps.length > 0),
  };
}

/** Deterministic grid used when a Diagram View has no coordinates yet. */
export function autoPosition(index: number, columns = 4) {
  return { x: (index % columns) * 240, y: Math.floor(index / columns) * 140 };
}
