import {
  type AcceptTestReportInput,
  TEST_REPORT_ERROR_CODES,
  TestReportRejectedError,
} from "@cantiara/api/test-report";
import { describe, expect, test } from "vitest";

import {
  accountId,
  archivedProjectId,
  createMemoryHarness,
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

const mcp = (report: unknown): AcceptTestReportInput => ({
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
    const fromForm = await harness.testReports.accept(userCaller, manual);
    const fromFile = await harness.testReports.accept(
      userCaller,
      json(envelope({ external_session_id: "file-1" })),
    );
    const fromMcp = await harness.testReports.accept(
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
    const { session } = await harness.testReports.accept(userCaller, {
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
    const bound = await harness.testReports.accept(
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
    const { session } = await harness.testReports.accept(
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
    const { session } = await harness.testReports.accept(
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
    const { session } = await harness.testReports.accept(
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
    const receipt = await harness.testReports.accept(
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
    const { session } = await harness.testReports.accept(userCaller, manual);
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
