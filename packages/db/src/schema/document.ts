import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

import { project } from "./project";

export const document = pgTable(
  "document",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => project.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    body: text("body").notNull(),
    type: text("type").notNull().default("General"),
    revision: integer("revision").notNull().default(0),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    index("document_project_updated_idx").on(table.projectId, table.updatedAt),
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
