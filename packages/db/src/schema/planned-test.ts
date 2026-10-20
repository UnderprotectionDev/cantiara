import { sql } from "drizzle-orm";
import {
  check,
  foreignKey,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

import { project } from "./project";

/**
 * Planned Test Case (Planlı Test Senaryosu) master record. Project-scoped. The
 * row only anchors identity and the head pointer: every definition field lives
 * on an immutable version row, so no edit can rewrite what an earlier version
 * (or anything later pinned to it) said. There is deliberately no result,
 * status, step or runner column: a case is intent, never a Test Session or a
 * Test Handoff package.
 */
export const plannedTestCase = pgTable(
  "project_planned_test_case",
  {
    createdAt: timestamp("created_at").defaultNow().notNull(),
    currentVersion: integer("current_version").default(1).notNull(),
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => project.id, { onDelete: "cascade" }),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("project_planned_test_case_project_idx").on(table.projectId),
    check(
      "project_planned_test_case_version_check",
      sql`${table.currentVersion} >= 1`,
    ),
  ],
);

/** One exact, immutable version of a Planned Test Case. Rows are only inserted. */
export const plannedTestCaseVersion = pgTable(
  "project_planned_test_case_version",
  {
    caseId: text("case_id").notNull(),
    changeKind: text("change_kind").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    expectedBehavior: text("expected_behavior").notNull(),
    id: text("id").primaryKey(),
    notes: text("notes"),
    preconditions: text("preconditions").notNull(),
    purpose: text("purpose").notNull(),
    scope: text("scope").notNull(),
    title: text("title").notNull(),
    version: integer("version").notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.caseId],
      foreignColumns: [plannedTestCase.id],
      name: "project_planned_test_case_version_case_fk",
    }).onDelete("cascade"),
    uniqueIndex("project_planned_test_case_version_uidx").on(
      table.caseId,
      table.version,
    ),
    check(
      "project_planned_test_case_version_number_check",
      sql`${table.version} >= 1`,
    ),
    check(
      "project_planned_test_case_version_kind_check",
      sql`${table.changeKind} in ('Initial version', 'Meaningful change', 'Editorial change')`,
    ),
    check(
      "project_planned_test_case_version_title_check",
      sql`length(btrim(${table.title})) between 1 and 255`,
    ),
  ],
);

/**
 * Relations belong to a version, so a later relation edit opens a new version
 * instead of changing what an earlier one related to. `target_id` is a
 * polymorphic reference with no foreign key: the live resolver of the target's
 * owner reads it at view time and reports a gone target as broken, never as a
 * different record. Only a Document target carries a revision and section.
 */
export const plannedTestCaseRelation = pgTable(
  "project_planned_test_case_relation",
  {
    createdAt: timestamp("created_at").defaultNow().notNull(),
    documentRevision: integer("document_revision"),
    id: text("id").primaryKey(),
    position: integer("position").notNull(),
    sectionId: text("section_id"),
    targetId: text("target_id").notNull(),
    targetType: text("target_type").notNull(),
    versionId: text("version_id").notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.versionId],
      foreignColumns: [plannedTestCaseVersion.id],
      name: "project_planned_test_case_relation_version_fk",
    }).onDelete("cascade"),
    index("project_planned_test_case_relation_version_idx").on(table.versionId),
    check(
      "project_planned_test_case_relation_type_check",
      sql`${table.targetType} in ('Work', 'Feature', 'Document', 'Decision', 'Risk', 'Project Goal', 'Milestone', 'Source', 'Screen')`,
    ),
    check(
      "project_planned_test_case_relation_document_check",
      sql`(${table.targetType} = 'Document' and ${table.documentRevision} is not null and ${table.documentRevision} >= 0) or (${table.targetType} <> 'Document' and ${table.documentRevision} is null and ${table.sectionId} is null)`,
    ),
  ],
);
