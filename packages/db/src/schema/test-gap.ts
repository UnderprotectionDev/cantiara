import { sql } from "drizzle-orm";
import {
  check,
  foreignKey,
  index,
  integer,
  pgTable,
  primaryKey,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

import {
  plannedTestCaseVersion,
  sessionTest,
  testHandoff,
} from "./planned-test";
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
    closedAt: timestamp("closed_at"),
    closureDecisionId: text("closure_decision_id"),
    closureRationale: text("closure_rationale"),
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => project.id, { onDelete: "cascade" }),
    rationale: text("rationale").notNull(),
    state: text("state").default("Open").notNull(),
    stateChangedAt: timestamp("state_changed_at").defaultNow().notNull(),
    title: text("title").notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("project_test_gap_project_idx").on(table.projectId),
    check(
      "project_test_gap_state_check",
      sql`${table.state} in ('Open', 'Planned', 'Met by result', 'Not needed')`,
    ),
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

/**
 * Exact Planned Test Case versions a Gap is planned against. The composite
 * foreign key names one immutable version row, so a bind never means "latest"
 * and no case edit moves it. A bind is planning: it can lift a Gap to at most
 * `Planned` and is never a result.
 */
export const testGapCaseBind = pgTable(
  "project_test_gap_case_bind",
  {
    caseId: text("case_id").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    gapId: text("gap_id").notNull(),
    version: integer("version").notNull(),
  },
  (table) => [
    primaryKey({
      columns: [table.gapId, table.caseId, table.version],
      name: "project_test_gap_case_bind_pk",
    }),
    foreignKey({
      columns: [table.gapId],
      foreignColumns: [testGap.id],
      name: "project_test_gap_case_bind_gap_fk",
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.caseId, table.version],
      foreignColumns: [
        plannedTestCaseVersion.caseId,
        plannedTestCaseVersion.version,
      ],
      name: "project_test_gap_case_bind_version_fk",
    }).onDelete("cascade"),
  ],
);

/**
 * Test Handoffs a Gap is planned against. Like a case bind, a Handoff bind is
 * planning only: no Handoff state, Session Test or arriving report writes this
 * row or the Gap's state.
 */
export const testGapHandoffBind = pgTable(
  "project_test_gap_handoff_bind",
  {
    createdAt: timestamp("created_at").defaultNow().notNull(),
    gapId: text("gap_id").notNull(),
    handoffId: text("handoff_id").notNull(),
  },
  (table) => [
    primaryKey({
      columns: [table.gapId, table.handoffId],
      name: "project_test_gap_handoff_bind_pk",
    }),
    foreignKey({
      columns: [table.gapId],
      foreignColumns: [testGap.id],
      name: "project_test_gap_handoff_bind_gap_fk",
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.handoffId],
      foreignColumns: [testHandoff.id],
      name: "project_test_gap_handoff_bind_handoff_fk",
    }).onDelete("cascade"),
  ],
);

/**
 * The exact Session Tests the founder selected when choosing `Met by result`.
 * Closure is a cited set, never a percentage: a row exists only because the
 * founder picked that Session Test, and nothing else writes this table. The
 * rows are inserted with the closure and never rewritten, so the citation
 * stays in history. `closure_decision_id` on the Gap is a polymorphic Decision
 * reference with no foreign key: the Decision's owner reads it at view time and
 * a gone Decision reads as broken, never as another record.
 */
export const testGapMetSessionTest = pgTable(
  "project_test_gap_met_session_test",
  {
    createdAt: timestamp("created_at").defaultNow().notNull(),
    gapId: text("gap_id").notNull(),
    sessionTestId: text("session_test_id").notNull(),
  },
  (table) => [
    primaryKey({
      columns: [table.gapId, table.sessionTestId],
      name: "project_test_gap_met_session_test_pk",
    }),
    foreignKey({
      columns: [table.gapId],
      foreignColumns: [testGap.id],
      name: "project_test_gap_met_session_test_gap_fk",
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.sessionTestId],
      foreignColumns: [sessionTest.id],
      name: "project_test_gap_met_session_test_session_test_fk",
    }).onDelete("cascade"),
    index("project_test_gap_met_session_test_session_idx").on(
      table.sessionTestId,
    ),
  ],
);
