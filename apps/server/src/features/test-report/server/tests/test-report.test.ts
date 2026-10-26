// biome-ignore-all lint/performance/noAwaitInLoops: Each ingress is refused in sequence against its own store.
import {
  type AcceptTestReportInput,
  TEST_REPORT_ERROR_CODES,
  TEST_REPORT_RESULTS,
  TestReportRejectedError,
} from "@cantiara/api/test-report";
import { TEST_REPORT_V1_RESULT_ALIASES } from "@cantiara/api/test-report-result";
import { describe, expect, test } from "vitest";
import {
  accepted,
  accountId,
  archivedProjectId,
  createMemoryHarness,
  type MemoryHarnessOptions,
  projectId,
} from "./test-report-memory-store";

const SCORE_FIELD = /score|trust|severity|confidence/i;
const user = { id: accountId, kind: "user" } as const;
const userCaller = { accountId, reporter: user };
const integrationCaller = {
  accountId,
  reporter: { id: "integration-7", kind: "integration" },
} as const;

function envelope(overrides: Record<string, unknown> = {}) {
  return {
    executor: { name: "Codex", type: "ai_agent", version: "1.2" },
    external_session_id: "codex-checkout-01",
    project_id: projectId,
    reported_at: "2026-08-06T15:30:00+03:00",
    schema_version: "test-report/1",
    tests: [
      {
        external_test_id: "coupon-single-use",
        normalized_result: "passed",
        raw_result: "passed",
        title: "Coupon can be used only once",
      },
    ],
    ...overrides,
  };
}

const json = (value: unknown): AcceptTestReportInput => ({
  content: JSON.stringify(value),
  format: "json",
  ingress: "File import",
  projectId,
});

const mcp = (
  report: unknown,
): Extract<AcceptTestReportInput, { ingress: "MCP" }> => ({
  ingress: "MCP",
  report,
});

const manual: AcceptTestReportInput = {
  executor: { name: "Me", type: "user" },
  ingress: "Application",
  projectId,
  tests: [{ result: "failed", title: "Coupon can be used twice" }],
};

async function rejectionOf(promise: Promise<unknown>) {
  try {
    await promise;
  } catch (error) {
    if (error instanceof TestReportRejectedError) {
      return error;
    }
    throw error;
  }
  throw new Error("Expected the report to be refused.");
}

describe("three ingresses write one Test Session model", () => {
  test("manual form, file import and MCP store the same record shape", async () => {
    const harness = createMemoryHarness();
    const fromForm = await accepted(harness.testReports, userCaller, manual);
    const fromFile = await accepted(
      harness.testReports,
      userCaller,
      json(envelope({ external_session_id: "file-1" })),
    );
    const fromMcp = await accepted(
      harness.testReports,
      integrationCaller,
      mcp(envelope({ external_session_id: "mcp-1" })),
    );

    expect(fromForm.outcome).toBe("created");
    const sessions = [fromForm, fromFile, fromMcp].map(
      ({ session }) => session,
    );
    expect(sessions.map(({ ingress }) => ingress)).toEqual([
      "Application",
      "File import",
      "MCP",
    ]);
    const shapes = sessions.map((session) => ({
      session: Object.keys(session).sort(),
      test: Object.keys(session.tests[0] ?? {}).sort(),
    }));
    expect(shapes[1]).toEqual(shapes[0]);
    expect(shapes[2]).toEqual(shapes[0]);
    expect(harness.sessions.size).toBe(3);
  });

  test("a Markdown file with YAML frontmatter reaches the same schema", async () => {
    const harness = createMemoryHarness();
    const content = [
      "---",
      "schema_version: test-report/1",
      `project_id: ${projectId}`,
      "external_session_id: md-1",
      "executor:",
      "  type: external_tool",
      "  name: Playwright CI",
      "reported_at: 2026-08-06T12:30:00Z",
      "tests:",
      "  - external_test_id: t1",
      "    title: Login works",
      "    normalized_result: passed",
      "---",
      "Raw run log.",
    ].join("\n");
    const { session } = await accepted(harness.testReports, userCaller, {
      content,
      format: "markdown",
      ingress: "File import",
      projectId,
    });
    expect(session.rawReport).toBe("Raw run log.");
    expect(session.executor).toEqual({
      name: "Playwright CI",
      type: "external_tool",
      version: null,
    });
    expect(session.tests[0]?.normalizedResult).toBe("passed");
  });

  test.each([
    ["an alias", "a: &x 1\nb: *x"],
    ["a merge key", "base: &b {k: 1}\nother:\n  <<: *b"],
    ["a custom tag", "schema_version: !custom test-report/1"],
    [
      "a duplicate key",
      "schema_version: test-report/1\nschema_version: test-report/1",
    ],
    ["a second document", "schema_version: test-report/1\n---\nother: 1"],
  ])(
    "Markdown frontmatter with %s fails closed with no record",
    async (_name, yaml) => {
      const harness = createMemoryHarness();
      const failure = await rejectionOf(
        harness.testReports.accept(userCaller, {
          content: `---\n${yaml}\n---\n`,
          format: "markdown",
          ingress: "File import",
          projectId,
        }),
      );
      expect(TEST_REPORT_ERROR_CODES).toContain(failure.code);
      expect(harness.sessions.size).toBe(0);
    },
  );
});

describe("test-report/1 envelope", () => {
  test("an unsupported schema_version is refused with nothing written", async () => {
    const harness = createMemoryHarness();
    const failure = await rejectionOf(
      harness.testReports.accept(
        integrationCaller,
        mcp(envelope({ schema_version: "test-report/2" })),
      ),
    );
    expect(failure.code).toBe("schema_unsupported");
    expect(failure.fieldPath).toBe("schema_version");
    expect(harness.sessions.size).toBe(0);
  });

  test("a missing or non-string schema_version is not upgraded either", async () => {
    const harness = createMemoryHarness();
    const { schema_version: _dropped, ...withoutVersion } = envelope();
    expect(
      (
        await rejectionOf(
          harness.testReports.accept(userCaller, json(withoutVersion)),
        )
      ).code,
    ).toBe("invalid_field");
    expect(
      (
        await rejectionOf(
          harness.testReports.accept(
            userCaller,
            json(envelope({ schema_version: 1 })),
          ),
        )
      ).code,
    ).toBe("schema_unsupported");
    expect(harness.sessions.size).toBe(0);
  });

  test("an empty tests array creates no session", async () => {
    const harness = createMemoryHarness();
    const failure = await rejectionOf(
      harness.testReports.accept(userCaller, json(envelope({ tests: [] }))),
    );
    expect(failure).toMatchObject({
      code: "invalid_field",
      fieldPath: "tests",
    });
    expect(harness.sessions.size).toBe(0);
  });

  test("scenario_id and scenario_version come together or not at all", async () => {
    const harness = createMemoryHarness({ scenarios: ["case-1@2"] });
    const withTest = (extra: Record<string, unknown>) =>
      envelope({
        tests: [{ external_test_id: "t", title: "T", ...extra }],
      });
    const refusals = await Promise.all(
      [{ scenario_id: "case-1" }, { scenario_version: 2 }].map((extra) =>
        rejectionOf(
          harness.testReports.accept(userCaller, json(withTest(extra))),
        ),
      ),
    );
    expect(refusals.map(({ code }) => code)).toEqual([
      "invalid_field",
      "invalid_field",
    ]);
    const bound = await accepted(
      harness.testReports,
      userCaller,
      json(withTest({ scenario_id: "case-1", scenario_version: 2 })),
    );
    expect(bound.session.tests[0]).toMatchObject({
      scenarioId: "case-1",
      scenarioVersion: 2,
    });
    const missing = await rejectionOf(
      harness.testReports.accept(
        userCaller,
        json({
          ...withTest({ scenario_id: "case-1", scenario_version: 9 }),
          external_session_id: "another-run",
        }),
      ),
    );
    expect(missing.code).toBe("reference_not_found");
    expect(harness.sessions.size).toBe(1);
  });

  test("handoff_id needs handoff_package_version", async () => {
    const harness = createMemoryHarness();
    const failure = await rejectionOf(
      harness.testReports.accept(
        userCaller,
        json(envelope({ handoff_id: "handoff-1" })),
      ),
    );
    expect(failure.code).toBe("invalid_field");
    expect(harness.sessions.size).toBe(0);
  });

  test("reported_at needs an offset and an unknown field is refused", async () => {
    const harness = createMemoryHarness();
    expect(
      (
        await rejectionOf(
          harness.testReports.accept(
            userCaller,
            json(envelope({ reported_at: "2026-08-06T12:30:00" })),
          ),
        )
      ).code,
    ).toBe("invalid_field");
    const unknown = await rejectionOf(
      harness.testReports.accept(
        userCaller,
        json(envelope({ reporter: "someone-else" })),
      ),
    );
    expect(unknown.code).toBe("unsupported_field");
    expect(harness.sessions.size).toBe(0);
  });

  test("duplicate external_test_id, an off-list relation and over-limit tests are refused", async () => {
    const harness = createMemoryHarness();
    const same = { external_test_id: "same", title: "T" };
    expect(
      (
        await rejectionOf(
          harness.testReports.accept(
            userCaller,
            json(envelope({ tests: [same, same] })),
          ),
        )
      ).code,
    ).toBe("duplicate_external_test_id");
    expect(
      (
        await rejectionOf(
          harness.testReports.accept(
            userCaller,
            json(
              envelope({
                tests: [
                  {
                    ...same,
                    relations: [{ target_id: "d1", target_type: "document" }],
                  },
                ],
              }),
            ),
          ),
        )
      ).code,
    ).toBe("unsupported_field");
    const many = Array.from({ length: 1001 }, (_, index) => ({
      external_test_id: `t${index}`,
      title: "T",
    }));
    expect(
      (
        await rejectionOf(
          harness.testReports.accept(
            userCaller,
            mcp(envelope({ tests: many })),
          ),
        )
      ).code,
    ).toBe("payload_too_large");
    expect(harness.sessions.size).toBe(0);
  });

  test("base64 evidence in a file import is attachment_rejected and writes nothing", async () => {
    const harness = createMemoryHarness();
    const failure = await rejectionOf(
      harness.testReports.accept(
        userCaller,
        json(
          envelope({
            tests: [
              {
                evidence: [
                  {
                    type: "attachment_ref",
                    value: "data:image/png;base64,QUJD",
                  },
                ],
                external_test_id: "t",
                title: "T",
              },
            ],
          }),
        ),
      ),
    );
    expect(failure).toMatchObject({
      code: "attachment_rejected",
      fieldPath: "tests[0].evidence[0]",
    });
    expect(harness.sessions.size).toBe(0);
  });

  test("the manual form is limited to 200 tests", async () => {
    const harness = createMemoryHarness();
    const failure = await rejectionOf(
      harness.testReports.accept(userCaller, {
        ...manual,
        tests: Array.from({ length: 201 }, () => ({
          result: "passed" as const,
          title: "T",
        })),
      } as AcceptTestReportInput),
    );
    expect(failure.code).toBe("payload_too_large");
  });

  test("a refusal never echoes payload values", async () => {
    const harness = createMemoryHarness();
    const failure = await rejectionOf(
      harness.testReports.accept(
        userCaller,
        json(
          envelope({
            summary: 12,
            tests: [{ external_test_id: "SECRET-VALUE" }],
          }),
        ),
      ),
    );
    expect(JSON.stringify([failure.message, failure.fieldPath])).not.toContain(
      "SECRET-VALUE",
    );
  });
});

describe("executor, reporter and ingress stay separate", () => {
  test("Codex run imported by the founder keeps three distinct fields and no score", async () => {
    const harness = createMemoryHarness();
    const { session } = await accepted(
      harness.testReports,
      userCaller,
      json(envelope()),
    );
    expect(session.executor).toEqual({
      name: "Codex",
      type: "ai_agent",
      version: "1.2",
    });
    expect(session.reporter).toEqual({ id: accountId, kind: "user" });
    expect(session.ingress).toBe("File import");
    expect(Object.keys(session)).not.toEqual(
      expect.arrayContaining([expect.stringMatching(SCORE_FIELD)]),
    );
  });

  test("the reporter is the verified caller, never a payload field", async () => {
    const harness = createMemoryHarness();
    const { session } = await accepted(
      harness.testReports,
      integrationCaller,
      mcp(envelope()),
    );
    expect(session.reporter).toEqual({
      id: "integration-7",
      kind: "integration",
    });
    const forged = await rejectionOf(
      harness.testReports.accept(
        integrationCaller,
        mcp(envelope({ reporter: { id: "founder", kind: "user" } })),
      ),
    );
    expect(forged.code).toBe("unsupported_field");
  });

  test("the original offset is kept beside the UTC time", async () => {
    const harness = createMemoryHarness();
    const { session } = await accepted(
      harness.testReports,
      userCaller,
      json(envelope()),
    );
    expect(session.reportedAtText).toBe("2026-08-06T15:30:00+03:00");
    expect(session.reportedAt).toBe("2026-08-06T12:30:00.000Z");
  });
});

describe("a reported result is history, not acceptance", () => {
  test("a reported Passed starts Unreviewed and opens no review or release gate", async () => {
    const harness = createMemoryHarness();
    const receipt = await accepted(
      harness.testReports,
      userCaller,
      json(envelope()),
    );
    expect(receipt.session.reviewState).toBe("Unreviewed");
    expect(receipt.session.tests[0]).toMatchObject({
      normalizedResult: "passed",
      resultLabel: "Passed",
    });
    expect(Object.keys(harness.testReports).sort()).toEqual([
      "accept",
      "sessions",
    ]);
    expect(Object.keys(receipt)).toEqual(["outcome", "session"]);
  });

  test("a manual form writes nothing until it is accepted, and the founder picks the label", async () => {
    const harness = createMemoryHarness();
    expect(
      (await harness.testReports.sessions(accountId, projectId)).sessions,
    ).toEqual([]);
    expect(harness.sessions.size).toBe(0);
    const { session } = await accepted(harness.testReports, userCaller, manual);
    expect(session.tests[0]).toMatchObject({
      normalizedResult: "failed",
      rawResult: "failed",
      resultLabel: "Failed",
    });
    expect(session.schemaVersion).toBe("test-report/1");
    const listed = await harness.testReports.sessions(accountId, projectId);
    expect(listed.sessions.map(({ id }) => id)).toEqual([session.id]);
  });

  test("a manual form with no tests creates no session", async () => {
    const harness = createMemoryHarness();
    const failure = await rejectionOf(
      harness.testReports.accept(userCaller, { ...manual, tests: [] }),
    );
    expect(failure.code).toBe("invalid_field");
    expect(harness.sessions.size).toBe(0);
  });
});

describe("authorization", () => {
  test("an unknown Project is project_not_authorized and an archived one is read-only", async () => {
    const harness = createMemoryHarness();
    const other = await rejectionOf(
      harness.testReports.accept(
        integrationCaller,
        mcp(envelope({ project_id: "project-other" })),
      ),
    );
    expect(other.code).toBe("project_not_authorized");
    const archived = await rejectionOf(
      harness.testReports.accept(userCaller, {
        ...manual,
        projectId: archivedProjectId,
      }),
    );
    expect(archived.code).toBe("project_not_authorized");
    expect(harness.sessions.size).toBe(0);
  });

  test("a file for another Project than the open one is a scope mismatch", async () => {
    const harness = createMemoryHarness();
    const failure = await rejectionOf(
      harness.testReports.accept(userCaller, {
        ...json(envelope({ project_id: archivedProjectId })),
        projectId,
      } as AcceptTestReportInput),
    );
    expect(failure.code).toBe("reference_scope_mismatch");
    expect(harness.sessions.size).toBe(0);
  });
});

const callerFixture = {
  accountId,
  reporter: { id: accountId, kind: "user" },
} as const;

function reportFixture(tests: Record<string, unknown>[], extra = {}) {
  return {
    executor: { name: "Playwright CI", type: "external_tool" },
    external_session_id: `run-${crypto.randomUUID()}`,
    project_id: projectId,
    reported_at: "2026-08-06T12:30:00Z",
    schema_version: "test-report/1",
    tests: tests.map((item, index) => ({
      external_test_id: `t${index}`,
      title: `Test ${index}`,
      ...item,
    })),
    ...extra,
  };
}

const mcpTestReportResult = (
  body: unknown,
): Extract<AcceptTestReportInput, { ingress: "MCP" }> => ({
  ingress: "MCP",
  report: body,
});

async function resultsOf(tests: Record<string, unknown>[]) {
  const harness = createMemoryHarness();
  const { session } = await accepted(
    harness.testReports,
    callerFixture,
    mcpTestReportResult(reportFixture(tests)),
  );
  return session.tests.map(({ normalizedResult, rawResult }) => ({
    normalized: normalizedResult,
    raw: rawResult,
  }));
}

async function conflictOf(tests: Record<string, unknown>[]) {
  const harness = createMemoryHarness();
  try {
    await harness.testReports.accept(
      callerFixture,
      mcpTestReportResult(reportFixture(tests)),
    );
  } catch (error) {
    if (error instanceof TestReportRejectedError) {
      return { error, harness };
    }
    throw error;
  }
  throw new Error("Expected result_conflict.");
}

describe("two-layer results", () => {
  test("catalog aliases normalize by case and outer whitespace and the raw text is kept as sent", async () => {
    const results = await resultsOf([
      { raw_result: "  PASS " },
      { raw_result: "Success" },
      { raw_result: "FAIL" },
      { raw_result: "blocked" },
      { raw_result: " N/A" },
      { raw_result: "Flaky" },
    ]);
    expect(results).toEqual([
      { normalized: "passed", raw: "  PASS " },
      { normalized: "passed", raw: "Success" },
      { normalized: "failed", raw: "FAIL" },
      { normalized: "blocked", raw: "blocked" },
      { normalized: "skipped", raw: " N/A" },
      { normalized: "inconclusive", raw: "Flaky" },
    ]);
  });

  test("a raw statement outside the catalog becomes not_reported and stays unrewritten", async () => {
    const results = await resultsOf([
      { raw_result: "Checkout flow looks good" },
      { raw_result: "passed with warnings" },
      { raw_result: "p a s s e d" },
    ]);
    expect(results).toEqual([
      { normalized: "not_reported", raw: "Checkout flow looks good" },
      { normalized: "not_reported", raw: "passed with warnings" },
      { normalized: "not_reported", raw: "p a s s e d" },
    ]);
  });

  test("no result at all is not_reported, and only a wire normalized_result is accepted", async () => {
    expect(await resultsOf([{}])).toEqual([
      { normalized: "not_reported", raw: null },
    ]);
    expect(await resultsOf([{ normalized_result: "blocked" }])).toEqual([
      { normalized: "blocked", raw: null },
    ]);
    const harness = createMemoryHarness();
    await expect(
      harness.testReports.accept(
        callerFixture,
        mcpTestReportResult(reportFixture([{ normalized_result: "Passed" }])),
      ),
    ).rejects.toMatchObject({ code: "invalid_field" });
  });

  test("an explicit normalized_result is kept when the raw text does not name another value", async () => {
    const results = await resultsOf([
      { normalized_result: "passed", raw_result: "ok" },
      {
        normalized_result: "inconclusive",
        raw_result: "Checkout flow looks good",
      },
    ]);
    expect(results).toEqual([
      { normalized: "passed", raw: "ok" },
      { normalized: "inconclusive", raw: "Checkout flow looks good" },
    ]);
  });

  test("raw and normalized_result that disagree reject the whole report as result_conflict", async () => {
    const { error, harness } = await conflictOf([
      { normalized_result: "passed", raw_result: "passed" },
      { normalized_result: "passed", raw_result: "FAILED" },
    ]);
    expect(error.code).toBe("result_conflict");
    expect(error.fieldPath).toBe("tests[1].normalized_result");
    expect(JSON.stringify(error.message)).not.toContain("FAILED");
    expect(harness.sessions.size).toBe(0);
  });

  test("mixed Session Test results never become a session verdict", async () => {
    const harness = createMemoryHarness();
    const { session } = await accepted(
      harness.testReports,
      callerFixture,
      mcpTestReportResult(
        reportFixture([
          { raw_result: "passed" },
          { raw_result: "failed" },
          { raw_result: "skipped" },
        ]),
      ),
    );
    expect(Object.keys(session).sort()).not.toEqual(
      expect.arrayContaining(["result", "normalizedResult", "verdict"]),
    );
    expect(session.tests.map(({ resultLabel }) => resultLabel)).toEqual([
      "Passed",
      "Failed",
      "Skipped",
    ]);
  });

  test("the catalog is closed to the six wire values", () => {
    expect(Object.keys(TEST_REPORT_V1_RESULT_ALIASES).sort()).toEqual(
      [...TEST_REPORT_RESULTS].sort(),
    );
    const every = Object.values(TEST_REPORT_V1_RESULT_ALIASES).flat();
    expect(new Set(every).size).toBe(every.length);
    expect(every.every((alias) => alias === alias.trim().toLowerCase())).toBe(
      true,
    );
  });
});

describe("manual results and free text", () => {
  test("the founder picks an English label and the wire value is stored", async () => {
    const harness = createMemoryHarness();
    const { session } = await accepted(harness.testReports, callerFixture, {
      executor: { name: "Me", type: "user" },
      ingress: "Application",
      projectId,
      tests: TEST_REPORT_RESULTS.map((result) => ({
        result,
        title: `Result ${result}`,
      })),
    });
    expect(session.tests.map(({ rawResult }) => rawResult)).toEqual([
      ...TEST_REPORT_RESULTS,
    ]);
    expect(
      session.tests.map(({ normalizedResult }) => normalizedResult),
    ).toEqual([...TEST_REPORT_RESULTS]);
    expect(session.tests.map(({ resultLabel }) => resultLabel)).toEqual([
      "Passed",
      "Failed",
      "Blocked",
      "Skipped",
      "Inconclusive",
      "Not reported",
    ]);
  });

  test("a free-text note or summary alone never becomes a Test Session", async () => {
    const harness = createMemoryHarness();
    const attempts = [
      harness.testReports.accept(callerFixture, {
        executor: { name: "Me", type: "user" },
        ingress: "Application",
        projectId,
        summary: "Checkout felt fine today.",
        tests: [],
      }),
      harness.testReports.accept(
        callerFixture,
        mcpTestReportResult(
          reportFixture([], { summary: "All good", raw_report: "log" }),
        ),
      ),
    ];
    const outcomes = await Promise.allSettled(attempts);
    expect(outcomes.map(({ status }) => status)).toEqual([
      "rejected",
      "rejected",
    ]);
    expect(harness.sessions.size).toBe(0);
  });

  test("a new session is Unreviewed whatever it reports", async () => {
    const harness = createMemoryHarness();
    const { session } = await accepted(
      harness.testReports,
      callerFixture,
      mcpTestReportResult(reportFixture([{ raw_result: "passed" }])),
    );
    expect(session.reviewState).toBe("Unreviewed");
  });
});

const userCallerTestReportSecrets = {
  accountId,
  reporter: { id: accountId, kind: "user" },
} as const;

// Built from parts so no token-shaped literal sits in the source.
const GITHUB_TOKEN = `ghp_${"a1B2c3D4e5".repeat(4)}`;
const AMBIGUOUS = `password: ${"hunter2"}!xyz`;

function envelopeTestReportSecrets(overrides: Record<string, unknown> = {}) {
  return {
    executor: { name: "Codex", type: "ai_agent" },
    external_session_id: "run-1",
    project_id: projectId,
    reported_at: "2026-08-06T12:30:00Z",
    schema_version: "test-report/1",
    tests: [{ external_test_id: "a", normalized_result: "passed", title: "A" }],
    ...overrides,
  };
}
const file = (report: unknown): AcceptTestReportInput => ({
  content: JSON.stringify(report),
  format: "json",
  ingress: "File import",
  projectId,
});

function withTestFixture(extra: Record<string, unknown>) {
  return envelopeTestReportSecrets({
    tests: [{ external_test_id: "a", title: "A", ...extra }],
  });
}

describe("known provider tokens reject the whole report", () => {
  test.each([
    [
      "raw_report",
      envelopeTestReportSecrets({ raw_report: `log ${GITHUB_TOKEN}` }),
      "raw_report",
    ],
    [
      "evidence",
      withTestFixture({
        evidence: [{ type: "text_excerpt", value: `out ${GITHUB_TOKEN}` }],
      }),
      "tests[0].evidence[0].value",
    ],
    ["notes", withTestFixture({ notes: GITHUB_TOKEN }), "tests[0].notes"],
    [
      "context",
      envelopeTestReportSecrets({ context: { commit: GITHUB_TOKEN } }),
      "context.commit",
    ],
    [
      "summary",
      envelopeTestReportSecrets({ summary: GITHUB_TOKEN }),
      "summary",
    ],
  ])(
    "a token in %s is sensitive_data_detected with only a masked path",
    async (_name, report, path) => {
      for (const [harness, input, caller] of [
        [createMemoryHarness(), mcp(report), integrationCaller],
        [createMemoryHarness(), file(report), userCallerTestReportSecrets],
      ] as const) {
        const failure = await rejectionOf(
          harness.testReports.accept(caller, input),
        );
        expect(failure).toMatchObject({
          code: "sensitive_data_detected",
          fieldPath: path,
        });
        expect(
          JSON.stringify([failure.message, failure.fieldPath]),
        ).not.toContain(GITHUB_TOKEN);
        expect(harness.sessions.size).toBe(0);
        expect(harness.signals).toEqual([]);
      }
    },
  );

  test("a token in a Markdown body is caught and the evidence is never edited", async () => {
    const harness = createMemoryHarness();
    const content = [
      "---",
      "schema_version: test-report/1",
      `project_id: ${projectId}`,
      "external_session_id: md-1",
      "executor: {type: user, name: Me}",
      "reported_at: 2026-08-06T12:30:00Z",
      "tests:",
      "  - {external_test_id: t1, title: T}",
      "---",
      `Output ${GITHUB_TOKEN}`,
    ].join("\n");
    const failure = await rejectionOf(
      harness.testReports.accept(userCallerTestReportSecrets, {
        content,
        format: "markdown",
        ingress: "File import",
        projectId,
      }),
    );
    expect(failure).toMatchObject({
      code: "sensitive_data_detected",
      fieldPath: "raw_report",
    });
    expect(harness.sessions.size).toBe(0);
  });

  test("the manual form is scanned too", async () => {
    const harness = createMemoryHarness();
    const failure = await rejectionOf(
      harness.testReports.accept(userCallerTestReportSecrets, {
        executor: { name: "Me", type: "user" },
        ingress: "Application",
        projectId,
        tests: [{ notes: GITHUB_TOKEN, result: "passed", title: "T" }],
      }),
    );
    expect(failure).toMatchObject({
      code: "sensitive_data_detected",
      fieldPath: "tests[0].notes",
    });
    expect(harness.sessions.size).toBe(0);
  });
});

describe("bearer tokens and credential URLs are high-confidence", () => {
  test.each([
    ["a bearer token", `Authorization: Bearer ${"Zx9Yw8Vu7Ts6Rq5P"}abcd`],
    ["a URL with credentials", "https://deploy:s3cretpass@example.test/path"],
  ])(
    "%s rejects the whole report on every ingress with the masked path",
    async (_name, text) => {
      for (const [harness, input, caller] of [
        [
          createMemoryHarness(),
          mcp(withTestFixture({ notes: text })),
          integrationCaller,
        ],
        [
          createMemoryHarness(),
          file(withTestFixture({ notes: text })),
          userCallerTestReportSecrets,
        ],
      ] as const) {
        const failure = await rejectionOf(
          harness.testReports.accept(caller, input),
        );
        expect(failure).toMatchObject({
          code: "sensitive_data_detected",
          fieldPath: "tests[0].notes",
        });
        expect(harness.sessions.size).toBe(0);
      }
    },
  );
});

describe("ambiguous findings", () => {
  const ambiguous = withTestFixture({ notes: AMBIGUOUS });

  test("are rejected on unsupervised MCP", async () => {
    const harness = createMemoryHarness();
    const failure = await rejectionOf(
      harness.testReports.accept(integrationCaller, mcp(ambiguous)),
    );
    expect(failure).toMatchObject({
      code: "sensitive_data_detected",
      fieldPath: "tests[0].notes",
    });
    expect(harness.sessions.size).toBe(0);
  });

  test("ask for a masked review on file and manual ingress and create nothing", async () => {
    const harness = createMemoryHarness();
    const fromFile = await harness.testReports.accept(
      userCallerTestReportSecrets,
      file(ambiguous),
    );
    const fromForm = await harness.testReports.accept(
      userCallerTestReportSecrets,
      {
        executor: { name: "Me", type: "user" },
        ingress: "Application",
        projectId,
        tests: [{ notes: AMBIGUOUS, result: "passed", title: "T" }],
      },
    );
    expect(fromFile).toEqual({
      findings: [{ fieldPath: "tests[0].notes" }],
      outcome: "masked_review",
    });
    expect(fromForm).toMatchObject({
      findings: [{ fieldPath: "tests[0].notes" }],
      outcome: "masked_review",
    });
    expect(JSON.stringify([fromFile, fromForm])).not.toContain("hunter2");
    expect(harness.sessions.size).toBe(0);
    expect(harness.identities.size).toBe(0);
    expect(harness.signals).toEqual([]);
  });

  test("a clean resend after the founder removed the value is accepted", async () => {
    const harness = createMemoryHarness();
    await harness.testReports.accept(
      userCallerTestReportSecrets,
      file(ambiguous),
    );
    const resent = await harness.testReports.accept(
      userCallerTestReportSecrets,
      file(withTestFixture({ notes: "password handling checked" })),
    );
    expect(resent.outcome).toBe("created");
  });

  test("a known token beats a review: file import rejects it outright", async () => {
    const harness = createMemoryHarness();
    const failure = await rejectionOf(
      harness.testReports.accept(
        userCallerTestReportSecrets,
        file(withTestFixture({ notes: `${AMBIGUOUS} ${GITHUB_TOKEN}` })),
      ),
    );
    expect(failure.code).toBe("sensitive_data_detected");
  });
});

describe("unreviewed-test-report signal", () => {
  const handoffs: NonNullable<MemoryHarnessOptions["handoffs"]> = [
    {
      id: "handoff-canceled",
      packageVersion: 1,
      projectId,
      scenarios: [],
      state: "Canceled",
    },
  ];

  test("a new MCP or file session produces exactly one signal, not one per Session Test", async () => {
    const harness = createMemoryHarness();
    const many = envelopeTestReportSecrets({
      tests: Array.from({ length: 5 }, (_, index) => ({
        external_test_id: `t${index}`,
        title: "T",
      })),
    });
    const { session } = await harness.testReports.accept(
      integrationCaller,
      mcp(many),
    );
    expect(harness.signals).toEqual([
      expect.objectContaining({
        ownerAccountId: accountId,
        presentation: "Action Required",
        signalId: `unreviewed-test-report:${session.id}`,
        signalType: "unreviewed-test-report",
        source: expect.objectContaining({ sessionId: session.id }),
      }),
    ]);
    await harness.testReports.accept(
      userCallerTestReportSecrets,
      file(envelopeTestReportSecrets({ external_session_id: "run-file" })),
    );
    expect(harness.signals.map(({ signalType }) => signalType)).toEqual([
      "unreviewed-test-report",
      "unreviewed-test-report",
    ]);
  });

  test("an idempotent retry and a refused report produce no new signal", async () => {
    const harness = createMemoryHarness();
    await harness.testReports.accept(
      integrationCaller,
      mcp(envelopeTestReportSecrets()),
    );
    await harness.testReports.accept(
      integrationCaller,
      mcp(envelopeTestReportSecrets()),
    );
    await rejectionOf(
      harness.testReports.accept(
        integrationCaller,
        mcp(
          envelopeTestReportSecrets({
            external_session_id: "run-2",
            tests: [],
          }),
        ),
      ),
    );
    await rejectionOf(
      harness.testReports.accept(
        integrationCaller,
        mcp(
          envelopeTestReportSecrets({
            tests: [{ external_test_id: "x", title: "X" }],
          }),
        ),
      ),
    );
    expect(harness.signals).toHaveLength(1);
  });

  test("a manual session is Unreviewed in the list with no signal", async () => {
    const harness = createMemoryHarness();
    await harness.testReports.accept(userCallerTestReportSecrets, {
      executor: { name: "Me", type: "user" },
      ingress: "Application",
      projectId,
      tests: [{ result: "passed", title: "T" }],
    });
    expect(harness.signals).toEqual([]);
    const { sessions } = await harness.testReports.sessions(
      accountId,
      projectId,
    );
    expect(sessions.map(({ reviewState }) => reviewState)).toEqual([
      "Unreviewed",
    ]);
  });

  test("the signal is written in the same unit as the session", async () => {
    const harness = createMemoryHarness();
    harness.faults.failOnSignal = true;
    await expect(
      harness.testReports.accept(
        integrationCaller,
        mcp(envelopeTestReportSecrets()),
      ),
    ).rejects.toThrow("Signal sink failed.");
    expect(harness.sessions.size).toBe(0);
    expect(harness.identities.size).toBe(0);
    expect(harness.signals).toEqual([]);
  });

  test("a report to a Canceled Handoff adds the registered handoff-result-after-cancel and leaves the Handoff", async () => {
    const harness = createMemoryHarness({ handoffs });
    const { session } = await harness.testReports.accept(
      integrationCaller,
      mcp(
        envelopeTestReportSecrets({
          handoff_id: "handoff-canceled",
          handoff_package_version: 1,
        }),
      ),
    );
    expect(
      harness.signals.map(({ signalType, presentation }) => [
        signalType,
        presentation,
      ]),
    ).toEqual([
      ["unreviewed-test-report", "Action Required"],
      ["handoff-result-after-cancel", "Information Feed"],
    ]);
    expect(harness.signals[1]?.signalId).toBe(
      `handoff-result-after-cancel:${session.id}`,
    );
    expect(handoffs[0]?.state).toBe("Canceled");
  });
});
