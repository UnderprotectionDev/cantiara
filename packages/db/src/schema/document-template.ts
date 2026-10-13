import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

import { workspace } from "./auth";
import { project } from "./project";

export const documentTemplate = pgTable(
  "document_template",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id").references(() => project.id, {
      onDelete: "cascade",
    }),
    workspaceId: text("workspace_id").references(() => workspace.id, {
      onDelete: "cascade",
    }),
    name: text("name").notNull(),
    body: text("body").notNull(),
    type: text("type").notNull().default("General"),
    revision: integer("revision").notNull().default(1),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    index("document_template_project_idx").on(table.projectId),
    index("document_template_wiki_idx").on(table.workspaceId),
    check(
      "document_template_scope_check",
      sql`(${table.projectId} IS NULL) <> (${table.workspaceId} IS NULL)`,
    ),
    check(
      "document_template_name_check",
      sql`length(btrim(${table.name})) between 1 and 255`,
    ),
    check(
      "document_template_body_check",
      sql`length(${table.body}) <= 1000000`,
    ),
    check(
      "document_template_type_check",
      sql`${table.type} in ('General', 'PRD', 'Plan', 'Spec', 'Research Note', 'Persona')`,
    ),
    check("document_template_revision_check", sql`${table.revision} >= 1`),
  ],
);
