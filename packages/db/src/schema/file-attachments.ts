import { relations, sql } from "drizzle-orm";
import {
  bigint,
  check,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

import { user, workspace } from "./auth";
import { project } from "./project";

export const fileAttachment = pgTable(
  "file_attachment",
  {
    createdAt: timestamp("created_at").defaultNow().notNull(),
    currentVersion: integer("current_version").default(1).notNull(),
    id: text("id").primaryKey(),
    lifecycleStatus: text("lifecycle_status").default("Active").notNull(),
    name: text("name").notNull(),
    personalWikiId: text("personal_wiki_id"),
    projectId: text("project_id").references(() => project.id, {
      onDelete: "cascade",
    }),
    revision: integer("revision").default(0).notNull(),
    scopeType: text("scope_type").notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspace.id, { onDelete: "cascade" }),
  },
  (table) => [
    index("file_attachment_workspace_idx").on(table.workspaceId),
    index("file_attachment_scope_idx").on(
      table.scopeType,
      table.projectId,
      table.personalWikiId,
    ),
    check(
      "file_attachment_current_version_check",
      sql`${table.currentVersion} >= 1`,
    ),
    check(
      "file_attachment_lifecycle_status_check",
      sql`${table.lifecycleStatus} in ('Active', 'Archive', 'Trash')`,
    ),
    check("file_attachment_name_check", sql`length(btrim(${table.name})) > 0`),
    check("file_attachment_revision_check", sql`${table.revision} >= 0`),
    check(
      "file_attachment_scope_check",
      sql`(${table.scopeType} = 'Project' and ${table.projectId} is not null and ${table.personalWikiId} is null) or (${table.scopeType} = 'Personal Wiki' and ${table.projectId} is null and ${table.personalWikiId} is not null)`,
    ),
  ],
);

export const fileAttachmentVersion = pgTable(
  "file_attachment_version",
  {
    attachmentId: text("attachment_id")
      .notNull()
      .references(() => fileAttachment.id, { onDelete: "cascade" }),
    byteSize: bigint("byte_size", { mode: "number" }).notNull(),
    contentHash: text("content_hash").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    detectedMimeType: text("detected_mime_type").notNull(),
    extension: text("extension").notNull(),
    fileName: text("file_name").notNull(),
    id: text("id").primaryKey(),
    mimeType: text("mime_type").notNull(),
    objectKey: text("object_key").notNull(),
    version: integer("version").notNull(),
  },
  (table) => [
    index("file_attachment_version_attachment_idx").on(table.attachmentId),
    uniqueIndex("file_attachment_version_attachment_number_uidx").on(
      table.attachmentId,
      table.version,
    ),
    check(
      "file_attachment_version_byte_size_check",
      sql`${table.byteSize} > 0`,
    ),
    check(
      "file_attachment_version_content_hash_check",
      sql`${table.contentHash} ~ '^[0-9a-fA-F]{64}$'`,
    ),
    check("file_attachment_version_version_check", sql`${table.version} >= 1`),
  ],
);

export const fileAttachmentUpload = pgTable(
  "file_attachment_upload",
  {
    accountId: text("account_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    attachmentId: text("attachment_id"),
    baseRevision: integer("base_revision"),
    clientIdempotencyKey: text("client_idempotency_key").notNull(),
    completedAt: timestamp("completed_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    declaredMimeType: text("declared_mime_type").notNull(),
    error: jsonb("error").$type<{ code: string; message: string } | null>(),
    expiresAt: timestamp("expires_at").notNull(),
    fileName: text("file_name").notNull(),
    id: text("id").primaryKey(),
    mode: text("mode").notNull(),
    payloadFingerprint: text("payload_fingerprint").notNull(),
    personalWikiId: text("personal_wiki_id"),
    projectId: text("project_id"),
    result: jsonb("result").$type<unknown>(),
    scopeType: text("scope_type"),
    status: text("status").default("staged").notNull(),
    temporaryObjectKey: text("temporary_object_key"),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspace.id, { onDelete: "cascade" }),
  },
  (table) => [
    uniqueIndex("file_attachment_upload_account_key_uidx").on(
      table.accountId,
      table.clientIdempotencyKey,
    ),
    index("file_attachment_upload_expiry_idx").on(
      table.status,
      table.expiresAt,
    ),
    index("file_attachment_upload_workspace_idx").on(table.workspaceId),
    check(
      "file_attachment_upload_base_revision_check",
      sql`${table.baseRevision} is null or ${table.baseRevision} >= 0`,
    ),
    check(
      "file_attachment_upload_mode_check",
      sql`${table.mode} in ('new', 'new-version')`,
    ),
    check(
      "file_attachment_upload_payload_fingerprint_check",
      sql`${table.payloadFingerprint} ~ '^[0-9a-fA-F]{64}$'`,
    ),
    check(
      "file_attachment_upload_scope_check",
      sql`(${table.scopeType} is null and ${table.projectId} is null and ${table.personalWikiId} is null) or (${table.scopeType} = 'Project' and ${table.projectId} is not null and ${table.personalWikiId} is null) or (${table.scopeType} = 'Personal Wiki' and ${table.projectId} is null and ${table.personalWikiId} is not null)`,
    ),
    check(
      "file_attachment_upload_status_check",
      sql`${table.status} in ('staged', 'committed', 'rejected', 'swept')`,
    ),
  ],
);

export const fileAttachmentMarking = pgTable(
  "file_attachment_marking",
  {
    accountId: text("account_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    attachmentId: text("attachment_id")
      .notNull()
      .references(() => fileAttachment.id, { onDelete: "cascade" }),
    clientIdempotencyKey: text("client_idempotency_key").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    geometry: jsonb("geometry").$type<unknown>().notNull(),
    id: text("id").primaryKey(),
    payloadFingerprint: text("payload_fingerprint").notNull(),
    tool: text("tool").notNull(),
    undoneAt: timestamp("undone_at"),
    versionId: text("version_id")
      .notNull()
      .references(() => fileAttachmentVersion.id, { onDelete: "cascade" }),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspace.id, { onDelete: "cascade" }),
  },
  (table) => [
    uniqueIndex("file_attachment_marking_account_key_uidx").on(
      table.accountId,
      table.clientIdempotencyKey,
    ),
    index("file_attachment_marking_attachment_version_idx").on(
      table.attachmentId,
      table.versionId,
    ),
    index("file_attachment_marking_workspace_idx").on(table.workspaceId),
    check(
      "file_attachment_marking_payload_fingerprint_check",
      sql`${table.payloadFingerprint} ~ '^[0-9a-fA-F]{64}$'`,
    ),
    check(
      "file_attachment_marking_tool_check",
      sql`${table.tool} in ('pen', 'highlighter', 'arrow', 'rectangle')`,
    ),
  ],
);

export const fileAttachmentRelations = relations(
  fileAttachment,
  ({ many, one }) => ({
    project: one(project, {
      fields: [fileAttachment.projectId],
      references: [project.id],
    }),
    markings: many(fileAttachmentMarking),
    versions: many(fileAttachmentVersion),
    workspace: one(workspace, {
      fields: [fileAttachment.workspaceId],
      references: [workspace.id],
    }),
  }),
);

export const fileAttachmentVersionRelations = relations(
  fileAttachmentVersion,
  ({ many, one }) => ({
    attachment: one(fileAttachment, {
      fields: [fileAttachmentVersion.attachmentId],
      references: [fileAttachment.id],
    }),
    markings: many(fileAttachmentMarking),
  }),
);

export const fileAttachmentMarkingRelations = relations(
  fileAttachmentMarking,
  ({ one }) => ({
    attachment: one(fileAttachment, {
      fields: [fileAttachmentMarking.attachmentId],
      references: [fileAttachment.id],
    }),
    version: one(fileAttachmentVersion, {
      fields: [fileAttachmentMarking.versionId],
      references: [fileAttachmentVersion.id],
    }),
    workspace: one(workspace, {
      fields: [fileAttachmentMarking.workspaceId],
      references: [workspace.id],
    }),
  }),
);
