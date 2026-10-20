import { sql } from "drizzle-orm";
import {
  check,
  date,
  foreignKey,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
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

/**
 * Test Session (Test Oturumu, spec 54): the reported-history parent of Session
 * Tests. One table for all three ingresses (`Application`, `File import`,
 * `MCP`); `ingress` is a stored fact, never a record type, queue or score. The
 * executor (display attribution), the reporter (verified user or integration
 * identity, never a payload field) and the ingress are separate columns.
 * `reported_at` is UTC for comparison and `reported_at_text` keeps the original
 * RFC 3339 offset. `review_state` only starts at `Unreviewed`; the review
 * lifecycle belongs to spec 57. There is no score, trust, severity or release
 * column: a reported result is not Product acceptance evidence.
 */
export const testSession = pgTable(
  "project_test_session",
  {
    acceptedAt: timestamp("accepted_at").defaultNow().notNull(),
    context: jsonb("context").$type<Record<string, string>>(),
    endedAt: timestamp("ended_at"),
    executorName: text("executor_name").notNull(),
    executorType: text("executor_type").notNull(),
    executorVersion: text("executor_version"),
    externalSessionId: text("external_session_id").notNull(),
    fingerprint: text("fingerprint"),
    handoffId: text("handoff_id"),
    handoffPackageVersion: integer("handoff_package_version"),
    handoffStateAtAccept: text("handoff_state_at_accept"),
    id: text("id").primaryKey(),
    ingress: text("ingress").notNull(),
    projectId: text("project_id")
      .notNull()
      .references(() => project.id, { onDelete: "cascade" }),
    rawReport: text("raw_report"),
    reportedAt: timestamp("reported_at").notNull(),
    reportedAtText: text("reported_at_text").notNull(),
    reporterId: text("reporter_id").notNull(),
    reporterKind: text("reporter_kind").notNull(),
    reviewState: text("review_state").default("Unreviewed").notNull(),
    schemaVersion: text("schema_version").notNull(),
    startedAt: timestamp("started_at"),
    summary: text("summary"),
  },
  (table) => [
    index("project_test_session_project_idx").on(
      table.projectId,
      table.acceptedAt,
    ),
    check(
      "project_test_session_ingress_check",
      sql`${table.ingress} in ('Application', 'File import', 'MCP')`,
    ),
    check(
      "project_test_session_executor_type_check",
      sql`${table.executorType} in ('user', 'ai_agent', 'external_tool')`,
    ),
    check(
      "project_test_session_reporter_kind_check",
      sql`${table.reporterKind} in ('user', 'integration')`,
    ),
    check(
      "project_test_session_handoff_check",
      sql`(${table.handoffId} is null) = (${table.handoffPackageVersion} is null)`,
    ),
  ],
);

/**
 * Idempotency boundary of a reported Test Session (spec 54, ticket 02): the
 * primary key is ingress + verified reporter + external session id inside one
 * Project, so a retry can never open a second session. The executor is display
 * attribution and is deliberately not in the key. A separate table, because
 * the shared-database rules do not let a unique key land on an existing one.
 */
export const testSessionIdentity = pgTable(
  "project_test_session_identity",
  {
    externalSessionId: text("external_session_id").notNull(),
    ingress: text("ingress").notNull(),
    projectId: text("project_id")
      .notNull()
      .references(() => project.id, { onDelete: "cascade" }),
    reporterId: text("reporter_id").notNull(),
    sessionId: text("session_id")
      .notNull()
      .references(() => testSession.id, { onDelete: "cascade" }),
  },
  (table) => [
    primaryKey({
      columns: [
        table.projectId,
        table.ingress,
        table.reporterId,
        table.externalSessionId,
      ],
      name: "project_test_session_identity_pk",
    }),
    index("project_test_session_identity_session_idx").on(table.sessionId),
  ],
);

/**
 * Session Test (Oturum Testi) bind, ticket 02. Project-scoped. Spec 54 adds
 * the nullable report columns (parent Test Session, external id, position, raw
 * and normalized result, notes, evidence, relations); a standalone Session Test
 * keeps them all null and a reported one carries the whole set (enforced by
 * Test Report Acceptance, because the shared-database rules keep checks on an
 * existing table from narrowing). A reported ad hoc test stores its reported
 * title as `purpose` and an empty `expected_behavior`, so the older content
 * check still holds. Review state belongs to the Test Session (spec 57 owns
 * its lifecycle). The bind is the composite foreign key
 * `(scenario_id, scenario_version)` to one immutable version row, so it names an
 * exact version and no case edit can move it. `purpose` and `expected_behavior`
 * hold the then-current content of an ad hoc test and are never rewritten by a
 * later link; a test bound when recorded keeps both null because the pinned
 * version already holds its definition. `bind_origin` records whether the
 * version was bound when recorded or linked later, so a late link is never read
 * as the version having been executed.
 */
export const sessionTest = pgTable(
  "project_session_test",
  {
    bindOrigin: text("bind_origin"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    evidence: jsonb("evidence").$type<unknown[]>(),
    expectedBehavior: text("expected_behavior"),
    externalTestId: text("external_test_id"),
    id: text("id").primaryKey(),
    linkedAt: timestamp("linked_at"),
    normalizedResult: text("normalized_result"),
    notes: text("notes"),
    projectId: text("project_id")
      .notNull()
      .references(() => project.id, { onDelete: "cascade" }),
    position: integer("position"),
    purpose: text("purpose"),
    rawResult: text("raw_result"),
    relations: jsonb("relations").$type<unknown[]>(),
    scenarioId: text("scenario_id"),
    scenarioVersion: integer("scenario_version"),
    sessionId: text("session_id").references(() => testSession.id, {
      onDelete: "cascade",
    }),
    title: text("title").notNull(),
  },
  (table) => [
    index("project_session_test_project_idx").on(table.projectId),
    index("project_session_test_session_idx").on(table.sessionId),
    uniqueIndex("project_session_test_session_external_idx").on(
      table.sessionId,
      table.externalTestId,
    ),
    foreignKey({
      columns: [table.scenarioId, table.scenarioVersion],
      foreignColumns: [
        plannedTestCaseVersion.caseId,
        plannedTestCaseVersion.version,
      ],
      name: "project_session_test_scenario_version_fk",
    }).onDelete("cascade"),
    check(
      "project_session_test_bind_check",
      sql`(${table.scenarioId} is null and ${table.scenarioVersion} is null and ${table.bindOrigin} is null and ${table.linkedAt} is null) or (${table.scenarioId} is not null and ${table.scenarioVersion} is not null and ${table.bindOrigin} in ('Bound when recorded', 'Linked later') and ((${table.bindOrigin} = 'Linked later') = (${table.linkedAt} is not null)))`,
    ),
    check(
      "project_session_test_content_check",
      sql`((${table.purpose} is null) = (${table.expectedBehavior} is null)) and (${table.purpose} is not null or ${table.bindOrigin} = 'Bound when recorded')`,
    ),
    check(
      "project_session_test_title_check",
      sql`length(btrim(${table.title})) between 1 and 255`,
    ),
  ],
);

/**
 * Test Handoff (spec 53, ticket 03): a light historical Project record of
 * requested external test work. Its own table, deliberately separate from
 * Work's external execution handoff (ADR-0015): no work_id, no return record,
 * no reconciliation and no result column. `state` is the handoff PROCESS; the
 * product writes it only when the founder asks. The `build_*` columns are the
 * founder-typed `product_build_context`; nothing reads GitHub or CI to fill
 * them. `package_version` is the counter the package export (ticket 04)
 * increments per produced package: 0 means none was produced yet.
 * `target_executor` is free text, not a closed vendor list.
 */
export const testHandoff = pgTable(
  "project_test_handoff",
  {
    buildBranch: text("build_branch"),
    buildCommit: text("build_commit"),
    buildName: text("build_name"),
    buildRepository: text("build_repository"),
    buildTargetEnvironment: text("build_target_environment"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    dueDate: date("due_date", { mode: "string" }),
    environmentPreconditions: text("environment_preconditions"),
    id: text("id").primaryKey(),
    packageVersion: integer("package_version").default(0).notNull(),
    projectId: text("project_id")
      .notNull()
      .references(() => project.id, { onDelete: "cascade" }),
    purpose: text("purpose").notNull(),
    state: text("state").default("Draft").notNull(),
    stateChangedAt: timestamp("state_changed_at").defaultNow().notNull(),
    targetExecutor: text("target_executor"),
    title: text("title").notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("project_test_handoff_project_idx").on(table.projectId),
    check(
      "project_test_handoff_state_check",
      sql`${table.state} in ('Draft', 'Ready to share', 'Shared', 'Result received', 'Closed', 'Canceled')`,
    ),
    check(
      "project_test_handoff_package_version_check",
      sql`${table.packageVersion} >= 0`,
    ),
    check(
      "project_test_handoff_title_check",
      sql`length(btrim(${table.title})) between 1 and 255`,
    ),
  ],
);

/**
 * Exact Planned Test Case versions a Handoff selected. The composite foreign
 * key names one immutable version row, so a Handoff can never mean "latest" and
 * no case edit moves it. One version per case per Handoff.
 */
export const testHandoffScenario = pgTable(
  "project_test_handoff_scenario",
  {
    caseId: text("case_id").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    handoffId: text("handoff_id").notNull(),
    position: integer("position").notNull(),
    version: integer("version").notNull(),
  },
  (table) => [
    primaryKey({
      columns: [table.handoffId, table.caseId],
      name: "project_test_handoff_scenario_pk",
    }),
    foreignKey({
      columns: [table.handoffId],
      foreignColumns: [testHandoff.id],
      name: "project_test_handoff_scenario_handoff_fk",
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.caseId, table.version],
      foreignColumns: [
        plannedTestCaseVersion.caseId,
        plannedTestCaseVersion.version,
      ],
      name: "project_test_handoff_scenario_version_fk",
    }).onDelete("cascade"),
  ],
);

/**
 * An arriving Session Test linked to a Handoff. A Session Test arrives on at
 * most one Handoff (primary key on `session_test_id`). The link carries no
 * state: linking never advances the Handoff, it only lets the product suggest
 * `Result received`. Report acceptance and review belong to specs 54 and 57.
 */
export const testHandoffSessionTest = pgTable(
  "project_test_handoff_session_test",
  {
    handoffId: text("handoff_id").notNull(),
    linkedAt: timestamp("linked_at").defaultNow().notNull(),
    sessionTestId: text("session_test_id").primaryKey(),
  },
  (table) => [
    foreignKey({
      columns: [table.handoffId],
      foreignColumns: [testHandoff.id],
      name: "project_test_handoff_session_test_handoff_fk",
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.sessionTestId],
      foreignColumns: [sessionTest.id],
      name: "project_test_handoff_session_test_session_test_fk",
    }).onDelete("cascade"),
    index("project_test_handoff_session_test_handoff_idx").on(table.handoffId),
  ],
);

/**
 * Founder-written ad hoc scope of a Handoff (`ad_hoc_scope[]` in the package).
 * Plain text rows: no case id, no version and no link to a Planned Test Case,
 * because the product mints none from this text.
 */
export const testHandoffAdHocScope = pgTable(
  "project_test_handoff_ad_hoc_scope",
  {
    createdAt: timestamp("created_at").defaultNow().notNull(),
    expectedBehavior: text("expected_behavior").notNull(),
    handoffId: text("handoff_id").notNull(),
    intent: text("intent").notNull(),
    position: integer("position").notNull(),
  },
  (table) => [
    primaryKey({
      columns: [table.handoffId, table.position],
      name: "project_test_handoff_ad_hoc_scope_pk",
    }),
    foreignKey({
      columns: [table.handoffId],
      foreignColumns: [testHandoff.id],
      name: "project_test_handoff_ad_hoc_scope_handoff_fk",
    }).onDelete("cascade"),
  ],
);

/**
 * Work, Feature, Document and Wireframe records the founder added to a Handoff
 * as package context. `target_id` is polymorphic with no foreign key (the
 * owner's live resolver reads it); a Document names its revision and optional
 * section, a Wireframe names an exact version, so a row never means "latest".
 */
export const testHandoffContextRef = pgTable(
  "project_test_handoff_context_ref",
  {
    createdAt: timestamp("created_at").defaultNow().notNull(),
    documentRevision: integer("document_revision"),
    handoffId: text("handoff_id").notNull(),
    kind: text("kind").notNull(),
    position: integer("position").notNull(),
    sectionId: text("section_id"),
    targetId: text("target_id").notNull(),
    wireframeVersion: integer("wireframe_version"),
  },
  (table) => [
    primaryKey({
      columns: [table.handoffId, table.position],
      name: "project_test_handoff_context_ref_pk",
    }),
    foreignKey({
      columns: [table.handoffId],
      foreignColumns: [testHandoff.id],
      name: "project_test_handoff_context_ref_handoff_fk",
    }).onDelete("cascade"),
    check(
      "project_test_handoff_context_ref_kind_check",
      sql`${table.kind} in ('Work', 'Feature', 'Document', 'Wireframe')`,
    ),
    check(
      "project_test_handoff_context_ref_exact_check",
      sql`(${table.kind} = 'Document' and ${table.documentRevision} is not null and ${table.documentRevision} >= 0 and ${table.wireframeVersion} is null) or (${table.kind} = 'Wireframe' and ${table.wireframeVersion} is not null and ${table.wireframeVersion} >= 1 and ${table.documentRevision} is null and ${table.sectionId} is null) or (${table.kind} in ('Work', 'Feature') and ${table.documentRevision} is null and ${table.sectionId} is null and ${table.wireframeVersion} is null)`,
    ),
  ],
);

/**
 * A produced Test Handoff package (ticket 04), stored exactly as handed out:
 * the JSON and Markdown renderings of one `(handoff_id, package_version)`.
 * Rows are only inserted; there is no update path, so a later case, spec or
 * Screen edit cannot change a produced package. `json` is text, not jsonb, so
 * the delivered bytes survive unchanged.
 */
export const testHandoffPackage = pgTable(
  "project_test_handoff_package",
  {
    createdAt: timestamp("created_at").notNull(),
    handoffId: text("handoff_id").notNull(),
    json: text("json").notNull(),
    markdown: text("markdown").notNull(),
    packageVersion: integer("package_version").notNull(),
  },
  (table) => [
    primaryKey({
      columns: [table.handoffId, table.packageVersion],
      name: "project_test_handoff_package_pk",
    }),
    foreignKey({
      columns: [table.handoffId],
      foreignColumns: [testHandoff.id],
      name: "project_test_handoff_package_handoff_fk",
    }).onDelete("cascade"),
    check(
      "project_test_handoff_package_version_check",
      sql`${table.packageVersion} >= 1`,
    ),
  ],
);
