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

/**
 * Durable User Flow document. React Flow is only the editor adapter; this is
 * the model of record. A Screen node carries a live Screen id and nothing else
 * of the Screen: no title, body or preview is copied onto the node.
 */
export interface UserFlowDocument {
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
