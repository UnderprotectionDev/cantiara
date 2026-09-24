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
import { mutationHistory } from "./mutation";
import { work } from "./work";

export const workExternalExecutionHandoff = pgTable(
  "work_external_execution_handoff",
  {
    cancellationReason: text("cancellation_reason"),
    clientIdempotencyKey: text("client_idempotency_key").notNull(),
    constraints: text("constraints").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    createdByAccountId: text("created_by_account_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    executor: text("executor").notNull(),
    expectedOutput: text("expected_output").notNull(),
    handoffId: text("handoff_id").primaryKey(),
    packageMarkdown: text("package_markdown").notNull(),
    packageProducedAt: timestamp("package_produced_at").notNull(),
    payloadFingerprint: text("payload_fingerprint").notNull(),
    purpose: text("purpose").notNull(),
    reconcileDecision: jsonb("reconcile_decision").$type<unknown>(),
    result: jsonb("result").$type<unknown>(),
    selectedVersions: jsonb("selected_versions")
      .$type<{
        githubContext: string[];
        work: { recordId: string; recordType: "Work"; revision: number } | null;
      }>()
      .notNull(),
    status: text("status").default("Open").notNull(),
    workId: text("work_id")
      .notNull()
      .references(() => work.id, { onDelete: "cascade" }),
  },
  (table) => [
    index("work_external_handoff_work_created_idx").on(
      table.workId,
      table.createdAt,
    ),
    uniqueIndex("work_external_handoff_work_idempotency_uidx").on(
      table.workId,
      table.clientIdempotencyKey,
    ),
    check(
      "work_external_handoff_status_check",
      sql`${table.status} in ('Open', 'Result returned', 'Reconciled', 'Canceled')`,
    ),
    check(
      "work_external_handoff_cancellation_reason_check",
      sql`(${table.status} = 'Canceled' and ${table.cancellationReason} is not null and length(btrim(${table.cancellationReason})) > 0) or (${table.status} <> 'Canceled' and ${table.cancellationReason} is null)`,
    ),
    check(
      "work_external_handoff_payload_fingerprint_check",
      sql`${table.payloadFingerprint} ~ '^[0-9a-f]{64}$'`,
    ),
  ],
);

export const workExternalExecutionHandoffAttentionSignal = pgTable(
  "work_external_execution_handoff_attention_signal",
  {
    closedAt: timestamp("closed_at"),
    handoffId: text("handoff_id")
      .notNull()
      .references(() => workExternalExecutionHandoff.handoffId, {
        onDelete: "cascade",
      }),
    occurredAt: timestamp("occurred_at").notNull(),
    signalId: text("signal_id").primaryKey(),
    signalType: text("signal_type").notNull(),
    sourceEventId: text("source_event_id")
      .notNull()
      .references(() => mutationHistory.id, { onDelete: "cascade" }),
    sourceWorkId: text("source_work_id")
      .notNull()
      .references(() => work.id, { onDelete: "cascade" }),
  },
  (table) => [
    uniqueIndex("work_external_handoff_attention_signal_handoff_uidx").on(
      table.handoffId,
    ),
    index("work_external_handoff_attention_signal_work_idx").on(
      table.sourceWorkId,
    ),
    check(
      "work_external_handoff_attention_signal_type_check",
      sql`${table.signalType} = 'external-run-returned'`,
    ),
    check(
      "work_external_handoff_attention_signal_id_check",
      sql`${table.signalId} = 'external-run-returned:' || ${table.handoffId}`,
    ),
  ],
);
