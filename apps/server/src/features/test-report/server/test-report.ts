import {
  type AcceptTestReportInput,
  acceptTestReportInputSchema,
  parseTestReport,
  rejection,
  type SessionTestReportStoredRecord,
  TEST_REPORT_SCHEMA_VERSION,
  type TestReportAcceptanceAccess,
  type TestReportCaller,
  type TestReportStore,
  type TestReportTransaction,
  type TestReportV1,
  type TestSessionStoredRecord,
  testSessionProjectInputSchema,
  toTestSessionRecord,
} from "@cantiara/api/test-report";
import { parseTestReportFile } from "@cantiara/api/test-report-import";

/** The report as the manual form writes it: the product supplies the envelope fields. */
function manualEnvelope(
  input: Extract<AcceptTestReportInput, { ingress: "Application" }>,
) {
  return {
    executor: input.executor,
    external_session_id: crypto.randomUUID(),
    project_id: input.projectId,
    reported_at: input.reportedAt ?? new Date().toISOString(),
    schema_version: TEST_REPORT_SCHEMA_VERSION,
    summary: input.summary,
    tests: input.tests.map((test) => ({
      external_test_id: crypto.randomUUID(),
      normalized_result: test.result,
      notes: test.notes,
      raw_result: test.result,
      title: test.title,
    })),
  };
}

/** Where the report is aimed; MCP names its Project inside the envelope. */
function targetProjectId(input: AcceptTestReportInput) {
  if (input.ingress !== "MCP") {
    return input.projectId;
  }
  const { report } = input;
  const candidate =
    typeof report === "object" && report !== null
      ? (report as Record<string, unknown>).project_id
      : undefined;
  if (typeof candidate !== "string" || candidate === "") {
    throw rejection("invalid_field", "project_id");
  }
  return candidate;
}

function rawEnvelope(input: AcceptTestReportInput): unknown {
  switch (input.ingress) {
    case "Application":
      return manualEnvelope(input);
    case "File import":
      return parseTestReportFile(input.format, input.content);
    default:
      return input.report;
  }
}

/** The older in-Project Session Test content check needs a purpose; a report states what was tried. */
function toStoredTests(report: TestReportV1): SessionTestReportStoredRecord[] {
  return report.tests.map((test, position) => ({
    evidence: test.evidence ?? [],
    externalTestId: test.external_test_id,
    id: crypto.randomUUID(),
    normalizedResult: test.normalized_result ?? "not_reported",
    notes: test.notes ?? null,
    position,
    rawResult: test.raw_result ?? null,
    relations: test.relations ?? [],
    scenarioId: test.scenario_id ?? null,
    scenarioVersion: test.scenario_version ?? null,
    title: test.title,
  }));
}

async function requireScenarios(
  transaction: TestReportTransaction,
  tests: SessionTestReportStoredRecord[],
) {
  const bound = tests.filter(
    (test) => test.scenarioId !== null && test.scenarioVersion !== null,
  );
  const found = await Promise.all(
    bound.map((test) =>
      transaction.scenarioVersionExists(
        test.scenarioId as string,
        test.scenarioVersion as number,
      ),
    ),
  );
  const missing = bound.find((_test, index) => !found[index]);
  if (missing) {
    throw rejection(
      "reference_not_found",
      `tests[${missing.position}].scenario_id`,
    );
  }
}

function toStoredSession(
  caller: TestReportCaller,
  input: AcceptTestReportInput,
  report: TestReportV1,
  tests: SessionTestReportStoredRecord[],
): TestSessionStoredRecord {
  return {
    acceptedAt: new Date().toISOString(),
    context: report.context ?? null,
    endedAt: report.ended_at ? new Date(report.ended_at).toISOString() : null,
    executor: {
      name: report.executor.name,
      type: report.executor.type,
      version: report.executor.version ?? null,
    },
    externalSessionId: report.external_session_id,
    handoffId: report.handoff_id ?? null,
    handoffPackageVersion: report.handoff_package_version ?? null,
    id: crypto.randomUUID(),
    ingress: input.ingress,
    projectId: report.project_id,
    rawReport: report.raw_report ?? null,
    reportedAt: new Date(report.reported_at).toISOString(),
    reportedAtText: report.reported_at,
    reporter: caller.reporter,
    reviewState: "Unreviewed",
    schemaVersion: report.schema_version,
    startedAt: report.started_at
      ? new Date(report.started_at).toISOString()
      : null,
    summary: report.summary ?? null,
    tests,
  };
}

/**
 * Test Report Acceptance. `accept` is the only write: it validates the whole
 * `test-report/1` envelope first and stores one Test Session with all its
 * Session Tests in one unit of work, or throws a closed-code refusal and stores
 * nothing. The reporter comes from the verified caller, never from the payload.
 * It opens no review, release gate, notification or score.
 */
export function createTestReportAcceptance(
  store: TestReportStore,
): TestReportAcceptanceAccess {
  return {
    async accept(caller, rawInput) {
      const input = acceptTestReportInputSchema.parse(rawInput);
      const stored = await store.run(
        caller.accountId,
        targetProjectId(input),
        "write",
        async (transaction) => {
          if (transaction.readOnly) {
            throw rejection("project_not_authorized");
          }
          const report = parseTestReport(rawEnvelope(input), input.ingress);
          if (
            input.ingress !== "MCP" &&
            report.project_id !== input.projectId
          ) {
            throw rejection("reference_scope_mismatch", "project_id");
          }
          const tests = toStoredTests(report);
          await requireScenarios(transaction, tests);
          const session = toStoredSession(caller, input, report, tests);
          await transaction.insertSession(session);
          return session;
        },
      );
      if (!stored) {
        throw rejection("project_not_authorized");
      }
      return { outcome: "created", session: toTestSessionRecord(stored) };
    },

    async sessions(accountId, projectId) {
      const parsed = testSessionProjectInputSchema.parse({ projectId });
      const listed = await store.run(
        accountId,
        parsed.projectId,
        "read",
        async (transaction) => ({
          readOnly: transaction.readOnly,
          sessions: (await transaction.listSessions())
            .sort(
              (left, right) =>
                right.reportedAt.localeCompare(left.reportedAt) ||
                left.id.localeCompare(right.id),
            )
            .map(toTestSessionRecord),
        }),
      );
      if (!listed) {
        throw rejection("project_not_authorized");
      }
      return listed;
    },
  };
}
