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
