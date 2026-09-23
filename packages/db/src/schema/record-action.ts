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

export const recordAction = pgTable(
  "record_action",
  {
    createdAt: timestamp("created_at").defaultNow().notNull(),
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    nameKey: text("name_key").notNull(),
    projectId: text("project_id")
      .notNull()
      .references(() => project.id, { onDelete: "cascade" }),
    revision: integer("revision").default(1).notNull(),
    steps: jsonb("steps")
      .$type<unknown[]>()
      .default(sql`'[]'::jsonb`)
      .notNull(),
    trashedAt: timestamp("trashed_at"),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [
    index("record_action_project_idx").on(table.projectId),
    uniqueIndex("record_action_project_name_uidx").on(
      table.projectId,
      table.nameKey,
    ),
    check("record_action_name_check", sql`length(btrim(${table.name})) > 0`),
    check("record_action_revision_check", sql`${table.revision} >= 1`),
  ],
);
