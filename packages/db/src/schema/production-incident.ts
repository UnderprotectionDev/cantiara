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

export const productionIncident = pgTable(
  "production_incident",
  {
    createdAt: timestamp("created_at").defaultNow().notNull(),
    detectedHow: text("detected_how"),
    id: text("id").primaryKey(),
    impact: text("impact"),
    learning: text("learning"),
    occurredAt: timestamp("occurred_at").notNull(),
    projectId: text("project_id")
      .notNull()
      .references(() => project.id, { onDelete: "cascade" }),
    resolution: text("resolution"),
    revision: integer("revision").default(0).notNull(),
    rootCause: text("root_cause"),
    status: text("status").default("Open").notNull(),
    title: text("title").notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [
    index("production_incident_project_status_occurred_at_idx").on(
      table.projectId,
      table.status,
      table.occurredAt,
    ),
    check(
      "production_incident_status_check",
      sql`${table.status} in ('Open', 'Watching', 'Resolved')`,
    ),
    check("production_incident_revision_check", sql`${table.revision} >= 0`),
    check(
      "production_incident_title_check",
      sql`length(btrim(${table.title})) between 1 and 255`,
    ),
  ],
);

export const productionIncidentRelations = relations(
  productionIncident,
  ({ one }) => ({
    project: one(project, {
      fields: [productionIncident.projectId],
      references: [project.id],
    }),
  }),
);
