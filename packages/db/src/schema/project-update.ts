import { relations, sql } from "drizzle-orm";
import {
  check,
  foreignKey,
  index,
  integer,
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
    id: text("id").notNull(),
    mark: text("mark").notNull(),
    narrative: text("narrative").notNull(),
    projectId: text("project_id")
      .notNull()
      .references(() => project.id, { onDelete: "cascade" }),
    snapshot: jsonb("snapshot").notNull(),
  },
  (table) => [
    // The id is unique per Project (the client's id for one save attempt), not
    // globally: the same `updateId` in another Project is an independent save.
    primaryKey({
      columns: [table.projectId, table.id],
      name: "project_update_pk",
    }),
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
    // Carries the Project so the parent foreign key is per Project below.
    projectId: text("project_id").notNull(),
    projectUpdateId: text("project_update_id").notNull(),
    targetId: text("target_id").notNull(),
    targetType: text("target_type").notNull(),
  },
  (table) => [
    primaryKey({
      columns: [table.projectUpdateId, table.targetType, table.targetId],
      name: "project_update_link_pk",
    }),
    foreignKey({
      columns: [table.projectUpdateId, table.projectId],
      foreignColumns: [projectUpdate.id, projectUpdate.projectId],
      name: "project_update_link_update_fk",
    }).onDelete("cascade"),
    check(
      "project_update_link_target_type_check",
      sql`${table.targetType} in ('Risk', 'Decision', 'Milestone', 'Work')`,
    ),
  ],
);

/**
 * The optional per-Project reminder settings (spec 69 #471). One row per
 * Project, editable in place: it is a preference, not a saved update. The row
 * only plans a Personal Reminders `Remind me` (`personal_reminder_id`, no
 * foreign key: the reminder is cancelled or replaced by the product) and never
 * writes a `project_update`.
 */
export const projectUpdateReminder = pgTable(
  "project_update_reminder",
  {
    intervalDays: integer("interval_days").notNull(),
    nextDueAt: timestamp("next_due_at"),
    personalReminderId: text("personal_reminder_id"),
    projectId: text("project_id")
      .primaryKey()
      .references(() => project.id, { onDelete: "cascade" }),
    question: text("question").notNull(),
    state: text("state").notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [
    check(
      "project_update_reminder_state_check",
      sql`${table.state} in ('Enabled', 'Paused', 'Disabled')`,
    ),
    check(
      "project_update_reminder_interval_check",
      sql`${table.intervalDays} between 1 and 365`,
    ),
    check(
      "project_update_reminder_question_check",
      sql`length(btrim(${table.question})) between 1 and 200`,
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
