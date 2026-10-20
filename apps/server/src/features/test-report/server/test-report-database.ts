import type {
  SessionTestReportStoredRecord,
  TestReportExecutorType,
  TestReportIngress,
  TestReportResult,
  TestReportStore,
  TestSessionStoredRecord,
} from "@cantiara/api/test-report";
import type { Database } from "@cantiara/db";
import {
  plannedTestCase,
  plannedTestCaseVersion,
  sessionTest,
  testSession,
} from "@cantiara/db/schema/planned-test";
import { and, asc, desc, eq, inArray } from "drizzle-orm";
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
    handoffId: row.handoffId,
    handoffPackageVersion: row.handoffPackageVersion,
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

/**
 * PostgreSQL Test Report Acceptance store. One transaction holds the Test
 * Session row and every Session Test row, so a failure rolls all of it back.
 */
export function createDatabaseTestReportStore(
  database: Database,
): TestReportStore {
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
          insertSession: async (record) => {
            await executor.insert(testSession).values({
              acceptedAt: new Date(record.acceptedAt),
              context: record.context,
              endedAt: record.endedAt ? new Date(record.endedAt) : null,
              executorName: record.executor.name,
              executorType: record.executor.type,
              executorVersion: record.executor.version,
              externalSessionId: record.externalSessionId,
              handoffId: record.handoffId,
              handoffPackageVersion: record.handoffPackageVersion,
              id: record.id,
              ingress: record.ingress,
              projectId: owned.id,
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
            if (record.tests.length === 0) {
              return;
            }
            await executor.insert(sessionTest).values(
              record.tests.map((test) => ({
                bindOrigin: test.scenarioId ? "Bound when recorded" : null,
                createdAt: new Date(record.acceptedAt),
                evidence: test.evidence,
                // A reported ad hoc test states what was tried as its purpose
                // (the older content check pairs it with an expectation).
                expectedBehavior: test.scenarioId ? null : "",
                externalTestId: test.externalTestId,
                id: test.id,
                normalizedResult: test.normalizedResult,
                notes: test.notes,
                position: test.position,
                projectId: owned.id,
                purpose: test.scenarioId ? null : test.title,
                rawResult: test.rawResult,
                relations: test.relations,
                scenarioId: test.scenarioId,
                scenarioVersion: test.scenarioVersion,
                sessionId: record.id,
                title: test.title,
              })),
            );
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
          readOnly: owned.archivedAt !== null,
          scenarioVersionExists: async (caseId, version) => {
            const [found] = await executor
              .select({ id: plannedTestCaseVersion.id })
              .from(plannedTestCaseVersion)
              .innerJoin(
                plannedTestCase,
                eq(plannedTestCase.id, plannedTestCaseVersion.caseId),
              )
              .where(
                and(
                  eq(plannedTestCaseVersion.caseId, caseId),
                  eq(plannedTestCaseVersion.version, version),
                  eq(plannedTestCase.projectId, owned.id),
                ),
              )
              .limit(1);
            return found !== undefined;
          },
        });
      });
    },
  };
}

export function createDatabaseTestReports(database: Database) {
  return createTestReportAcceptance(createDatabaseTestReportStore(database));
}
