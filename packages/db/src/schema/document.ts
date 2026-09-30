import { sql } from "drizzle-orm";
import {
  check,
  foreignKey,
  index,
  integer,
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
    revision: integer("revision").notNull().default(0),
    originDocumentId: text("origin_document_id"),
    originRevision: integer("origin_revision"),
    originConflictDraftId: text("origin_conflict_draft_id"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    index("document_project_updated_idx").on(table.projectId, table.updatedAt),
    index("document_wiki_updated_idx").on(table.workspaceId, table.updatedAt),
    unique("document_id_project_unique").on(table.id, table.projectId),
    unique("document_id_workspace_unique").on(table.id, table.workspaceId),
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
    documentId: text("document_id").notNull(),
    projectId: text("project_id"),
    workspaceId: text("workspace_id"),
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
    foreignKey({
      columns: [table.documentId, table.projectId],
      foreignColumns: [document.id, document.projectId],
      name: "document_conflict_draft_project_scope_fk",
    })
      .onDelete("cascade")
      .onUpdate("cascade"),
    foreignKey({
      columns: [table.documentId, table.workspaceId],
      foreignColumns: [document.id, document.workspaceId],
      name: "document_conflict_draft_workspace_scope_fk",
    })
      .onDelete("cascade")
      .onUpdate("cascade"),
    uniqueIndex("document_conflict_draft_request_idx").on(
      table.documentId,
      table.clientIdempotencyKey,
    ),
    index("document_conflict_draft_document_idx").on(
      table.documentId,
      table.resolvedAt,
    ),
    check(
      "document_conflict_draft_scope_check",
      sql`(${table.projectId} IS NOT NULL AND ${table.workspaceId} IS NULL) OR (${table.projectId} IS NULL AND ${table.workspaceId} IS NOT NULL)`,
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
