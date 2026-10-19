import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

import { project } from "./project";

/**
 * Screen master record (Ekran). Project-scoped, created from a title alone.
 * Visibility follows the common master-record contract: `archived_at` is
 * Archive, `trashed_at` is Trash; neither deletes the row, so the Screen id
 * and its Wireframe versions survive both.
 */
export const screen = pgTable(
  "project_screen",
  {
    archivedAt: timestamp("archived_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => project.id, { onDelete: "cascade" }),
    revision: integer("revision").default(1).notNull(),
    title: text("title").notNull(),
    trashedAt: timestamp("trashed_at"),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("project_screen_project_idx").on(table.projectId),
    check(
      "project_screen_title_check",
      sql`length(btrim(${table.title})) between 1 and 255`,
    ),
    check("project_screen_revision_check", sql`${table.revision} >= 1`),
  ],
);

/**
 * Exact Wireframe versions of one Screen. This is deliberately not a master
 * record: it has no Project scope, no archive or trash column and no identity
 * outside its Screen. `document` is the canonical versioned WireframeDocument
 * (validated by `@cantiara/api/wireframe-document`); renderer JSON is never stored.
 */
export const screenWireframeVersion = pgTable(
  "project_screen_wireframe_version",
  {
    createdAt: timestamp("created_at").defaultNow().notNull(),
    document: jsonb("document")
      .$type<Record<string, unknown>>()
      .default(
        sql`'{"format":"cantiara.wireframe-document","version":1,"canvas":{"width":1280,"height":800},"blocks":[],"linkedDefinitions":{},"animations":[]}'::jsonb`,
      )
      .notNull(),
    id: text("id").primaryKey(),
    screenId: text("screen_id")
      .notNull()
      .references(() => screen.id, { onDelete: "cascade" }),
    version: integer("version").notNull(),
  },
  (table) => [
    uniqueIndex("project_screen_wireframe_version_uidx").on(
      table.screenId,
      table.version,
    ),
    check("project_screen_wireframe_version_check", sql`${table.version} >= 1`),
  ],
);

/**
 * Project-scoped source definition of a linked Wireframe block. Instances in
 * Wireframe documents share it; it is not a production component, a token or a
 * cross-project library, so it is owned by exactly one Project.
 */
export const screenLinkedBlock = pgTable(
  "project_screen_linked_block",
  {
    content: jsonb("content").$type<Record<string, unknown>>().notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    projectId: text("project_id")
      .notNull()
      .references(() => project.id, { onDelete: "cascade" }),
    revision: integer("revision").default(1).notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("project_screen_linked_block_project_idx").on(table.projectId),
    check(
      "project_screen_linked_block_name_check",
      sql`length(btrim(${table.name})) between 1 and 120`,
    ),
    check(
      "project_screen_linked_block_revision_check",
      sql`${table.revision} >= 1`,
    ),
  ],
);
