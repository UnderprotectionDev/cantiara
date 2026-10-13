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

export const feedback = pgTable(
  "project_feedback",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => project.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    originalMessage: text("original_message").notNull(),
    channel: text("channel"),
    occurredAt: timestamp("occurred_at").notNull(),
    status: text("status").default("New").notNull(),
    revision: integer("revision").default(0).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("project_feedback_project_idx").on(table.projectId),
    check(
      "project_feedback_status_check",
      sql`${table.status} in ('New', 'Reviewed', 'Archived')`,
    ),
    check(
      "project_feedback_title_check",
      sql`length(btrim(${table.title})) between 1 and 255`,
    ),
    check(
      "project_feedback_message_check",
      sql`length(btrim(${table.originalMessage})) between 1 and 20000`,
    ),
    check("project_feedback_revision_check", sql`${table.revision} >= 0`),
  ],
);
