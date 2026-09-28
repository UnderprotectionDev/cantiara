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

export const projectRelease = pgTable(
  "project_release",
  {
    createdAt: timestamp("created_at").defaultNow().notNull(),
    description: text("description"),
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    projectId: text("project_id")
      .notNull()
      .references(() => project.id, { onDelete: "cascade" }),
    revision: integer("revision").default(0).notNull(),
    status: text("status").default("Draft").notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
    versionLabel: text("version_label"),
  },
  (table) => [
    index("project_release_project_status_name_idx").on(
      table.projectId,
      table.status,
      table.name,
    ),
    check(
      "project_release_status_check",
      sql`${table.status} in ('Draft', 'Preparing', 'Published', 'Cancelled')`,
    ),
    check("project_release_revision_check", sql`${table.revision} >= 0`),
    check(
      "project_release_name_check",
      sql`length(btrim(${table.name})) between 1 and 255`,
    ),
    check(
      "project_release_version_label_check",
      sql`${table.versionLabel} is null or length(btrim(${table.versionLabel})) <= 255`,
    ),
  ],
);

export const projectReleaseRelations = relations(projectRelease, ({ one }) => ({
  project: one(project, {
    fields: [projectRelease.projectId],
    references: [project.id],
  }),
}));
