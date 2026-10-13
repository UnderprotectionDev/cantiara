import { pgTable, primaryKey, text, timestamp } from "drizzle-orm/pg-core";
import { user } from "./auth";
import { project } from "./project";
import { work } from "./work";

export const projectLastVisit = pgTable(
  "project_last_visit",
  {
    accountId: text("account_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    projectId: text("project_id")
      .notNull()
      .references(() => project.id, { onDelete: "cascade" }),
    viewedAt: timestamp("viewed_at").notNull(),
  },
  (table) => [primaryKey({ columns: [table.accountId, table.projectId] })],
);
export const workLastVisit = pgTable(
  "work_last_visit",
  {
    accountId: text("account_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    workId: text("work_id")
      .notNull()
      .references(() => work.id, { onDelete: "cascade" }),
    viewedAt: timestamp("viewed_at").notNull(),
  },
  (table) => [primaryKey({ columns: [table.accountId, table.workId] })],
);
