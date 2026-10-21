import type {
  TestResultStoredEvent,
  TestReviewState,
  TestReviewStore,
  TestReviewStoredEvent,
  TestReviewStoredSession,
} from "@cantiara/api/test-review";
import type { Database } from "@cantiara/db";
import { sessionTest, testSession } from "@cantiara/db/schema/planned-test";
import {
  sessionTestReview,
  testResultEvent,
  testReviewEvent,
} from "@cantiara/db/schema/test-review";
import { and, asc, desc, eq, inArray, isNotNull } from "drizzle-orm";

import {
  type FeedbackExecutor,
  findOwnedProject,
  findReadableProject,
} from "../../feedback/server/feedback-database";
import { createTestReview } from "./test-review";

type Executor = FeedbackExecutor;

const EVENT_LIMIT = 500;

async function readSessions(
  executor: Executor,
  projectId: string,
  sessionId?: string,
): Promise<TestReviewStoredSession[]> {
  const sessions = await executor
    .select()
    .from(testSession)
    .where(
      sessionId
        ? and(
            eq(testSession.projectId, projectId),
            eq(testSession.id, sessionId),
          )
        : eq(testSession.projectId, projectId),
    )
    .orderBy(desc(testSession.reportedAt), asc(testSession.id));
  if (sessions.length === 0) {
    return [];
  }
  const items = await executor
    .select({
      id: sessionTest.id,
      normalizedResult: sessionTest.normalizedResult,
      position: sessionTest.position,
      rawResult: sessionTest.rawResult,
      reviewState: sessionTestReview.reviewState,
      sessionId: sessionTest.sessionId,
      title: sessionTest.title,
    })
    .from(sessionTest)
    .leftJoin(
      sessionTestReview,
      eq(sessionTestReview.sessionTestId, sessionTest.id),
    )
    .where(
      and(
        eq(sessionTest.projectId, projectId),
        isNotNull(sessionTest.sessionId),
        inArray(
          sessionTest.sessionId,
          sessions.map(({ id }) => id),
        ),
      ),
    )
    .orderBy(asc(sessionTest.position), asc(sessionTest.id));
  return sessions.map((row) => ({
    executorName: row.executorName,
    id: row.id,
    items: items
      .filter((item) => item.sessionId === row.id)
      .map((item) => ({
        id: item.id,
        normalizedResult: item.normalizedResult,
        position: item.position,
        rawResult: item.rawResult,
        reviewState: (item.reviewState ?? "Unreviewed") as TestReviewState,
        title: item.title,
      })),
    projectId: row.projectId,
    reportedAt: row.reportedAt.toISOString(),
    reviewState: row.reviewState as TestReviewState,
    summary: row.summary,
  }));
}

function toEvent(
  row: typeof testReviewEvent.$inferSelect,
): TestReviewStoredEvent {
  return {
    action: row.action as TestReviewStoredEvent["action"],
    actorAccountId: row.actorAccountId,
    batchId: row.batchId,
    fromState: row.fromState as TestReviewState,
    id: row.id,
    reason: row.reason,
    recordedAt: row.recordedAt.toISOString(),
    remaining: row.remaining as TestReviewStoredEvent["remaining"],
    sessionId: row.sessionId,
    sessionTestId: row.sessionTestId,
    toState: row.toState as TestReviewState,
  };
}

function toResultEvent(
  row: typeof testResultEvent.$inferSelect,
): TestResultStoredEvent {
  return {
    actorAccountId: row.actorAccountId,
    correctedResult:
      row.correctedResult as TestResultStoredEvent["correctedResult"],
    id: row.id,
    kind: row.kind as TestResultStoredEvent["kind"],
    note: row.note,
    previousEventId: row.previousEventId,
    reason: row.reason,
    recordedAt: row.recordedAt.toISOString(),
    redactedEventId: row.redactedEventId,
    redactedField: row.redactedField as TestResultStoredEvent["redactedField"],
    sessionId: row.sessionId,
    sessionTestId: row.sessionTestId,
  };
}

/**
 * PostgreSQL Test Review store. It writes only `project_test_session.review_state`,
 * `project_session_test_review`, `project_test_review_event` and the
 * insert-only `project_test_result_event` (whose only update is clearing the
 * content of an event a security redaction replaced); the reported result columns, Handoffs, Project Releases and Test Gaps are never touched.
 */
export function createDatabaseTestReviewStore(
  database: Database,
): TestReviewStore {
  return {
    run(accountId, projectId, mode, unitOfWork) {
      return database.transaction(async (executor) => {
        const owned =
          mode === "write"
            ? await findOwnedProject(executor, accountId, projectId)
            : await findReadableProject(executor, accountId, projectId);
        if (!owned) {
          return null;
        }
        return await unitOfWork({
          appendEvents: async (events) => {
            if (events.length === 0) {
              return;
            }
            await executor.insert(testReviewEvent).values(
              events.map((entry) => ({
                action: entry.action,
                actorAccountId: entry.actorAccountId,
                batchId: entry.batchId,
                fromState: entry.fromState,
                id: entry.id,
                projectId: owned.id,
                reason: entry.reason,
                recordedAt: new Date(entry.recordedAt),
                remaining: entry.remaining,
                sessionId: entry.sessionId,
                sessionTestId: entry.sessionTestId,
                toState: entry.toState,
              })),
            );
          },
          appendResultEvents: async (events) => {
            if (events.length === 0) {
              return;
            }
            await executor.insert(testResultEvent).values(
              events.map((entry) => ({
                actorAccountId: entry.actorAccountId,
                correctedResult: entry.correctedResult,
                id: entry.id,
                kind: entry.kind,
                note: entry.note,
                previousEventId: entry.previousEventId,
                projectId: owned.id,
                reason: entry.reason,
                recordedAt: new Date(entry.recordedAt),
                redactedEventId: entry.redactedEventId,
                redactedField: entry.redactedField,
                sessionId: entry.sessionId,
                sessionTestId: entry.sessionTestId,
              })),
            );
          },
          eraseResultEventContent: async (eventId) => {
            await executor
              .update(testResultEvent)
              .set({ correctedResult: null, note: null, reason: null })
              .where(
                and(
                  eq(testResultEvent.id, eventId),
                  eq(testResultEvent.projectId, owned.id),
                ),
              );
          },
          findSession: async (sessionId) =>
            (await readSessions(executor, owned.id, sessionId))[0] ?? null,
          listEvents: async () =>
            (
              await executor
                .select()
                .from(testReviewEvent)
                .where(eq(testReviewEvent.projectId, owned.id))
                .orderBy(
                  desc(testReviewEvent.recordedAt),
                  desc(testReviewEvent.id),
                )
                .limit(EVENT_LIMIT)
            ).map(toEvent),
          listResultEvents: async () =>
            (
              await executor
                .select()
                .from(testResultEvent)
                .where(eq(testResultEvent.projectId, owned.id))
                .orderBy(
                  asc(testResultEvent.recordedAt),
                  asc(testResultEvent.id),
                )
            ).map(toResultEvent),
          listSessions: () => readSessions(executor, owned.id),
          readOnly: owned.archivedAt !== null,
          writeItemStates: async (ids, state) => {
            if (ids.length === 0) {
              return;
            }
            await executor
              .insert(sessionTestReview)
              .values(
                ids.map((id) => ({ reviewState: state, sessionTestId: id })),
              )
              .onConflictDoUpdate({
                set: { reviewState: state, updatedAt: new Date() },
                target: sessionTestReview.sessionTestId,
              });
          },
          writeSessionState: async (id, state) => {
            await executor
              .update(testSession)
              .set({ reviewState: state })
              .where(
                and(
                  eq(testSession.id, id),
                  eq(testSession.projectId, owned.id),
                ),
              );
          },
        });
      });
    },
  };
}

export function createDatabaseTestReview(database: Database) {
  return createTestReview(createDatabaseTestReviewStore(database));
}
