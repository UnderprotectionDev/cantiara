import { relations, sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

import { workspace } from "./auth";
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
    blockingStatus: text("blocking_status"),
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
      "work_relation_blocking_status_check",
      sql`(${table.kind} <> 'Blocks' and ${table.blockingStatus} is null) or (${table.kind} = 'Blocks' and ${table.blockingStatus} is not null and ${table.blockingStatus} in ('Active', 'Resolved'))`,
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

export const USAGE_LINK_KIND_OPTIONS = [
  "Inline reference",
  "Section reference",
  "Live block",
  "Pinned bind",
  "Screen reference",
] as const;

const usageLinkKindSql = sql.raw(
  USAGE_LINK_KIND_OPTIONS.map((kind) => `'${kind}'`).join(", "),
);

export const usageLink = pgTable(
  "usage_link",
  {
    createdAt: timestamp("created_at").defaultNow().notNull(),
    id: text("id").primaryKey(),
    kind: text("kind").notNull(),
    location: jsonb("location").$type<unknown>(),
    revision: integer("revision").default(1).notNull(),
    sourceRecordId: text("source_record_id").notNull(),
    sourceRecordType: text("source_record_type").notNull(),
    surfaceRecordId: text("surface_record_id").notNull(),
    surfaceRecordType: text("surface_record_type").notNull(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspace.id, { onDelete: "cascade" }),
  },
  (table) => [
    index("usage_link_workspace_source_idx").on(
      table.workspaceId,
      table.sourceRecordType,
      table.sourceRecordId,
    ),
    index("usage_link_workspace_surface_idx").on(
      table.workspaceId,
      table.surfaceRecordType,
      table.surfaceRecordId,
    ),
    check("usage_link_kind_check", sql`${table.kind} in (${usageLinkKindSql})`),
    check("usage_link_revision_check", sql`${table.revision} >= 1`),
    check(
      "usage_link_source_record_id_check",
      sql`length(btrim(${table.sourceRecordId})) > 0`,
    ),
    check(
      "usage_link_source_record_type_check",
      sql`length(btrim(${table.sourceRecordType})) > 0`,
    ),
    check(
      "usage_link_surface_record_id_check",
      sql`length(btrim(${table.surfaceRecordId})) > 0`,
    ),
    check(
      "usage_link_surface_record_type_check",
      sql`length(btrim(${table.surfaceRecordType})) > 0`,
    ),
  ],
);

export const usageLinkRelations = relations(usageLink, ({ one }) => ({
  workspace: one(workspace, {
    fields: [usageLink.workspaceId],
    references: [workspace.id],
  }),
}));
