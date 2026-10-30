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

import { user } from "./auth";

/**
 * Standard Import staging (spec 80): the encrypted file of one write-free
 * preview, kept at most 24 hours. It is not a primary record: it has no
 * relation to any record, is never indexed for search and holds the file only
 * as ciphertext (`wrapped_data_key` is wrapped by the versioned import key).
 * `request` is the non-sensitive choice set (scope, type, mapping) a reopened
 * preview needs again; it never carries file bytes.
 */
export const dataImportStaging = pgTable(
  "data_import_staging",
  {
    accountId: text("account_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    /** Idempotency key of the `Apply Import` that claimed this file; null before. */
    applyingKey: text("applying_key"),
    byteSize: integer("byte_size").notNull(),
    ciphertext: text("ciphertext").notNull(),
    createdAt: timestamp("created_at").notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    id: text("id").primaryKey(),
    keyVersion: integer("key_version").notNull(),
    request: jsonb("request").$type<Record<string, unknown>>().notNull(),
    rowCount: integer("row_count").notNull(),
    wrappedDataKey: text("wrapped_data_key").notNull(),
  },
  (table) => [
    index("data_import_staging_expires_idx").on(table.expiresAt),
    index("data_import_staging_account_idx").on(table.accountId),
    check(
      "data_import_staging_window_check",
      sql`${table.expiresAt} <= ${table.createdAt} + interval '24 hours'`,
    ),
    check(
      "data_import_staging_size_check",
      sql`${table.byteSize} between 1 and 26214400`,
    ),
    check(
      "data_import_staging_rows_check",
      sql`${table.rowCount} between 0 and 10000`,
    ),
  ],
);

/**
 * The durable `Apply Import` receipt (read model of the Mutation Contract
 * receipt): a full commit or a full rollback, reopenable by its idempotency
 * key after a dropped connection. It carries counts and names, never file
 * bytes or record values.
 */
export const dataImportReceipt = pgTable(
  "data_import_receipt",
  {
    accountId: text("account_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    catalogType: text("catalog_type"),
    completedAt: timestamp("completed_at").notNull(),
    counts: jsonb("counts").$type<Record<string, number>>().notNull(),
    family: text("family").notNull(),
    fileName: text("file_name").notNull(),
    finalSetFingerprint: text("final_set_fingerprint").notNull(),
    id: text("id").primaryKey(),
    idempotencyKey: text("idempotency_key").notNull(),
    provenance: text("provenance"),
    reason: text("reason"),
    scopeLabel: text("scope_label").notNull(),
    status: text("status").notNull(),
    supportReference: text("support_reference"),
  },
  (table) => [
    uniqueIndex("data_import_receipt_key_uidx").on(
      table.accountId,
      table.idempotencyKey,
    ),
    check(
      "data_import_receipt_status_check",
      sql`${table.status} in ('committed', 'rolled-back')`,
    ),
  ],
);

/**
 * Import origins kept by `Apply Import`: provider/file scope plus the source's
 * origin key, next to the product record it created. It is provenance, never
 * authority to resurrect a product id; the later no-identity-resurrection
 * ticket reads it to match living, deleted and retired ids. Not unique on
 * purpose: a repeated source keeps every earlier origin.
 */
export const dataImportOrigin = pgTable(
  "data_import_origin",
  {
    accountId: text("account_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").notNull(),
    id: text("id").primaryKey(),
    originKey: text("origin_key").notNull(),
    provenance: text("provenance").notNull(),
    receiptKey: text("receipt_key").notNull(),
    recordId: text("record_id").notNull(),
    recordType: text("record_type").notNull(),
    scopeId: text("scope_id").notNull(),
    scopeKind: text("scope_kind").notNull(),
  },
  (table) => [
    index("data_import_origin_match_idx").on(
      table.accountId,
      table.scopeKind,
      table.scopeId,
      table.recordType,
      table.provenance,
      table.originKey,
    ),
    index("data_import_origin_record_idx").on(table.recordId),
    check(
      "data_import_origin_scope_check",
      sql`${table.scopeKind} in ('project', 'wiki', 'workspace')`,
    ),
  ],
);
