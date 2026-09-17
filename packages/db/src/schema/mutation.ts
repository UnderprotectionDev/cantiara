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

export const mutationTarget = pgTable("mutation_target", {
  id: text("id").primaryKey(),
  revision: integer("revision").default(0).notNull(),
  value: jsonb("value").$type<unknown>().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => /* @__PURE__ */ new Date())
    .notNull(),
});

export const mutationStaging = pgTable(
  "mutation_staging",
  {
    id: text("id").primaryKey(),
    targetId: text("target_id").notNull(),
    idempotencyScope: text("idempotency_scope").notNull(),
    idempotencyKey: text("idempotency_key").notNull(),
    payload: jsonb("payload").$type<unknown>(),
    payloadFingerprint: text("payload_fingerprint").notNull(),
    actorType: text("actor_type").notNull(),
    actorId: text("actor_id").notNull(),
    authorizingUserId: text("authorizing_user_id"),
    originKind: text("origin_kind").notNull(),
    clientIdempotencyKey: text("client_idempotency_key"),
    sourceId: text("source_id"),
    deliveryId: text("delivery_id"),
    expectedRevision: integer("expected_revision").notNull(),
    receiptId: text("receipt_id").notNull(),
    historyId: text("history_id").notNull(),
    status: text("status").default("staged").notNull(),
    rollbackReason: text("rollback_reason"),
    rollbackCurrentRevision: integer("rollback_current_revision"),
    rollbackCurrentValue: jsonb("rollback_current_value").$type<unknown>(),
    undo: jsonb("undo").$type<unknown>(),
    undoOf: text("undo_of"),
    stagedAt: timestamp("staged_at").notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    completedAt: timestamp("completed_at"),
  },
  (table) => [
    uniqueIndex("mutation_staging_idempotency_uidx").on(
      table.idempotencyScope,
      table.idempotencyKey,
    ),
    index("mutation_staging_expiry_idx").on(table.status, table.expiresAt),
    check(
      "mutation_staging_actor_type_check",
      sql`${table.actorType} in ('User', 'System automation', 'GitHub', 'Authorized integration')`,
    ),
    check(
      "mutation_staging_origin_kind_check",
      sql`${table.originKind} in ('human', 'source')`,
    ),
    check(
      "mutation_staging_status_check",
      sql`${table.status} in ('staged', 'finalizing', 'committed', 'rolled-back')`,
    ),
    check(
      "mutation_staging_rollback_reason_check",
      sql`${table.rollbackReason} is null or ${table.rollbackReason} in ('cancelled', 'expired', 'stale-base-revision', 'target-not-found', 'authorization', 'scope', 'quota', 'apply-failed')`,
    ),
  ],
);

export const mutationReceipt = pgTable(
  "mutation_receipt",
  {
    id: text("id").primaryKey(),
    targetId: text("target_id").notNull(),
    idempotencyScope: text("idempotency_scope").notNull(),
    idempotencyKey: text("idempotency_key").notNull(),
    payloadFingerprint: text("payload_fingerprint").notNull(),
    actorType: text("actor_type").notNull(),
    actorId: text("actor_id").notNull(),
    authorizingUserId: text("authorizing_user_id"),
    originKind: text("origin_kind").notNull(),
    clientIdempotencyKey: text("client_idempotency_key"),
    sourceId: text("source_id"),
    deliveryId: text("delivery_id"),
    expectedRevision: integer("expected_revision").notNull(),
    revision: integer("revision").notNull(),
    previousValue: jsonb("previous_value").$type<unknown>().notNull(),
    nextValue: jsonb("next_value").$type<unknown>().notNull(),
    undo: jsonb("undo").$type<unknown>(),
    undoOf: text("undo_of"),
    committedAt: timestamp("committed_at").notNull(),
  },
  (table) => [
    uniqueIndex("mutation_receipt_idempotency_uidx").on(
      table.idempotencyScope,
      table.idempotencyKey,
    ),
    index("mutation_receipt_target_idx").on(table.targetId),
    check(
      "mutation_receipt_actor_type_check",
      sql`${table.actorType} in ('User', 'System automation', 'GitHub', 'Authorized integration')`,
    ),
    check(
      "mutation_receipt_origin_kind_check",
      sql`${table.originKind} in ('human', 'source')`,
    ),
  ],
);

export const mutationHistory = pgTable(
  "mutation_history",
  {
    id: text("id").primaryKey(),
    targetId: text("target_id").notNull(),
    revision: integer("revision").notNull(),
    actorType: text("actor_type").notNull(),
    actorId: text("actor_id").notNull(),
    authorizingUserId: text("authorizing_user_id"),
    originKind: text("origin_kind").notNull(),
    clientIdempotencyKey: text("client_idempotency_key"),
    sourceId: text("source_id"),
    deliveryId: text("delivery_id"),
    payloadFingerprint: text("payload_fingerprint").notNull(),
    previousValue: jsonb("previous_value").$type<unknown>().notNull(),
    nextValue: jsonb("next_value").$type<unknown>().notNull(),
    undo: jsonb("undo").$type<unknown>(),
    undoOf: text("undo_of"),
    occurredAt: timestamp("occurred_at").notNull(),
  },
  (table) => [
    index("mutation_history_target_revision_idx").on(
      table.targetId,
      table.revision,
    ),
    check(
      "mutation_history_actor_type_check",
      sql`${table.actorType} in ('User', 'System automation', 'GitHub', 'Authorized integration')`,
    ),
    check(
      "mutation_history_origin_kind_check",
      sql`${table.originKind} in ('human', 'source')`,
    ),
  ],
);
