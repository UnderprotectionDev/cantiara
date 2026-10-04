import { sql } from "drizzle-orm";
import {
  check,
  index,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

import { user } from "./auth";

export const personalReminder = pgTable(
  "personal_reminder",
  {
    accountId: text("account_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    action: text("action").notNull(),
    cancelledAt: timestamp("cancelled_at"),
    clientIdempotencyKey: text("client_idempotency_key"),
    condition: text("condition").default("In any case").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    fireAt: timestamp("fire_at").notNull(),
    fireNote: text("fire_note"),
    id: text("id").primaryKey(),
    sectionId: text("section_id"),
    sourceProjectId: text("source_project_id"),
    sourceRecordId: text("source_record_id").notNull(),
    sourceRecordType: text("source_record_type").notNull(),
    status: text("status").default("Planned").notNull(),
    triggeredAt: timestamp("triggered_at"),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [
    index("personal_reminder_account_source_idx").on(
      table.accountId,
      table.sourceRecordType,
      table.sourceRecordId,
      table.status,
    ),
    index("personal_reminder_account_fire_idx").on(
      table.accountId,
      table.status,
      table.fireAt,
    ),
    uniqueIndex("personal_reminder_account_idempotency_uidx")
      .on(table.accountId, table.clientIdempotencyKey)
      .where(sql`${table.clientIdempotencyKey} is not null`),
    check(
      "personal_reminder_action_check",
      sql`${table.action} in ('Remind me', 'Review Later')`,
    ),
    check(
      "personal_reminder_condition_check",
      sql`${table.condition} in ('In any case', 'Only if still open')`,
    ),
    check(
      "personal_reminder_source_type_check",
      sql`${table.sourceRecordType} in ('Project', 'Document', 'Work', 'Decision', 'Risk', 'Milestone', 'Project Release', 'Production Incident')`,
    ),
    check(
      "personal_reminder_section_check",
      sql`${table.sectionId} is null or (${table.action} = 'Review Later' and ${table.sourceRecordType} = 'Document')`,
    ),
    check(
      "personal_reminder_status_check",
      sql`(
        (${table.status} = 'Planned' and ${table.cancelledAt} is null and ${table.triggeredAt} is null)
        or (${table.status} = 'Triggered' and ${table.cancelledAt} is null and ${table.triggeredAt} is not null)
        or (${table.status} = 'Cancelled' and ${table.cancelledAt} is not null and ${table.triggeredAt} is null)
      )`,
    ),
    check(
      "personal_reminder_source_id_check",
      sql`length(btrim(${table.sourceRecordId})) between 1 and 255`,
    ),
  ],
);

export const personalReminderAttentionSignal = pgTable(
  "personal_reminder_attention_signal",
  {
    evaluationNote: text("evaluation_note"),
    occurredAt: timestamp("occurred_at").notNull(),
    ownerAccountId: text("owner_account_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    personalReminderId: text("personal_reminder_id")
      .notNull()
      .references(() => personalReminder.id, { onDelete: "cascade" }),
    signalId: text("signal_id").primaryKey(),
    signalType: text("signal_type").notNull(),
    sourcePath: text("source_path").notNull(),
    sourceProjectId: text("source_project_id"),
    sourceRecordId: text("source_record_id").notNull(),
    sourceRecordType: text("source_record_type").notNull(),
  },
  (table) => [
    uniqueIndex("personal_reminder_attention_signal_reminder_uidx").on(
      table.personalReminderId,
    ),
    index("personal_reminder_attention_signal_owner_idx").on(
      table.ownerAccountId,
      table.occurredAt,
    ),
    check(
      "personal_reminder_attention_signal_type_check",
      sql`${table.signalType} in ('personal-reminder', 'review-later')`,
    ),
  ],
);
