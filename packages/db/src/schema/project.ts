import { relations, sql } from "drizzle-orm";
import {
  check,
  date,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

import { workspace } from "./auth";

export const project = pgTable(
  "project",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspace.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    shortCode: text("short_code").notNull(),
    starterConfiguration: text("starter_configuration").notNull(),
    status: text("status").default("Active").notNull(),
    purpose: text("purpose"),
    problem: text("problem"),
    scope: text("scope"),
    targetDate: date("target_date", { mode: "string" }),
    logo: text("logo"),
    revision: integer("revision").default(0).notNull(),
    workCount: integer("work_count").default(0).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [
    index("project_workspace_idx").on(table.workspaceId),
    uniqueIndex("project_workspace_short_code_uidx").on(
      table.workspaceId,
      table.shortCode,
    ),
    check(
      "project_short_code_format_check",
      sql`${table.shortCode} ~ '^[A-Z][A-Z0-9]*(-[A-Z0-9]+)*$'`,
    ),
    check(
      "project_starter_configuration_check",
      sql`${table.starterConfiguration} in ('Blank Project', 'Solo SaaS', 'Open Source Library', 'Mobile Application')`,
    ),
    check(
      "project_status_check",
      sql`${table.status} in ('Active', 'Pending', 'Completed', 'Abandoned')`,
    ),
    check("project_work_count_check", sql`${table.workCount} >= 0`),
    check("project_revision_check", sql`${table.revision} >= 0`),
  ],
);

export const projectShortCode = pgTable(
  "project_short_code",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspace.id, { onDelete: "cascade" }),
    projectId: text("project_id").references(() => project.id, {
      onDelete: "set null",
    }),
    shortCode: text("short_code").notNull(),
    reservedAt: timestamp("reserved_at").defaultNow().notNull(),
  },
  (table) => [
    index("project_short_code_project_idx").on(table.projectId),
    uniqueIndex("project_short_code_workspace_code_uidx").on(
      table.workspaceId,
      table.shortCode,
    ),
    check(
      "project_short_code_format_check",
      sql`${table.shortCode} ~ '^[A-Z][A-Z0-9]*(-[A-Z0-9]+)*$'`,
    ),
  ],
);

export const projectRelations = relations(project, ({ many, one }) => ({
  shortCodeReservations: many(projectShortCode),
  workspace: one(workspace, {
    fields: [project.workspaceId],
    references: [workspace.id],
  }),
}));

export const projectShortCodeRelations = relations(
  projectShortCode,
  ({ one }) => ({
    project: one(project, {
      fields: [projectShortCode.projectId],
      references: [project.id],
    }),
    workspace: one(workspace, {
      fields: [projectShortCode.workspaceId],
      references: [workspace.id],
    }),
  }),
);
