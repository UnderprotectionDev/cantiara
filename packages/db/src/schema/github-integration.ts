import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  check,
  index,
  integer,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

import { project } from "./project";

/**
 * GitHub App installation claimed for one Project. The installation, not the
 * Better Auth login, is the repository authority: no column here refers to a
 * login account, session or OAuth token. `removed_at` records that GitHub
 * reported the App uninstalled; it never touches identity or sessions.
 */
export const githubInstallation = pgTable(
  "project_github_installation",
  {
    accountLogin: text("account_login").notNull(),
    connectedByAccountId: text("connected_by_account_id").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    id: text("id").primaryKey(),
    installationId: bigint("installation_id", { mode: "number" }).notNull(),
    projectId: text("project_id")
      .notNull()
      .references(() => project.id, { onDelete: "cascade" }),
    removedAt: timestamp("removed_at"),
  },
  (table) => [
    uniqueIndex("project_github_installation_project_installation_idx").on(
      table.projectId,
      table.installationId,
    ),
    index("project_github_installation_installation_idx").on(
      table.installationId,
    ),
  ],
);

/**
 * Envelope-encrypted installation access token: AES-256-GCM ciphertext under a
 * per-row data key, which is itself wrapped by a versioned key. Plaintext is
 * never stored, logged or exported.
 */
export const githubInstallationCredential = pgTable(
  "project_github_installation_credential",
  {
    ciphertext: text("ciphertext").notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    installationRowId: text("installation_row_id")
      .primaryKey()
      .references(() => githubInstallation.id, { onDelete: "cascade" }),
    keyVersion: integer("key_version").notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
    wrappedDataKey: text("wrapped_data_key").notNull(),
  },
);

/**
 * GitHub bağlantısı: identity is GitHub's stable numeric `repository_id`;
 * `owner` and `name` are only the latest observed labels.
 */
export const githubRepositoryLink = pgTable(
  "project_github_repository_link",
  {
    disconnectedAt: timestamp("disconnected_at"),
    htmlUrl: text("html_url").notNull(),
    id: text("id").primaryKey(),
    lastError: text("last_error"),
    lastErrorAt: timestamp("last_error_at"),
    lastSuccessAt: timestamp("last_success_at"),
    /** Project archive paused the link; unarchive never clears it (explicit Reconnect does). */
    pausedAt: timestamp("paused_at"),
    /** Retry-After / rate-limit reset: no read before this instant. */
    rateLimitedUntil: timestamp("rate_limited_until"),
    /** Start of the last successful incremental read; the next one asks GitHub `since` it. */
    syncCursor: timestamp("sync_cursor"),
    installationRowId: text("installation_row_id")
      .notNull()
      .references(() => githubInstallation.id, { onDelete: "cascade" }),
    linkedAt: timestamp("linked_at").defaultNow().notNull(),
    name: text("name").notNull(),
    owner: text("owner").notNull(),
    projectId: text("project_id")
      .notNull()
      .references(() => project.id, { onDelete: "cascade" }),
    repositoryId: bigint("repository_id", { mode: "number" }).notNull(),
    stopReason: text("stop_reason"),
    triageState: text("triage_state").default("Pending").notNull(),
  },
  (table) => [
    uniqueIndex("project_github_repository_link_project_repository_idx").on(
      table.projectId,
      table.repositoryId,
    ),
    check(
      "project_github_repository_link_stop_reason_check",
      sql`${table.stopReason} is null or ${table.stopReason} in ('App uninstalled', 'Access revoked', 'Repository not found')`,
    ),
    check(
      "project_github_repository_link_triage_state_check",
      sql`${table.triageState} in ('Pending', 'Skipped')`,
    ),
  ],
);

/** Earlier owner and name labels of the same stable repository id. */
export const githubRepositoryLinkName = pgTable(
  "project_github_repository_link_name",
  {
    linkId: text("link_id")
      .notNull()
      .references(() => githubRepositoryLink.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    observedAt: timestamp("observed_at").notNull(),
    owner: text("owner").notNull(),
  },
  (table) => [
    primaryKey({
      columns: [table.linkId, table.observedAt],
      name: "project_github_repository_link_name_pk",
    }),
  ],
);

/**
 * GitHub dış kaydı: a read-only source snapshot with its own product identity.
 * Only the PRD 12 allow-listed fields exist here: no body, file tree, blob,
 * diff, full check log or free webhook payload.
 */
export const githubExternalRecord = pgTable(
  "project_github_external_record",
  {
    archivedAt: timestamp("archived_at"),
    capturedAt: timestamp("captured_at").defaultNow().notNull(),
    /** Set on restore from Trash: only an explicit Sync now applies the missed source state. */
    needsReconcile: boolean("needs_reconcile").default(false).notNull(),
    /** `reconcile` or `webhook`: at an equal `updated_at` the reconcile snapshot wins. */
    appliedFrom: text("applied_from").default("reconcile").notNull(),
    /** Product identity of the permanently deleted record this one was re-included from. */
    originRecordId: text("origin_record_id"),
    originDeletedAt: timestamp("origin_deleted_at"),
    trashedAt: timestamp("trashed_at"),
    githubId: bigint("github_id", { mode: "number" }).notNull(),
    htmlUrl: text("html_url").notNull(),
    id: text("id").primaryKey(),
    kind: text("kind").notNull(),
    labels: text("labels").array().notNull().default(sql`'{}'::text[]`),
    linkId: text("link_id")
      .notNull()
      .references(() => githubRepositoryLink.id, { onDelete: "cascade" }),
    milestone: text("milestone"),
    number: integer("number").notNull(),
    projectId: text("project_id")
      .notNull()
      .references(() => project.id, { onDelete: "cascade" }),
    sourceState: text("source_state").notNull(),
    sourceUpdatedAt: timestamp("source_updated_at").notNull(),
    title: text("title").notNull(),
  },
  (table) => [
    uniqueIndex("project_github_external_record_source_idx").on(
      table.linkId,
      table.kind,
      table.githubId,
    ),
    index("project_github_external_record_project_idx").on(
      table.projectId,
      table.sourceUpdatedAt,
    ),
    check(
      "project_github_external_record_applied_from_check",
      sql`${table.appliedFrom} in ('reconcile', 'webhook')`,
    ),
    check(
      "project_github_external_record_kind_check",
      sql`${table.kind} in ('Issue', 'Pull request')`,
    ),
    check(
      "project_github_external_record_state_check",
      sql`${table.sourceState} in ('open', 'closed', 'merged')`,
    ),
  ],
);

/**
 * Permanent delete tombstone: content-free (ids only). A later webhook,
 * reconcile or relink finding the same source never recreates the record;
 * only an explicit re-include mints a new product identity.
 */
export const githubExternalRecordTombstone = pgTable(
  "project_github_external_record_tombstone",
  {
    deletedAt: timestamp("deleted_at").notNull(),
    githubId: bigint("github_id", { mode: "number" }).notNull(),
    kind: text("kind").notNull(),
    linkId: text("link_id")
      .notNull()
      .references(() => githubRepositoryLink.id, { onDelete: "cascade" }),
    /** The source's issue or PR number: an id, not content; re-include reads it by number. */
    number: integer("number").notNull(),
    recordId: text("record_id").notNull(),
  },
  (table) => [
    primaryKey({
      columns: [table.linkId, table.kind, table.githubId],
      name: "project_github_external_record_tombstone_pk",
    }),
  ],
);

/** Visible connection history: pauses, stops, conflicts at one timestamp. */
export const githubLinkHistory = pgTable(
  "project_github_link_history",
  {
    at: timestamp("at").notNull(),
    detail: text("detail").notNull(),
    id: text("id").primaryKey(),
    kind: text("kind").notNull(),
    linkId: text("link_id")
      .notNull()
      .references(() => githubRepositoryLink.id, { onDelete: "cascade" }),
  },
  (table) => [
    index("project_github_link_history_link_idx").on(table.linkId, table.at),
  ],
);

/**
 * Webhook inbox: one row per GitHub delivery id, written only after the
 * signature verified. Kept 30 days as id, hash and result; the raw payload
 * lives in `github_webhook_payload` and is deleted by the retention sweep.
 */
export const githubWebhookDelivery = pgTable(
  "github_webhook_delivery",
  {
    attempts: integer("attempts").default(0).notNull(),
    deliveryId: text("delivery_id").primaryKey(),
    event: text("event").notNull(),
    installationId: bigint("installation_id", { mode: "number" }),
    lastError: text("last_error"),
    payloadHash: text("payload_hash").notNull(),
    processedAt: timestamp("processed_at"),
    receivedAt: timestamp("received_at").notNull(),
    result: text("result"),
    status: text("status").default("received").notNull(),
  },
  (table) => [
    index("github_webhook_delivery_received_idx").on(table.receivedAt),
    index("github_webhook_delivery_status_idx").on(table.status),
    check(
      "github_webhook_delivery_status_check",
      sql`${table.status} in ('received', 'processed', 'failed', 'dead-letter')`,
    ),
  ],
);

/** Envelope-encrypted raw payload; success <= 24 h, failed <= 7 days, then physically deleted. */
export const githubWebhookPayload = pgTable(
  "github_webhook_payload",
  {
    ciphertext: text("ciphertext").notNull(),
    deliveryId: text("delivery_id")
      .primaryKey()
      .references(() => githubWebhookDelivery.deliveryId, {
        onDelete: "cascade",
      }),
    expiresAt: timestamp("expires_at").notNull(),
    keyVersion: integer("key_version").notNull(),
    wrappedDataKey: text("wrapped_data_key").notNull(),
  },
  (table) => [index("github_webhook_payload_expires_idx").on(table.expiresAt)],
);

/** Envelope-encrypted webhook secrets; the previous one verifies for 15 minutes after rotation. */
export const githubWebhookSecret = pgTable("github_webhook_secret", {
  activatedAt: timestamp("activated_at").notNull(),
  ciphertext: text("ciphertext").notNull(),
  id: text("id").primaryKey(),
  keyVersion: integer("key_version").notNull(),
  retiredAt: timestamp("retired_at"),
  wrappedDataKey: text("wrapped_data_key").notNull(),
});
