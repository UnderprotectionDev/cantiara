import { z } from "zod";

/**
 * Test Report Acceptance (spec 54, ticket 01): the single seam that turns a
 * reported test run into one Test Session (Test Oturumu) with its Session Tests
 * (Oturum Testi). The manual form, a JSON or Markdown file import and the narrow
 * MCP delivery are three INGRESSES of one model: `ingress` is a stored fact on
 * the Test Session, never a second record type, queue or score. The versioned
 * envelope is `test-report/1`; an unsupported version is refused, never
 * upgraded. A reported `Passed` is a historical statement, not Product
 * acceptance evidence, and accepting a report opens no review or release gate,
 * so this contract names no review, approve, verify, score, trust or release
 * operation or field.
 *
 * Later tickets extend this module: identity and atomic idempotency (#400),
 * the alias catalog (#401), the narrow MCP receipt (#402), the secret scan and
 * the `unreviewed-test-report` signal (#403).
 */

export const TEST_SESSION_LABEL = "Test Session";
export const TEST_SESSIONS_LABEL = "Test Sessions";
export const SESSION_TEST_REPORT_LABEL = "Session Test";
export const TEST_SESSION_REVIEW_UNREVIEWED = "Unreviewed";

export const TEST_REPORT_SCHEMA_VERSION = "test-report/1";
/** Versions the acceptance reads; a new version is added here on purpose. */
export const SUPPORTED_TEST_REPORT_VERSIONS = [
  TEST_REPORT_SCHEMA_VERSION,
] as const;

export const TEST_REPORT_INGRESSES = [
  "Application",
  "File import",
  "MCP",
] as const;
export type TestReportIngress = (typeof TEST_REPORT_INGRESSES)[number];

export const TEST_REPORT_EXECUTOR_TYPES = [
  "user",
  "ai_agent",
  "external_tool",
] as const;
export type TestReportExecutorType =
  (typeof TEST_REPORT_EXECUTOR_TYPES)[number];

export const TEST_REPORT_EXECUTOR_TYPE_LABELS: Record<
  TestReportExecutorType,
  string
> = {
  ai_agent: "AI agent",
  external_tool: "External tool",
  user: "User",
};

/** Wire values of the normalized layer, in the order the PRD 10 table lists them. */
export const TEST_REPORT_RESULTS = [
  "passed",
  "failed",
  "blocked",
  "skipped",
  "inconclusive",
  "not_reported",
] as const;
export type TestReportResult = (typeof TEST_REPORT_RESULTS)[number];

export const TEST_REPORT_RESULT_LABELS: Record<TestReportResult, string> = {
  blocked: "Blocked",
  failed: "Failed",
  inconclusive: "Inconclusive",
  not_reported: "Not reported",
  passed: "Passed",
  skipped: "Skipped",
};

/** The closed PRD 10 error code set; no other code is ever returned. */
export const TEST_REPORT_ERROR_CODES = [
  "schema_unsupported",
  "project_not_authorized",
  "payload_too_large",
  "invalid_field",
  "unsupported_field",
  "duplicate_external_test_id",
  "identity_conflict",
  "reference_not_found",
  "reference_scope_mismatch",
  "result_conflict",
  "sensitive_data_detected",
  "attachment_rejected",
] as const;
export type TestReportErrorCode = (typeof TEST_REPORT_ERROR_CODES)[number];

const KIB = 1024;
const MIB = KIB * KIB;

/** First `test-report/1` limits (PRD 10 table); a limit change is not a schema version. */
export const TEST_REPORT_LIMITS = {
  envelopeBytes: 5 * MIB,
  evidencePerTest: 20,
  rawReportBytes: MIB,
  relationsPerTest: 50,
  testsByIngress: { Application: 200, "File import": 1000, MCP: 1000 },
  textExcerptBytes: 16 * KIB,
  totalEvidenceByIngress: { Application: 1000, "File import": 5000, MCP: 5000 },
  totalRelationsByIngress: {
    Application: 1000,
    "File import": 5000,
    MCP: 5000,
  },
} as const;

/** The only record types an external report may relate to (PRD 10 allow-list). */
export const TEST_REPORT_RELATION_TARGET_TYPES = [
  "planned_test_case",
  "test_handoff",
  "work",
  "feature",
  "test_gap",
  "project_release",
] as const;
export type TestReportRelationTargetType =
  (typeof TEST_REPORT_RELATION_TARGET_TYPES)[number];

export const TEST_REPORT_EVIDENCE_TYPES = [
  "attachment_ref",
  "external_url",
  "text_excerpt",
  "raw_report_ref",
  "code_ref",
] as const;

const textField = (max: number) => z.string().min(1).max(max);
const opaqueId = z.string().min(1).max(255);
const rfc3339 = z.iso.datetime({ offset: true });
const positiveInt = z.number().int().min(1).safe();

export const testReportExecutorSchema = z
  .object({
    name: textField(255),
    type: z.enum(TEST_REPORT_EXECUTOR_TYPES),
    version: textField(255).optional(),
  })
  .strict();

const contextSchema = z
  .object({
    branch: textField(255).optional(),
    browser: textField(255).optional(),
    build: textField(255).optional(),
    commit: textField(255).optional(),
    device: textField(255).optional(),
    environment: textField(255).optional(),
    fixture: textField(255).optional(),
    os: textField(255).optional(),
    repository: textField(255).optional(),
    tool: textField(255).optional(),
  })
  .strict();

const evidenceSchema = z
  .object({
    label: textField(255).optional(),
    type: z.enum(TEST_REPORT_EVIDENCE_TYPES),
    value: z.string().min(1).max(TEST_REPORT_LIMITS.textExcerptBytes),
  })
  .strict();

const relationSchema = z
  .object({
    scenario_version: positiveInt.optional(),
    target_id: opaqueId,
    target_type: z.enum(TEST_REPORT_RELATION_TARGET_TYPES),
  })
  .strict();

const testSchema = z
  .object({
    evidence: z
      .array(evidenceSchema)
      .max(TEST_REPORT_LIMITS.evidencePerTest)
      .optional(),
    external_test_id: opaqueId,
    normalized_result: z.enum(TEST_REPORT_RESULTS).optional(),
    notes: textField(20_000).optional(),
    raw_result: textField(2000).optional(),
    relations: z
      .array(relationSchema)
      .max(TEST_REPORT_LIMITS.relationsPerTest)
      .optional(),
    scenario_id: opaqueId.optional(),
    scenario_version: positiveInt.optional(),
    title: textField(255).refine((value) => value.trim().length > 0),
  })
  .strict();

/** Machine reason carried on a custom Zod issue so the mapping stays code-based. */
const REASON = "reason";

function customIssue(
  ctx: z.RefinementCtx,
  reason: TestReportErrorCode,
  path: (string | number)[],
) {
  ctx.addIssue({
    code: "custom",
    message: reason,
    params: { [REASON]: reason },
    path,
  });
}

type TestReportEnvelopeFields = z.infer<typeof envelopeShape>;

const envelopeShape = z
  .object({
    context: contextSchema.optional(),
    ended_at: rfc3339.optional(),
    executor: testReportExecutorSchema,
    external_session_id: opaqueId,
    handoff_id: opaqueId.optional(),
    handoff_package_version: positiveInt.optional(),
    project_id: opaqueId,
    raw_report: z.string().min(1).optional(),
    reported_at: rfc3339,
    schema_version: z.literal(TEST_REPORT_SCHEMA_VERSION),
    started_at: rfc3339.optional(),
    summary: textField(20_000).optional(),
    tests: z.array(testSchema),
  })
  .strict();

function checkEnvelope(
  report: TestReportEnvelopeFields,
  ingress: TestReportIngress,
  ctx: z.RefinementCtx,
) {
  if (report.tests.length === 0) {
    customIssue(ctx, "invalid_field", ["tests"]);
  }
  if (report.tests.length > TEST_REPORT_LIMITS.testsByIngress[ingress]) {
    customIssue(ctx, "payload_too_large", ["tests"]);
  }
  if (
    report.raw_report !== undefined &&
    new TextEncoder().encode(report.raw_report).length >
      TEST_REPORT_LIMITS.rawReportBytes
  ) {
    customIssue(ctx, "payload_too_large", ["raw_report"]);
  }
  if (
    (report.handoff_id === undefined) !==
    (report.handoff_package_version === undefined)
  ) {
    customIssue(ctx, "invalid_field", [
      report.handoff_id === undefined
        ? "handoff_id"
        : "handoff_package_version",
    ]);
  }
  if (
    report.started_at !== undefined &&
    report.ended_at !== undefined &&
    Date.parse(report.ended_at) < Date.parse(report.started_at)
  ) {
    customIssue(ctx, "invalid_field", ["ended_at"]);
  }
  let relations = 0;
  let evidence = 0;
  const seen = new Set<string>();
  report.tests.forEach((test, index) => {
    if (seen.has(test.external_test_id)) {
      customIssue(ctx, "duplicate_external_test_id", [
        "tests",
        index,
        "external_test_id",
      ]);
    }
    seen.add(test.external_test_id);
    if (
      (test.scenario_id === undefined) !==
      (test.scenario_version === undefined)
    ) {
      customIssue(ctx, "invalid_field", [
        "tests",
        index,
        test.scenario_id === undefined ? "scenario_id" : "scenario_version",
      ]);
    }
    relations += test.relations?.length ?? 0;
    evidence += test.evidence?.length ?? 0;
    test.relations?.forEach((relation, relationIndex) => {
      const isCase = relation.target_type === "planned_test_case";
      if (isCase !== (relation.scenario_version !== undefined)) {
        customIssue(ctx, "invalid_field", [
          "tests",
          index,
          "relations",
          relationIndex,
          "scenario_version",
        ]);
      }
    });
  });
  if (relations > TEST_REPORT_LIMITS.totalRelationsByIngress[ingress]) {
    customIssue(ctx, "payload_too_large", ["tests"]);
  }
  if (evidence > TEST_REPORT_LIMITS.totalEvidenceByIngress[ingress]) {
    customIssue(ctx, "payload_too_large", ["tests"]);
  }
}

/** The `test-report/1` envelope, validated for the limits of one ingress. */
export function testReportV1Schema(ingress: TestReportIngress) {
  return envelopeShape.superRefine((report, ctx) =>
    checkEnvelope(report, ingress, ctx),
  );
}
export type TestReportV1 = z.infer<typeof envelopeShape>;

/** A refusal: a closed code, a safe field path and a fixable explanation, never a payload value. */
export class TestReportRejectedError extends Error {
  readonly code: TestReportErrorCode;
  readonly fieldPath: string | null;
  readonly explanation: string;

  constructor(
    code: TestReportErrorCode,
    fieldPath: string | null,
    explanation: string,
  ) {
    super(explanation);
    this.name = "TestReportRejectedError";
    this.code = code;
    this.fieldPath = fieldPath;
    this.explanation = explanation;
  }
}

const EXPLANATIONS: Record<TestReportErrorCode, string> = {
  attachment_rejected: "Binary or base64 evidence is not accepted.",
  duplicate_external_test_id: "External test ids must be unique in one report.",
  identity_conflict:
    "This external session id was already reported with different content. Use a new external session id.",
  invalid_field: "The field is missing, malformed or out of range.",
  payload_too_large:
    "The report is over a size or count limit. Nothing was trimmed.",
  project_not_authorized: "The Project is unavailable for this report.",
  reference_not_found: "A referenced record was not found in this Project.",
  reference_scope_mismatch:
    "A referenced record does not belong to this report's Project or Handoff.",
  result_conflict: "The raw result and the normalized result disagree.",
  schema_unsupported: `Only ${SUPPORTED_TEST_REPORT_VERSIONS.join(", ")} is supported. The report was not upgraded.`,
  sensitive_data_detected: "The report looks like it holds a secret.",
  unsupported_field: "The field is not part of the report contract.",
};

export function rejection(
  code: TestReportErrorCode,
  fieldPath: string | null = null,
) {
  return new TestReportRejectedError(code, fieldPath, EXPLANATIONS[code]);
}

/** `tests[2].title`; keys come only from the closed schema, never from payload content. */
export function formatFieldPath(path: readonly PropertyKey[]) {
  let out = "";
  for (const part of path) {
    out +=
      typeof part === "number"
        ? `[${part}]`
        : `${out ? "." : ""}${String(part)}`;
  }
  return out || null;
}

/** Maps the first Zod issue to the closed code set without echoing any value. */
export function rejectionFromZod(error: z.ZodError) {
  const [issue] = error.issues;
  if (!issue) {
    return rejection("invalid_field");
  }
  const path = formatFieldPath(issue.path);
  if (issue.code === "unrecognized_keys") {
    return rejection("unsupported_field", path);
  }
  if (issue.code === "custom") {
    const reason = (issue as { params?: Record<string, unknown> }).params?.[
      REASON
    ];
    const code = TEST_REPORT_ERROR_CODES.find(
      (candidate) => candidate === reason,
    );
    return rejection(code ?? "invalid_field", path);
  }
  const last = issue.path.at(-1);
  if (
    issue.code === "invalid_value" &&
    (last === "target_type" || last === "type") &&
    issue.path.includes("relations")
  ) {
    return rejection("unsupported_field", path);
  }
  return rejection("invalid_field", path);
}

/** A report whose `schema_version` is anything but a supported version is refused first. */
export function assertSupportedSchemaVersion(report: unknown) {
  if (typeof report !== "object" || report === null || Array.isArray(report)) {
    throw rejection("invalid_field");
  }
  const version = (report as Record<string, unknown>).schema_version;
  if (version === undefined) {
    throw rejection("invalid_field", "schema_version");
  }
  if (
    typeof version !== "string" ||
    !(SUPPORTED_TEST_REPORT_VERSIONS as readonly string[]).includes(version)
  ) {
    throw rejection("schema_unsupported", "schema_version");
  }
}

/**
 * Validates one parsed report (from JSON, Markdown frontmatter, MCP or the
 * manual form) against the closed envelope. Parsers cannot widen types: the
 * value is only ever read through this schema.
 */
export function parseTestReport(
  report: unknown,
  ingress: TestReportIngress,
): TestReportV1 {
  assertSupportedSchemaVersion(report);
  const parsed = testReportV1Schema(ingress).safeParse(report);
  if (!parsed.success) {
    throw rejectionFromZod(parsed.error);
  }
  return parsed.data;
}

const projectIdSchema = z.string().trim().min(1).max(255);

/** The manual form; the product writes the current envelope itself on save. */
export const manualTestReportInputSchema = z
  .object({
    executor: testReportExecutorSchema,
    ingress: z.literal("Application"),
    projectId: projectIdSchema,
    reportedAt: rfc3339.optional(),
    summary: textField(20_000).optional(),
    tests: z.array(
      z
        .object({
          notes: textField(20_000).optional(),
          result: z.enum(TEST_REPORT_RESULTS),
          title: textField(255),
        })
        .strict(),
    ),
  })
  .strict();

export const fileTestReportInputSchema = z
  .object({
    content: z.string(),
    format: z.enum(["json", "markdown"]),
    ingress: z.literal("File import"),
    projectId: projectIdSchema,
  })
  .strict();

/** Transport-agnostic MCP delivery; the adapter (ticket 04) hands the parsed JSON body in. */
export const mcpTestReportInputSchema = z
  .object({
    ingress: z.literal("MCP"),
    report: z.unknown(),
  })
  .strict();

export const acceptTestReportInputSchema = z.discriminatedUnion("ingress", [
  manualTestReportInputSchema,
  fileTestReportInputSchema,
  mcpTestReportInputSchema,
]);
/** What the signed-in web app may send; `MCP` is only ever delivered by the MCP adapter. */
export const applicationTestReportInputSchema = z.discriminatedUnion(
  "ingress",
  [manualTestReportInputSchema, fileTestReportInputSchema],
);
export type AcceptTestReportInput = z.infer<typeof acceptTestReportInputSchema>;

export const testSessionProjectInputSchema = z
  .object({ projectId: projectIdSchema })
  .strict();

/** Who delivered: the verified user or integration, never a payload field. */
export interface TestReportReporter {
  id: string;
  kind: "user" | "integration";
}

export interface TestReportCaller {
  accountId: string;
  reporter: TestReportReporter;
}

export interface SessionTestReportStoredRecord {
  evidence: unknown[];
  externalTestId: string;
  id: string;
  normalizedResult: TestReportResult;
  notes: string | null;
  position: number;
  rawResult: string | null;
  relations: unknown[];
  scenarioId: string | null;
  scenarioVersion: number | null;
  title: string;
}

export interface TestSessionStoredRecord {
  acceptedAt: string;
  context: Record<string, string> | null;
  endedAt: string | null;
  executor: {
    name: string;
    type: TestReportExecutorType;
    version: string | null;
  };
  externalSessionId: string;
  handoffId: string | null;
  handoffPackageVersion: number | null;
  id: string;
  ingress: TestReportIngress;
  projectId: string;
  rawReport: string | null;
  reportedAt: string;
  /** The original RFC 3339 text, offset included. */
  reportedAtText: string;
  reporter: TestReportReporter;
  reviewState: typeof TEST_SESSION_REVIEW_UNREVIEWED;
  schemaVersion: string;
  startedAt: string | null;
  summary: string | null;
  tests: SessionTestReportStoredRecord[];
}

export interface SessionTestReportRecord extends SessionTestReportStoredRecord {
  resultLabel: string;
}

export interface TestSessionRecord
  extends Omit<TestSessionStoredRecord, "tests"> {
  tests: SessionTestReportRecord[];
}

export function toTestSessionRecord(
  stored: TestSessionStoredRecord,
): TestSessionRecord {
  return {
    ...stored,
    tests: stored.tests.map((test) => ({
      ...test,
      resultLabel: TEST_REPORT_RESULT_LABELS[test.normalizedResult],
    })),
  };
}

export interface TestReportReceipt {
  outcome: "created";
  session: TestSessionRecord;
}

export interface TestSessionList {
  readOnly: boolean;
  sessions: TestSessionRecord[];
}

/** The reference checks a report needs from the Project; a test double in tickets 01. */
export interface TestReportTransaction {
  insertSession: (record: TestSessionStoredRecord) => Promise<void>;
  listSessions: () => Promise<TestSessionStoredRecord[]>;
  readOnly: boolean;
  /** Whether this exact Planned Test Case version exists in the Project. */
  scenarioVersionExists: (caseId: string, version: number) => Promise<boolean>;
}

export interface TestReportStore {
  /** Resolves to `null` when the account does not own the Project. */
  run: <T>(
    accountId: string,
    projectId: string,
    mode: "read" | "write",
    work: (transaction: TestReportTransaction) => Promise<T>,
  ) => Promise<T | null>;
}

export interface TestReportAcceptanceAccess {
  /**
   * The only write. One Test Session with all its Session Tests is stored, or
   * the call throws `TestReportRejectedError` and nothing is written. It opens
   * no review, release gate or notification.
   */
  accept: (
    caller: TestReportCaller,
    input: AcceptTestReportInput,
  ) => Promise<TestReportReceipt>;
  sessions: (accountId: string, projectId: string) => Promise<TestSessionList>;
}
