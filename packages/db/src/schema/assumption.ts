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

export const assumption = pgTable(
  "project_assumption",
  {
    createdAt: timestamp("created_at").defaultNow().notNull(),
    id: text("id").primaryKey(),
    life: text("life").default("Open").notNull(),
    projectId: text("project_id")
      .notNull()
      .references(() => project.id, { onDelete: "cascade" }),
    rationale: text("rationale"),
    revision: integer("revision").default(0).notNull(),
    statement: text("statement").notNull(),
    title: text("title").notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [
    index("project_assumption_project_life_title_idx").on(
      table.projectId,
      table.life,
      table.title,
    ),
    check(
      "project_assumption_life_check",
      sql`${table.life} in ('Open', 'Confirmed', 'Refuted', 'No longer applicable')`,
    ),
    check("project_assumption_revision_check", sql`${table.revision} >= 0`),
    check(
      "project_assumption_title_check",
      sql`length(btrim(${table.title})) between 1 and 255`,
    ),
    check(
      "project_assumption_statement_check",
      sql`length(btrim(${table.statement})) between 1 and 100000`,
    ),
  ],
);

export const assumptionRelations = relations(assumption, ({ one }) => ({
  project: one(project, {
    fields: [assumption.projectId],
    references: [project.id],
  }),
}));
