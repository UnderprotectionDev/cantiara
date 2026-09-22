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

export interface WorkTemplateChecklistItem {
  id: string;
  text: string;
}
export interface WorkTemplateCustomFieldDefault {
  definitionId: string;
  value:
    | { boolean: boolean; kind: "boolean" }
    | { kind: "number"; number: number }
    | { kind: "option"; option: string }
    | { kind: "options"; options: string[] }
    | { kind: "text"; text: string };
}
export interface WorkTemplateRelativeDates {
  plannedStart?: { offsetDays: number };
  target?: { offsetDays: number };
}

export const workTemplate = pgTable(
  "work_template",
  {
    checklist: jsonb("checklist")
      .$type<WorkTemplateChecklistItem[]>()
      .default(sql`'[]'::jsonb`)
      .notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    customFieldDefaults: jsonb("custom_field_defaults")
      .$type<WorkTemplateCustomFieldDefault[]>()
      .default(sql`'[]'::jsonb`)
      .notNull(),
    descriptionSkeleton: text("description_skeleton"),
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    nameKey: text("name_key").notNull(),
    projectId: text("project_id")
      .notNull()
      .references(() => project.id, { onDelete: "cascade" }),
    relativeDates: jsonb("relative_dates")
      .$type<WorkTemplateRelativeDates>()
      .default(sql`'{}'::jsonb`)
      .notNull(),
    revision: integer("revision").default(1).notNull(),
    trashedAt: timestamp("trashed_at"),
    type: text("type").notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [
    index("work_template_project_idx").on(table.projectId),
    uniqueIndex("work_template_project_name_uidx").on(
      table.projectId,
      table.nameKey,
    ),
    check("work_template_name_check", sql`length(btrim(${table.name})) > 0`),
    check("work_template_revision_check", sql`${table.revision} >= 1`),
    check(
      "work_template_type_check",
      sql`${table.type} in ('Feature', 'Bug', 'Task', 'Research', 'Improvement')`,
    ),
  ],
);
