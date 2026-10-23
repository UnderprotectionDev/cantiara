import { describe, expect, test } from "vitest";

import {
  addReleaseChecklistItemInputSchema,
  deriveReleaseEvidencePack,
  deriveReleaseOpenScopeSignal,
  type ReleaseEvidenceFacts,
  releaseEvidencePackInputSchema,
  releaseEvidencePackSchema,
  setReleaseChecklistItemInputSchema,
} from "./release-evidence";

const SCORE_OR_GATE = /score|verdict|readiness|gate|passRate/i;
const ACCEPTED = /accepted|acceptance evidence/i;
const STALE = /stale|old|outdated/i;

const ok = <T>(value: T) => ({ available: true as const, value });

function facts(
  overrides: Partial<ReleaseEvidenceFacts> = {},
): ReleaseEvidenceFacts {
  return {
    assessment: ok(null),
    checklist: [],
    decisions: ok([]),
    gaps: ok([]),
    inconsistencies: ok([]),
    publishDiff: ok({ changelogPrepared: true, snapshotApproved: true }),
    pullRequests: ok([
      {
        checks: [
          {
            checkId: "ci",
            name: "CI",
            outcome: "Passed",
            requirement: "Required",
          },
        ],
        number: 7,
        recordId: "pr-7",
        role: "Required for completion",
        sourceState: "merged",
        title: "Ship it",
        workIds: ["work-1"],
      },
    ]),
    readOnly: false,
    release: {
      id: "release-1",
      name: "tidekit 1.0",
      projectId: "project-1",
      status: "Preparing",
      versionLabel: "1.0",
    },
    risks: ok([]),
    scope: ok([
      {
        expectedOutcome: "Users can ship.",
        id: "work-1",
        key: "TID-1",
        status: "Done",
        title: "Ship",
      },
    ]),
    tests: ok({
      cases: [{ id: "case-1", title: "Ship case" }],
      contextChanges: [],
      handoffs: [],
      sessionTests: [
        {
          id: "st-1",
          normalizedResult: "passed",
          rawResult: "PASS",
          reportedAt: "2020-01-01T00:00:00.000Z",
          reviewState: "Reviewed",
          sessionId: "session-1",
          sessionLabel: "Run 1",
          technicalContext: "build 42",
          title: "Ship flow",
        },
      ],
    }),
    ...overrides,
  };
}

const reasons = (input: ReleaseEvidenceFacts) =>
  deriveReleaseEvidencePack(input).attention.map((row) => row.reason);

describe("Release Evidence Pack", () => {
  test("a fully sourced release has sections that open sources and no attention", () => {
    const pack = deriveReleaseEvidencePack(facts());
    expect(pack.attention).toEqual([]);
    expect(releaseEvidencePackSchema.safeParse(pack).success).toBe(true);
    for (const section of pack.sections) {
      for (const row of section.rows) {
        expect(row.why.length).toBeGreaterThan(0);
        expect(row.source.recordId.length).toBeGreaterThan(0);
      }
    }
  });

  test("the pack carries no score, verdict or gate field and never says publish", () => {
    const pack = deriveReleaseEvidencePack(
      facts({ release: { ...facts().release, status: "Draft" } }),
    );
    const serialized = JSON.stringify(pack);
    expect(serialized).not.toMatch(SCORE_OR_GATE);
    expect(serialized.toLowerCase()).not.toContain("ready to publish");
    expect(Object.keys(pack).sort()).toEqual([
      "attention",
      "checklist",
      "readOnly",
      "release",
      "sections",
    ]);
  });

  test("missing scope, expected outcome, required PR and related tests are visible attention, never omitted", () => {
    const pack = deriveReleaseEvidencePack(
      facts({
        pullRequests: ok([]),
        scope: ok([
          {
            expectedOutcome: null,
            id: "work-2",
            key: "TID-2",
            status: "Open",
            title: "Unfinished",
          },
        ]),
        tests: ok({
          cases: [],
          contextChanges: [],
          handoffs: [],
          sessionTests: [],
        }),
      }),
    );
    expect(pack.attention.map((row) => row.reason).sort()).toEqual([
      "missing-expected-outcome",
      "missing-related-tests",
      "missing-required-pull-request",
    ]);
    expect(pack.sections.map((section) => section.section)).toHaveLength(6);

    expect(reasons(facts({ scope: ok([]) }))).toContain("missing-scope");
  });

  test("an unavailable source is a source-linked attention row and its section stays", () => {
    const pack = deriveReleaseEvidencePack(
      facts({
        publishDiff: { available: false, reason: "Not available yet." },
        scope: { available: false, reason: "Release scope is not readable." },
      }),
    );
    const unavailable = pack.attention.filter(
      (row) => row.reason === "source-unavailable",
    );
    expect(unavailable.map((row) => row.section).sort()).toEqual([
      "Publish diff",
      "Scope",
    ]);
    expect(
      unavailable.every((row) => row.source.recordId === "release-1"),
    ).toBe(true);
    const scope = pack.sections.find((section) => section.section === "Scope");
    expect(scope?.unavailableReason).toBe("Release scope is not readable.");
  });

  test("GitHub checks keep their source states and are not Test Sessions", () => {
    const pack = deriveReleaseEvidencePack(
      facts({
        pullRequests: ok([
          {
            checks: [
              {
                checkId: "ci",
                name: "CI",
                outcome: "Failed",
                requirement: "Required",
              },
              {
                checkId: "lint",
                name: "Lint",
                outcome: "Pending",
                requirement: "Unknown",
              },
            ],
            number: 7,
            recordId: "pr-7",
            role: "Required for completion",
            sourceState: "open",
            title: "Ship it",
            workIds: ["work-1"],
          },
        ]),
      }),
    );
    expect(pack.attention.map((row) => row.reason).sort()).toEqual([
      "failed-check",
      "pending-check",
    ]);
    const checks = pack.sections
      .flatMap((section) => section.rows)
      .filter((row) => row.source.recordType === "Check");
    expect(checks.map((row) => row.state)).toEqual(["Failed", "Pending"]);
    const tests = pack.sections.find((section) => section.section === "Tests");
    expect(tests?.rows.some((row) => row.source.recordType === "Check")).toBe(
      false,
    );
  });

  test("Work–PR inconsistency, open Risk, open Test Gap are neutral source-linked attention", () => {
    const found = reasons(
      facts({
        gaps: ok([{ id: "gap-1", state: "Open", title: "Upgrade path" }]),
        inconsistencies: ok([
          {
            pullRequestRecordId: "pr-7",
            summary: "TID-1 is Done but #7 is not merged",
            workId: "work-1",
          },
        ]),
        risks: ok([
          { id: "risk-1", open: true, state: "Open", title: "Data loss" },
          { id: "risk-2", open: false, state: "Resolved", title: "Old" },
        ]),
      }),
    );
    expect(found.sort()).toEqual([
      "open-risk",
      "open-test-gap",
      "work-pull-request-inconsistency",
    ]);
  });

  test("a reported Passed keeps the raw report, normalized result, source session and context, and is not acceptance", () => {
    const pack = deriveReleaseEvidencePack(facts());
    const row = pack.sections
      .flatMap((section) => section.rows)
      .find((entry) => entry.rowId === "session-test:st-1");
    expect(row?.details).toEqual(
      expect.arrayContaining([
        { label: "Reported result", value: "PASS" },
        { label: "Normalized result", value: "passed" },
        { label: "Source session", value: "Run 1" },
        { label: "Technical context", value: "build 42" },
      ]),
    );
    expect(row?.why).toContain("not acceptance");
    expect(JSON.stringify(row)).not.toMatch(ACCEPTED);
  });

  test("negative, inconclusive and unreviewed reports and context changes raise attention", () => {
    const found = reasons(
      facts({
        tests: ok({
          cases: [],
          contextChanges: [
            {
              id: "ctx-1",
              kind: "commit",
              label: "abc123",
              recordedAt: "2026-01-01T00:00:00.000Z",
            },
          ],
          handoffs: [],
          sessionTests: [
            {
              id: "st-2",
              normalizedResult: "failed",
              rawResult: "FAIL",
              reportedAt: null,
              reviewState: "Unreviewed",
              sessionId: "s",
              sessionLabel: "Run 2",
              technicalContext: null,
              title: "Broken",
            },
            {
              id: "st-3",
              normalizedResult: "inconclusive",
              rawResult: "?",
              reportedAt: null,
              reviewState: "Reviewed",
              sessionId: "s",
              sessionLabel: "Run 2",
              technicalContext: null,
              title: "Unclear",
            },
          ],
        }),
      }),
    );
    expect(found.sort()).toEqual([
      "context-change",
      "negative-or-inconclusive-result",
      "negative-or-inconclusive-result",
      "unreviewed-report",
    ]);
  });

  test("elapsed time alone never marks a test stale", () => {
    const old = facts();
    const pack = deriveReleaseEvidencePack(old);
    expect(pack.attention.some((row) => STALE.test(row.why))).toBe(false);
    expect(pack.attention).toEqual([]);
  });

  test("new context after the latest assessment is attention; an assessment alone is not", () => {
    const assessment = (newContextCount: number) =>
      ok({
        assessedAt: "2026-01-01T00:00:00.000Z",
        decision: "Acceptable",
        id: "assessment-1",
        newContextCount,
      });
    expect(reasons(facts({ assessment: assessment(0) }))).toEqual([]);
    expect(reasons(facts({ assessment: assessment(2) }))).toEqual([
      "new-context-since-assessment",
    ]);
  });

  test("a missing changelog or snapshot is attention on the publish diff row", () => {
    const pack = deriveReleaseEvidencePack(
      facts({
        publishDiff: ok({ changelogPrepared: false, snapshotApproved: true }),
      }),
    );
    expect(pack.attention.map((row) => row.reason)).toEqual([
      "missing-publish-diff",
    ]);
    const diff = pack.sections.find(
      (section) => section.section === "Publish diff",
    );
    expect(diff?.rows[0]?.source.recordType).toBe("Publish diff");
  });

  test("checklist state is shown but changes no other row and never gates", () => {
    const base = deriveReleaseEvidencePack(facts());
    const checked = deriveReleaseEvidencePack(
      facts({
        checklist: [{ checked: false, id: "c1", text: "Tag the repo" }],
      }),
    );
    expect(checked.attention).toEqual(base.attention);
    const checklist = checked.sections.find(
      (section) => section.section === "Checklist",
    );
    expect(checklist?.rows[0]?.why).toContain("does not gate publish");
  });

  test("a Published release with open Work raises a deduped signal that blocks nothing", () => {
    const published = facts({
      release: { ...facts().release, status: "Published" },
      scope: ok([
        {
          expectedOutcome: "x",
          id: "work-9",
          key: "TID-9",
          status: "In Progress",
          title: "Still going",
        },
      ]),
    });
    const signal = deriveReleaseOpenScopeSignal(published, false);
    expect(signal).toMatchObject({
      blocksPublish: false,
      closeable: true,
      signalId: "published-release-open-scope:release-1",
    });
    expect(deriveReleaseOpenScopeSignal(published, false)?.signalId).toBe(
      signal?.signalId,
    );
    expect(deriveReleaseOpenScopeSignal(facts(), false)).toBeNull();
    expect(
      deriveReleaseOpenScopeSignal(
        {
          ...published,
          release: { ...published.release, status: "Preparing" },
        },
        false,
      ),
    ).toBeNull();
    expect(reasons(published)).toContain("published-release-open-scope");
  });

  test("pack inputs reject domain writes, status and score fields", () => {
    expect(
      releaseEvidencePackInputSchema.safeParse({
        projectId: "p",
        releaseId: "r",
        status: "Published",
      }).success,
    ).toBe(false);
    expect(
      addReleaseChecklistItemInputSchema.safeParse({
        projectId: "p",
        releaseId: "r",
        text: "Tag",
      }).success,
    ).toBe(true);
    expect(
      addReleaseChecklistItemInputSchema.safeParse({
        projectId: "p",
        releaseId: "r",
        text: "Tag",
        workStatus: "Done",
      }).success,
    ).toBe(false);
    expect(
      setReleaseChecklistItemInputSchema.safeParse({
        checked: true,
        itemId: "i",
        projectId: "p",
        publish: true,
        releaseId: "r",
      }).success,
    ).toBe(false);
  });
});
