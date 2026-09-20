import { relations, sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
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

export const WORK_RELATION_USAGE_KIND_OPTIONS = [
  "Inline reference",
  "Section reference",
  "Live block",
  "Pinned bind",
  "Screen reference",
] as const;

const workRelationUsageKindSql = sql.raw(
  WORK_RELATION_USAGE_KIND_OPTIONS.map((kind) => `'${kind}'`).join(", "),
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
    uniqueIndex("work_relation_unique_per_source_uidx")
      .on(table.kind, table.sourceRecordType, table.sourceWorkId)
      .where(
        sql`${table.deletedAt} is null and ${table.kind} in ('Primary spec', 'Belongs to Company', 'Participant')`,
      ),
    uniqueIndex("work_relation_unique_per_target_uidx")
      .on(table.kind, table.targetRecordType, table.targetRecordId)
      .where(sql`${table.deletedAt} is null and ${table.kind} = 'Includes'`),
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

/**
 * Usage links (kullanim baglari) are derived, embed-owned bindings between a
 * surface and the main record it uses. They are not semantic relations: no
 * Evidence Role, no cardinality rule, no lifecycle effect, and they never
 * enter relation counts. Unlink (`Unlink`) soft-deletes the row and keeps the
 * source record.
 */
export const recordUsageLink = pgTable(
  "record_usage_link",
  {
    createdAt: timestamp("created_at").defaultNow().notNull(),
    deletedAt: timestamp("deleted_at"),
    id: text("id").primaryKey(),
    kind: text("kind").notNull(),
    sourceRecordId: text("source_record_id")
      .notNull()
      .references(() => work.id, { onDelete: "cascade" }),
    sourceRecordType: text("source_record_type").default("Work").notNull(),
    surfaceContext: text("surface_context"),
    surfaceRecordId: text("surface_record_id").notNull(),
    surfaceRecordType: text("surface_record_type").notNull(),
  },
  (table) => [
    index("record_usage_link_source_idx").on(
      table.sourceRecordType,
      table.sourceRecordId,
    ),
    index("record_usage_link_surface_idx").on(
      table.surfaceRecordType,
      table.surfaceRecordId,
    ),
    check(
      "record_usage_link_kind_check",
      sql`${table.kind} in (${workRelationUsageKindSql})`,
    ),
    check(
      "record_usage_link_source_record_type_check",
      sql`length(btrim(${table.sourceRecordType})) > 0`,
    ),
    check(
      "record_usage_link_surface_record_type_check",
      sql`length(btrim(${table.surfaceRecordType})) > 0`,
    ),
  ],
);
