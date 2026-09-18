import { relations, sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

import { project } from "./project";

export const work = pgTable(
  "work",
  {
    closureResult: text("closure_result"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    id: text("id").primaryKey(),
    key: text("key").notNull(),
    number: integer("number").notNull(),
    projectId: text("project_id")
      .notNull()
      .references(() => project.id, { onDelete: "cascade" }),
    revision: integer("revision").default(0).notNull(),
    status: text("status").default("Not Started").notNull(),
    title: text("title").notNull(),
    type: text("type").notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [
    index("work_project_idx").on(table.projectId),
    uniqueIndex("work_project_number_uidx").on(table.projectId, table.number),
    uniqueIndex("work_project_key_uidx").on(table.projectId, table.key),
    check("work_number_check", sql`${table.number} >= 1`),
    check("work_revision_check", sql`${table.revision} >= 0`),
    check("work_title_check", sql`length(btrim(${table.title})) > 0`),
    check(
      "work_type_check",
      sql`${table.type} in ('Feature', 'Bug', 'Task', 'Research', 'Improvement')`,
    ),
    check(
      "work_status_check",
      sql`${table.status} in ('Not Started', 'In Progress', 'Blocked', 'Closed')`,
    ),
    check(
      "work_closure_result_check",
      sql`${table.closureResult} is null or ${table.closureResult} in ('Completed', 'Abandoned')`,
    ),
  ],
);

/**
 * A committed allocation is deliberately separate from `work`. It is created
 * before the Mutation Contract commit so a failed create still consumes its
 * number and a retry cannot reuse it.
 */
export const workKeyAllocation = pgTable(
  "work_key_allocation",
  {
    clientIdempotencyKey: text("client_idempotency_key").notNull(),
    id: text("id").primaryKey(),
    key: text("key").notNull(),
    number: integer("number").notNull(),
    payloadFingerprint: text("payload_fingerprint"),
    projectId: text("project_id")
      .notNull()
      .references(() => project.id, { onDelete: "cascade" }),
    reservedAt: timestamp("reserved_at").defaultNow().notNull(),
    shortCode: text("short_code").notNull(),
    workId: text("work_id").notNull(),
  },
  (table) => [
    index("work_key_allocation_work_idx").on(table.workId),
    uniqueIndex("work_key_allocation_project_client_uidx").on(
      table.projectId,
      table.clientIdempotencyKey,
    ),
    uniqueIndex("work_key_allocation_project_number_uidx").on(
      table.projectId,
      table.number,
    ),
    check("work_key_allocation_number_check", sql`${table.number} >= 1`),
    check(
      "work_key_allocation_payload_fingerprint_check",
      sql`${table.payloadFingerprint} is null or ${table.payloadFingerprint} ~ '^[0-9a-fA-F]{64}$'`,
    ),
  ],
);

export const workRelations = relations(work, ({ one }) => ({
  project: one(project, {
    fields: [work.projectId],
    references: [project.id],
  }),
}));

export const workKeyAllocationRelations = relations(
  workKeyAllocation,
  ({ one }) => ({
    project: one(project, {
      fields: [workKeyAllocation.projectId],
      references: [project.id],
    }),
  }),
);
