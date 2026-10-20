import type {
  SessionTestReportStoredRecord,
  TestReportAttentionSignal,
  TestReportExecutorType,
  TestReportIngress,
  TestReportLookup,
  TestReportLookupType,
  TestReportResult,
  TestReportStore,
  TestSessionStoredRecord,
} from "@cantiara/api/test-report";
import type { Database } from "@cantiara/db";
import {
  fileAttachment,
  fileAttachmentVersion,
} from "@cantiara/db/schema/file-attachments";
import {
  plannedTestCase,
  plannedTestCaseVersion,
  sessionTest,
  testHandoff,
  testHandoffScenario,
  testReportAttentionSignal,
  testSession,
  testSessionIdentity,
} from "@cantiara/db/schema/planned-test";
import { projectRelease } from "@cantiara/db/schema/project-release";
import { work } from "@cantiara/db/schema/work";
import { and, asc, desc, eq, inArray, isNull } from "drizzle-orm";
import {
  findOwnedProject,
  findReadableProject,
} from "../../feedback/server/feedback-database";
import { createTestReportAcceptance } from "./test-report";

function toStoredTest(
  row: typeof sessionTest.$inferSelect,
): SessionTestReportStoredRecord {
  return {
    evidence: row.evidence ?? [],
    externalTestId: row.externalTestId ?? "",
    id: row.id,
    normalizedResult: (row.normalizedResult ??
      "not_reported") as TestReportResult,
    notes: row.notes,
    position: row.position ?? 0,
    rawResult: row.rawResult,
    relations: row.relations ?? [],
    scenarioId: row.scenarioId,
    scenarioVersion: row.scenarioVersion,
    title: row.title,
  };
}

function toStoredSession(
  row: typeof testSession.$inferSelect,
  tests: SessionTestReportStoredRecord[],
): TestSessionStoredRecord {
  return {
    acceptedAt: row.acceptedAt.toISOString(),
    context: row.context,
    endedAt: row.endedAt?.toISOString() ?? null,
    executor: {
      name: row.executorName,
      type: row.executorType as TestReportExecutorType,
      version: row.executorVersion,
    },
    externalSessionId: row.externalSessionId,
    fingerprint: row.fingerprint ?? "",
    handoffId: row.handoffId,
    handoffPackageVersion: row.handoffPackageVersion,
    handoffStateAtAccept: row.handoffStateAtAccept,
    id: row.id,
    ingress: row.ingress as TestReportIngress,
    projectId: row.projectId,
    rawReport: row.rawReport,
    reportedAt: row.reportedAt.toISOString(),
    reportedAtText: row.reportedAtText,
    reporter: {
      id: row.reporterId,
      kind: row.reporterKind as "integration" | "user",
    },
    reviewState: "Unreviewed",
    schemaVersion: row.schemaVersion,
    startedAt: row.startedAt?.toISOString() ?? null,
    summary: row.summary,
    tests,
  };
}

export interface TestReportAttentionSignalSink {
  produce: (
    executor: Pick<Executor, "insert">,
    signal: TestReportAttentionSignal,
  ) => Promise<void> | void;
}

export interface DatabaseTestReportOptions {
  attentionSignalSink?: TestReportAttentionSignalSink;
}

/** Default sink: the signal row joins the transaction of the session that caused it. */
const defaultAttentionSignalSink: TestReportAttentionSignalSink = {
  async produce(executor, signal) {
    await executor.insert(testReportAttentionSignal).values({
      handoffId: signal.source.handoffId,
      occurredAt: new Date(signal.occurredAt),
      ownerAccountId: signal.ownerAccountId,
      presentation: signal.presentation,
      projectId: signal.source.projectId,
      sessionId: signal.source.sessionId,
      signalId: signal.signalId,
      signalType: signal.signalType,
    });
  },
};

type Executor = Parameters<Parameters<Database["transaction"]>[0]>[0];

const IDENTITY_CONSTRAINT = "project_test_session_identity_pk";

/** Postgres unique violation on the idempotency key, however the driver wraps it. */
function isIdentityConflict(error: unknown) {
  const candidates = [error, (error as { cause?: unknown } | null)?.cause];
  return candidates.some((candidate) => {
    const found = candidate as { code?: string; constraint?: string } | null;
    return found?.code === "23505" && found.constraint === IDENTITY_CONSTRAINT;
  });
}

async function insertSessionRows(
  executor: Pick<Executor, "insert">,
  projectId: string,
  record: TestSessionStoredRecord,
) {
  await executor.insert(testSession).values({
    acceptedAt: new Date(record.acceptedAt),
    context: record.context,
    endedAt: record.endedAt ? new Date(record.endedAt) : null,
    executorName: record.executor.name,
    executorType: record.executor.type,
    executorVersion: record.executor.version,
    externalSessionId: record.externalSessionId,
    fingerprint: record.fingerprint,
    handoffId: record.handoffId,
    handoffPackageVersion: record.handoffPackageVersion,
    handoffStateAtAccept: record.handoffStateAtAccept,
    id: record.id,
    ingress: record.ingress,
    projectId,
    rawReport: record.rawReport,
    reportedAt: new Date(record.reportedAt),
    reportedAtText: record.reportedAtText,
    reporterId: record.reporter.id,
    reporterKind: record.reporter.kind,
    reviewState: record.reviewState,
    schemaVersion: record.schemaVersion,
    startedAt: record.startedAt ? new Date(record.startedAt) : null,
    summary: record.summary,
  });
  await executor.insert(testSessionIdentity).values({
    externalSessionId: record.externalSessionId,
    ingress: record.ingress,
    projectId,
    reporterId: record.reporter.id,
    sessionId: record.id,
  });
  if (record.tests.length === 0) {
    return;
  }
  await executor.insert(sessionTest).values(
    record.tests.map((test) => ({
      bindOrigin: test.scenarioId ? "Bound when recorded" : null,
      createdAt: new Date(record.acceptedAt),
      evidence: test.evidence,
      // A reported ad hoc test states what was tried as its purpose (the older
      // content check pairs it with an expectation).
      expectedBehavior: test.scenarioId ? null : "",
      externalTestId: test.externalTestId,
      id: test.id,
      normalizedResult: test.normalizedResult,
      notes: test.notes,
      position: test.position,
      projectId,
      purpose: test.scenarioId ? null : test.title,
      rawResult: test.rawResult,
      relations: test.relations,
      scenarioId: test.scenarioId,
      scenarioVersion: test.scenarioVersion,
      sessionId: record.id,
      title: test.title,
    })),
  );
}

async function readSession(
  executor: Pick<Executor, "select">,
  sessionId: string,
) {
  const [row] = await executor
    .select()
    .from(testSession)
    .where(eq(testSession.id, sessionId))
    .limit(1);
  if (!row) {
    return null;
  }
  const tests = await executor
    .select()
    .from(sessionTest)
    .where(eq(sessionTest.sessionId, sessionId))
    .orderBy(asc(sessionTest.position));
  return toStoredSession(row, tests.map(toStoredTest));
}

function scopeOf(rowProjectId: string, projectId: string): TestReportLookup {
  return rowProjectId === projectId ? "found" : "other_project";
}

/** Existence and Project scope of an allow-listed record; trashed Work is gone. */
async function resolveReference(
  executor: Pick<Executor, "select">,
  projectId: string,
  type: TestReportLookupType,
  id: string,
  version: number | null,
): Promise<TestReportLookup> {
  switch (type) {
    case "planned_test_case": {
      const [row] = await executor
        .select({ projectId: plannedTestCase.projectId })
        .from(plannedTestCaseVersion)
        .innerJoin(
          plannedTestCase,
          eq(plannedTestCase.id, plannedTestCaseVersion.caseId),
        )
        .where(
          and(
            eq(plannedTestCaseVersion.caseId, id),
            eq(plannedTestCaseVersion.version, version ?? 0),
          ),
        )
        .limit(1);
      return row ? scopeOf(row.projectId, projectId) : "missing";
    }
    case "work":
    case "feature": {
      const [row] = await executor
        .select({ projectId: work.projectId, type: work.type })
        .from(work)
        .where(and(eq(work.id, id), isNull(work.trashedAt)))
        .limit(1);
      // Feature is Work of type Feature: neither stands in for the other.
      if (!row || (row.type === "Feature") !== (type === "feature")) {
        return "missing";
      }
      return scopeOf(row.projectId, projectId);
    }
    case "project_release": {
      const [row] = await executor
        .select({ projectId: projectRelease.projectId })
        .from(projectRelease)
        .where(eq(projectRelease.id, id))
        .limit(1);
      return row ? scopeOf(row.projectId, projectId) : "missing";
    }
    default:
      // Test Gap has no record yet (spec 56), so nothing can be related to.
      return "missing";
  }
}

/**
 * PostgreSQL Test Report Acceptance store. One transaction holds the Test
 * Session row and every Session Test row, so a failure rolls all of it back.
 */
export function createDatabaseTestReportStore(
  database: Database,
  options: DatabaseTestReportOptions = {},
): TestReportStore {
  const attentionSignalSink =
    options.attentionSignalSink ?? defaultAttentionSignalSink;
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
          findHandoff: async (handoffId) => {
            const [row] = await executor
              .select()
              .from(testHandoff)
              .where(eq(testHandoff.id, handoffId))
              .limit(1);
            if (!row) {
              return null;
            }
            if (row.projectId !== owned.id) {
              return "other_project";
            }
            const scenarios = await executor
              .select()
              .from(testHandoffScenario)
              .where(eq(testHandoffScenario.handoffId, handoffId));
            return {
              id: row.id,
              packageVersion: row.packageVersion,
              scenarios: scenarios.map(({ caseId, version }) => ({
                caseId,
                version,
              })),
              state: row.state,
            };
          },
          findSessionByIdentity: async (
            ingress,
            reporterId,
            externalSessionId,
          ) => {
            const [identity] = await executor
              .select({ sessionId: testSessionIdentity.sessionId })
              .from(testSessionIdentity)
              .where(
                and(
                  eq(testSessionIdentity.projectId, owned.id),
                  eq(testSessionIdentity.ingress, ingress),
                  eq(testSessionIdentity.reporterId, reporterId),
                  eq(testSessionIdentity.externalSessionId, externalSessionId),
                ),
              )
              .limit(1);
            return identity
              ? await readSession(executor, identity.sessionId)
              : null;
          },
          insertSession: async (record) => {
            // A savepoint keeps the session, its identity and its tests together:
            // a lost identity race rolls all three back and reports `false`.
            try {
              await executor.transaction(async (inner) => {
                await insertSessionRows(inner, owned.id, record);
              });
              return true;
            } catch (error) {
              if (isIdentityConflict(error)) {
                return false;
              }
              throw error;
            }
          },
          listSessions: async () => {
            const rows = await executor
              .select()
              .from(testSession)
              .where(eq(testSession.projectId, owned.id))
              .orderBy(desc(testSession.reportedAt), asc(testSession.id));
            if (rows.length === 0) {
              return [];
            }
            const tests = await executor
              .select()
              .from(sessionTest)
              .where(
                inArray(
                  sessionTest.sessionId,
                  rows.map(({ id }) => id),
                ),
              )
              .orderBy(asc(sessionTest.position));
            return rows.map((row) =>
              toStoredSession(
                row,
                tests
                  .filter((test) => test.sessionId === row.id)
                  .map(toStoredTest),
              ),
            );
          },
          produceSignal: async (signal) => {
            await attentionSignalSink.produce(executor, signal);
          },
          readOnly: owned.archivedAt !== null,
          resolveAttachment: async (attachmentId) => {
            const [row] = await executor
              .select({
                contentHash: fileAttachmentVersion.contentHash,
                lifecycleStatus: fileAttachment.lifecycleStatus,
                projectId: fileAttachment.projectId,
              })
              .from(fileAttachment)
              .innerJoin(
                fileAttachmentVersion,
                and(
                  eq(fileAttachmentVersion.attachmentId, fileAttachment.id),
                  eq(
                    fileAttachmentVersion.version,
                    fileAttachment.currentVersion,
                  ),
                ),
              )
              .where(eq(fileAttachment.id, attachmentId))
              .limit(1);
            if (!row || row.lifecycleStatus === "Trash") {
              return { status: "missing" };
            }
            return row.projectId === owned.id
              ? { contentHash: row.contentHash, status: "found" }
              : { status: "other_project" };
          },
          resolveReference: (type, id, version) =>
            resolveReference(executor, owned.id, type, id, version),
        });
      });
    },
  };
}

export function createDatabaseTestReports(
  database: Database,
  options: DatabaseTestReportOptions = {},
) {
  return createTestReportAcceptance(
    createDatabaseTestReportStore(database, options),
  );
}
