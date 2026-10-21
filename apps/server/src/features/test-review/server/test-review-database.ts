import type {
  TestFollowUpLinkStored,
  TestResultStoredEvent,
  TestReviewState,
  TestReviewStore,
  TestReviewStoredEvent,
  TestReviewStoredSession,
} from "@cantiara/api/test-review";
import type {
  BoundSpec,
  TestFollowUpLink,
  TestResultBindingStored,
  TestSupersessionStored,
} from "@cantiara/api/test-review-signals";
import type { Database } from "@cantiara/db";
import { document } from "@cantiara/db/schema/document";
import {
  plannedTestCaseRelation,
  plannedTestCaseVersion,
  sessionTest,
  testHandoff,
  testSession,
} from "@cantiara/db/schema/planned-test";
import {
  sessionTestReview,
  sessionTestSupersession,
  testFollowUpLink,
  testResultBinding,
  testResultEvent,
  testReviewEvent,
} from "@cantiara/db/schema/test-review";
import { work } from "@cantiara/db/schema/work";
import {
  and,
  asc,
  desc,
  eq,
  inArray,
  isNotNull,
  isNull,
  ne,
} from "drizzle-orm";

import { insertWorkWithKeyAllocation } from "../../evidence/server/evidence-record-creation";
import {
  type FeedbackExecutor,
  findOwnedProject,
  findReadableProject,
} from "../../feedback/server/feedback-database";
import { createTestReview } from "./test-review";
import { readSummaryFacts } from "./test-review-summary-database";

type Executor = FeedbackExecutor;

const EVENT_LIMIT = 500;

/**
 * Primary spec revisions each exact scenario version was bound to, beside the
 * live Document head. Only a Document that is some Work's Primary spec counts;
 * any other Document relation is not a Birincil spec binding.
 */
async function readBoundSpecs(
  executor: Executor,
  projectId: string,
  pairs: { scenarioId: string; scenarioVersion: number }[],
) {
  const bound = new Map<string, BoundSpec[]>();
  if (pairs.length === 0) {
    return bound;
  }
  const primary = await executor
    .select({ id: work.primarySpecId })
    .from(work)
    .where(and(eq(work.projectId, projectId), isNotNull(work.primarySpecId)));
  const primaryIds = [
    ...new Set(primary.flatMap(({ id }) => (id ? [id] : []))),
  ];
  if (primaryIds.length === 0) {
    return bound;
  }
  const rows = await executor
    .select({
      boundRevision: plannedTestCaseRelation.documentRevision,
      caseId: plannedTestCaseVersion.caseId,
      currentRevision: document.revision,
      documentId: document.id,
      title: document.title,
      version: plannedTestCaseVersion.version,
    })
    .from(plannedTestCaseRelation)
    .innerJoin(
      plannedTestCaseVersion,
      eq(plannedTestCaseVersion.id, plannedTestCaseRelation.versionId),
    )
    .innerJoin(document, eq(document.id, plannedTestCaseRelation.targetId))
    .where(
      and(
        eq(plannedTestCaseRelation.targetType, "Document"),
        inArray(document.id, primaryIds),
        inArray(plannedTestCaseVersion.caseId, [
          ...new Set(pairs.map((pair) => pair.scenarioId)),
        ]),
      ),
    );
  for (const row of rows) {
    if (row.boundRevision === null) {
      continue;
    }
    const key = `${row.caseId}@${row.version}`;
    bound.set(key, [
      ...(bound.get(key) ?? []),
      {
        boundRevision: row.boundRevision,
        currentRevision: row.currentRevision,
        documentId: row.documentId,
        title: row.title,
      },
    ]);
  }
  return bound;
}

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
      scenarioId: sessionTest.scenarioId,
      scenarioVersion: sessionTest.scenarioVersion,
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
  const handoffs = await executor
    .select({
      buildBranch: testHandoff.buildBranch,
      buildCommit: testHandoff.buildCommit,
      buildName: testHandoff.buildName,
      id: testHandoff.id,
    })
    .from(testHandoff)
    .where(eq(testHandoff.projectId, projectId));
  const targets = new Map(
    handoffs.map((handoff) => {
      const target: Record<string, string> = {};
      if (handoff.buildBranch) {
        target.branch = handoff.buildBranch;
      }
      if (handoff.buildCommit) {
        target.commit = handoff.buildCommit;
      }
      if (handoff.buildName) {
        target.build = handoff.buildName;
      }
      return [
        handoff.id,
        Object.keys(target).length > 0 ? target : null,
      ] as const;
    }),
  );
  const bound = await readBoundSpecs(
    executor,
    projectId,
    items.flatMap((item) =>
      item.scenarioId && item.scenarioVersion
        ? [
            {
              scenarioId: item.scenarioId,
              scenarioVersion: item.scenarioVersion,
            },
          ]
        : [],
    ),
  );
  return sessions.map((row) => ({
    context: row.context,
    executorName: row.executorName,
    id: row.id,
    items: items
      .filter((item) => item.sessionId === row.id)
      .map((item) => ({
        boundSpecs:
          bound.get(`${item.scenarioId}@${item.scenarioVersion}`) ?? [],
        id: item.id,
        normalizedResult: item.normalizedResult,
        position: item.position,
        rawResult: item.rawResult,
        reviewState: (item.reviewState ?? "Unreviewed") as TestReviewState,
        scenarioId: item.scenarioId,
        scenarioVersion: item.scenarioVersion,
        title: item.title,
      })),
    projectId: row.projectId,
    reportedAt: row.reportedAt.toISOString(),
    reporter:
      row.reporterKind === "user"
        ? "User"
        : `${row.reporterKind} ${row.reporterId}`,
    reviewState: row.reviewState as TestReviewState,
    summary: row.summary,
    targetContext: row.handoffId ? (targets.get(row.handoffId) ?? null) : null,
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

function toSupersession(
  row: typeof sessionTestSupersession.$inferSelect,
): TestSupersessionStored {
  return {
    actorAccountId: row.actorAccountId,
    id: row.id,
    newerSessionTestId: row.newerSessionTestId,
    olderSessionTestId: row.olderSessionTestId,
    reason: row.reason,
    recordedAt: row.recordedAt.toISOString(),
  };
}

function toBinding(
  row: typeof testResultBinding.$inferSelect,
): TestResultBindingStored {
  return {
    actorAccountId: row.actorAccountId,
    id: row.id,
    judgedSessionTestIds: row.judgedSessionTestIds,
    reason: row.reason,
    recordedAt: row.recordedAt.toISOString(),
    scenarioId: row.scenarioId,
    scenarioVersion: row.scenarioVersion,
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
          appendBinding: async (binding) => {
            await executor.insert(testResultBinding).values({
              actorAccountId: binding.actorAccountId,
              id: binding.id,
              judgedSessionTestIds: binding.judgedSessionTestIds,
              projectId: owned.id,
              reason: binding.reason,
              recordedAt: new Date(binding.recordedAt),
              scenarioId: binding.scenarioId,
              scenarioVersion: binding.scenarioVersion,
              sessionTestId: binding.sessionTestId,
            });
          },
          appendFollowUpLinks: async (links: TestFollowUpLinkStored[]) => {
            if (links.length === 0) {
              return;
            }
            await executor.insert(testFollowUpLink).values(
              links.map((link) => ({
                actorAccountId: link.actorAccountId,
                id: link.id,
                mode: link.mode,
                projectId: owned.id,
                recordedAt: new Date(link.recordedAt),
                sessionId: link.sessionId,
                sessionTestId: link.sessionTestId,
                workId: link.workId,
              })),
            );
          },
          appendSupersession: async (edge) => {
            await executor.insert(sessionTestSupersession).values({
              actorAccountId: edge.actorAccountId,
              id: edge.id,
              newerSessionTestId: edge.newerSessionTestId,
              olderSessionTestId: edge.olderSessionTestId,
              projectId: owned.id,
              reason: edge.reason,
              recordedAt: new Date(edge.recordedAt),
            });
          },
          createFollowUpWork: (input) =>
            insertWorkWithKeyAllocation(executor, owned.project, {
              committedAt: new Date(),
              description: input.description,
              idempotencyKey: `test-review-follow-up:${input.workId}`,
              originComponentId: input.originComponentId,
              originOwnerRecordId: input.originOwnerRecordId,
              originSourceVersion: input.originSourceVersion,
              payloadFingerprint: input.payloadFingerprint,
              title: input.title,
              type: input.type,
              workId: input.workId,
            }),
          findFollowUpWork: async (workId) => {
            const [found] = await executor
              .select({
                id: work.id,
                key: work.key,
                status: work.status,
                title: work.title,
                type: work.type,
              })
              .from(work)
              .where(
                and(
                  eq(work.id, workId),
                  eq(work.projectId, owned.id),
                  ne(work.type, "Feature"),
                  isNull(work.trashedAt),
                  isNull(work.archivedAt),
                ),
              )
              .limit(1);
            return found ?? null;
          },
          listBindings: async () =>
            (
              await executor
                .select()
                .from(testResultBinding)
                .where(eq(testResultBinding.projectId, owned.id))
                .orderBy(asc(testResultBinding.recordedAt))
            ).map(toBinding),
          listFollowUps: async (): Promise<TestFollowUpLink[]> =>
            (
              await executor
                .select({
                  link: testFollowUpLink,
                  workKey: work.key,
                  workStatus: work.status,
                  workTitle: work.title,
                })
                .from(testFollowUpLink)
                .leftJoin(work, eq(work.id, testFollowUpLink.workId))
                .where(eq(testFollowUpLink.projectId, owned.id))
                .orderBy(
                  asc(testFollowUpLink.recordedAt),
                  asc(testFollowUpLink.id),
                )
            ).map((row) => ({
              actorAccountId: row.link.actorAccountId,
              id: row.link.id,
              mode: row.link.mode as TestFollowUpLink["mode"],
              recordedAt: row.link.recordedAt.toISOString(),
              sessionId: row.link.sessionId,
              sessionTestId: row.link.sessionTestId,
              workId: row.link.workId,
              workKey: row.workKey,
              workStatus: row.workStatus,
              workTitle: row.workTitle,
            })),
          listSupersessions: async () =>
            (
              await executor
                .select()
                .from(sessionTestSupersession)
                .where(eq(sessionTestSupersession.projectId, owned.id))
                .orderBy(asc(sessionTestSupersession.recordedAt))
            ).map(toSupersession),
          projectName: owned.project.name,
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
          readSummaryFacts: (scope) =>
            readSummaryFacts(executor, owned.id, owned.project.name, scope),
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
