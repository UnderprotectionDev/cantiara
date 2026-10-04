import { sql } from "drizzle-orm";
import {
  check,
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  unique,
} from "drizzle-orm/pg-core";

import { project } from "./project";

export const smartCollection = pgTable(
  "smart_collection",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => project.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    sourceType: text("source_type").notNull().default("Work"),
    scope: jsonb("scope")
      .$type<{ projectIds: string[] }>()
      .notNull()
      .default({ projectIds: [] }),
    conditions: jsonb("conditions")
      .$type<{
        status?: string;
        type?: string;
        documentType?: string;
        tag?: string;
      }>()
      .notNull()
      .default({}),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    index("smart_collection_project_idx").on(table.projectId),
    check(
      "smart_collection_name_check",
      sql`length(btrim(${table.name})) between 1 and 255`,
    ),
    check(
      "smart_collection_source_type_check",
      sql`${table.sourceType} in ('Work', 'Document', 'Wiki Document', 'Decision', 'Risk', 'Assumption', 'Open Question', 'Milestone', 'Project Release', 'Production Incident')`,
    ),
  ],
);

export const smartCollectionView = pgTable(
  "smart_collection_view",
  {
    id: text("id").primaryKey(),
    collectionId: text("collection_id")
      .notNull()
      .references(() => smartCollection.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    presentation: text("presentation").notNull().default("List"),
    purpose: text("purpose"),
  },
  (table) => [
    unique("smart_collection_view_name_unique").on(
      table.collectionId,
      table.name,
    ),
    check(
      "smart_collection_view_name_check",
      sql`length(btrim(${table.name})) between 1 and 255`,
    ),
    check(
      "smart_collection_view_presentation_check",
      sql`${table.presentation} in ('List', 'Table')`,
    ),
  ],
);
