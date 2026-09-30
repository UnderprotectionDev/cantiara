import { sql } from "drizzle-orm";
import {
  check,
  foreignKey,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
} from "drizzle-orm/pg-core";

import { workspace } from "./auth";
import { project } from "./project";

export const document = pgTable(
  "document",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id").references(() => project.id, {
      onDelete: "cascade",
    }),
    workspaceId: text("workspace_id").references(() => workspace.id, {
      onDelete: "cascade",
    }),
    title: text("title").notNull(),
    body: text("body").notNull(),
    type: text("type").notNull().default("General"),
    archivedAt: timestamp("archived_at"),
    folder: text("folder"),
    parentDocumentId: text("parent_document_id"),
    inlineTags: jsonb("inline_tags")
      .$type<
        Array<{
          tagId: string;
          name: string;
          start: number;
          end: number;
        }>
      >()
      .notNull()
      .default([]),
    revision: integer("revision").notNull().default(0),
    originDocumentId: text("origin_document_id"),
    originRevision: integer("origin_revision"),
    originConflictDraftId: text("origin_conflict_draft_id"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    unique("document_id_project_unique").on(table.id, table.projectId),
    unique("document_id_workspace_unique").on(table.id, table.workspaceId),
    foreignKey({
      name: "document_parent_scope_fk",
      columns: [table.parentDocumentId, table.projectId],
      foreignColumns: [table.id, table.projectId],
    }),
    foreignKey({
      name: "document_parent_workspace_fk",
      columns: [table.parentDocumentId, table.workspaceId],
      foreignColumns: [table.id, table.workspaceId],
    }),
    check(
      "document_parent_self_check",
      sql`${table.parentDocumentId} is null or ${table.parentDocumentId} <> ${table.id}`,
    ),
    check(
      "document_folder_check",
      sql`${table.folder} is null or length(btrim(${table.folder})) between 1 and 255`,
    ),
    index("document_parent_idx").on(table.parentDocumentId),
    index("document_project_updated_idx").on(table.projectId, table.updatedAt),
    index("document_wiki_updated_idx").on(table.workspaceId, table.updatedAt),
    check(
      "document_ownership_check",
      sql`(${table.projectId} IS NOT NULL AND ${table.workspaceId} IS NULL) OR (${table.projectId} IS NULL AND ${table.workspaceId} IS NOT NULL)`,
    ),
    check(
      "document_title_check",
      sql`length(btrim(${table.title})) between 1 and 255`,
    ),
    check(
      "document_type_check",
      sql`${table.type} in ('General', 'PRD', 'Plan', 'Spec', 'Research Note', 'Persona')`,
    ),
    check("document_revision_check", sql`${table.revision} >= 0`),
  ],
);

export const documentConflictDraft = pgTable(
  "document_conflict_draft",
  {
    id: text("id").primaryKey(),
    documentId: text("document_id")
      .notNull()
      .references(() => document.id, { onDelete: "cascade" }),
    projectId: text("project_id")
      .notNull()
      .references(() => project.id, { onDelete: "cascade" }),
    baseRevision: integer("base_revision").notNull(),
    title: text("title").notNull(),
    body: text("body").notNull(),
    type: text("type").notNull(),
    clientIdempotencyKey: text("client_idempotency_key").notNull(),
    payloadFingerprint: text("payload_fingerprint").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    resolvedAt: timestamp("resolved_at"),
  },
  (table) => [
    uniqueIndex("document_conflict_draft_request_idx").on(
      table.documentId,
      table.clientIdempotencyKey,
    ),
    index("document_conflict_draft_document_idx").on(
      table.documentId,
      table.resolvedAt,
    ),
    check(
      "document_conflict_draft_revision_check",
      sql`${table.baseRevision} > 0`,
    ),
    check(
      "document_conflict_draft_type_check",
      sql`${table.type} in ('General', 'PRD', 'Plan', 'Spec', 'Research Note', 'Persona')`,
    ),
  ],
);
