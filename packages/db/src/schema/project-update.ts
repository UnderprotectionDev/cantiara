import { relations, sql } from "drizzle-orm";
import {
  check,
  index,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

import { project } from "./project";

/**
 * Manual Project Update (spec 69): the founder's dated, subjective mark with a
 * short narrative and the summary blocks seen at save. The table is
 * append-only: rows are inserted once and never updated or deleted by the
 * product (no `revision`, no `updated_at`); they leave only with their Project.
 * `snapshot` is a historical copy and never a source of truth.
 */
export const projectUpdate = pgTable(
  "project_update",
  {
    createdAt: timestamp("created_at").notNull(),
    id: text("id").primaryKey(),
    mark: text("mark").notNull(),
    narrative: text("narrative").notNull(),
    projectId: text("project_id")
      .notNull()
      .references(() => project.id, { onDelete: "cascade" }),
    snapshot: jsonb("snapshot").notNull(),
  },
  (table) => [
    index("project_update_project_created_at_idx").on(
      table.projectId,
      table.createdAt,
    ),
    check(
      "project_update_mark_check",
      sql`${table.mark} in ('On Track', 'At Risk', 'Off Track')`,
    ),
    check(
      "project_update_narrative_check",
      sql`length(btrim(${table.narrative})) between 1 and 1000`,
    ),
  ],
);

/**
 * A live link from one update to a record of the same Project. `target_id` has
 * no foreign key on purpose: a link to a record that later disappears stays
 * listed as unavailable instead of rewriting the saved update. The adapter
 * checks the target belongs to the Project at save.
 */
export const projectUpdateLink = pgTable(
  "project_update_link",
  {
    projectUpdateId: text("project_update_id")
      .notNull()
      .references(() => projectUpdate.id, { onDelete: "cascade" }),
    targetId: text("target_id").notNull(),
    targetType: text("target_type").notNull(),
  },
  (table) => [
    primaryKey({
      columns: [table.projectUpdateId, table.targetType, table.targetId],
      name: "project_update_link_pk",
    }),
    check(
      "project_update_link_target_type_check",
      sql`${table.targetType} in ('Risk', 'Decision', 'Milestone', 'Work')`,
    ),
  ],
);

export const projectUpdateRelations = relations(
  projectUpdate,
  ({ many, one }) => ({
    links: many(projectUpdateLink),
    project: one(project, {
      fields: [projectUpdate.projectId],
      references: [project.id],
    }),
  }),
);

export const projectUpdateLinkRelations = relations(
  projectUpdateLink,
  ({ one }) => ({
    update: one(projectUpdate, {
      fields: [projectUpdateLink.projectUpdateId],
      references: [projectUpdate.id],
    }),
  }),
);
