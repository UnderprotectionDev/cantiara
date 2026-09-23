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
import { work } from "./work";

export const workExternalExecutionHandoff = pgTable(
  "work_external_execution_handoff",
  {
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
      "work_external_handoff_payload_fingerprint_check",
      sql`${table.payloadFingerprint} ~ '^[0-9a-f]{64}$'`,
    ),
  ],
);
