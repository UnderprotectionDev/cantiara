import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { fileAttachment } from "./file-attachments";
import { project } from "./project";
import { work } from "./work";

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
    url: text("url"),
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
    check(
      "project_feedback_url_check",
      sql`${table.url} is null or length(btrim(${table.url})) between 1 and 2048`,
    ),
    check("project_feedback_revision_check", sql`${table.revision} >= 0`),
  ],
);

/**
 * Attachments are references to existing Project-scoped File Attachments; the
 * Feedback record owns no file bytes, versions or lifecycle of its own.
 */
export const feedbackAttachment = pgTable(
  "project_feedback_attachment",
  {
    attachmentId: text("attachment_id")
      .notNull()
      .references(() => fileAttachment.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    feedbackId: text("feedback_id")
      .notNull()
      .references(() => feedback.id, { onDelete: "cascade" }),
  },
  (table) => [
    primaryKey({
      columns: [table.feedbackId, table.attachmentId],
      name: "project_feedback_attachment_pk",
    }),
    index("project_feedback_attachment_attachment_idx").on(table.attachmentId),
  ],
);

/**
 * Feedback `Origin` link to the Work created from it. Several Feedback records
 * may origin-link to one Work as separate rows; no count here is a vote or a
 * priority. The link owns no Feedback or Work lifecycle.
 */
export const feedbackWorkOrigin = pgTable(
  "project_feedback_work_origin",
  {
    actorId: text("actor_id").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    feedbackId: text("feedback_id")
      .notNull()
      .references(() => feedback.id, { onDelete: "cascade" }),
    id: text("id").primaryKey(),
    revision: integer("revision").default(1).notNull(),
    workId: text("work_id")
      .notNull()
      .references(() => work.id, { onDelete: "cascade" }),
  },
  (table) => [
    uniqueIndex("project_feedback_work_origin_pair_uidx").on(
      table.feedbackId,
      table.workId,
    ),
    index("project_feedback_work_origin_work_idx").on(table.workId),
    check(
      "project_feedback_work_origin_revision_check",
      sql`${table.revision} >= 1`,
    ),
  ],
);
