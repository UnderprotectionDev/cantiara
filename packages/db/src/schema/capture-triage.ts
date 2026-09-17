import { sql } from "drizzle-orm";
import {
  check,
  index,
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
