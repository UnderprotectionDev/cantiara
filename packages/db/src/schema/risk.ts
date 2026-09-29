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

export const risk = pgTable(
  "project_risk",
  {
    createdAt: timestamp("created_at").defaultNow().notNull(),
    description: text("description"),
    id: text("id").primaryKey(),
    impact: text("impact"),
    life: text("life").default("Open").notNull(),
    probability: text("probability"),
    projectId: text("project_id")
      .notNull()
      .references(() => project.id, { onDelete: "cascade" }),
    rationale: text("rationale"),
    response: text("response"),
    revision: integer("revision").default(0).notNull(),
    title: text("title").notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [
    index("project_risk_project_life_title_idx").on(
      table.projectId,
      table.life,
      table.title,
    ),
    check(
      "project_risk_life_check",
      sql`${table.life} in ('Open', 'Mitigating', 'Occurred', 'Resolved', 'Accepted')`,
    ),
    check("project_risk_revision_check", sql`${table.revision} >= 0`),
    check(
      "project_risk_title_check",
      sql`length(btrim(${table.title})) between 1 and 255`,
    ),
  ],
);

export const riskRelations = relations(risk, ({ one }) => ({
  project: one(project, {
    fields: [risk.projectId],
    references: [project.id],
  }),
}));
