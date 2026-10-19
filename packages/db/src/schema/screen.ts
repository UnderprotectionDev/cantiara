import { sql } from "drizzle-orm";
import {
  check,
  foreignKey,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

import { workspace } from "./auth";
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

/**
 * `Kökeni` from a Screen to the one main record `Convert and Bind` created,
 * plus the immutable Origin Location (Screen, block id, exact Wireframe
 * version). It is not a usage bond. The block id and version are plain data:
 * deleting the block never deletes this row or the record, and the location is
 * never retargeted; an explicit rebind inserts a new row and marks this one
 * `superseded_at`, so the old origin stays readable. The composite foreign key
 * keeps the named version existing; a version an origin names is sealed
 * (a later geometry save opens a new version instead of mutating it).
 */
export const screenBlockOrigin = pgTable(
  "project_screen_block_origin",
  {
    actorId: text("actor_id").notNull(),
    blockId: text("block_id").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => project.id, { onDelete: "cascade" }),
    screenId: text("screen_id")
      .notNull()
      .references(() => screen.id, { onDelete: "cascade" }),
    supersededAt: timestamp("superseded_at"),
    supersedesId: text("supersedes_id"),
    // Polymorphic id of the created Work, Decision, Risk or Open Question.
    targetRecordId: text("target_record_id").notNull(),
    targetType: text("target_type").notNull(),
    wireframeVersion: integer("wireframe_version").notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.screenId, table.wireframeVersion],
      foreignColumns: [
        screenWireframeVersion.screenId,
        screenWireframeVersion.version,
      ],
      name: "project_screen_block_origin_version_fk",
    }).onDelete("cascade"),
    index("project_screen_block_origin_screen_idx").on(
      table.screenId,
      table.wireframeVersion,
    ),
    uniqueIndex("project_screen_block_origin_current_target_uidx")
      .on(table.targetType, table.targetRecordId)
      .where(sql`${table.supersededAt} is null`),
    check(
      "project_screen_block_origin_target_type_check",
      sql`${table.targetType} in ('Work', 'Decision', 'Risk', 'Open Question')`,
    ),
    check(
      "project_screen_block_origin_version_check",
      sql`${table.wireframeVersion} >= 1`,
    ),
  ],
);

/**
 * Workspace-scoped Wireframe template stamp. It stores a sanitized document
 * (structure, placeholders, linked-block snapshots) and a name only: no
 * source Project, Screen or version reference, so nothing can bind back.
 */
export const screenWireframeTemplate = pgTable(
  "workspace_screen_wireframe_template",
  {
    createdAt: timestamp("created_at").defaultNow().notNull(),
    document: jsonb("document").$type<Record<string, unknown>>().notNull(),
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspace.id, { onDelete: "cascade" }),
  },
  (table) => [
    index("workspace_screen_wireframe_template_workspace_idx").on(
      table.workspaceId,
    ),
    check(
      "workspace_screen_wireframe_template_name_check",
      sql`length(btrim(${table.name})) between 1 and 120`,
    ),
  ],
);
