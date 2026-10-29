import { sql } from "drizzle-orm";
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
import { project } from "./project";

/**
 * Trash entry (spec 77): one supported primary record waiting out its 30-day
 * recoverable window. The record keeps its own row, internal id and ownership
 * scope; this row is the lifecycle fact, so `record_id` has no foreign key
 * (the record type varies) and a restore or purge ticket removes or closes
 * the entry without touching the record's identity. `expires_at` is exactly
 * 720 hours after `trashed_at`: a product clock, not a calendar month.
 * `group_id` stays null until a Project delete group shares one clock.
 */
export const trashEntry = pgTable(
  "trash_entry",
  {
    actorAccountId: text("actor_account_id").notNull(),
    baseRevision: integer("base_revision").notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    groupId: text("group_id"),
    id: text("id").primaryKey(),
    idempotencyKey: text("idempotency_key").notNull(),
    idempotencyScope: text("idempotency_scope").notNull(),
    payloadFingerprint: text("payload_fingerprint").notNull(),
    projectId: text("project_id")
      .notNull()
      .references(() => project.id, { onDelete: "cascade" }),
    recordId: text("record_id").notNull(),
    recordKind: text("record_kind").notNull(),
    recordLabel: text("record_label").notNull(),
    trashedAt: timestamp("trashed_at").notNull(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspace.id, { onDelete: "cascade" }),
  },
  (table) => [
    // A record is in Trash at most once; its identity is the pair, not a copy.
    uniqueIndex("trash_entry_record_uidx").on(
      table.projectId,
      table.recordKind,
      table.recordId,
    ),
    // The same key replays the same result instead of a second entry.
    uniqueIndex("trash_entry_idempotency_uidx").on(
      table.idempotencyScope,
      table.idempotencyKey,
    ),
    index("trash_entry_project_expires_idx").on(
      table.projectId,
      table.expiresAt,
    ),
    index("trash_entry_group_idx").on(table.groupId),
    check(
      "trash_entry_record_kind_check",
      sql`${table.recordKind} in ('Work', 'Document', 'Decision', 'Risk', 'Screen', 'External Surface', 'Custom Field', 'Smart Collection', 'Automation Rule', 'Work Template', 'Document Template', 'Record Action', 'Prioritization Session')`,
    ),
    check(
      "trash_entry_retention_check",
      sql`${table.expiresAt} = ${table.trashedAt} + interval '720 hours'`,
    ),
    check("trash_entry_base_revision_check", sql`${table.baseRevision} >= 0`),
    check(
      "trash_entry_label_check",
      sql`length(${table.recordLabel}) between 1 and 255`,
    ),
  ],
);

/**
 * Restore receipt (spec 77): the idempotent answer of one restore. A restore
 * closes the `trash_entry` (the record keeps its own row and id), so the key
 * lives here and the same key replays the same result instead of a second
 * restore. Content-free: kinds, ids and revisions only.
 */
export const trashRestoreReceipt = pgTable(
  "trash_restore_receipt",
  {
    idempotencyKey: text("idempotency_key").notNull(),
    idempotencyScope: text("idempotency_scope").notNull(),
    payloadFingerprint: text("payload_fingerprint").notNull(),
    projectId: text("project_id")
      .notNull()
      .references(() => project.id, { onDelete: "cascade" }),
    restoredAt: timestamp("restored_at").notNull(),
    result: jsonb("result").notNull(),
  },
  (table) => [
    uniqueIndex("trash_restore_receipt_idempotency_uidx").on(
      table.idempotencyScope,
      table.idempotencyKey,
    ),
    index("trash_restore_receipt_project_idx").on(table.projectId),
  ],
);
