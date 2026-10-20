import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  doublePrecision,
  index,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

import { project } from "./project";

/**
 * Tasarım type `Proje Duvarı`: a flat, named, Project-scoped main record.
 * There is no parent wall and no Workspace column; a wall exists only inside
 * one Project. Later wall features (visual links, groups, Lock Position,
 * viewport, snapshots) add their own tables or columns next to it.
 */
export const projectWall = pgTable(
  "project_wall",
  {
    createdAt: timestamp("created_at").defaultNow().notNull(),
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => project.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [
    index("project_wall_project_idx").on(table.projectId),
    check(
      "project_wall_title_check",
      sql`length(btrim(${table.title})) between 1 and 255`,
    ),
  ],
);

/**
 * A named, single-level group: wall view state only. It has no parent group,
 * colour or kind, so it cannot become taxonomy or a relation.
 */
export const projectWallGroup = pgTable(
  "project_wall_group",
  {
    collapsed: boolean("collapsed").default(false).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    id: text("id").primaryKey(),
    title: text("title").notNull(),
    wallId: text("wall_id")
      .notNull()
      .references(() => projectWall.id, { onDelete: "cascade" }),
  },
  (table) => [
    index("project_wall_group_wall_idx").on(table.wallId),
    check(
      "project_wall_group_title_check",
      sql`length(btrim(${table.title})) between 1 and 255`,
    ),
  ],
);

/**
 * A live card: a reference to one existing master record by its source id plus
 * wall view state (position, density, highlight). It carries no title, body,
 * note, task or file of its own, so a card cannot become a copy of the record.
 * The source reference has no foreign key on purpose: the master tables differ
 * by `source_type`, the card must survive a permanently deleted source as a
 * broken target, and a restricting key on an existing table is not
 * parallel-safe on the shared development database.
 */
export const projectWallItem = pgTable(
  "project_wall_item",
  {
    density: text("density").default("Preview").notNull(),
    // Wall-only membership; deleting a group keeps its cards.
    groupId: text("group_id").references(() => projectWallGroup.id, {
      onDelete: "set null",
    }),
    highlight: text("highlight"),
    id: text("id").primaryKey(),
    // View-local `Lock Position`; never read by any source record.
    locked: boolean("locked").default(false).notNull(),
    placedAt: timestamp("placed_at").defaultNow().notNull(),
    positionX: doublePrecision("position_x").default(0).notNull(),
    positionY: doublePrecision("position_y").default(0).notNull(),
    sourceId: text("source_id").notNull(),
    sourceType: text("source_type").notNull(),
    wallId: text("wall_id")
      .notNull()
      .references(() => projectWall.id, { onDelete: "cascade" }),
  },
  (table) => [
    // The same record may sit on many walls, but only once on one wall.
    uniqueIndex("project_wall_item_wall_source_uidx").on(
      table.wallId,
      table.sourceType,
      table.sourceId,
    ),
    index("project_wall_item_source_idx").on(table.sourceType, table.sourceId),
    index("project_wall_item_group_idx").on(table.groupId),
    check(
      "project_wall_item_source_type_check",
      sql`${table.sourceType} in ('Work', 'Decision', 'Risk')`,
    ),
    check(
      "project_wall_item_density_check",
      sql`${table.density} in ('Compact', 'Preview', 'Detailed')`,
    ),
    check(
      "project_wall_item_highlight_check",
      sql`${table.highlight} is null or ${table.highlight} in ('blue', 'green', 'amber', 'red', 'violet')`,
    ),
  ],
);

/**
 * A `Visual link`: a directed, labeled line between two cards of one wall. It
 * is wall view state, not a relation: it references no relation row and a
 * relation is written only through the previewed `Create Persistent Relation`.
 */
export const projectWallLink = pgTable(
  "project_wall_link",
  {
    createdAt: timestamp("created_at").defaultNow().notNull(),
    fromItemId: text("from_item_id")
      .notNull()
      .references(() => projectWallItem.id, { onDelete: "cascade" }),
    id: text("id").primaryKey(),
    label: text("label").notNull(),
    toItemId: text("to_item_id")
      .notNull()
      .references(() => projectWallItem.id, { onDelete: "cascade" }),
    wallId: text("wall_id")
      .notNull()
      .references(() => projectWall.id, { onDelete: "cascade" }),
  },
  (table) => [
    index("project_wall_link_wall_idx").on(table.wallId),
    index("project_wall_link_from_idx").on(table.fromItemId),
    index("project_wall_link_to_idx").on(table.toItemId),
    check(
      "project_wall_link_label_check",
      sql`length(btrim(${table.label})) between 1 and 120`,
    ),
    check(
      "project_wall_link_distinct_check",
      sql`${table.fromItemId} <> ${table.toItemId}`,
    ),
  ],
);
