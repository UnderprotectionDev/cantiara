import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
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
 * outside its Screen. Document content is added by the Wireframe engine.
 */
export const screenWireframeVersion = pgTable(
  "project_screen_wireframe_version",
  {
    createdAt: timestamp("created_at").defaultNow().notNull(),
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
