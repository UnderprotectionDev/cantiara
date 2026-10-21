// biome-ignore-all lint/performance/noAwaitInLoops: Each ingress is refused in sequence against its own store.
import {
  type AcceptTestReportInput,
  TestReportRejectedError,
} from "@cantiara/api/test-report";
import { describe, expect, test } from "vitest";

import {
  accountId,
  createMemoryHarness,
  type MemoryHarnessOptions,
  projectId,
} from "../test-report-memory-store";

const userCaller = {
  accountId,
  reporter: { id: accountId, kind: "user" },
} as const;
const integrationCaller = {
  accountId,
  reporter: { id: "integration-7", kind: "integration" },
} as const;

// Built from parts so no token-shaped literal sits in the source.
const GITHUB_TOKEN = `ghp_${"a1B2c3D4e5".repeat(4)}`;
const AMBIGUOUS = `password: ${"hunter2"}!xyz`;

function envelope(overrides: Record<string, unknown> = {}) {
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

const mcp = (
  report: unknown,
): Extract<AcceptTestReportInput, { ingress: "MCP" }> => ({
  ingress: "MCP",
  report,
});
const file = (report: unknown): AcceptTestReportInput => ({
  content: JSON.stringify(report),
  format: "json",
  ingress: "File import",
  projectId,
});

function withTest(extra: Record<string, unknown>) {
  return envelope({
    tests: [{ external_test_id: "a", title: "A", ...extra }],
  });
}

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

describe("known provider tokens reject the whole report", () => {
  test.each([
    [
      "raw_report",
      envelope({ raw_report: `log ${GITHUB_TOKEN}` }),
      "raw_report",
    ],
    [
      "evidence",
      withTest({
        evidence: [{ type: "text_excerpt", value: `out ${GITHUB_TOKEN}` }],
      }),
      "tests[0].evidence[0].value",
    ],
    ["notes", withTest({ notes: GITHUB_TOKEN }), "tests[0].notes"],
    [
      "context",
      envelope({ context: { commit: GITHUB_TOKEN } }),
      "context.commit",
    ],
    ["summary", envelope({ summary: GITHUB_TOKEN }), "summary"],
  ])(
    "a token in %s is sensitive_data_detected with only a masked path",
    async (_name, report, path) => {
      for (const [harness, input, caller] of [
        [createMemoryHarness(), mcp(report), integrationCaller],
        [createMemoryHarness(), file(report), userCaller],
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
      harness.testReports.accept(userCaller, {
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
      harness.testReports.accept(userCaller, {
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
          mcp(withTest({ notes: text })),
          integrationCaller,
        ],
        [createMemoryHarness(), file(withTest({ notes: text })), userCaller],
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
  const ambiguous = withTest({ notes: AMBIGUOUS });

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
      userCaller,
      file(ambiguous),
    );
    const fromForm = await harness.testReports.accept(userCaller, {
      executor: { name: "Me", type: "user" },
      ingress: "Application",
      projectId,
      tests: [{ notes: AMBIGUOUS, result: "passed", title: "T" }],
    });
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
    await harness.testReports.accept(userCaller, file(ambiguous));
    const resent = await harness.testReports.accept(
      userCaller,
      file(withTest({ notes: "password handling checked" })),
    );
    expect(resent.outcome).toBe("created");
  });

  test("a known token beats a review: file import rejects it outright", async () => {
    const harness = createMemoryHarness();
    const failure = await rejectionOf(
      harness.testReports.accept(
        userCaller,
        file(withTest({ notes: `${AMBIGUOUS} ${GITHUB_TOKEN}` })),
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
    const many = envelope({
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
      userCaller,
      file(envelope({ external_session_id: "run-file" })),
    );
    expect(harness.signals.map(({ signalType }) => signalType)).toEqual([
      "unreviewed-test-report",
      "unreviewed-test-report",
    ]);
  });

  test("an idempotent retry and a refused report produce no new signal", async () => {
    const harness = createMemoryHarness();
    await harness.testReports.accept(integrationCaller, mcp(envelope()));
    await harness.testReports.accept(integrationCaller, mcp(envelope()));
    await rejectionOf(
      harness.testReports.accept(
        integrationCaller,
        mcp(envelope({ external_session_id: "run-2", tests: [] })),
      ),
    );
    await rejectionOf(
      harness.testReports.accept(
        integrationCaller,
        mcp(envelope({ tests: [{ external_test_id: "x", title: "X" }] })),
      ),
    );
    expect(harness.signals).toHaveLength(1);
  });

  test("a manual session is Unreviewed in the list with no signal", async () => {
    const harness = createMemoryHarness();
    await harness.testReports.accept(userCaller, {
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
      harness.testReports.accept(integrationCaller, mcp(envelope())),
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
        envelope({
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
