import { relations, sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { project } from "./project";

export const projectGoal = pgTable(
  "project_goal",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => project.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    description: text("description").notNull(),
    intendedOutcome: text("intended_outcome"),
    observedOutcomeLearning: text("observed_outcome_learning"),
    revision: integer("revision").default(0).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("project_goal_project_created_idx").on(
      table.projectId,
      table.createdAt,
      table.id,
    ),
    check("project_goal_revision_check", sql`${table.revision} >= 0`),
    check(
      "project_goal_title_check",
      sql`length(btrim(${table.title})) between 1 and 255`,
    ),
    check(
      "project_goal_description_check",
      sql`length(btrim(${table.description})) between 1 and 10000`,
    ),
  ],
);
export const projectGoalRelations = relations(projectGoal, ({ one }) => ({
  project: one(project, {
    fields: [projectGoal.projectId],
    references: [project.id],
  }),
}));
