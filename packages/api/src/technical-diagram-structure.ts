import type {
  ArchitectureModel,
  DataModelModel,
  DiagramModel,
  SequenceModel,
} from "@cantiara/db/schema/technical-diagram";
import { z } from "zod";

export type {
  ArchitectureModel,
  DataModelModel,
  SequenceModel,
} from "@cantiara/db/schema/technical-diagram";

/**
 * Typed canonical structural models of the three Technical Diagram types
 * (ADR-0021: PostgreSQL only; Mermaid, SQL and DBML are never a second live
 * source). Coordinates, collapse and focus are `Diagram View` metadata and do
 * not appear here.
 */

export const TECHNICAL_DIAGRAM_TYPES = [
  "Technical Architecture",
  "Data Model",
  "Technical Sequence",
] as const;

export type TechnicalDiagramType = (typeof TECHNICAL_DIAGRAM_TYPES)[number];

/** Closed Architecture catalog. BPMN, org chart and Gantt are not members. */
export const ARCHITECTURE_NODE_KINDS = [
  "Component",
  "Service",
  "Datastore",
  "Queue/Event Bus",
  "External System",
  "Boundary",
] as const;

export const ARCHITECTURE_LINK_KINDS = [
  "Calls",
  "Reads from",
  "Writes to",
  "Publishes to",
  "Subscribes to",
  "Depends on",
  "Contains",
] as const;

export const REFERENTIAL_ACTIONS = [
  "NO ACTION",
  "RESTRICT",
  "CASCADE",
  "SET NULL",
  "SET DEFAULT",
] as const;

export const DATA_MODEL_CARDINALITIES = ["One to one", "One to many"] as const;
export const SEQUENCE_MESSAGE_KINDS = [
  "Sync",
  "Async",
  "Event",
  "Return",
] as const;
export const SEQUENCE_GROUP_KINDS = ["Alt", "Opt", "Loop"] as const;
export const SEQUENCE_PARTICIPANT_KINDS = ["Actor", "Component"] as const;

export class StructuralModelError extends Error {}

const idSchema = z.string().trim().min(1).max(120);
const labelSchema = z.string().trim().min(1).max(255);

/** PostgreSQL column types the designed schema may use. */
const POSTGRES_TYPE =
  /^(smallint|integer|bigint|real|double precision|boolean|text|uuid|date|time|timestamp|timestamptz|jsonb|json|bytea|numeric(\(\d{1,3}(,\d{1,3})?\))?|varchar(\(\d{1,5}\))?)$/;

const architectureNodeSchema = z
  .object({
    id: idSchema,
    kind: z.enum(ARCHITECTURE_NODE_KINDS),
    label: labelSchema,
  })
  .strict();

const architectureLinkSchema = z
  .object({
    from: idSchema,
    kind: z.enum(ARCHITECTURE_LINK_KINDS).default("Depends on"),
    label: z.string().trim().min(1).max(255).nullable().default(null),
    to: idSchema,
  })
  .strict();

const columnSchema = z
  .object({
    default: z.string().trim().min(1).max(255).nullable().default(null),
    id: idSchema,
    name: labelSchema,
    nullable: z.boolean(),
    primaryKey: z.boolean().default(false),
    type: z.string().trim().regex(POSTGRES_TYPE, "Unknown PostgreSQL type."),
    unique: z.boolean().default(false),
  })
  .strict();

const indexSchema = z
  .object({
    columnIds: z.array(idSchema).min(1),
    id: idSchema,
    name: labelSchema,
    unique: z.boolean().default(false),
  })
  .strict();

const tableSchema = z
  .object({
    columns: z.array(columnSchema).min(1),
    id: idSchema,
    indexes: z.array(indexSchema).default([]),
    name: labelSchema,
  })
  .strict();

const relationSchema = z
  .object({
    cardinality: z.enum(DATA_MODEL_CARDINALITIES),
    fromColumnId: idSchema,
    fromTableId: idSchema,
    id: idSchema,
    onDelete: z.enum(REFERENTIAL_ACTIONS).default("NO ACTION"),
    onUpdate: z.enum(REFERENTIAL_ACTIONS).default("NO ACTION"),
    toColumnId: idSchema,
    toTableId: idSchema,
  })
  .strict();

const bindSchema = z
  .object({
    boundLabel: labelSchema,
    diagramId: idSchema,
    nodeId: idSchema,
    versionId: idSchema.nullable().default(null),
  })
  .strict();

const messageStepSchema = z
  .object({
    from: idSchema,
    id: idSchema,
    kind: z.literal("Message"),
    label: labelSchema,
    messageKind: z.enum(SEQUENCE_MESSAGE_KINDS),
    to: idSchema,
  })
  .strict();

const groupStepSchema = z
  .object({
    condition: labelSchema,
    groupKind: z.enum(SEQUENCE_GROUP_KINDS),
    id: idSchema,
    kind: z.literal("Group"),
    steps: z.array(messageStepSchema).min(1),
  })
  .strict();

const participantSchema = z
  .object({
    bind: bindSchema.nullable().default(null),
    id: idSchema,
    kind: z.enum(SEQUENCE_PARTICIPANT_KINDS),
    label: labelSchema,
  })
  .strict();

function issue(context: z.RefinementCtx, message: string) {
  context.addIssue({ code: "custom", message });
}

function duplicates(values: string[]) {
  return new Set(values).size !== values.length;
}

export const architectureModelSchema = z
  .object({
    links: z.array(architectureLinkSchema),
    nodes: z.array(architectureNodeSchema),
  })
  .strict()
  .superRefine((model, context) => {
    const kinds = new Map(model.nodes.map(({ id, kind }) => [id, kind]));
    if (kinds.size !== model.nodes.length) {
      issue(context, "Duplicate diagram node ID.");
    }
    const seen = new Set<string>();
    for (const link of model.links) {
      if (!(kinds.has(link.from) && kinds.has(link.to))) {
        issue(context, "Diagram link target is missing.");
        continue;
      }
      if (link.from === link.to) {
        issue(context, "A diagram link needs two different nodes.");
      }
      if (link.kind === "Contains" && kinds.get(link.from) !== "Boundary") {
        issue(context, "Only a Boundary can contain another node.");
      }
      const key = JSON.stringify([link.from, link.to, link.kind]);
      if (seen.has(key)) {
        issue(context, "Duplicate typed diagram link.");
      }
      seen.add(key);
    }
  });

type DataModelDraft = z.infer<typeof dataModelBaseSchema>;

function checkTable(
  table: DataModelDraft["tables"][number],
  indexNames: string[],
  context: z.RefinementCtx,
) {
  const columnIds = table.columns.map(({ id }) => id);
  if (duplicates(columnIds)) {
    issue(context, `Table ${table.name} repeats a column ID.`);
  }
  if (duplicates(table.columns.map(({ name }) => name.toLowerCase()))) {
    issue(context, `Table ${table.name} repeats a column name.`);
  }
  for (const column of table.columns) {
    if (column.primaryKey && column.nullable) {
      issue(context, `Primary key column ${column.name} cannot be null.`);
    }
  }
  for (const index of table.indexes) {
    indexNames.push(index.name.toLowerCase());
    if (!index.columnIds.every((id) => columnIds.includes(id))) {
      issue(context, `Index ${index.name} uses an unknown column.`);
    }
  }
}

function checkRelation(
  model: DataModelDraft,
  relation: DataModelDraft["relations"][number],
  context: z.RefinementCtx,
) {
  const lookup = (tableId: string, columnId: string) =>
    model.tables
      .find(({ id }) => id === tableId)
      ?.columns.find(({ id }) => id === columnId);
  const from = lookup(relation.fromTableId, relation.fromColumnId);
  const to = lookup(relation.toTableId, relation.toColumnId);
  if (!(from && to)) {
    issue(context, "Relation endpoint is missing.");
    return;
  }
  if (from.type !== to.type) {
    issue(context, "Relation columns need the same PostgreSQL type.");
  }
  if (!(to.primaryKey || to.unique)) {
    issue(context, "A relation must reference a key or unique column.");
  }
  if (
    (relation.onDelete === "SET NULL" || relation.onUpdate === "SET NULL") &&
    !from.nullable
  ) {
    issue(context, "SET NULL needs a nullable referencing column.");
  }
}

const dataModelBaseSchema = z
  .object({
    relations: z.array(relationSchema),
    tables: z.array(tableSchema),
  })
  .strict();

export const dataModelModelSchema = dataModelBaseSchema.superRefine(
  (model, context) => {
    if (duplicates(model.tables.map(({ id }) => id))) {
      issue(context, "Duplicate table ID.");
    }
    if (duplicates(model.tables.map(({ name }) => name.toLowerCase()))) {
      issue(context, "Duplicate table name.");
    }
    const indexNames: string[] = [];
    for (const table of model.tables) {
      checkTable(table, indexNames, context);
    }
    if (duplicates(indexNames)) {
      issue(context, "Duplicate index name.");
    }
    if (duplicates(model.relations.map(({ id }) => id))) {
      issue(context, "Duplicate relation ID.");
    }
    for (const relation of model.relations) {
      checkRelation(model, relation, context);
    }
  },
);

export const sequenceModelSchema = z
  .object({
    participants: z.array(participantSchema),
    steps: z.array(
      z.discriminatedUnion("kind", [messageStepSchema, groupStepSchema]),
    ),
  })
  .strict()
  .superRefine((model, context) => {
    const participantIds = model.participants.map(({ id }) => id);
    if (duplicates(participantIds)) {
      issue(context, "Duplicate participant ID.");
    }
    const known = new Set(participantIds);
    const ordered = model.steps.flatMap((step) =>
      step.kind === "Group" ? [step, ...step.steps] : [step],
    );
    if (duplicates(ordered.map(({ id }) => id))) {
      issue(context, "Duplicate step ID.");
    }
    const calls: Array<{ from: string; to: string }> = [];
    for (const step of ordered) {
      if (step.kind === "Group") {
        continue;
      }
      if (!(known.has(step.from) && known.has(step.to))) {
        issue(context, "Message participant is missing.");
        continue;
      }
      if (step.messageKind === "Return") {
        const answered = calls.findIndex(
          (call) => call.from === step.to && call.to === step.from,
        );
        if (answered < 0) {
          issue(
            context,
            "A Return message must answer an earlier message in the opposite direction.",
          );
        } else {
          calls.splice(answered, 1);
        }
      } else {
        calls.push({ from: step.from, to: step.to });
      }
    }
  });

export const structuralModelSchema = z.union([
  architectureModelSchema,
  dataModelModelSchema,
  sequenceModelSchema,
]);

const SCHEMAS = {
  "Data Model": dataModelModelSchema,
  "Technical Architecture": architectureModelSchema,
  "Technical Sequence": sequenceModelSchema,
} as const;

export function emptyStructuralModel(
  type: "Technical Architecture",
): ArchitectureModel;
export function emptyStructuralModel(type: "Data Model"): DataModelModel;
export function emptyStructuralModel(type: "Technical Sequence"): SequenceModel;
export function emptyStructuralModel(type: TechnicalDiagramType): DiagramModel;
export function emptyStructuralModel(type: TechnicalDiagramType): DiagramModel {
  if (type === "Data Model") {
    return { relations: [], tables: [] };
  }
  if (type === "Technical Sequence") {
    return { participants: [], steps: [] };
  }
  return { links: [], nodes: [] };
}

/** Validates a model against the diagram's type; the type picks the schema. */
export function resolveStructuralModel(
  type: TechnicalDiagramType,
  raw: unknown,
): DiagramModel {
  const parsed = SCHEMAS[type].safeParse(raw ?? emptyStructuralModel(type));
  if (!parsed.success) {
    throw new StructuralModelError(
      `${type} structural model is invalid: ${parsed.error.issues
        .map(({ message }) => message)
        .join(" ")}`,
    );
  }
  return parsed.data;
}

/**
 * Reads a stored model. Rows created before the three types had their own
 * model hold the empty Architecture shape; they read as an empty model of
 * their own type.
 */
export function parseStoredStructuralModel(
  type: TechnicalDiagramType,
  raw: unknown,
): DiagramModel | null {
  const parsed = SCHEMAS[type].safeParse(raw);
  if (parsed.success) {
    return parsed.data;
  }
  const legacy = architectureModelSchema.safeParse(raw);
  if (
    legacy.success &&
    legacy.data.nodes.length === 0 &&
    legacy.data.links.length === 0
  ) {
    return emptyStructuralModel(type);
  }
  return null;
}

export function isArchitectureModel(
  model: DiagramModel,
): model is ArchitectureModel {
  return "nodes" in model;
}

export interface DiagramGraph {
  links: Array<{ from: string; id: string; label: string | null; to: string }>;
  nodes: Array<{ id: string; kind: string; label: string }>;
}

/**
 * Element projection used by `Diagram View` selection, live cards and the
 * canvas. It is derived on read and never stored as a second source.
 */
export function diagramGraph(model: DiagramModel): DiagramGraph {
  if (isArchitectureModel(model)) {
    return {
      links: model.links.map((link) => ({
        from: link.from,
        id: `${link.from}>${link.kind}>${link.to}`,
        label: link.label ?? link.kind,
        to: link.to,
      })),
      nodes: model.nodes,
    };
  }
  if ("tables" in model) {
    return {
      links: model.relations.map((relation) => ({
        from: relation.fromTableId,
        id: relation.id,
        label: `${relation.cardinality}`,
        to: relation.toTableId,
      })),
      nodes: model.tables.map((table) => ({
        id: table.id,
        kind: "Table",
        label: table.name,
      })),
    };
  }
  return {
    links: model.steps
      .flatMap((step) => (step.kind === "Group" ? step.steps : [step]))
      .map((step) => ({
        from: step.from,
        id: step.id,
        label: `${step.messageKind}: ${step.label}`,
        to: step.to,
      })),
    nodes: model.participants.map((participant) => ({
      id: participant.id,
      kind: participant.kind,
      label: participant.label,
    })),
  };
}

function byId<T extends { id: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => a.id.localeCompare(b.id));
}

/**
 * Deterministic serialization: logically equal models (entity order aside)
 * give the same text. Column and step order is meaningful and kept.
 */
export function canonicalStructuralModel(model: DiagramModel): string {
  if (isArchitectureModel(model)) {
    return JSON.stringify({
      links: [...model.links].sort((a, b) =>
        `${a.from}\u0000${a.to}\u0000${a.kind}`.localeCompare(
          `${b.from}\u0000${b.to}\u0000${b.kind}`,
        ),
      ),
      nodes: byId(model.nodes),
    });
  }
  if ("tables" in model) {
    return JSON.stringify({
      relations: byId(model.relations),
      tables: byId(model.tables).map((table) => ({
        ...table,
        indexes: byId(table.indexes),
      })),
    });
  }
  return JSON.stringify({
    participants: byId(model.participants),
    steps: model.steps,
  });
}
