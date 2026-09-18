import { relations, sql } from "drizzle-orm";
import { check, index, pgTable, text, timestamp } from "drizzle-orm/pg-core";

import { work } from "./work";

export const WORK_RELATION_KIND_OPTIONS = [
  "Related",
  "Origin",
  "Evidence",
  "Contributes to Goal",
  "Blocks",
  "Includes",
  "Contributes to Milestone",
  "Primary spec",
  "Supersedes",
  "Implements",
  "Belongs to Company",
  "Participant",
  "Required for completion",
] as const;

const workRelationKindSql = sql.raw(
  WORK_RELATION_KIND_OPTIONS.map((kind) => `'${kind}'`).join(", "),
);

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
      sql`${table.kind} in (${workRelationKindSql})`,
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
