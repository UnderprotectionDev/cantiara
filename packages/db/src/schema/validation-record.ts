import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { project } from "./project";

export const validationRecord = pgTable(
  "project_validation_record",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => project.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    method: text("method").notNull(),
    result: text("result"),
    context: jsonb("context")
      .$type<
        {
          sourceType: "Assumption" | "Open Question" | "Decision";
          sourceId: string;
        }[]
      >()
      .notNull()
      .default([]),
    status: text("status").notNull().default("Active"),
    revision: integer("revision").notNull().default(0),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at")
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("project_validation_record_project_status_idx").on(
      table.projectId,
      table.status,
    ),
    check(
      "project_validation_record_title_check",
      sql`length(btrim(${table.title})) between 1 and 255`,
    ),
    check(
      "project_validation_record_method_check",
      sql`length(btrim(${table.method})) between 1 and 100000`,
    ),
    check(
      "project_validation_record_result_check",
      sql`${table.result} is null or length(${table.result}) <= 100000`,
    ),
    check(
      "project_validation_record_status_check",
      sql`${table.status} in ('Active', 'Archived', 'Trash')`,
    ),
    check(
      "project_validation_record_revision_check",
      sql`${table.revision} >= 0`,
    ),
  ],
);
