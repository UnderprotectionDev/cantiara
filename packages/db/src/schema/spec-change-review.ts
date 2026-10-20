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
