import { relations, sql } from "drizzle-orm";
import {
  check,
  date,
  index,
  integer,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

import { project } from "./project";

export const projectMilestone = pgTable(
  "project_milestone",
  {
    createdAt: timestamp("created_at").defaultNow().notNull(),
    description: text("description"),
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => project.id, { onDelete: "cascade" }),
    revision: integer("revision").default(0).notNull(),
    status: text("status").default("Planned").notNull(),
    targetDate: date("target_date", { mode: "string" }),
    title: text("title").notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [
    index("project_milestone_project_target_date_title_idx").on(
      table.projectId,
      table.targetDate,
      table.title,
    ),
    check(
      "project_milestone_status_check",
      sql`${table.status} in ('Planned', 'Reached', 'Abandoned')`,
    ),
    check("project_milestone_revision_check", sql`${table.revision} >= 0`),
    check(
      "project_milestone_title_check",
      sql`length(btrim(${table.title})) between 1 and 255`,
    ),
  ],
);

export const projectMilestoneRelations = relations(
  projectMilestone,
  ({ one }) => ({
    project: one(project, {
      fields: [projectMilestone.projectId],
      references: [project.id],
    }),
  }),
);
