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

/**
 * Notification Center signal (Hesap-owned). The source ids are origin
 * references, not a second truth: there is no foreign key to a source record,
 * so a deleted source leaves the signal readable as a tombstone. Read and
 * closed marks live here and never write the source record.
 */
export const attentionSignal = pgTable(
  "attention_signal",
  {
    accountId: text("account_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    closedAt: timestamp("closed_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    eventId: text("event_id").notNull(),
    groupId: text("group_id").notNull(),
    groupKind: text("group_kind").notNull(),
    id: text("id").primaryKey(),
    occurredAt: timestamp("occurred_at").notNull(),
    projectId: text("project_id"),
    readAt: timestamp("read_at"),
    reason: text("reason").notNull(),
    signalId: text("signal_id").notNull(),
    targetId: text("target_id").notNull(),
  },
  (table) => [
    uniqueIndex("attention_signal_identity_uidx").on(
      table.accountId,
      table.signalId,
      table.eventId,
      table.targetId,
    ),
    index("attention_signal_account_group_idx").on(
      table.accountId,
      table.groupKind,
      table.groupId,
    ),
    check(
      "attention_signal_signal_id_check",
      sql`${table.signalId} in ('due-date', 'reappear-date', 'personal-reminder', 'review-later', 'open-risk', 'work-blocked', 'source-version-in-use', 'external-run-returned', 'release-observation-missing', 'github-check-failed', 'work-pr-status-conflict', 'unlinked-open-pr', 'published-release-open-scope', 'automation-failed', 'public-roadmap-review-due', 'unreviewed-test-report', 'test-result-conflict', 'handoff-result-after-cancel', 'smart-collection-entry', 'github-activity')`,
    ),
  ],
);
