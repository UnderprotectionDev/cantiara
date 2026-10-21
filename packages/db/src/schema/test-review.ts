import { sql } from "drizzle-orm";
import {
  check,
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

import { sessionTest, testSession } from "./planned-test";
import { project } from "./project";

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
