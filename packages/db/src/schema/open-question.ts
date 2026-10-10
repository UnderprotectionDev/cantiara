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

export const openQuestion = pgTable(
  "project_open_question",
  {
    answer: text("answer"),
    context: text("context"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    id: text("id").primaryKey(),
    life: text("life").default("Open").notNull(),
    projectId: text("project_id")
      .notNull()
      .references(() => project.id, { onDelete: "cascade" }),
    question: text("question").notNull(),
    rationale: text("rationale"),
    revision: integer("revision").default(0).notNull(),
    title: text("title").notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [
    index("project_open_question_project_life_title_idx").on(
      table.projectId,
      table.life,
      table.title,
    ),
    check(
      "project_open_question_life_check",
      sql`${table.life} in ('Open', 'Answered', 'No longer applicable')`,
    ),
    check("project_open_question_revision_check", sql`${table.revision} >= 0`),
    check(
      "project_open_question_title_check",
      sql`length(btrim(${table.title})) between 1 and 255`,
    ),
    check(
      "project_open_question_question_check",
      sql`length(btrim(${table.question})) between 1 and 100000`,
    ),
  ],
);

export const openQuestionRelations = relations(openQuestion, ({ one }) => ({
  project: one(project, {
    fields: [openQuestion.projectId],
    references: [project.id],
  }),
}));
