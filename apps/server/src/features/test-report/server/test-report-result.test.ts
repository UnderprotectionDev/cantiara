import {
  type AcceptTestReportInput,
  TEST_REPORT_RESULTS,
  TestReportRejectedError,
} from "@cantiara/api/test-report";
import { TEST_REPORT_V1_RESULT_ALIASES } from "@cantiara/api/test-report-result";
import { describe, expect, test } from "vitest";

import {
  accountId,
  createMemoryHarness,
  projectId,
} from "./test-report-memory-store";

const caller = {
  accountId,
  reporter: { id: accountId, kind: "user" },
} as const;

function report(tests: Record<string, unknown>[], extra = {}) {
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

const mcp = (body: unknown): AcceptTestReportInput => ({
  ingress: "MCP",
  report: body,
});

async function resultsOf(tests: Record<string, unknown>[]) {
  const harness = createMemoryHarness();
  const { session } = await harness.testReports.accept(
    caller,
    mcp(report(tests)),
  );
  return session.tests.map(({ normalizedResult, rawResult }) => ({
    normalized: normalizedResult,
    raw: rawResult,
  }));
}

async function conflictOf(tests: Record<string, unknown>[]) {
  const harness = createMemoryHarness();
  try {
    await harness.testReports.accept(caller, mcp(report(tests)));
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
        caller,
        mcp(report([{ normalized_result: "Passed" }])),
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
    const { session } = await harness.testReports.accept(
      caller,
      mcp(
        report([
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
    const { session } = await harness.testReports.accept(caller, {
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
      harness.testReports.accept(caller, {
        executor: { name: "Me", type: "user" },
        ingress: "Application",
        projectId,
        summary: "Checkout felt fine today.",
        tests: [],
      }),
      harness.testReports.accept(
        caller,
        mcp(report([], { summary: "All good", raw_report: "log" })),
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
    const { session } = await harness.testReports.accept(
      caller,
      mcp(report([{ raw_result: "passed" }])),
    );
    expect(session.reviewState).toBe("Unreviewed");
  });
});
