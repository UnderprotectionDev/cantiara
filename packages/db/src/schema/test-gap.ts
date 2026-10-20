import { sql } from "drizzle-orm";
import {
  check,
  foreignKey,
  index,
  integer,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

import { project } from "./project";

/**
 * Test Gap (Test Açığı) master record, spec 55. Project-scoped and written only
 * by the founder: nothing in the product inserts a row from a failed test, a
 * missing case relation, a spec change, a check or similarity. There is
 * deliberately no coverage, score, severity or result column: a Gap is a named
 * area the founder thinks is untested, never a Bug, Risk, Product Gap or Work.
 */
export const testGap = pgTable(
  "project_test_gap",
  {
    createdAt: timestamp("created_at").defaultNow().notNull(),
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => project.id, { onDelete: "cascade" }),
    rationale: text("rationale").notNull(),
    title: text("title").notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("project_test_gap_project_idx").on(table.projectId),
    check(
      "project_test_gap_title_check",
      sql`length(btrim(${table.title})) between 1 and 255`,
    ),
    check(
      "project_test_gap_rationale_check",
      sql`length(btrim(${table.rationale})) >= 1`,
    ),
  ],
);

/**
 * Support relations of a Gap. `target_id` is polymorphic with no foreign key:
 * the owner's live resolver reads it at view time and reports a gone target as
 * broken, never as another record. Only a Document target carries a revision
 * and an optional section. A relation is evidence for the founder's judgement;
 * binding one never writes the target's status, priority or publish fitness.
 */
export const testGapRelation = pgTable(
  "project_test_gap_relation",
  {
    createdAt: timestamp("created_at").defaultNow().notNull(),
    documentRevision: integer("document_revision"),
    gapId: text("gap_id").notNull(),
    id: text("id").primaryKey(),
    position: integer("position").notNull(),
    sectionId: text("section_id"),
    targetId: text("target_id").notNull(),
    targetType: text("target_type").notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.gapId],
      foreignColumns: [testGap.id],
      name: "project_test_gap_relation_gap_fk",
    }).onDelete("cascade"),
    index("project_test_gap_relation_gap_idx").on(table.gapId),
    check(
      "project_test_gap_relation_type_check",
      sql`${table.targetType} in ('Work', 'Feature', 'Document', 'Risk', 'Project Release')`,
    ),
    check(
      "project_test_gap_relation_document_check",
      sql`(${table.targetType} = 'Document' and ${table.documentRevision} is not null and ${table.documentRevision} >= 0) or (${table.targetType} <> 'Document' and ${table.documentRevision} is null and ${table.sectionId} is null)`,
    ),
  ],
);
