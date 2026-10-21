// biome-ignore-all lint/performance/noAwaitInLoops: Each scope is read after the previous one.
import type { TestSummary } from "@cantiara/api/test-review-summary";
import { describe, expect, test } from "vitest";

import { TestReviewSummaryScopeNotFoundError } from "../test-review";
import {
  accountId,
  createMemoryHarness,
  emptySummaryFacts,
  fixtureSession,
  projectId,
  summaryFactsKey,
} from "../test-review-memory-store";

const FORBIDDEN_MEMBER =
  /gap|assessment|handoff|report|delete|trash|archive|gate|score/i;
const SCORE_OR_GATE =
  /score|coverage|quality|verdict|gate|waiver|passrate|percent|overall|readiness/i;

function sessions() {
  return [
    fixtureSession(
      "s-feature",
      [
        {
          id: "pass",
          normalized: "passed",
          raw: "ok",
          scenario: ["case-1", 1],
          title: "Checkout happy path",
        },
        {
          id: "fail",
          normalized: "failed",
          raw: "FAIL 500",
          scenario: ["case-2", 1],
          title: "Refund",
        },
        {
          id: "skip",
          normalized: "skipped",
          raw: "skip",
          title: "Coupon",
        },
      ],
      {
        context: { branch: "feature/checkout", commit: "abc" },
        executorName: "Codex",
        reportedAt: "2026-10-02T09:00:00.000Z",
        reporter: "Integration codex-ci",
        targetContext: { branch: "main" },
      },
    ),
    fixtureSession(
      "s-other",
      [{ id: "other", normalized: "failed", title: "Unrelated" }],
      { reportedAt: "2026-10-03T09:00:00.000Z" },
    ),
  ];
}

function setup(overrides: { assessedAt?: string } = {}) {
  const feature = emptySummaryFacts("Feature", "feature-1", "Checkout", {
    assessments: overrides.assessedAt
      ? [
          {
            assessedAt: overrides.assessedAt,
            decision: "Acceptable",
            id: "a1",
            label: "Checkout assessment",
          },
        ]
      : [],
    gaps: [
      {
        id: "g1",
        recordedAt: "2026-10-05T09:00:00.000Z",
        state: "Open",
        title: "No refund test",
      },
      {
        id: "g2",
        recordedAt: "2026-09-01T09:00:00.000Z",
        state: "Met by result",
        title: "Closed gap",
      },
    ],
    handoffs: [{ id: "h1", state: "Shared", title: "Checkout handoff" }],
    scenarios: [
      { id: "case-1", title: "Checkout", version: 1 },
      { id: "case-2", title: "Refund", version: 1 },
      { id: "case-3", title: "Never run", version: 1 },
    ],
    sessionTestIds: ["pass", "fail", "skip"],
  });
  const release = emptySummaryFacts(
    "Project Release",
    "release-1",
    "Release 1",
    { gaps: feature.gaps.slice(0, 1), sessionTestIds: ["fail"] },
  );
  const empty = emptySummaryFacts("Feature", "feature-empty", "Lonely");
  return createMemoryHarness(
    sessions(),
    [
      {
        id: "work-1",
        key: "PRJ-1",
        status: "Not Started",
        title: "Fix refund",
        type: "Task",
      },
    ],
    {
      [summaryFactsKey({ id: "feature-1", kind: "Feature" })]: feature,
      [summaryFactsKey({ id: "feature-empty", kind: "Feature" })]: empty,
      [summaryFactsKey({ id: "release-1", kind: "Project Release" })]: release,
    },
  );
}

function section(summary: TestSummary, key: string) {
  const found = [...summary.sections, ...summary.attention].find(
    (entry) => entry.key === key,
  );
  if (!found) {
    throw new Error(`No section ${key}`);
  }
  return found;
}

function ids(summary: TestSummary, key: string) {
  return section(summary, key).records.map((record) => record.id);
}

describe("Feature Test Summary", () => {
  test("shows only in-scope records and opens each as its exact set", async () => {
    const { testReview } = setup();
    const summary = await testReview.summary(accountId, {
      projectId,
      scope: { id: "feature-1", kind: "Feature" },
    });
    expect(summary.scope).toEqual({
      id: "feature-1",
      kind: "Feature",
      label: "Checkout",
    });
    expect(ids(summary, "scenarios")).toEqual(["case-1", "case-2", "case-3"]);
    expect(ids(summary, "handoffs")).toEqual(["h1"]);
    expect(ids(summary, "sessions")).toEqual(["s-feature"]);
    expect(ids(summary, "session-tests")).toEqual(["pass", "fail", "skip"]);
    expect(ids(summary, "open-gaps")).toEqual(["g1"]);
    expect(ids(summary, "latest-assessment")).toEqual([]);
    for (const entry of [...summary.sections, ...summary.attention]) {
      expect(entry.filters.length).toBeGreaterThan(0);
    }
  });

  test("keeps raw and normalized results, source session, executor, reporter, time and context", async () => {
    const { testReview } = setup();
    const summary = await testReview.summary(accountId, {
      projectId,
      scope: { id: "feature-1", kind: "Feature" },
    });
    const failed = section(summary, "session-tests").records.find(
      (record) => record.id === "fail",
    );
    expect(failed?.provenance).toEqual({
      context: { branch: "feature/checkout", commit: "abc" },
      currentResult: "failed",
      executorName: "Codex",
      normalizedResult: "failed",
      rawResult: "FAIL 500",
      reportedAt: "2026-10-02T09:00:00.000Z",
      reporter: "Integration codex-ci",
      reviewState: "Unreviewed",
      sessionId: "s-feature",
    });
  });

  test("lists attention as neutral source-linked records with no verdict", async () => {
    const { testReview } = setup();
    const summary = await testReview.summary(accountId, {
      projectId,
      scope: { id: "feature-1", kind: "Feature" },
    });
    expect(ids(summary, "failed-results")).toEqual(["fail"]);
    expect(ids(summary, "skipped-results")).toEqual(["skip"]);
    expect(ids(summary, "unreviewed-reports")).toEqual(["s-feature"]);
    expect(ids(summary, "open-gaps")).toEqual(["g1"]);
    expect(ids(summary, "context-changed")).toEqual(["pass", "fail", "skip"]);
    expect(ids(summary, "scenarios-without-results")).toEqual(["case-3"]);
    expect(summary.attention.map((entry) => entry.key)).not.toContain(
      "no-related-tests",
    );
  });

  test("derives conflict and context-changed attention from the review seam", async () => {
    const harness = createMemoryHarness(
      [
        ...sessions(),
        fixtureSession(
          "s-second",
          [
            {
              id: "pass-again",
              normalized: "passed",
              scenario: ["case-2", 1],
              title: "Refund again",
            },
          ],
          { reportedAt: "2026-10-04T09:00:00.000Z" },
        ),
      ],
      [],
      {
        "Feature:feature-1": emptySummaryFacts(
          "Feature",
          "feature-1",
          "Checkout",
          { sessionTestIds: ["fail", "pass-again"] },
        ),
      },
    );
    const summary = await harness.testReview.summary(accountId, {
      projectId,
      scope: { id: "feature-1", kind: "Feature" },
    });
    expect(ids(summary, "test-result-conflict")).toEqual([
      "fail",
      "pass-again",
    ]);
    expect(ids(summary, "context-changed")).toEqual(["fail"]);
    expect(harness.writes).toEqual([]);
    // Binding a valid result closes the signal; the summary follows live.
    await harness.testReview.bindValidResult(accountId, {
      projectId,
      scenarioId: "case-2",
      scenarioVersion: 1,
      sessionTestId: "pass-again",
    });
    const bound = await harness.testReview.summary(accountId, {
      projectId,
      scope: { id: "feature-1", kind: "Feature" },
    });
    expect(bound.attention.map((entry) => entry.key)).not.toContain(
      "test-result-conflict",
    );
  });

  test("an empty Feature names the missing tests with the Feature as its source", async () => {
    const { testReview } = setup();
    const summary = await testReview.summary(accountId, {
      projectId,
      scope: { id: "feature-empty", kind: "Feature" },
    });
    expect(summary.sections.every((entry) => entry.records.length === 0)).toBe(
      true,
    );
    expect(section(summary, "no-related-tests").records).toEqual([
      {
        detail: null,
        id: "feature-empty",
        kind: "Feature",
        label: "Lonely",
        provenance: null,
      },
    ]);
  });

  test("flags test context that arrived after the latest assessment", async () => {
    const { testReview } = setup({ assessedAt: "2026-10-01T00:00:00.000Z" });
    const summary = await testReview.summary(accountId, {
      projectId,
      scope: { id: "feature-1", kind: "Feature" },
    });
    expect(ids(summary, "latest-assessment")).toEqual(["a1"]);
    expect(ids(summary, "new-context-after-assessment")).toEqual([
      "s-feature",
      "g1",
    ]);
    const later = setup({ assessedAt: "2026-12-01T00:00:00.000Z" });
    const quiet = await later.testReview.summary(accountId, {
      projectId,
      scope: { id: "feature-1", kind: "Feature" },
    });
    expect(quiet.attention.map((entry) => entry.key)).not.toContain(
      "new-context-after-assessment",
    );
  });

  test("emits no score, coverage, verdict, waiver or gate field anywhere", async () => {
    const { testReview } = setup();
    for (const scope of [
      { id: "feature-1", kind: "Feature" },
      { id: "release-1", kind: "Project Release" },
      { kind: "Project" },
    ] as const) {
      const summary = await testReview.summary(accountId, {
        projectId,
        scope,
      });
      const keys = new Set<string>();
      JSON.stringify(summary, (key, value) => {
        keys.add(key);
        return value;
      });
      for (const key of keys) {
        expect(key).not.toMatch(SCORE_OR_GATE);
      }
      for (const entry of [...summary.sections, ...summary.attention]) {
        expect(Object.keys(entry).sort()).toEqual([
          "filters",
          "key",
          "label",
          "records",
        ]);
      }
    }
  });

  test("a GitHub check is never a Test Session and the summary writes nothing", async () => {
    const harness = setup();
    const before = structuredClone([...harness.sessions.keys()]);
    const summary = await harness.testReview.summary(accountId, {
      projectId,
      scope: { id: "feature-1", kind: "Feature" },
    });
    expect(ids(summary, "sessions")).toEqual(["s-feature"]);
    expect([...harness.sessions.keys()]).toEqual(before);
    // No Test Gap, assessment, report, review, event or Work writer ran.
    expect(harness.writes).toEqual([]);
  });

  test("refuses a Feature that is not in the Project", async () => {
    const { testReview } = setup();
    await expect(
      testReview.summary(accountId, {
        projectId,
        scope: { id: "missing", kind: "Feature" },
      }),
    ).rejects.toBeInstanceOf(TestReviewSummaryScopeNotFoundError);
  });

  test("a session Correction promotes the corrected summary into the Test Sessions section", async () => {
    const { testReview } = setup();
    await testReview.recordCorrection(accountId, {
      note: "Checkout run against the fixed build.",
      projectId,
      reason: "The summary described the wrong build.",
      sessionId: "s-feature",
    });
    const summary = await testReview.summary(accountId, {
      projectId,
      scope: { id: "feature-1", kind: "Feature" },
    });
    const record = section(summary, "sessions").records.find(
      (entry) => entry.id === "s-feature",
    );
    expect(record?.label).toBe("Checkout run against the fixed build.");
  });
});

describe("Project Release Test Summary", () => {
  test("uses the release's own scope plus direct links", async () => {
    const { testReview } = setup();
    const release = await testReview.summary(accountId, {
      projectId,
      scope: { id: "release-1", kind: "Project Release" },
    });
    expect(release.scope.kind).toBe("Project Release");
    expect(ids(release, "session-tests")).toEqual(["fail"]);
    expect(ids(release, "open-gaps")).toEqual(["g1"]);
    expect(ids(release, "failed-results")).toEqual(["fail"]);
  });
});

describe("Tests overview sections", () => {
  test("lists the derived sections as exact record sets", async () => {
    const harness = createMemoryHarness(sessions(), [], {
      Project: emptySummaryFacts("Project", null, "Project One", {
        assessments: [
          {
            assessedAt: "2026-10-04T00:00:00.000Z",
            decision: "Undecided",
            id: "a1",
            label: "Checkout",
          },
        ],
        gaps: [
          {
            id: "g1",
            recordedAt: "2026-10-01T00:00:00.000Z",
            state: "Open",
            title: "A",
          },
          {
            id: "g2",
            recordedAt: "2026-10-01T00:00:00.000Z",
            state: "Planned",
            title: "B",
          },
          {
            id: "g3",
            recordedAt: "2026-10-01T00:00:00.000Z",
            state: "Not needed",
            title: "C",
          },
        ],
        handoffs: [
          { id: "h1", state: "Draft", title: "Draft" },
          { id: "h2", state: "Shared", title: "Shared" },
          { id: "h3", state: "Closed", title: "Closed" },
        ],
      }),
    });
    const summary = await harness.testReview.summary(accountId, {
      projectId,
      scope: { kind: "Project" },
    });
    expect(summary.attention).toEqual([]);
    expect(summary.sections.map((entry) => entry.key)).toEqual([
      "unreviewed-reports",
      "follow-up-needed-results",
      "open-gaps",
      "conflicting-results",
      "context-changed-results",
      "active-handoffs",
      "recent-sessions",
      "recent-assessments",
    ]);
    expect(ids(summary, "unreviewed-reports")).toEqual([
      "s-other",
      "s-feature",
    ]);
    expect(ids(summary, "open-gaps")).toEqual(["g1", "g2"]);
    expect(ids(summary, "active-handoffs")).toEqual(["h2"]);
    expect(ids(summary, "recent-sessions")).toEqual(["s-other", "s-feature"]);
    expect(ids(summary, "recent-assessments")).toEqual(["a1"]);
    expect(harness.writes).toEqual([]);
  });

  test("follow-up needed results and context changes follow the review seam", async () => {
    const harness = createMemoryHarness(sessions());
    await harness.testReview.setItemReviewState(accountId, {
      projectId,
      sessionId: "s-feature",
      sessionTestId: "fail",
      state: "Follow-up needed",
    });
    const summary = await harness.testReview.summary(accountId, {
      projectId,
      scope: { kind: "Project" },
    });
    expect(ids(summary, "follow-up-needed-results")).toEqual(["fail"]);
    // Failed, conflict and context never open a Test Gap by themselves.
    expect(ids(summary, "open-gaps")).toEqual([]);
    expect(ids(summary, "context-changed-results")).toEqual([
      "pass",
      "fail",
      "skip",
    ]);
  });

  test("the contract has no write for gaps, assessments, handoffs or reports", () => {
    const { testReview } = setup();
    expect(Object.keys(testReview).join(" ")).not.toMatch(FORBIDDEN_MEMBER);
  });
});
