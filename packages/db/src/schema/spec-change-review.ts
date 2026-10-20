import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

import { document } from "./document";
import { project } from "./project";
import { work } from "./work";

/**
 * Spec Change Review: the identity of one exact Document version pair of a
 * Feature's `Primary spec`. It stores no spec body, title or diff; both
 * versions are read from Document history. Candidates and per-candidate review
 * metadata attach later in their own tables keyed by this record's `id`.
 */
export const specChangeReview = pgTable(
  "spec_change_review",
  {
    createdAt: timestamp("created_at").defaultNow().notNull(),
    documentId: text("document_id")
      .notNull()
      .references(() => document.id, { onDelete: "cascade" }),
    featureId: text("feature_id")
      .notNull()
      .references(() => work.id, { onDelete: "cascade" }),
    id: text("id").primaryKey(),
    nextRevision: integer("next_revision").notNull(),
    previousRevision: integer("previous_revision").notNull(),
    projectId: text("project_id")
      .notNull()
      .references(() => project.id, { onDelete: "cascade" }),
  },
  (table) => [
    uniqueIndex("spec_change_review_pair_uidx").on(
      table.featureId,
      table.documentId,
      table.nextRevision,
    ),
    index("spec_change_review_project_idx").on(
      table.projectId,
      table.createdAt,
    ),
    check(
      "spec_change_review_revision_check",
      sql`${table.previousRevision} >= 1 and ${table.nextRevision} > ${table.previousRevision}`,
    ),
  ],
);

export const SPEC_CHANGE_REVIEW_STATE_OPTIONS = [
  "Waiting",
  "Reviewed",
  "Not affected",
] as const;

const specChangeReviewStateSql = sql.raw(
  SPEC_CHANGE_REVIEW_STATE_OPTIONS.map((state) => `'${state}'`).join(", "),
);

/**
 * Spec Change Review metadata of one candidate in one exact version pair. A
 * candidate is derived from recorded links and never stored; a row exists
 * only after the founder marks that single candidate, so `Waiting` is the
 * implicit default and nothing is bulk-written. The row never references or
 * writes the candidate record. `section_id` is `''` for a Document-level
 * candidate. A new spec version is a new `spec_change_review` row, so its
 * marks and notes are separate rows.
 */
export const specChangeReviewMark = pgTable(
  "spec_change_review_mark",
  {
    createdAt: timestamp("created_at").defaultNow().notNull(),
    id: text("id").primaryKey(),
    note: text("note"),
    recordId: text("record_id").notNull(),
    recordType: text("record_type").notNull(),
    revision: integer("revision").default(1).notNull(),
    reviewId: text("review_id")
      .notNull()
      .references(() => specChangeReview.id, { onDelete: "cascade" }),
    sectionId: text("section_id").default("").notNull(),
    state: text("state").notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("spec_change_review_mark_candidate_uidx").on(
      table.reviewId,
      table.recordType,
      table.recordId,
      table.sectionId,
    ),
    check(
      "spec_change_review_mark_state_check",
      sql`${table.state} in (${specChangeReviewStateSql})`,
    ),
    check(
      "spec_change_review_mark_note_check",
      sql`${table.note} is null or length(btrim(${table.note})) between 1 and 500`,
    ),
    check(
      "spec_change_review_mark_revision_check",
      sql`${table.revision} >= 1`,
    ),
  ],
);
