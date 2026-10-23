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

import { project } from "./project";
import { projectRelease } from "./project-release";

export const releaseNote = pgTable(
  "release_note",
  {
    authorId: text("author_id").notNull(),
    body: text("body").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => project.id, { onDelete: "cascade" }),
    publishedAt: timestamp("published_at"),
    releaseId: text("release_id")
      .notNull()
      .references(() => projectRelease.id, { onDelete: "cascade" }),
    revision: integer("revision").default(1).notNull(),
    scopeWorkIds: jsonb("scope_work_ids").$type<string[]>().notNull(),
    status: text("status").default("Draft").notNull(),
    tagIds: jsonb("tag_ids").$type<string[]>().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
    whyTrail: jsonb("why_trail").$type<unknown[]>().notNull(),
  },
  (table) => [
    index("release_note_release_idx").on(table.releaseId),
    index("release_note_project_idx").on(table.projectId, table.status),
    check(
      "release_note_status_check",
      sql`${table.status} in ('Draft', 'Published')`,
    ),
    check("release_note_revision_check", sql`${table.revision} >= 1`),
    check(
      "release_note_scope_check",
      sql`jsonb_array_length(${table.scopeWorkIds}) >= 1`,
    ),
  ],
);

/** Immutable approved snapshot revision: the only source of the public changelog. */
export const releaseChangelogSnapshot = pgTable(
  "release_changelog_snapshot",
  {
    approvedAt: timestamp("approved_at").notNull(),
    id: text("id").primaryKey(),
    noteId: text("note_id")
      .notNull()
      .references(() => releaseNote.id, { onDelete: "cascade" }),
    projectId: text("project_id")
      .notNull()
      .references(() => project.id, { onDelete: "cascade" }),
    releaseId: text("release_id")
      .notNull()
      .references(() => projectRelease.id, { onDelete: "cascade" }),
    revision: integer("revision").notNull(),
    snapshot: jsonb("snapshot").$type<unknown>().notNull(),
  },
  (table) => [
    uniqueIndex("release_changelog_snapshot_note_uidx").on(
      table.noteId,
      table.revision,
    ),
    index("release_changelog_snapshot_project_idx").on(
      table.projectId,
      table.approvedAt,
    ),
    check(
      "release_changelog_snapshot_revision_check",
      sql`${table.revision} >= 1`,
    ),
  ],
);

export const releaseReassessmentRound = pgTable(
  "release_reassessment_round",
  {
    closeReason: text("close_reason"),
    closedAt: timestamp("closed_at"),
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => project.id, { onDelete: "cascade" }),
    releaseId: text("release_id")
      .notNull()
      .references(() => projectRelease.id, { onDelete: "cascade" }),
    sequence: integer("sequence").notNull(),
    startedAt: timestamp("started_at").notNull(),
  },
  (table) => [
    uniqueIndex("release_reassessment_round_sequence_uidx").on(
      table.releaseId,
      table.sequence,
    ),
    index("release_reassessment_round_project_idx").on(table.projectId),
    check(
      "release_reassessment_round_sequence_check",
      sql`${table.sequence} >= 1`,
    ),
    check(
      "release_reassessment_round_close_check",
      sql`(${table.closedAt} is null) = (${table.closeReason} is null)`,
    ),
  ],
);

export const releaseObservation = pgTable(
  "release_observation",
  {
    assessment: text("assessment").notNull(),
    authorId: text("author_id").notNull(),
    evidence: jsonb("evidence").$type<unknown[]>().notNull(),
    id: text("id").primaryKey(),
    kind: text("kind").notNull(),
    observedAt: timestamp("observed_at").notNull(),
    revision: integer("revision").default(1).notNull(),
    roundId: text("round_id")
      .notNull()
      .references(() => releaseReassessmentRound.id, { onDelete: "cascade" }),
    savedAt: timestamp("saved_at").notNull(),
    text: text("text").default("").notNull(),
  },
  (table) => [
    uniqueIndex("release_observation_round_kind_uidx").on(
      table.roundId,
      table.kind,
    ),
    check(
      "release_observation_kind_check",
      sql`${table.kind} in ('access', 'outcome')`,
    ),
    check(
      "release_observation_assessment_check",
      sql`${table.assessment} in ('Observed', 'Partially observed', 'Not observed', 'Could not learn')`,
    ),
    check("release_observation_revision_check", sql`${table.revision} >= 1`),
  ],
);

/** Previous values of a corrected observation; rows are only ever appended. */
export const releaseObservationRevision = pgTable(
  "release_observation_revision",
  {
    assessment: text("assessment").notNull(),
    authorId: text("author_id").notNull(),
    evidence: jsonb("evidence").$type<unknown[]>().notNull(),
    observationId: text("observation_id")
      .notNull()
      .references(() => releaseObservation.id, { onDelete: "cascade" }),
    observedAt: timestamp("observed_at").notNull(),
    revision: integer("revision").notNull(),
    savedAt: timestamp("saved_at").notNull(),
    text: text("text").notNull(),
  },
  (table) => [
    uniqueIndex("release_observation_revision_uidx").on(
      table.observationId,
      table.revision,
    ),
  ],
);
