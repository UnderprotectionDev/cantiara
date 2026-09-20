import { relations, sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

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
    deletedAt: timestamp("deleted_at"),
    brokenReason: text("broken_reason"),
    id: text("id").primaryKey(),
    kind: text("kind").notNull(),
    revision: integer("revision").default(0).notNull(),
    sourceRecordType: text("source_record_type").default("Work").notNull(),
    sourceWorkId: text("source_work_id")
      .notNull()
      .references(() => work.id, { onDelete: "cascade" }),
    targetLabel: text("target_label").notNull(),
    targetProjectId: text("target_project_id").notNull(),
    targetRecordId: text("target_record_id").notNull(),
    targetRecordType: text("target_record_type").default("Work").notNull(),
  },
  (table) => [
    index("work_relation_source_idx").on(table.sourceWorkId),
    index("work_relation_target_idx").on(
      table.targetRecordType,
      table.targetRecordId,
    ),
    check(
      "work_relation_kind_check",
      sql`${table.kind} in (${workRelationKindSql})`,
    ),
    check("work_relation_revision_check", sql`${table.revision} >= 0`),
    check(
      "work_relation_broken_reason_check",
      sql`${table.brokenReason} is null or ${table.brokenReason} in ('Archived', 'In Trash', 'Permanently deleted', 'Redacted for security', 'No access')`,
    ),
    check(
      "work_relation_source_record_type_check",
      sql`length(btrim(${table.sourceRecordType})) > 0`,
    ),
    check(
      "work_relation_target_record_type_check",
      sql`length(btrim(${table.targetRecordType})) > 0`,
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
