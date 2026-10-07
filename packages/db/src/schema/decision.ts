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

export const decision = pgTable(
  "project_decision",
  {
    createdAt: timestamp("created_at").defaultNow().notNull(),
    decision: text("decision").notNull(),
    id: text("id").primaryKey(),
    life: text("life").default("Valid").notNull(),
    projectId: text("project_id")
      .notNull()
      .references(() => project.id, { onDelete: "cascade" }),
    rationale: text("rationale"),
    revision: integer("revision").default(0).notNull(),
    title: text("title").notNull(),
    withdrawnAt: timestamp("withdrawn_at"),
    withdrawalRationale: text("withdrawal_rationale"),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [
    index("project_decision_project_life_title_idx").on(
      table.projectId,
      table.life,
      table.title,
    ),
    check(
      "project_decision_life_check",
      sql`${table.life} in ('Valid', 'Superseded', 'Withdrawn')`,
    ),
    check("project_decision_revision_check", sql`${table.revision} >= 0`),
    check(
      "project_decision_title_check",
      sql`length(btrim(${table.title})) between 1 and 255`,
    ),
    check(
      "project_decision_decision_check",
      sql`length(btrim(${table.decision})) between 1 and 20000`,
    ),
  ],
);

export const decisionRelations = relations(decision, ({ one }) => ({
  project: one(project, {
    fields: [decision.projectId],
    references: [project.id],
  }),
}));
