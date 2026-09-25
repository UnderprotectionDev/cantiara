import { sql } from "drizzle-orm";
import {
  check,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

import { project } from "./project";

export const projectBacklogOrder = pgTable(
  "project_backlog_order",
  {
    projectId: text("project_id")
      .primaryKey()
      .references(() => project.id, { onDelete: "cascade" }),
    revision: integer("revision").default(0).notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
    workIds: jsonb("work_ids").$type<string[]>().default([]).notNull(),
  },
  (table) => [
    check(
      "project_backlog_order_work_ids_check",
      sql`jsonb_typeof(${table.workIds}) = 'array'`,
    ),
    check("project_backlog_order_revision_check", sql`${table.revision} >= 0`),
  ],
);

export const projectBacklogPresentation = pgTable(
  "project_backlog_presentation",
  {
    projectId: text("project_id")
      .primaryKey()
      .references(() => project.id, { onDelete: "cascade" }),
    revision: integer("revision").default(0).notNull(),
    saved: jsonb("saved").$type<unknown>().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [
    check(
      "project_backlog_presentation_revision_check",
      sql`${table.revision} >= 0`,
    ),
    check(
      "project_backlog_presentation_saved_check",
      sql`jsonb_typeof(${table.saved}) = 'object'`,
    ),
  ],
);
