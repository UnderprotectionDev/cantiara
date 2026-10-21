import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  unique,
} from "drizzle-orm/pg-core";

import { project } from "./project";

/** Typed canonical structural models. React Flow positions are not here. */
export type ArchitectureNodeKind =
  | "Component"
  | "Service"
  | "Datastore"
  | "Queue/Event Bus"
  | "External System"
  | "Boundary";

export type ArchitectureLinkKind =
  | "Calls"
  | "Reads from"
  | "Writes to"
  | "Publishes to"
  | "Subscribes to"
  | "Depends on"
  | "Contains";

export interface ArchitectureModel {
  links: Array<{
    from: string;
    kind: ArchitectureLinkKind;
    label: string | null;
    to: string;
  }>;
  nodes: Array<{ id: string; kind: ArchitectureNodeKind; label: string }>;
}

export type ReferentialAction =
  | "NO ACTION"
  | "RESTRICT"
  | "CASCADE"
  | "SET NULL"
  | "SET DEFAULT";

/** Designed PostgreSQL schema; never a live database or a Drizzle sync. */
export interface DataModelModel {
  relations: Array<{
    cardinality: "One to one" | "One to many";
    fromColumnId: string;
    fromTableId: string;
    id: string;
    onDelete: ReferentialAction;
    onUpdate: ReferentialAction;
    toColumnId: string;
    toTableId: string;
  }>;
  tables: Array<{
    columns: Array<{
      default: string | null;
      id: string;
      name: string;
      nullable: boolean;
      primaryKey: boolean;
      type: string;
      unique: boolean;
    }>;
    id: string;
    indexes: Array<{
      columnIds: string[];
      id: string;
      name: string;
      unique: boolean;
    }>;
    name: string;
  }>;
}

/**
 * Optional exact bind of a lifeline to an Architecture node. `versionId` is the
 * explicit pinned `Diagram Version` reference; it stays null until Diagram
 * Versions exist and is never filled by following the source's newest state.
 */
export interface SequenceParticipantBind {
  boundLabel: string;
  diagramId: string;
  nodeId: string;
  versionId: string | null;
}

export type SequenceMessageKind = "Sync" | "Async" | "Event" | "Return";

export interface SequenceMessageStep {
  from: string;
  id: string;
  kind: "Message";
  label: string;
  messageKind: SequenceMessageKind;
  to: string;
}

export interface SequenceGroupStep {
  condition: string;
  groupKind: "Alt" | "Opt" | "Loop";
  id: string;
  kind: "Group";
  steps: SequenceMessageStep[];
}

export interface SequenceModel {
  participants: Array<{
    bind: SequenceParticipantBind | null;
    id: string;
    kind: "Actor" | "Component";
    label: string;
  }>;
  steps: Array<SequenceMessageStep | SequenceGroupStep>;
}

export type DiagramModel = ArchitectureModel | DataModelModel | SequenceModel;

export const technicalDiagram = pgTable(
  "technical_diagram",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => project.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    type: text("type").notNull(),
    authorityMode: text("authority_mode").notNull(),
    model: jsonb("model").$type<DiagramModel>().notNull(),
    externalUrl: text("external_url"),
    externalRevision: text("external_revision"),
    externalTool: text("external_tool"),
    externalCheckedAt: timestamp("external_checked_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    index("technical_diagram_project_idx").on(table.projectId),
    check(
      "technical_diagram_title_check",
      sql`length(btrim(${table.title})) between 1 and 255`,
    ),
    check(
      "technical_diagram_type_check",
      sql`${table.type} in ('Technical Architecture', 'Data Model', 'Technical Sequence')`,
    ),
    check(
      "technical_diagram_authority_mode_check",
      sql`${table.authorityMode} in ('Product-authored Model', 'Imported Independent Copy', 'External Source Link')`,
    ),
  ],
);

/** Authority conversion: the target `Originates from` the source (inverse `Derived`). */
export const diagramAuthorityOrigin = pgTable(
  "diagram_authority_origin",
  {
    targetDiagramId: text("target_diagram_id")
      .primaryKey()
      .references(() => technicalDiagram.id, { onDelete: "cascade" }),
    sourceDiagramId: text("source_diagram_id")
      .notNull()
      .references(() => technicalDiagram.id, { onDelete: "cascade" }),
    sourceMode: text("source_mode").notNull(),
    targetMode: text("target_mode").notNull(),
    loss: jsonb("loss").$type<string[]>().notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    index("diagram_authority_origin_source_idx").on(table.sourceDiagramId),
    check(
      "diagram_authority_origin_distinct_check",
      sql`${table.sourceDiagramId} <> ${table.targetDiagramId} and ${table.sourceMode} <> ${table.targetMode}`,
    ),
    check(
      "diagram_authority_origin_modes_check",
      sql`${table.sourceMode} in ('Product-authored Model', 'Imported Independent Copy', 'External Source Link') and ${table.targetMode} in ('Product-authored Model', 'Imported Independent Copy', 'External Source Link')`,
    ),
  ],
);

export const diagramView = pgTable(
  "diagram_view",
  {
    id: text("id").primaryKey(),
    diagramId: text("diagram_id")
      .notNull()
      .references(() => technicalDiagram.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    selectedNodeIds: jsonb("selected_node_ids")
      .$type<string[]>()
      .notNull()
      .default([]),
    /** View metadata only: element id to canvas coordinates. Not canonical. */
    layout: jsonb("layout")
      .$type<Record<string, { x: number; y: number }>>()
      .notNull()
      .default({}),
  },
  (table) => [
    unique("diagram_view_name_unique").on(table.diagramId, table.name),
    check(
      "diagram_view_name_check",
      sql`length(btrim(${table.name})) between 1 and 255`,
    ),
  ],
);

export const diagramDocumentOrigin = pgTable(
  "diagram_document_origin",
  {
    diagramId: text("diagram_id")
      .primaryKey()
      .references(() => technicalDiagram.id, { onDelete: "cascade" }),
    documentId: text("document_id").notNull(),
    documentRevision: integer("document_revision").notNull(),
    blockStart: integer("block_start").notNull(),
    blockEnd: integer("block_end").notNull(),
  },
  (table) => [
    check("diagram_origin_revision_check", sql`${table.documentRevision} >= 0`),
    check(
      "diagram_origin_block_check",
      sql`${table.blockStart} >= 0 and ${table.blockEnd} > ${table.blockStart}`,
    ),
  ],
);
