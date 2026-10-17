import { sql } from "drizzle-orm";
import {
  check,
  foreignKey,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
} from "drizzle-orm/pg-core";

import { workspace } from "./auth";
import { document } from "./document";
import { feedback } from "./feedback";

export const workspaceCompany = pgTable(
  "workspace_company",
  {
    archivedAt: timestamp("archived_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    revision: integer("revision").default(0).notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspace.id, { onDelete: "cascade" }),
  },
  (table) => [
    index("workspace_company_workspace_idx").on(table.workspaceId),
    unique("workspace_company_id_workspace_unique").on(
      table.id,
      table.workspaceId,
    ),
    check(
      "workspace_company_name_check",
      sql`length(btrim(${table.name})) between 1 and 255`,
    ),
    check("workspace_company_revision_check", sql`${table.revision} >= 0`),
  ],
);

export const workspaceContact = pgTable(
  "workspace_contact",
  {
    archivedAt: timestamp("archived_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    displayName: text("display_name"),
    id: text("id").primaryKey(),
    revision: integer("revision").default(0).notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspace.id, { onDelete: "cascade" }),
  },
  (table) => [
    index("workspace_contact_workspace_idx").on(table.workspaceId),
    unique("workspace_contact_id_workspace_unique").on(
      table.id,
      table.workspaceId,
    ),
    check(
      "workspace_contact_display_name_check",
      sql`${table.displayName} is null or length(btrim(${table.displayName})) between 1 and 255`,
    ),
    check("workspace_contact_revision_check", sql`${table.revision} >= 0`),
  ],
);

/**
 * Normalized email aliases. Two Contacts may share one alias on purpose: the
 * shared value is the strong copy candidate, not a uniqueness violation.
 */
export const workspaceContactEmail = pgTable(
  "workspace_contact_email",
  {
    contactId: text("contact_id").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    id: text("id").primaryKey(),
    normalizedEmail: text("normalized_email").notNull(),
    workspaceId: text("workspace_id").notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.contactId, table.workspaceId],
      foreignColumns: [workspaceContact.id, workspaceContact.workspaceId],
      name: "workspace_contact_email_contact_fk",
    }).onDelete("cascade"),
    uniqueIndex("workspace_contact_email_contact_alias_uidx").on(
      table.contactId,
      table.normalizedEmail,
    ),
    index("workspace_contact_email_workspace_alias_idx").on(
      table.workspaceId,
      table.normalizedEmail,
    ),
    check(
      "workspace_contact_email_normalized_check",
      sql`${table.normalizedEmail} = lower(btrim(${table.normalizedEmail})) and length(${table.normalizedEmail}) between 3 and 320`,
    ),
  ],
);

/**
 * `Belongs to Company` history. The row without `ended_at` is the single
 * current affiliation; changing it closes that row and keeps it.
 */
export const workspaceContactCompanyAffiliation = pgTable(
  "workspace_contact_company_affiliation",
  {
    companyId: text("company_id").notNull(),
    contactId: text("contact_id").notNull(),
    endedAt: timestamp("ended_at"),
    id: text("id").primaryKey(),
    startedAt: timestamp("started_at").defaultNow().notNull(),
    workspaceId: text("workspace_id").notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.contactId, table.workspaceId],
      foreignColumns: [workspaceContact.id, workspaceContact.workspaceId],
      name: "workspace_contact_affiliation_contact_fk",
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.companyId, table.workspaceId],
      foreignColumns: [workspaceCompany.id, workspaceCompany.workspaceId],
      name: "workspace_contact_affiliation_company_fk",
    }).onDelete("cascade"),
    index("workspace_contact_affiliation_company_idx").on(table.companyId),
    uniqueIndex("workspace_contact_affiliation_current_uidx")
      .on(table.contactId)
      .where(sql`${table.endedAt} is null`),
    check(
      "workspace_contact_affiliation_period_check",
      sql`${table.endedAt} is null or ${table.endedAt} >= ${table.startedAt}`,
    ),
  ],
);

/** Explicit Contact–Persona Document relation; never written automatically. */
export const workspaceContactPersona = pgTable(
  "workspace_contact_persona",
  {
    contactId: text("contact_id").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    documentId: text("document_id")
      .notNull()
      .references(() => document.id, { onDelete: "cascade" }),
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id").notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.contactId, table.workspaceId],
      foreignColumns: [workspaceContact.id, workspaceContact.workspaceId],
      name: "workspace_contact_persona_contact_fk",
    }).onDelete("cascade"),
    uniqueIndex("workspace_contact_persona_contact_document_uidx").on(
      table.contactId,
      table.documentId,
    ),
    index("workspace_contact_persona_document_idx").on(table.documentId),
  ],
);

/**
 * Contact–Feedback link. Feedback capture (47) decides how links are
 * created; merge only moves them onto the survivor.
 */
export const workspaceContactFeedback = pgTable(
  "workspace_contact_feedback",
  {
    contactId: text("contact_id").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    feedbackId: text("feedback_id")
      .notNull()
      .references(() => feedback.id, { onDelete: "cascade" }),
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id").notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.contactId, table.workspaceId],
      foreignColumns: [workspaceContact.id, workspaceContact.workspaceId],
      name: "workspace_contact_feedback_contact_fk",
    }).onDelete("cascade"),
    uniqueIndex("workspace_contact_feedback_contact_feedback_uidx").on(
      table.contactId,
      table.feedbackId,
    ),
    index("workspace_contact_feedback_feedback_idx").on(table.feedbackId),
  ],
);

/**
 * A merged Contact no longer remains a live row. Its immutable id stays here
 * as a contentless redirect to the survivor: no name, email or Company. It is
 * not a Contact, so it is never listed, searched or reused as a new key.
 */
export const workspaceContactRetiredIdentity = pgTable(
  "workspace_contact_retired_identity",
  {
    id: text("id").primaryKey(),
    mergeId: text("merge_id").notNull(),
    retiredAt: timestamp("retired_at").defaultNow().notNull(),
    survivingContactId: text("surviving_contact_id").notNull(),
    workspaceId: text("workspace_id").notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.survivingContactId, table.workspaceId],
      foreignColumns: [workspaceContact.id, workspaceContact.workspaceId],
      name: "workspace_contact_retired_survivor_fk",
    }).onDelete("cascade"),
    index("workspace_contact_retired_survivor_idx").on(
      table.survivingContactId,
    ),
  ],
);

/**
 * Denetim kaydı for identity changes. It holds opaque Contact ids and the
 * actor account id only, never an email address or a display name.
 */
export const workspaceContactAuditEvent = pgTable(
  "workspace_contact_audit_event",
  {
    actorAccountId: text("actor_account_id").notNull(),
    eventType: text("event_type").notNull(),
    id: text("id").primaryKey(),
    mergeId: text("merge_id").notNull(),
    occurredAt: timestamp("occurred_at").defaultNow().notNull(),
    retiredContactId: text("retired_contact_id").notNull(),
    survivingContactId: text("surviving_contact_id").notNull(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspace.id, { onDelete: "cascade" }),
  },
  (table) => [
    index("workspace_contact_audit_workspace_idx").on(
      table.workspaceId,
      table.occurredAt,
    ),
    check(
      "workspace_contact_audit_event_type_check",
      sql`${table.eventType} in ('contact.merged')`,
    ),
  ],
);
