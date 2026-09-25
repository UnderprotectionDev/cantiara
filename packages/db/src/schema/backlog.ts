import { sql } from "drizzle-orm";
import {
  check,
  date,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

import { user } from "./auth";
import { project } from "./project";
import { work } from "./work";

export const projectBacklogOrder = pgTable(
  "project_backlog_order",
  {
    projectId: text("project_id")
      .primaryKey()
      .references(() => project.id, { onDelete: "cascade" }),
    revision: integer("revision").default(0).notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
    workIds: jsonb("work_ids").$type<string[]>().default([]).notNull(),
  },
  (table) => [
    check(
      "project_backlog_order_work_ids_check",
      sql`jsonb_typeof(${table.workIds}) = 'array'`,
    ),
    check("project_backlog_order_revision_check", sql`${table.revision} >= 0`),
  ],
);

export const projectBacklogPresentation = pgTable(
  "project_backlog_presentation",
  {
    projectId: text("project_id")
      .primaryKey()
      .references(() => project.id, { onDelete: "cascade" }),
    revision: integer("revision").default(0).notNull(),
    saved: jsonb("saved").$type<unknown>().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [
    check(
      "project_backlog_presentation_revision_check",
      sql`${table.revision} >= 0`,
    ),
    check(
      "project_backlog_presentation_saved_check",
      sql`jsonb_typeof(${table.saved}) = 'object'`,
    ),
  ],
);

export const projectBacklogReappearAttentionSignal = pgTable(
  "project_backlog_reappear_attention_signal",
  {
    occurredAt: timestamp("occurred_at").notNull(),
    ownerAccountId: text("owner_account_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    presentation: text("presentation").default("Action Required").notNull(),
    projectId: text("project_id")
      .notNull()
      .references(() => project.id, { onDelete: "cascade" }),
    reappearDate: date("reappear_date", { mode: "string" }).notNull(),
    signalId: text("signal_id").primaryKey(),
    signalType: text("signal_type").default("reappear-date").notNull(),
    sourcePath: text("source_path").notNull(),
    sourceWorkId: text("source_work_id")
      .notNull()
      .references(() => work.id, { onDelete: "cascade" }),
  },
  (table) => [
    index("backlog_reappear_signal_work_idx").on(table.sourceWorkId),
    check(
      "backlog_reappear_signal_type_check",
      sql`${table.signalType} = 'reappear-date'`,
    ),
    check(
      "backlog_reappear_signal_presentation_check",
      sql`${table.presentation} = 'Action Required'`,
    ),
  ],
);
