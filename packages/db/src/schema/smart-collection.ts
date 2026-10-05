import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
} from "drizzle-orm/pg-core";

import { user } from "./auth";
import { project } from "./project";

export const smartCollection = pgTable(
  "smart_collection",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => project.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    sourceType: text("source_type").notNull().default("Work"),
    scope: jsonb("scope")
      .$type<{ projectIds: string[] }>()
      .notNull()
      .default({ projectIds: [] }),
    conditions: jsonb("conditions")
      .$type<{
        status?: string;
        type?: string;
        documentType?: string;
        tag?: string;
      }>()
      .notNull()
      .default({}),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    index("smart_collection_project_idx").on(table.projectId),
    check(
      "smart_collection_name_check",
      sql`length(btrim(${table.name})) between 1 and 255`,
    ),
    check(
      "smart_collection_source_type_check",
      sql`${table.sourceType} in ('Work', 'Document', 'Wiki Document', 'Decision', 'Risk', 'Assumption', 'Open Question', 'Milestone', 'Project Release', 'Production Incident')`,
    ),
  ],
);

export const smartCollectionView = pgTable(
  "smart_collection_view",
  {
    id: text("id").primaryKey(),
    collectionId: text("collection_id")
      .notNull()
      .references(() => smartCollection.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    presentation: text("presentation").notNull().default("List"),
    purpose: text("purpose"),
  },
  (table) => [
    unique("smart_collection_view_name_unique").on(
      table.collectionId,
      table.name,
    ),
    check(
      "smart_collection_view_name_check",
      sql`length(btrim(${table.name})) between 1 and 255`,
    ),
    check(
      "smart_collection_view_presentation_check",
      sql`${table.presentation} in ('List', 'Table')`,
    ),
  ],
);

export const smartCollectionSubscription = pgTable(
  "smart_collection_subscription",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    collectionId: text("collection_id")
      .notNull()
      .references(() => smartCollection.id, { onDelete: "cascade" }),
    notifyOnLeave: boolean("notify_on_leave").notNull().default(false),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("smart_collection_subscription_collection_uidx").on(
      table.collectionId,
    ),
  ],
);

export const smartCollectionSubscriptionMembership = pgTable(
  "smart_collection_subscription_membership",
  {
    subscriptionId: text("subscription_id")
      .notNull()
      .references(() => smartCollectionSubscription.id, {
        onDelete: "cascade",
      }),
    sourceRecordType: text("source_record_type").notNull(),
    sourceRecordId: text("source_record_id").notNull(),
    sourceProjectId: text("source_project_id"),
    sourceRecordTitle: text("source_record_title").notNull(),
    sourcePath: text("source_path").notNull(),
    membershipReasons: jsonb("membership_reasons")
      .$type<string[]>()
      .notNull()
      .default([]),
    membershipPeriod: integer("membership_period").notNull().default(1),
    isMember: boolean("is_member").notNull().default(true),
    enteredAt: timestamp("entered_at").notNull(),
    leftAt: timestamp("left_at"),
  },
  (table) => [
    uniqueIndex("smart_collection_subscription_membership_record_uidx").on(
      table.subscriptionId,
      table.sourceRecordType,
      table.sourceRecordId,
    ),
    index("smart_collection_subscription_membership_active_idx").on(
      table.subscriptionId,
      table.isMember,
    ),
    check(
      "smart_collection_subscription_membership_period_check",
      sql`${table.membershipPeriod} >= 1`,
    ),
    check(
      "smart_collection_subscription_membership_state_check",
      sql`(${table.isMember} = true and ${table.leftAt} is null) or (${table.isMember} = false and ${table.leftAt} is not null)`,
    ),
    check(
      "smart_collection_subscription_membership_source_type_check",
      sql`${table.sourceRecordType} in ('Work', 'Document', 'Wiki Document', 'Decision', 'Risk', 'Assumption', 'Open Question', 'Milestone', 'Project Release', 'Production Incident')`,
    ),
    check(
      "smart_collection_subscription_membership_reasons_check",
      sql`jsonb_typeof(${table.membershipReasons}) = 'array'`,
    ),
  ],
);

export const smartCollectionAttentionSignal = pgTable(
  "smart_collection_attention_signal",
  {
    signalId: text("signal_id").primaryKey(),
    subscriptionId: text("subscription_id").notNull(),
    collectionId: text("collection_id")
      .notNull()
      .references(() => smartCollection.id, { onDelete: "cascade" }),
    ownerAccountId: text("owner_account_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    eventType: text("event_type").notNull(),
    signalType: text("signal_type").notNull().default("smart-collection-entry"),
    presentation: text("presentation").notNull().default("Information Flow"),
    membershipPeriod: integer("membership_period").notNull(),
    sourceRecordType: text("source_record_type").notNull(),
    sourceRecordId: text("source_record_id").notNull(),
    sourceProjectId: text("source_project_id"),
    sourceRecordName: text("source_record_name").notNull(),
    sourcePath: text("source_path").notNull(),
    reason: text("reason").notNull(),
    occurredAt: timestamp("occurred_at").notNull(),
  },
  (table) => [
    uniqueIndex("smart_collection_attention_signal_period_event_uidx").on(
      table.subscriptionId,
      table.sourceRecordType,
      table.sourceRecordId,
      table.membershipPeriod,
      table.eventType,
    ),
    index("smart_collection_attention_signal_owner_idx").on(
      table.ownerAccountId,
      table.occurredAt,
    ),
    index("smart_collection_attention_signal_collection_idx").on(
      table.collectionId,
      table.occurredAt,
    ),
    check(
      "smart_collection_attention_signal_type_check",
      sql`${table.signalType} = 'smart-collection-entry'`,
    ),
    check(
      "smart_collection_attention_signal_presentation_check",
      sql`${table.presentation} = 'Information Flow'`,
    ),
    check(
      "smart_collection_attention_signal_event_check",
      sql`${table.eventType} in ('entry', 'leave')`,
    ),
    check(
      "smart_collection_attention_signal_period_check",
      sql`${table.membershipPeriod} >= 1`,
    ),
    check(
      "smart_collection_attention_signal_source_type_check",
      sql`${table.sourceRecordType} in ('Work', 'Document', 'Wiki Document', 'Decision', 'Risk', 'Assumption', 'Open Question', 'Milestone', 'Project Release', 'Production Incident')`,
    ),
  ],
);
