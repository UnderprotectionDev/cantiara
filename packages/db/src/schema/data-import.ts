import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
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
