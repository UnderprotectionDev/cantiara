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
 * Stored Custom field value payload. The shape mirrors the Zod
 * `customFieldValuePayloadSchema` in @cantiara/api/custom-fields; the value is
 * validated on every write and read boundary. Unset ("Not evaluated") values
 * have no row at all, which keeps empty distinct from a Boolean false or an
 * empty selection.
 */
export type CustomFieldValuePayload =
  | { boolean: boolean; kind: "boolean" }
  | { date: string; kind: "date" }
  | { kind: "number"; number: number }
  | { kind: "option"; option: string }
  | { kind: "options"; options: string[] }
  | { kind: "text"; text: string };

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
    trashedAt: timestamp("trashed_at"),
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

export const customFieldValue = pgTable(
  "custom_field_value",
  {
    createdAt: timestamp("created_at").defaultNow().notNull(),
    definitionId: text("definition_id")
      .notNull()
      .references(() => customFieldDefinition.id, { onDelete: "cascade" }),
    id: text("id").primaryKey(),
    recordId: text("record_id").notNull(),
    recordType: text("record_type").notNull(),
    revision: integer("revision").default(0).notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
    value: jsonb("value").$type<CustomFieldValuePayload>().notNull(),
  },
  (table) => [
    index("custom_field_value_record_idx").on(table.recordType, table.recordId),
    uniqueIndex("custom_field_value_definition_record_uidx").on(
      table.definitionId,
      table.recordId,
    ),
    check("custom_field_value_revision_check", sql`${table.revision} >= 0`),
  ],
);
