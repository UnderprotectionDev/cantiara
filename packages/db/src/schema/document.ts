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

export const document = pgTable(
  "document",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id").references(() => project.id, {
      onDelete: "cascade",
    }),
    workspaceId: text("workspace_id").references(() => workspace.id, {
      onDelete: "cascade",
    }),
    title: text("title").notNull(),
    body: text("body").notNull(),
    type: text("type").notNull().default("General"),
    revision: integer("revision").notNull().default(0),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    index("document_project_updated_idx").on(table.projectId, table.updatedAt),
    index("document_wiki_updated_idx").on(table.workspaceId, table.updatedAt),
    check(
      "document_ownership_check",
      sql`(${table.projectId} IS NOT NULL AND ${table.workspaceId} IS NULL) OR (${table.projectId} IS NULL AND ${table.workspaceId} IS NOT NULL)`,
    ),
    check(
      "document_title_check",
      sql`length(btrim(${table.title})) between 1 and 255`,
    ),
    check(
      "document_type_check",
      sql`${table.type} in ('General', 'PRD', 'Plan', 'Spec', 'Research Note', 'Persona')`,
    ),
    check("document_revision_check", sql`${table.revision} >= 0`),
  ],
);
