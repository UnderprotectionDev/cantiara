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
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    unique("user_flow_version_unique").on(table.userFlowId, table.version),
    check("user_flow_version_number_check", sql`${table.version} >= 1`),
  ],
);
