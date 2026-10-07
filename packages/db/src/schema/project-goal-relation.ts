import { sql } from "drizzle-orm";
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

// Endpoint IDs deliberately have no cascading FK: deleted ends keep their historical bind.
export const projectGoalRelation = pgTable(
  "project_goal_relation",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => project.id, { onDelete: "cascade" }),
    goalId: text("goal_id").notNull(),
    memberId: text("member_id").notNull(),
    memberType: text("member_type").notNull(),
    kind: text("kind").notNull(),
    revision: integer("revision").default(0).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    removedAt: timestamp("removed_at"),
  },
  (table) => [
    index("project_goal_relation_goal_idx").on(table.projectId, table.goalId),
    index("project_goal_relation_member_idx").on(
      table.projectId,
      table.memberType,
      table.memberId,
    ),
    uniqueIndex("project_goal_relation_pair_uidx").on(
      table.goalId,
      table.kind,
      table.memberType,
      table.memberId,
    ),
    check(
      "project_goal_relation_kind_check",
      sql`${table.kind} in ('Contributes to Goal', 'Related')`,
    ),
    check(
      "project_goal_relation_contribution_check",
      sql`${table.kind} <> 'Contributes to Goal' or ${table.memberType} in ('Work', 'Milestone', 'Project Release')`,
    ),
    check("project_goal_relation_revision_check", sql`${table.revision} >= 0`),
  ],
);
