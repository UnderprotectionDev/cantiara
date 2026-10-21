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

import { sessionTest, testSession } from "./planned-test";
import { project } from "./project";
import { work } from "./work";

const REVIEW_STATES = "'Unreviewed', 'Reviewed', 'Follow-up needed', 'Closed'";

/**
 * Review state of one Session Test (Oturum Testi, spec 57). A row exists only
 * after an explicit item review; no row means `Unreviewed`, so a new report
 * needs no backfill and the Session Test table is not widened. The state lives
 * apart from the Test Session's own `review_state`, so neither implies the
 * other, and it sits apart from the reported result columns, so a review can
 * never rewrite them. There is no release, gate, score or Handoff column.
 */
export const sessionTestReview = pgTable(
  "project_session_test_review",
  {
    reviewState: text("review_state").notNull(),
    sessionTestId: text("session_test_id")
      .primaryKey()
      .references(() => sessionTest.id, { onDelete: "cascade" }),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (_table) => [
    check(
      "project_session_test_review_state_check",
      sql.raw(`"review_state" in (${REVIEW_STATES})`),
    ),
  ],
);

/**
 * Kayıt geçmişi of review and close: additive, insert-only entries bound to
 * the exact Test Session (and Session Test) they concern. Not a Denetim kaydı.
 * `remaining` keeps the exact open items a close left behind; `batch_id` ties
 * the entries of one bulk `Mark session and selected results as reviewed`.
 */
export const testReviewEvent = pgTable(
  "project_test_review_event",
  {
    action: text("action").notNull(),
    actorAccountId: text("actor_account_id").notNull(),
    batchId: text("batch_id"),
    fromState: text("from_state").notNull(),
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => project.id, { onDelete: "cascade" }),
    reason: text("reason"),
    recordedAt: timestamp("recorded_at").defaultNow().notNull(),
    remaining:
      jsonb("remaining").$type<
        { id: string; state: string; title: string }[]
      >(),
    sessionId: text("session_id")
      .notNull()
      .references(() => testSession.id, { onDelete: "cascade" }),
    sessionTestId: text("session_test_id"),
    toState: text("to_state").notNull(),
  },
  (table) => [
    index("project_test_review_event_session_idx").on(
      table.sessionId,
      table.recordedAt,
    ),
    index("project_test_review_event_project_idx").on(
      table.projectId,
      table.recordedAt,
    ),
    check(
      "project_test_review_event_action_check",
      sql`${table.action} in ('Review state set', 'Bulk review')`,
    ),
    check(
      "project_test_review_event_state_check",
      sql.raw(
        `"from_state" in (${REVIEW_STATES}) and "to_state" in (${REVIEW_STATES})`,
      ),
    ),
  ],
);

/**
 * Correction, Withdrawal and security-redaction events (spec 57 #414): additive
 * Kayıt geçmişi bound to the original Test Session (and Session Test), never an
 * edit of the reported result columns. `previous_event_id` links the chain.
 * A Redaction is a contentless mark (time, reason, actor); the only update
 * any row ever receives is clearing `note`, `reason` and `corrected_result`
 * of the event it redacts (the narrow security-redaction exception).
 */
export const testResultEvent = pgTable(
  "project_test_result_event",
  {
    actorAccountId: text("actor_account_id").notNull(),
    correctedResult: text("corrected_result"),
    id: text("id").primaryKey(),
    kind: text("kind").notNull(),
    note: text("note"),
    previousEventId: text("previous_event_id"),
    projectId: text("project_id")
      .notNull()
      .references(() => project.id, { onDelete: "cascade" }),
    reason: text("reason"),
    recordedAt: timestamp("recorded_at").defaultNow().notNull(),
    redactedEventId: text("redacted_event_id"),
    redactedField: text("redacted_field"),
    sessionId: text("session_id")
      .notNull()
      .references(() => testSession.id, { onDelete: "cascade" }),
    sessionTestId: text("session_test_id"),
  },
  (table) => [
    index("project_test_result_event_session_idx").on(
      table.sessionId,
      table.recordedAt,
    ),
    index("project_test_result_event_project_idx").on(
      table.projectId,
      table.recordedAt,
    ),
    check(
      "project_test_result_event_kind_check",
      sql`${table.kind} in ('Correction', 'Withdrawal', 'Redaction')`,
    ),
    check(
      "project_test_result_event_redacted_field_check",
      sql`${table.redactedField} is null or ${table.redactedField} in ('Reported result', 'Session summary', 'Event content')`,
    ),
  ],
);

/**
 * `Supersedes` / `Superseded` between two exact Session Tests (spec 57 #415).
 * An insert-only, directed edge: the newer result supersedes the older one and
 * neither result row is written. Acyclicity and same-type are checked by the
 * Test Review access before the insert. This is the Session Test side of the
 * standard relation; it never holds a Work, a Decision or a score.
 */
export const sessionTestSupersession = pgTable(
  "project_session_test_supersession",
  {
    actorAccountId: text("actor_account_id").notNull(),
    id: text("id").primaryKey(),
    newerSessionTestId: text("newer_session_test_id")
      .notNull()
      .references(() => sessionTest.id, { onDelete: "cascade" }),
    olderSessionTestId: text("older_session_test_id")
      .notNull()
      .references(() => sessionTest.id, { onDelete: "cascade" }),
    projectId: text("project_id")
      .notNull()
      .references(() => project.id, { onDelete: "cascade" }),
    reason: text("reason"),
    recordedAt: timestamp("recorded_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("project_session_test_supersession_pair_uidx").on(
      table.newerSessionTestId,
      table.olderSessionTestId,
    ),
    index("project_session_test_supersession_project_idx").on(table.projectId),
    check(
      "project_session_test_supersession_distinct_check",
      sql`${table.newerSessionTestId} <> ${table.olderSessionTestId}`,
    ),
  ],
);

/**
 * The founder's judgment of which result stands for one exact scenario
 * version. Insert-only; `judged_session_test_ids` keeps the exact Session
 * Tests that were weighed, so a later differing result reopens the
 * `test-result-conflict` signal instead of being silently absorbed.
 */
export const testResultBinding = pgTable(
  "project_test_result_binding",
  {
    actorAccountId: text("actor_account_id").notNull(),
    id: text("id").primaryKey(),
    judgedSessionTestIds: jsonb("judged_session_test_ids")
      .$type<string[]>()
      .notNull(),
    projectId: text("project_id")
      .notNull()
      .references(() => project.id, { onDelete: "cascade" }),
    reason: text("reason"),
    recordedAt: timestamp("recorded_at").defaultNow().notNull(),
    scenarioId: text("scenario_id").notNull(),
    scenarioVersion: integer("scenario_version").notNull(),
    sessionTestId: text("session_test_id")
      .notNull()
      .references(() => sessionTest.id, { onDelete: "cascade" }),
  },
  (table) => [
    index("project_test_result_binding_scenario_idx").on(
      table.projectId,
      table.scenarioId,
      table.scenarioVersion,
    ),
    check(
      "project_test_result_binding_version_check",
      sql`${table.scenarioVersion} >= 1`,
    ),
  ],
);

/**
 * Links a Session Test to the Work opened or chosen for it by `Create
 * follow-up work`. A result may link one existing İş with others of the same
 * root cause; the link never writes the result and closing the Work never
 * changes it. The Work's own Origin Location columns hold the immutable origin
 * of a Work this action created.
 */
export const testFollowUpLink = pgTable(
  "project_test_follow_up_link",
  {
    actorAccountId: text("actor_account_id").notNull(),
    id: text("id").primaryKey(),
    mode: text("mode").notNull(),
    projectId: text("project_id")
      .notNull()
      .references(() => project.id, { onDelete: "cascade" }),
    recordedAt: timestamp("recorded_at").defaultNow().notNull(),
    sessionId: text("session_id")
      .notNull()
      .references(() => testSession.id, { onDelete: "cascade" }),
    sessionTestId: text("session_test_id")
      .notNull()
      .references(() => sessionTest.id, { onDelete: "cascade" }),
    workId: text("work_id")
      .notNull()
      .references(() => work.id, { onDelete: "cascade" }),
  },
  (table) => [
    uniqueIndex("project_test_follow_up_link_pair_uidx").on(
      table.sessionTestId,
      table.workId,
    ),
    index("project_test_follow_up_link_work_idx").on(table.workId),
    index("project_test_follow_up_link_project_idx").on(table.projectId),
    check(
      "project_test_follow_up_link_mode_check",
      sql`${table.mode} in ('Created', 'Attached')`,
    ),
  ],
);
