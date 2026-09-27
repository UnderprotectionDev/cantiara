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
import { work } from "./work";

export const workNotNowTrail = pgTable(
  "work_not_now_trail",
  {
    clientIdempotencyKey: text("client_idempotency_key").notNull(),
    closedAt: timestamp("closed_at"),
    closedBy: text("closed_by"),
    closedByAccountId: text("closed_by_account_id").references(() => user.id, {
      onDelete: "cascade",
    }),
    closedByClientIdempotencyKey: text("closed_by_client_idempotency_key"),
    closedByPayloadFingerprint: text("closed_by_payload_fingerprint"),
    condition: text("condition"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    createdByAccountId: text("created_by_account_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    grounds: jsonb("grounds").$type<unknown[]>().default([]).notNull(),
    id: text("id").primaryKey(),
    payloadFingerprint: text("payload_fingerprint").notNull(),
    reason: text("reason").notNull(),
    revision: integer("revision").notNull(),
    status: text("status").default("Active").notNull(),
    workId: text("work_id")
      .notNull()
      .references(() => work.id, { onDelete: "cascade" }),
  },
  (table) => [
    index("work_not_now_trail_work_created_idx").on(
      table.workId,
      table.createdAt,
    ),
    uniqueIndex("work_not_now_trail_work_idempotency_uidx").on(
      table.workId,
      table.clientIdempotencyKey,
    ),
    uniqueIndex("work_not_now_trail_work_revision_uidx").on(
      table.workId,
      table.revision,
    ),
    uniqueIndex("work_not_now_trail_work_close_idempotency_uidx")
      .on(table.workId, table.closedByClientIdempotencyKey)
      .where(sql`${table.closedByClientIdempotencyKey} is not null`),
    uniqueIndex("work_not_now_trail_active_work_uidx")
      .on(table.workId)
      .where(sql`${table.status} = 'Active'`),
    check(
      "work_not_now_trail_status_check",
      sql`${table.status} in ('Active', 'Reconsidered', 'Replaced')`,
    ),
    check(
      "work_not_now_trail_close_state_check",
      sql`(
        ${table.status} = 'Active'
        and ${table.closedAt} is null
        and ${table.closedBy} is null
        and ${table.closedByAccountId} is null
        and ${table.closedByClientIdempotencyKey} is null
        and ${table.closedByPayloadFingerprint} is null
      ) or (
        ${table.status} in ('Reconsidered', 'Replaced')
        and ${table.closedAt} is not null
        and ${table.closedByAccountId} is not null
        and ${table.closedByClientIdempotencyKey} is not null
        and ${table.closedByPayloadFingerprint} is not null
        and (
          (${table.status} = 'Reconsidered' and ${table.closedBy} = 'Reconsidering')
          or (${table.status} = 'Replaced' and ${table.closedBy} = 'Replaced')
        )
      )`,
    ),
    check("work_not_now_trail_revision_check", sql`${table.revision} > 0`),
    check(
      "work_not_now_trail_reason_check",
      sql`length(btrim(${table.reason})) between 1 and 500`,
    ),
    check(
      "work_not_now_trail_condition_check",
      sql`${table.condition} is null or length(${table.condition}) <= 2000`,
    ),
    check(
      "work_not_now_trail_grounds_check",
      sql`jsonb_typeof(${table.grounds}) = 'array'`,
    ),
    check(
      "work_not_now_trail_payload_fingerprint_check",
      sql`${table.payloadFingerprint} ~ '^[0-9a-f]{64}$'`,
    ),
    check(
      "work_not_now_trail_close_fingerprint_check",
      sql`${table.closedByPayloadFingerprint} is null or ${table.closedByPayloadFingerprint} ~ '^[0-9a-f]{64}$'`,
    ),
  ],
);
