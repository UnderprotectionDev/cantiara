import { sql } from "drizzle-orm";
import {
  check,
  date,
  index,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

import { workspace } from "./auth";
import { work } from "./work";

/** A Work selected for one profile-calendar day in the personal Daily Focus. */
export const dailyFocusMembership = pgTable(
  "daily_focus_membership",
  {
    createdAt: timestamp("created_at").defaultNow().notNull(),
    focusDate: date("focus_date", { mode: "string" }).notNull(),
    id: text("id").primaryKey(),
    workId: text("work_id")
      .notNull()
      .references(() => work.id, { onDelete: "cascade" }),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspace.id, { onDelete: "cascade" }),
  },
  (table) => [
    index("daily_focus_membership_day_idx").on(
      table.workspaceId,
      table.focusDate,
    ),
    uniqueIndex("daily_focus_membership_work_day_uidx").on(
      table.workspaceId,
      table.workId,
      table.focusDate,
    ),
    check(
      "daily_focus_membership_date_check",
      sql`${table.focusDate}::text ~ '^\\d{4}-\\d{2}-\\d{2}$'`,
    ),
  ],
);
