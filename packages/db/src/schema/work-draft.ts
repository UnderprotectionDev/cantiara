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

export const workDraft = pgTable(
  "work_draft",
  {
    accountId: text("account_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    checklist: jsonb("checklist").$type<unknown>().notNull().default([]),
    consumedAt: timestamp("consumed_at"),
    customFieldValues: jsonb("custom_field_values")
      .$type<unknown>()
      .notNull()
      .default([]),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    description: text("description"),
    finalizedWorkId: text("finalized_work_id"),
    finalizingClientIdempotencyKey: text("finalizing_client_idempotency_key"),
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => project.id, { onDelete: "cascade" }),
    reappearDate: date("reappear_date", { mode: "string" }),
    revision: integer("revision").default(0).notNull(),
    title: text("title").default("").notNull(),
    type: text("type").default("Task").notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [
    index("work_draft_account_project_updated_idx").on(
      table.accountId,
      table.projectId,
      table.updatedAt,
    ),
    check(
      "work_draft_type_check",
      sql`${table.type} in ('Feature', 'Bug', 'Task', 'Research', 'Improvement')`,
    ),
    check("work_draft_revision_check", sql`${table.revision} >= 0`),
    check(
      "work_draft_finalization_check",
      sql`${table.consumedAt} is null or ${table.finalizedWorkId} is not null`,
    ),
  ],
);
