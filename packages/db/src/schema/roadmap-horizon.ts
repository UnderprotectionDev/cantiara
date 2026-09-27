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

export const roadmapView = pgTable(
  "roadmap_view",
  {
    groupBy: text("group_by").notNull(),
    horizons: jsonb("horizons").$type<string[]>().default([]).notNull(),
    id: text("id").primaryKey(),
    markBy: text("mark_by").notNull(),
    name: text("name").notNull(),
    projectId: text("project_id")
      .notNull()
      .references(() => project.id, { onDelete: "cascade" }),
    revision: integer("revision").default(0).notNull(),
    types: jsonb("types").$type<string[]>().default([]).notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("roadmap_view_project_idx").on(table.projectId),
    uniqueIndex("roadmap_view_project_name_uidx").on(
      table.projectId,
      table.name,
    ),
    check("roadmap_view_name_check", sql`length(btrim(${table.name})) > 0`),
    check("roadmap_view_revision_check", sql`${table.revision} >= 0`),
    check(
      "roadmap_view_group_check",
      sql`${table.groupBy} in ('Horizon', 'Type', 'Status')`,
    ),
    check(
      "roadmap_view_mark_check",
      sql`${table.markBy} in ('Horizon', 'Type', 'Status')`,
    ),
  ],
);
