import { sql } from "drizzle-orm";
import {
  check,
  date,
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { workspace } from "./auth";
import { work } from "./work";

export interface FocusPeriodSnapshotWork {
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
    closeSnapshot: jsonb("close_snapshot").$type<FocusPeriodSnapshotWork[]>(),
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
