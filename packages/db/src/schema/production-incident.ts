import { relations, sql } from "drizzle-orm";
import {
  check,
  foreignKey,
  index,
  integer,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

import { decision } from "./decision";
import { githubExternalRecord } from "./github-integration";
import { project } from "./project";
import { projectRelease } from "./project-release";
import { risk } from "./risk";
import { work } from "./work";

export const productionIncident = pgTable(
  "production_incident",
  {
    createdAt: timestamp("created_at").defaultNow().notNull(),
    detectedHow: text("detected_how"),
    id: text("id").primaryKey(),
    impact: text("impact"),
    learning: text("learning"),
    occurredAt: timestamp("occurred_at").notNull(),
    projectId: text("project_id")
      .notNull()
      .references(() => project.id, { onDelete: "cascade" }),
    resolution: text("resolution"),
    revision: integer("revision").default(0).notNull(),
    rootCause: text("root_cause"),
    status: text("status").default("Open").notNull(),
    title: text("title").notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [
    index("production_incident_project_status_occurred_at_idx").on(
      table.projectId,
      table.status,
      table.occurredAt,
    ),
    check(
      "production_incident_status_check",
      sql`${table.status} in ('Open', 'Watching', 'Resolved')`,
    ),
    check("production_incident_revision_check", sql`${table.revision} >= 0`),
    check(
      "production_incident_title_check",
      sql`length(btrim(${table.title})) between 1 and 255`,
    ),
  ],
);

export const productionIncidentRelations = relations(
  productionIncident,
  ({ one }) => ({
    project: one(project, {
      fields: [productionIncident.projectId],
      references: [project.id],
    }),
  }),
);

/**
 * Production Incident link: the source-linked context the founder binds to one
 * incident. Exactly one target column matches `target_type`; the composite
 * `(project_id, ...)` keys keep a Bug and a Decision in the incident's
 * Project, and the adapter checks the same for the keys that have no composite
 * form yet (the incident itself, GitHub PR, Project Release, Risk): adding a
 * unique key to an existing table is a contract migration. Removal keeps the row with
 * `removed_at`. A link never writes the status or lifecycle of its target, and
 * `work_relation` cannot hold it because that table is Work-sourced.
 */
export const productionIncidentLink = pgTable(
  "production_incident_link",
  {
    createdAt: timestamp("created_at").defaultNow().notNull(),
    decisionId: text("decision_id"),
    githubRecordId: text("github_record_id").references(
      () => githubExternalRecord.id,
      { onDelete: "cascade" },
    ),
    id: text("id").primaryKey(),
    incidentId: text("incident_id")
      .notNull()
      .references(() => productionIncident.id, { onDelete: "cascade" }),
    projectId: text("project_id")
      .notNull()
      .references(() => project.id, { onDelete: "cascade" }),
    releaseId: text("release_id").references(() => projectRelease.id, {
      onDelete: "cascade",
    }),
    removedAt: timestamp("removed_at"),
    revision: integer("revision").default(0).notNull(),
    riskId: text("risk_id").references(() => risk.id, {
      onDelete: "cascade",
    }),
    targetType: text("target_type").notNull(),
    workId: text("work_id"),
  },
  (table) => [
    foreignKey({
      columns: [table.projectId, table.workId],
      foreignColumns: [work.projectId, work.id],
      name: "production_incident_link_work_fk",
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.projectId, table.decisionId],
      foreignColumns: [decision.projectId, decision.id],
      name: "production_incident_link_decision_fk",
    }).onDelete("cascade"),
    index("production_incident_link_incident_idx").on(
      table.projectId,
      table.incidentId,
    ),
    check(
      "production_incident_link_target_type_check",
      sql`${table.targetType} in ('Bug', 'GitHub PR', 'Project Release', 'Risk', 'Decision')`,
    ),
    check(
      "production_incident_link_target_check",
      sql`(${table.targetType} = 'Bug' and ${table.workId} is not null and ${table.githubRecordId} is null and ${table.releaseId} is null and ${table.riskId} is null and ${table.decisionId} is null) or (${table.targetType} = 'GitHub PR' and ${table.githubRecordId} is not null and ${table.workId} is null and ${table.releaseId} is null and ${table.riskId} is null and ${table.decisionId} is null) or (${table.targetType} = 'Project Release' and ${table.releaseId} is not null and ${table.workId} is null and ${table.githubRecordId} is null and ${table.riskId} is null and ${table.decisionId} is null) or (${table.targetType} = 'Risk' and ${table.riskId} is not null and ${table.workId} is null and ${table.githubRecordId} is null and ${table.releaseId} is null and ${table.decisionId} is null) or (${table.targetType} = 'Decision' and ${table.decisionId} is not null and ${table.workId} is null and ${table.githubRecordId} is null and ${table.releaseId} is null and ${table.riskId} is null)`,
    ),
    check(
      "production_incident_link_revision_check",
      sql`${table.revision} >= 0`,
    ),
  ],
);

/**
 * Follow-up Work created from a Production Incident after its preview. The
 * Work carries the incident as `origin_owner_record_id`; this row is the
 * incident-side record of the Origin. `incident_id` has no foreign key so a
 * deleted incident leaves the Origin visible as a broken reference instead of
 * erasing it, and the composite Work key keeps the Work in the incident's
 * Project. Only the preview fingerprint and incident revision are stored; the
 * incident status is never written.
 */
export const productionIncidentFollowUp = pgTable(
  "production_incident_follow_up",
  {
    createdAt: timestamp("created_at").defaultNow().notNull(),
    id: text("id").primaryKey(),
    incidentId: text("incident_id").notNull(),
    incidentRevision: integer("incident_revision").notNull(),
    previewFingerprint: text("preview_fingerprint").notNull(),
    projectId: text("project_id")
      .notNull()
      .references(() => project.id, { onDelete: "cascade" }),
    revision: integer("revision").default(1).notNull(),
    workId: text("work_id").notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.projectId, table.workId],
      foreignColumns: [work.projectId, work.id],
      name: "production_incident_follow_up_work_fk",
    }).onDelete("cascade"),
    index("production_incident_follow_up_incident_idx").on(
      table.projectId,
      table.incidentId,
    ),
    check(
      "production_incident_follow_up_revision_check",
      sql`${table.revision} >= 0`,
    ),
  ],
);
