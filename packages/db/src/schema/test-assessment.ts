import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  pgTable,
  primaryKey,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

import { project } from "./project";

/**
 * Test Assessment (Test değerlendirmesi): an immutable dated snapshot of how the
 * founder read the test records of one Feature, Handoff or Project Release. The
 * row is only ever inserted. There is deliberately no score, coverage,
 * readiness, gate, exception, acceptance-evidence or GitHub-check column, and
 * `context_id` and the cited ids carry no foreign key: archiving or removing a
 * cited record must not rewrite the snapshot.
 */
export const testAssessment = pgTable(
  "project_test_assessment",
  {
    assessedAt: timestamp("assessed_at").defaultNow().notNull(),
    assessorAccountId: text("assessor_account_id").notNull(),
    contextId: text("context_id").notNull(),
    contextKind: text("context_kind").notNull(),
    decision: text("decision").notNull(),
    id: text("id").primaryKey(),
    knownLimits: text("known_limits"),
    projectId: text("project_id")
      .notNull()
      .references(() => project.id, { onDelete: "cascade" }),
  },
  (table) => [
    index("project_test_assessment_project_idx").on(
      table.projectId,
      table.assessedAt,
    ),
    index("project_test_assessment_context_idx").on(
      table.contextKind,
      table.contextId,
    ),
    check(
      "project_test_assessment_context_kind_check",
      sql`${table.contextKind} in ('Feature', 'Handoff', 'Project Release')`,
    ),
    check(
      "project_test_assessment_decision_check",
      sql`${table.decision} in ('Acceptable', 'Follow-up needed', 'Undecided')`,
    ),
  ],
);

/** Exact ids the snapshot cited, in the founder's order. Never updated. */
export const testAssessmentSource = pgTable(
  "project_test_assessment_source",
  {
    assessmentId: text("assessment_id")
      .notNull()
      .references(() => testAssessment.id, { onDelete: "cascade" }),
    position: integer("position").notNull(),
    sourceId: text("source_id").notNull(),
    sourceKind: text("source_kind").notNull(),
  },
  (table) => [
    primaryKey({
      columns: [table.assessmentId, table.sourceKind, table.sourceId],
      name: "project_test_assessment_source_pk",
    }),
    check(
      "project_test_assessment_source_kind_check",
      sql`${table.sourceKind} in ('Test Session', 'Test Gap', 'Follow-up Work')`,
    ),
  ],
);
