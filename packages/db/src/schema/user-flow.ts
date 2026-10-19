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
  uniqueIndex,
} from "drizzle-orm/pg-core";

import { workspace } from "./auth";
import { project } from "./project";

/**
 * Read-only live card of a Work, Decision or Risk on the canvas. The card holds
 * only the record id and its place on the canvas: moving or removing it is a
 * flow edit and never writes the source record.
 */
export interface UserFlowCard {
  id: string;
  kind: "Decision" | "Risk" | "Work";
  placedAt: string;
  position: { x: number; y: number };
  recordId: string;
}

/**
 * Durable User Flow document. React Flow is only the editor adapter; this is
 * the model of record. A Screen node carries a live Screen id and nothing else
 * of the Screen: no title, body or preview is copied onto the node.
 */
export interface UserFlowDocument {
  /** Absent in versions saved before live cards existed. */
  cards?: UserFlowCard[];
  links: Array<{ from: string; id: string; text: string; to: string }>;
  nodes: Array<{
    id: string;
    kind: "Action" | "Decision" | "Screen" | "Section" | "State/Outcome";
    /** When the live Screen reference was first established. */
    placedAt: string;
    position: { x: number; y: number };
    screenId: string | null;
    /** Fixed palette tone; absent in versions saved before styles existed. */
    style?: "amber" | "blue" | "default" | "green" | "red" | "violet";
    /** Flow-specific description, transition, condition or decision text. */
    text: string;
  }>;
}

/**
 * Minimal Screen master record owned by the User Flow spec until the Screens
 * and Wireframes feature extends it. A permanently deleted Screen has no row.
 */
export const screen = pgTable(
  "screen",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => project.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    archivedAt: timestamp("archived_at"),
    trashedAt: timestamp("trashed_at"),
    redactedAt: timestamp("redacted_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    index("screen_project_idx").on(table.projectId),
    check(
      "screen_title_check",
      sql`length(btrim(${table.title})) between 1 and 255`,
    ),
  ],
);

/** Project-scoped Design master record of type `User Flow`. */
export const userFlow = pgTable(
  "user_flow",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => project.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    currentVersion: integer("current_version").notNull().default(1),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    index("user_flow_project_idx").on(table.projectId),
    check(
      "user_flow_title_check",
      sql`length(btrim(${table.title})) between 1 and 255`,
    ),
    check("user_flow_version_check", sql`${table.currentVersion} >= 1`),
  ],
);

export const userFlowVersion = pgTable(
  "user_flow_version",
  {
    id: text("id").primaryKey(),
    userFlowId: text("user_flow_id")
      .notNull()
      .references(() => userFlow.id, { onDelete: "cascade" }),
    version: integer("version").notNull(),
    document: jsonb("document").$type<UserFlowDocument>().notNull(),
    // Generated verdict of the closed semantic set: `valid` only when every
    // node has one of the five kinds (and a palette tone when styled).
    closedSet: text("closed_set").generatedAlwaysAs(
      sql`case when jsonb_typeof(document -> 'nodes') = 'array'
        and jsonb_array_length(jsonb_path_query_array(document, '$.nodes[*]')) = jsonb_array_length(jsonb_path_query_array(
          document,
          '$.nodes[*] ? (@.kind == "Screen" || @.kind == "Action" || @.kind == "Decision" || @.kind == "State/Outcome" || @.kind == "Section")'
        ))
        and jsonb_array_length(jsonb_path_query_array(
          document,
          '$.nodes[*] ? (exists(@.style) && @.style != "default" && @.style != "blue" && @.style != "green" && @.style != "amber" && @.style != "red" && @.style != "violet")'
        )) = 0
        then 'valid' else 'invalid' end`,
    ),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    unique("user_flow_version_unique").on(table.userFlowId, table.version),
    check("user_flow_version_number_check", sql`${table.version} >= 1`),
    // Last line of defence of the closed semantic set: a document whose generated
    // verdict is not `valid` is refused. The guard lives on a new column so the
    // migration stays expand-only.
    check(
      "user_flow_version_closed_set_check",
      sql`${table.closedSet} = 'valid'`,
    ),
  ],
);

/** The record types `Convert and Bind` can open; never a Screen. */
export const USER_FLOW_BIND_RECORD_TYPES = [
  "Work",
  "Decision",
  "Risk",
  "Open Question",
] as const;

/**
 * Structure and placeholders only. Template-local ids replace every source id;
 * no Screen id, Project id, record, relation, publish state or history exists
 * in this shape, so a template is a stamp and holds no live bind.
 */
export interface UserFlowTemplateStructure {
  links: Array<{ from: string; id: string; text: string; to: string }>;
  nodes: Array<{
    id: string;
    kind: "Action" | "Decision" | "Screen" | "Section" | "State/Outcome";
    position: { x: number; y: number };
    style: "amber" | "blue" | "default" | "green" | "red" | "violet";
    text: string;
  }>;
}

/**
 * `Convert and Bind` bind of one flow node to the one record it opened. The
 * Origin Location (`userFlowId`, `nodeId`, `originVersion`) is immutable;
 * `boundVersion` is the exact node version the bind stays on and moves only
 * through a previewed rebind.
 */
export const userFlowRecordBind = pgTable(
  "user_flow_record_bind",
  {
    id: text("id").primaryKey(),
    userFlowId: text("user_flow_id")
      .notNull()
      .references(() => userFlow.id, { onDelete: "cascade" }),
    nodeId: text("node_id").notNull(),
    recordType: text("record_type").notNull(),
    recordId: text("record_id").notNull(),
    originVersion: integer("origin_version").notNull(),
    boundVersion: integer("bound_version").notNull(),
    revision: integer("revision").notNull().default(1),
    actorId: text("actor_id").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("user_flow_record_bind_record_uidx").on(
      table.recordType,
      table.recordId,
    ),
    index("user_flow_record_bind_flow_node_idx").on(
      table.userFlowId,
      table.nodeId,
    ),
    check(
      "user_flow_record_bind_type_check",
      sql`${table.recordType} in ('Work', 'Decision', 'Risk', 'Open Question')`,
    ),
    check(
      "user_flow_record_bind_version_check",
      sql`${table.originVersion} >= 1 and ${table.boundVersion} >= ${table.originVersion}`,
    ),
    check("user_flow_record_bind_revision_check", sql`${table.revision} >= 1`),
  ],
);

/** Every previewed rebind keeps the version it left. */
export const userFlowRecordBindRebind = pgTable(
  "user_flow_record_bind_rebind",
  {
    id: text("id").primaryKey(),
    bindId: text("bind_id")
      .notNull()
      .references(() => userFlowRecordBind.id, { onDelete: "cascade" }),
    fromVersion: integer("from_version").notNull(),
    toVersion: integer("to_version").notNull(),
    actorId: text("actor_id").notNull(),
    reboundAt: timestamp("rebound_at").notNull().defaultNow(),
  },
  (table) => [
    index("user_flow_record_bind_rebind_bind_idx").on(table.bindId),
    check(
      "user_flow_record_bind_rebind_version_check",
      sql`${table.toVersion} > ${table.fromVersion}`,
    ),
  ],
);

/** Custom User Flow template, usable across the Projects of one Workspace. */
export const userFlowTemplate = pgTable(
  "user_flow_template",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspace.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    structure: jsonb("structure").$type<UserFlowTemplateStructure>().notNull(),
    actorId: text("actor_id").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    index("user_flow_template_workspace_idx").on(table.workspaceId),
    check(
      "user_flow_template_name_check",
      sql`length(btrim(${table.name})) between 1 and 255`,
    ),
  ],
);
