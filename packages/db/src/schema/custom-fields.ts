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

export const customFieldDefinition = pgTable(
  "custom_field_definition",
  {
    createdAt: timestamp("created_at").defaultNow().notNull(),
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    nameKey: text("name_key").notNull(),
    options: jsonb("options")
      .$type<string[]>()
      .default(sql`'[]'::jsonb`)
      .notNull(),
    projectId: text("project_id")
      .notNull()
      .references(() => project.id, { onDelete: "cascade" }),
    recordTypes: jsonb("record_types")
      .$type<string[]>()
      .default(sql`'[]'::jsonb`)
      .notNull(),
    revision: integer("revision").default(0).notNull(),
    type: text("type").notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [
    index("custom_field_definition_project_idx").on(table.projectId),
    uniqueIndex("custom_field_definition_project_name_uidx").on(
      table.projectId,
      table.nameKey,
    ),
    check(
      "custom_field_definition_name_check",
      sql`length(btrim(${table.name})) > 0`,
    ),
    check(
      "custom_field_definition_type_check",
      sql`${table.type} in ('Text', 'Number', 'Boolean', 'Date', 'Single select', 'Multi select')`,
    ),
    check(
      "custom_field_definition_revision_check",
      sql`${table.revision} >= 0`,
    ),
  ],
);
