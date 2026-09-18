import { relations, sql } from "drizzle-orm";
import { check, index, pgTable, text, timestamp } from "drizzle-orm/pg-core";

import { work } from "./work";

export const workRelation = pgTable(
  "work_relation",
  {
    createdAt: timestamp("created_at").defaultNow().notNull(),
    id: text("id").primaryKey(),
    kind: text("kind").notNull(),
    sourceWorkId: text("source_work_id")
      .notNull()
      .references(() => work.id, { onDelete: "cascade" }),
    targetLabel: text("target_label").notNull(),
    targetProjectId: text("target_project_id").notNull(),
    targetRecordId: text("target_record_id").notNull(),
  },
  (table) => [
    index("work_relation_source_idx").on(table.sourceWorkId),
    check(
      "work_relation_kind_check",
      sql`${table.kind} in ('Related', 'Evidence', 'Contributes to Goal', 'Contributes to Milestone', 'Implements', 'GitHub Completion', 'Automation', 'Planning Membership', 'Publish', 'Parentage', 'Merge State', 'History', 'Closure Result', 'Status', 'Date', 'Origin')`,
    ),
    check(
      "work_relation_target_label_check",
      sql`length(btrim(${table.targetLabel})) > 0`,
    ),
  ],
);

export const workRelationRelations = relations(workRelation, ({ one }) => ({
  sourceWork: one(work, {
    fields: [workRelation.sourceWorkId],
    references: [work.id],
  }),
}));
