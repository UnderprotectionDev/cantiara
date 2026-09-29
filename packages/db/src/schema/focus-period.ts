import { sql } from "drizzle-orm";
import {
  check,
  date,
  index,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { workspace } from "./auth";
import { work } from "./work";

export interface FocusPeriodSnapshotWork {
  closureResult: string | null;
  id: string;
  key: string;
  projectId: string;
  projectName: string;
  status: string;
  title: string;
}

export const focusPeriod = pgTable(
  "focus_period",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspace.id, { onDelete: "cascade" }),
    purpose: text("purpose").notNull(),
    startDate: date("start_date", { mode: "string" }).notNull(),
    endDate: date("end_date", { mode: "string" }).notNull(),
    status: text("status").default("Planned").notNull(),
    startedAt: timestamp("started_at"),
    closedAt: timestamp("closed_at"),
    startSnapshot: jsonb("start_snapshot").$type<FocusPeriodSnapshotWork[]>(),
    closeSnapshot:
      jsonb("close_snapshot").$type<
        (FocusPeriodSnapshotWork & { inCloseScope?: false })[]
      >(),
    evaluationKeep: text("evaluation_keep"),
    evaluationChange: text("evaluation_change"),
    evaluationTryNext: text("evaluation_try_next"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("focus_period_workspace_idx").on(table.workspaceId),
    check(
      "focus_period_status_check",
      sql`${table.status} in ('Planned', 'Active', 'Closed', 'Canceled')`,
    ),
    check(
      "focus_period_purpose_check",
      sql`length(btrim(${table.purpose})) between 1 and 1000`,
    ),
    check(
      "focus_period_window_check",
      sql`${table.endDate} - ${table.startDate} between 6 and 55`,
    ),
    check(
      "focus_period_evaluation_keep_check",
      sql`${table.evaluationKeep} is null or length(btrim(${table.evaluationKeep})) between 1 and 2000`,
    ),
    check(
      "focus_period_evaluation_change_check",
      sql`${table.evaluationChange} is null or length(btrim(${table.evaluationChange})) between 1 and 2000`,
    ),
    check(
      "focus_period_evaluation_try_next_check",
      sql`${table.evaluationTryNext} is null or length(btrim(${table.evaluationTryNext})) between 1 and 2000`,
    ),
  ],
);

export const focusPeriodMembership = pgTable(
  "focus_period_membership",
  {
    id: text("id").primaryKey(),
    periodId: text("period_id")
      .notNull()
      .references(() => focusPeriod.id, { onDelete: "cascade" }),
    workId: text("work_id")
      .notNull()
      .references(() => work.id, { onDelete: "cascade" }),
    joinedAt: timestamp("joined_at").defaultNow().notNull(),
    removedAt: timestamp("removed_at"),
  },
  (table) => [
    index("focus_period_membership_period_idx").on(table.periodId),
    uniqueIndex("focus_period_membership_current_uidx")
      .on(table.periodId, table.workId)
      .where(sql`${table.removedAt} is null`),
  ],
);

export const focusPeriodActiveWork = pgTable(
  "focus_period_active_work",
  {
    workId: text("work_id")
      .primaryKey()
      .references(() => work.id, { onDelete: "cascade" }),
    periodId: text("period_id")
      .notNull()
      .references(() => focusPeriod.id, { onDelete: "cascade" }),
  },
  (table) => [index("focus_period_active_work_period_idx").on(table.periodId)],
);

export const focusPeriodLeftoverDecision = pgTable(
  "focus_period_leftover_decision",
  {
    periodId: text("period_id")
      .notNull()
      .references(() => focusPeriod.id, { onDelete: "cascade" }),
    workId: text("work_id")
      .notNull()
      .references(() => work.id, { onDelete: "cascade" }),
    destination: text("destination").notNull(),
    targetPeriodId: text("target_period_id").references(() => focusPeriod.id, {
      onDelete: "set null",
    }),
  },
  (table) => [
    uniqueIndex("focus_period_leftover_decision_uidx").on(
      table.periodId,
      table.workId,
    ),
    check(
      "focus_period_leftover_destination_check",
      sql`${table.destination} in ('Next period', 'Another period', 'Backlog', 'Abandon')`,
    ),
  ],
);

export const focusPeriodFollowUpWork = pgTable(
  "focus_period_follow_up_work",
  {
    periodId: text("period_id")
      .notNull()
      .references(() => focusPeriod.id, { onDelete: "cascade" }),
    workId: text("work_id")
      .notNull()
      .references(() => work.id, { onDelete: "cascade" }),
    learning: text("learning").notNull(),
    learningText: text("learning_text").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    primaryKey({
      columns: [table.workId],
      name: "focus_period_follow_up_work_pk",
    }),
    index("focus_period_follow_up_work_period_idx").on(table.periodId),
    check(
      "focus_period_follow_up_learning_check",
      sql`${table.learning} in ('Keep', 'Change', 'Try next')`,
    ),
    check(
      "focus_period_follow_up_learning_text_check",
      sql`length(btrim(${table.learningText})) between 1 and 2000`,
    ),
  ],
);
