import {
  type AcceptTestReportInput,
  acceptTestReportInputSchema,
  parseTestReport,
  rejection,
  type SessionTestReportStoredRecord,
  TEST_REPORT_LIMITS,
  TEST_REPORT_SCHEMA_VERSION,
  type TestReportAcceptanceAccess,
  type TestReportCaller,
  type TestReportHandoffRef,
  type TestReportLookup,
  type TestReportRejectedError,
  type TestReportStore,
  type TestReportTransaction,
  type TestReportV1,
  type TestSessionStoredRecord,
  testSessionProjectInputSchema,
  toTestSessionRecord,
} from "@cantiara/api/test-report";
import { testReportFingerprint } from "@cantiara/api/test-report-identity";
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

type Check = () => Promise<TestReportRejectedError | null>;

/** The first refusal in report order, so the error is stable whatever resolves first. */
async function firstRefusal(checks: Check[]) {
  const results = await Promise.all(checks.map((check) => check()));
  return results.find((result) => result !== null) ?? null;
}

function lookupRefusal(lookup: TestReportLookup, fieldPath: string) {
  if (lookup === "missing") {
    return rejection("reference_not_found", fieldPath);
  }
  return lookup === "other_project"
    ? rejection("reference_scope_mismatch", fieldPath)
    : null;
}

/** The Handoff the report is bound to; its package version must match exactly. */
async function requireHandoff(
  transaction: TestReportTransaction,
  report: TestReportV1,
) {
  if (report.handoff_id === undefined) {
    return null;
  }
  const found = await transaction.findHandoff(report.handoff_id);
  // Another Project's Handoff reads the same as an unknown one.
  if (found === null || found === "other_project") {
    throw rejection("reference_not_found", "handoff_id");
  }
  if (found.packageVersion !== report.handoff_package_version) {
    throw rejection("reference_scope_mismatch", "handoff_package_version");
  }
  return found;
}

function inPackage(
  handoff: TestReportHandoffRef,
  caseId: string,
  version: number | undefined,
) {
  return handoff.scenarios.some(
    (scenario) => scenario.caseId === caseId && scenario.version === version,
  );
}

async function relationRefusal(
  transaction: TestReportTransaction,
  handoff: TestReportHandoffRef | null,
  relation: NonNullable<TestReportV1["tests"][number]["relations"]>[number],
  fieldPath: string,
) {
  if (relation.target_type === "test_handoff") {
    const found = await transaction.findHandoff(relation.target_id);
    if (found === null) {
      return rejection("reference_not_found", fieldPath);
    }
    if (found === "other_project" || (handoff && found.id !== handoff.id)) {
      return rejection("reference_scope_mismatch", fieldPath);
    }
    return null;
  }
  const lookup = await transaction.resolveReference(
    relation.target_type,
    relation.target_id,
    relation.scenario_version ?? null,
  );
  const refusal = lookupRefusal(lookup, fieldPath);
  if (refusal) {
    return refusal;
  }
  return relation.target_type === "planned_test_case" &&
    handoff &&
    !inPackage(handoff, relation.target_id, relation.scenario_version)
    ? rejection("reference_scope_mismatch", fieldPath)
    : null;
}

/** Every scenario and relation must be a real, in-scope record; nothing is dropped silently. */
async function requireReferences(
  transaction: TestReportTransaction,
  handoff: TestReportHandoffRef | null,
  report: TestReportV1,
) {
  const checks: Check[] = [];
  report.tests.forEach((test, index) => {
    const at = `tests[${index}]`;
    if (test.scenario_id !== undefined && test.scenario_version !== undefined) {
      const { scenario_id: caseId, scenario_version: version } = test;
      checks.push(async () => {
        const refusal = lookupRefusal(
          await transaction.resolveReference(
            "planned_test_case",
            caseId,
            version,
          ),
          `${at}.scenario_id`,
        );
        return (
          refusal ??
          (handoff && !inPackage(handoff, caseId, version)
            ? rejection("reference_scope_mismatch", `${at}.scenario_id`)
            : null)
        );
      });
    }
    test.relations?.forEach((relation, relationIndex) => {
      checks.push(() =>
        relationRefusal(
          transaction,
          handoff,
          relation,
          `${at}.relations[${relationIndex}].target_id`,
        ),
      );
    });
  });
  const refusal = await firstRefusal(checks);
  if (refusal) {
    throw refusal;
  }
}

/** The raw size is checked before any schema runs; nothing is trimmed. */
function assertEnvelopeSize(raw: unknown) {
  let bytes: number;
  try {
    bytes = new TextEncoder().encode(JSON.stringify(raw) ?? "").length;
  } catch (error) {
    const refusal = rejection("invalid_field");
    refusal.cause = error;
    throw refusal;
  }
  if (bytes > TEST_REPORT_LIMITS.envelopeBytes) {
    throw rejection("payload_too_large");
  }
}

function toStoredSession(
  caller: TestReportCaller,
  input: AcceptTestReportInput,
  report: TestReportV1,
  tests: SessionTestReportStoredRecord[],
  handoff: TestReportHandoffRef | null,
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
    fingerprint: testReportFingerprint(report),
    handoffId: report.handoff_id ?? null,
    handoffPackageVersion: report.handoff_package_version ?? null,
    handoffStateAtAccept: handoff?.state ?? null,
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
 * The ingress + verified reporter + external session id boundary. The same
 * canonical content is the prior receipt; different content is a conflict and
 * never an update. The executor is not part of either.
 */
async function priorAcceptance(
  transaction: TestReportTransaction,
  caller: TestReportCaller,
  input: AcceptTestReportInput,
  report: TestReportV1,
) {
  const prior = await transaction.findSessionByIdentity(
    input.ingress,
    caller.reporter.id,
    report.external_session_id,
  );
  if (!prior) {
    return null;
  }
  if (prior.fingerprint !== testReportFingerprint(report)) {
    throw rejection("identity_conflict", "external_session_id");
  }
  return { outcome: "duplicate" as const, stored: prior };
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
      const accepted = await store.run(
        caller.accountId,
        targetProjectId(input),
        "write",
        async (transaction) => {
          if (transaction.readOnly) {
            throw rejection("project_not_authorized");
          }
          const raw = rawEnvelope(input);
          if (input.ingress !== "File import") {
            assertEnvelopeSize(raw);
          }
          const report = parseTestReport(raw, input.ingress);
          if (
            input.ingress !== "MCP" &&
            report.project_id !== input.projectId
          ) {
            throw rejection("reference_scope_mismatch", "project_id");
          }
          const tests = toStoredTests(report);
          const prior = await priorAcceptance(
            transaction,
            caller,
            input,
            report,
          );
          if (prior) {
            return prior;
          }
          const handoff = await requireHandoff(transaction, report);
          await requireReferences(transaction, handoff, report);
          const session = toStoredSession(
            caller,
            input,
            report,
            tests,
            handoff,
          );
          if (!(await transaction.insertSession(session))) {
            // A concurrent delivery won the identity; answer from what it stored.
            const winner = await priorAcceptance(
              transaction,
              caller,
              input,
              report,
            );
            if (winner) {
              return winner;
            }
            throw rejection("identity_conflict", "external_session_id");
          }
          return { outcome: "created" as const, stored: session };
        },
      );
      if (!accepted) {
        throw rejection("project_not_authorized");
      }
      return {
        outcome: accepted.outcome,
        session: toTestSessionRecord(accepted.stored),
      };
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
