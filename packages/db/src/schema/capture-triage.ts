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

export const captureInboxItem = pgTable(
  "capture_inbox_item",
  {
    accountId: text("account_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    attachment: jsonb("attachment").$type<unknown>(),
    clientIdempotencyKey: text("client_idempotency_key"),
    content: text("content").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    fields: jsonb("fields").$type<Record<string, string>>().notNull(),
    id: text("id").primaryKey(),
    link: text("link"),
    origin: jsonb("origin").$type<unknown>(),
    payloadFingerprint: text("payload_fingerprint"),
    projectId: text("project_id"),
    template: text("template"),
  },
  (table) => [
    index("capture_inbox_item_account_project_created_idx").on(
      table.accountId,
      table.projectId,
      table.createdAt,
    ),
    uniqueIndex("capture_inbox_item_idempotency_uidx").on(
      table.accountId,
      table.clientIdempotencyKey,
    ),
    check(
      "capture_inbox_item_template_check",
      sql`${table.template} is null or ${table.template} in ('Bug Capture', 'Feedback Capture', 'Research Fragment')`,
    ),
  ],
);

export const captureInboxOperation = pgTable(
  "capture_inbox_operation",
  {
    accountId: text("account_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    fingerprint: text("fingerprint").notNull(),
    id: text("id").primaryKey(),
    kind: text("kind").notNull(),
    operationKey: text("operation_key").notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
    value: jsonb("value").$type<unknown>().notNull(),
  },
  (table) => [
    uniqueIndex("capture_inbox_operation_account_kind_key_uidx").on(
      table.accountId,
      table.kind,
      table.operationKey,
    ),
    check(
      "capture_inbox_operation_kind_check",
      sql`${table.kind} in ('preview', 'merge', 'completed')`,
    ),
  ],
);

export const captureInboxBulkView = pgTable(
  "capture_inbox_bulk_view",
  {
    accountId: text("account_id")
      .primaryKey()
      .references(() => user.id, { onDelete: "cascade" }),
    clusters: jsonb("clusters").$type<unknown>().notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    placements: jsonb("placements").$type<unknown>().notNull(),
    revision: integer("revision").default(0).notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [
    check(
      "capture_inbox_bulk_view_revision_check",
      sql`${table.revision} >= 0`,
    ),
  ],
);
