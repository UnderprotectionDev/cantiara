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

export interface DiagramModel {
  links: Array<{ from: string; to: string; label: string | null }>;
  nodes: Array<{
    id: string;
    label: string;
    kind:
      | "Component"
      | "Service"
      | "Datastore"
      | "Queue/Event Bus"
      | "External System"
      | "Boundary";
  }>;
}

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
