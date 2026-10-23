import { z } from "zod";

import type { GITHUB_CHECK_OUTCOMES } from "./github-checks";
import type { GITHUB_WORK_LINK_ROLES } from "./github-work-links";
import type { TEST_REPORT_RESULTS } from "./test-report";
import type { TEST_REVIEW_STATES } from "./test-review";

/**
 * Release Evidence Pack seam (spec 64, Sürüm Kanıt Paketi).
 *
 * The pack is a live, read-only evaluation view of one Project Release. It is
 * derived from owner records on every read and stores nothing but the optional
 * Release checklist. It computes no score, no pass rate, no ready/not-ready
 * verdict and no gate, runs no CI or deploy, and never says "publish". Every
 * row names why it is shown and the owner record it opens (`Open source
 * record`); a fix happens on that record's own surface, so the pack has no
 * command that writes Work, test, Pull request, Risk, Karar or Project Release
 * state. A missing required source is a visible, neutral attention row and is
 * never silently omitted. Elapsed time alone never makes a test stale. A
 * Test Session `Passed` is a reported historical result, not Cantiara
 * acceptance (ADR-0007), and GitHub checks keep their source states instead of
 * becoming Test Sessions. It is not the Test Summary (57), the PR Context Card
 * (61), Project Release planning (63), release notes (65) or a closure summary.
 */

const identifierSchema = z.string().trim().min(1).max(255);

export const RELEASE_EVIDENCE_PACK_LABEL = "Release Evidence Pack" as const;
export const RELEASE_EVIDENCE_OPEN_SOURCE_LABEL = "Open source record" as const;
export const RELEASE_EVIDENCE_CHECKLIST_LABEL = "Checklist" as const;
export const RELEASE_EVIDENCE_ADD_ITEM_LABEL = "Add item" as const;
export const RELEASE_EVIDENCE_NOTE =
  "Edit records on their own surface. This pack has no score and no gate." as const;

export const RELEASE_EVIDENCE_SECTIONS = [
  "Scope",
  "Pull requests and checks",
  "Decisions and Risks",
  "Tests",
  "Checklist",
  "Publish diff",
] as const;
export type ReleaseEvidenceSection = (typeof RELEASE_EVIDENCE_SECTIONS)[number];

/** Owner record kinds a row can open. */
export const RELEASE_EVIDENCE_SOURCE_TYPES = [
  "Work",
  "Pull request",
  "Check",
  "Decision",
  "Risk",
  "Planned Test Case",
  "Test Handoff",
  "Test Session",
  "Test Gap",
  "Test Assessment",
  "Publish diff",
  "Project Release",
] as const;
export type ReleaseEvidenceSourceType =
  (typeof RELEASE_EVIDENCE_SOURCE_TYPES)[number];

/** Neutral attention reasons. None of them is a score, a verdict or a gate. */
export const RELEASE_EVIDENCE_ATTENTION_REASONS = [
  "source-unavailable",
  "missing-scope",
  "missing-expected-outcome",
  "missing-required-pull-request",
  "pending-check",
  "failed-check",
  "work-pull-request-inconsistency",
  "open-risk",
  "missing-related-tests",
  "negative-or-inconclusive-result",
  "unreviewed-report",
  "open-test-gap",
  "context-change",
  "new-context-since-assessment",
  "missing-publish-diff",
  "published-release-open-scope",
] as const;
export type ReleaseEvidenceAttentionReason =
  (typeof RELEASE_EVIDENCE_ATTENTION_REASONS)[number];

export const releaseEvidenceSourceRefSchema = z
  .object({
    label: z.string(),
    recordId: z.string(),
    recordType: z.enum(RELEASE_EVIDENCE_SOURCE_TYPES),
  })
  .strict();
export type ReleaseEvidenceSourceRef = z.infer<
  typeof releaseEvidenceSourceRefSchema
>;

export const releaseEvidenceRowSchema = z
  .object({
    /** Name/value pairs shown as stored, e.g. the raw and normalized result. */
    details: z.array(z.object({ label: z.string(), value: z.string() })),
    rowId: z.string(),
    section: z.enum(RELEASE_EVIDENCE_SECTIONS),
    /** The owner record's own state text; never edited here. */
    state: z.string().nullable(),
    /** The owner record `Open source record` opens. */
    source: releaseEvidenceSourceRefSchema,
    title: z.string(),
    /** Why this row is on the pack. */
    why: z.string(),
  })
  .strict();
export type ReleaseEvidenceRow = z.infer<typeof releaseEvidenceRowSchema>;

export const releaseEvidenceAttentionRowSchema = z
  .object({
    reason: z.enum(RELEASE_EVIDENCE_ATTENTION_REASONS),
    rowId: z.string(),
    section: z.enum(RELEASE_EVIDENCE_SECTIONS),
    /** The record to open; the release itself when the source is missing. */
    source: releaseEvidenceSourceRefSchema,
    title: z.string(),
    why: z.string(),
  })
  .strict();
export type ReleaseEvidenceAttentionRow = z.infer<
  typeof releaseEvidenceAttentionRowSchema
>;

export const releaseEvidenceSectionStateSchema = z
  .object({
    /** Counts of exact sets listed in `rows`; a section never hides itself. */
    count: z.number().int(),
    /** Set when the owner source could not be read; the other sections work. */
    unavailableReason: z.string().nullable(),
    rows: z.array(releaseEvidenceRowSchema),
    section: z.enum(RELEASE_EVIDENCE_SECTIONS),
  })
  .strict();
export type ReleaseEvidenceSectionState = z.infer<
  typeof releaseEvidenceSectionStateSchema
>;

export const releaseEvidenceChecklistItemSchema = z
  .object({
    checked: z.boolean(),
    id: z.string(),
    text: z.string(),
  })
  .strict();
export type ReleaseEvidenceChecklistItem = z.infer<
  typeof releaseEvidenceChecklistItemSchema
>;

export const releaseEvidencePackSchema = z
  .object({
    attention: z.array(releaseEvidenceAttentionRowSchema),
    checklist: z.array(releaseEvidenceChecklistItemSchema),
    readOnly: z.boolean(),
    release: z
      .object({
        id: z.string(),
        name: z.string(),
        projectId: z.string(),
        status: z.string(),
        versionLabel: z.string().nullable(),
      })
      .strict(),
    sections: z.array(releaseEvidenceSectionStateSchema),
  })
  .strict();
export type ReleaseEvidencePack = z.infer<typeof releaseEvidencePackSchema>;

// ---------------------------------------------------------------------------
// Inputs. Every schema is strict so no Work, test, PR, Risk, Karar, status or
// score field can be smuggled onto the pack.
// ---------------------------------------------------------------------------

export const releaseEvidencePackInputSchema = z
  .object({ projectId: identifierSchema, releaseId: identifierSchema })
  .strict();
export type ReleaseEvidencePackInput = z.infer<
  typeof releaseEvidencePackInputSchema
>;

export const releaseChecklistTextSchema = z.string().trim().min(1).max(500);

export const addReleaseChecklistItemInputSchema = z
  .object({
    projectId: identifierSchema,
    releaseId: identifierSchema,
    text: releaseChecklistTextSchema,
  })
  .strict();
export type AddReleaseChecklistItemInput = z.infer<
  typeof addReleaseChecklistItemInputSchema
>;

export const setReleaseChecklistItemInputSchema = z
  .object({
    checked: z.boolean(),
    itemId: identifierSchema,
    projectId: identifierSchema,
    releaseId: identifierSchema,
  })
  .strict();
export type SetReleaseChecklistItemInput = z.infer<
  typeof setReleaseChecklistItemInputSchema
>;

export const removeReleaseChecklistItemInputSchema = z
  .object({
    itemId: identifierSchema,
    projectId: identifierSchema,
    releaseId: identifierSchema,
  })
  .strict();
export type RemoveReleaseChecklistItemInput = z.infer<
  typeof removeReleaseChecklistItemInputSchema
>;

export const releaseChecklistItemOutputSchema =
  releaseEvidenceChecklistItemSchema;

/** The deduped, closeable signal for a Published release with open Work. */
export const RELEASE_OPEN_SCOPE_SIGNAL_TYPE =
  "published-release-open-scope" as const;

export const releaseOpenScopeSignalSchema = z
  .object({
    /** Stable per release: the same open scope never creates a second signal. */
    signalId: z.string(),
    signalType: z.literal(RELEASE_OPEN_SCOPE_SIGNAL_TYPE),
    /** The signal never blocks publish and never changes a status. */
    blocksPublish: z.literal(false),
    closeable: z.literal(true),
    closed: z.boolean(),
    openWork: z.array(
      z.object({ id: z.string(), key: z.string(), title: z.string() }).strict(),
    ),
    releaseId: z.string(),
    sourcePath: z.string(),
  })
  .strict();
export type ReleaseOpenScopeSignal = z.infer<
  typeof releaseOpenScopeSignalSchema
>;

export const releaseOpenScopeSignalOutputSchema = z
  .object({ signal: releaseOpenScopeSignalSchema.nullable() })
  .strict();

export const closeReleaseOpenScopeSignalInputSchema = z
  .object({
    projectId: identifierSchema,
    releaseId: identifierSchema,
  })
  .strict();
export type CloseReleaseOpenScopeSignalInput = z.infer<
  typeof closeReleaseOpenScopeSignalInputSchema
>;

// ---------------------------------------------------------------------------
// Facts: what the owner records say, supplied through a read-only port.
// ---------------------------------------------------------------------------

/** A source is either read or named as unavailable; never silently empty. */
export type ReleaseEvidenceSourced<T> =
  | { available: true; value: T }
  | { available: false; reason: string };

export interface ReleaseEvidenceWorkFact {
  expectedOutcome: string | null;
  id: string;
  key: string;
  /** The Work owner's status text, e.g. `Done`. */
  status: string;
  title: string;
}

export interface ReleaseEvidenceCheckFact {
  checkId: string;
  name: string;
  outcome: (typeof GITHUB_CHECK_OUTCOMES)[number];
  requirement: "Required" | "Unknown";
}

export interface ReleaseEvidencePullRequestFact {
  checks: ReleaseEvidenceCheckFact[];
  number: number;
  recordId: string;
  role: (typeof GITHUB_WORK_LINK_ROLES)[number];
  sourceState: "open" | "closed" | "merged";
  title: string;
  workIds: string[];
}

/** A direct Work–Pull request mismatch the GitHub owner reports. */
export interface ReleaseEvidenceInconsistencyFact {
  pullRequestRecordId: string | null;
  summary: string;
  workId: string;
}

export interface ReleaseEvidenceRecordFact {
  id: string;
  /** Owner state text; a Risk is open when `open` is true. */
  open: boolean;
  state: string | null;
  title: string;
}

export interface ReleaseEvidenceSessionTestFact {
  id: string;
  normalizedResult: (typeof TEST_REPORT_RESULTS)[number] | null;
  rawResult: string | null;
  reportedAt: string | null;
  reviewState: (typeof TEST_REVIEW_STATES)[number];
  sessionId: string;
  sessionLabel: string;
  /** Technical context the executor reported (build, commit, environment). */
  technicalContext: string | null;
  title: string;
}

export interface ReleaseEvidenceContextChangeFact {
  id: string;
  kind: "spec" | "commit" | "build";
  label: string;
  recordedAt: string;
}

export interface ReleaseEvidenceTestFacts {
  cases: { id: string; title: string }[];
  contextChanges: ReleaseEvidenceContextChangeFact[];
  handoffs: { id: string; title: string }[];
  sessionTests: ReleaseEvidenceSessionTestFact[];
}

export interface ReleaseEvidenceGapFact {
  id: string;
  state: string;
  title: string;
}

export interface ReleaseEvidenceAssessmentFact {
  assessedAt: string;
  decision: string;
  id: string;
  /** Test context recorded after `assessedAt`; elapsed time is never one. */
  newContextCount: number;
}

export interface ReleaseEvidencePublishDiffFact {
  /** Whether a prepared changelog exists to compare. */
  changelogPrepared: boolean;
  /** Whether an approved external snapshot exists to compare against. */
  snapshotApproved: boolean;
}

export interface ReleaseEvidenceFacts {
  assessment: ReleaseEvidenceSourced<ReleaseEvidenceAssessmentFact | null>;
  checklist: ReleaseEvidenceChecklistItem[];
  decisions: ReleaseEvidenceSourced<ReleaseEvidenceRecordFact[]>;
  gaps: ReleaseEvidenceSourced<ReleaseEvidenceGapFact[]>;
  inconsistencies: ReleaseEvidenceSourced<ReleaseEvidenceInconsistencyFact[]>;
  publishDiff: ReleaseEvidenceSourced<ReleaseEvidencePublishDiffFact>;
  pullRequests: ReleaseEvidenceSourced<ReleaseEvidencePullRequestFact[]>;
  readOnly: boolean;
  release: ReleaseEvidencePack["release"];
  risks: ReleaseEvidenceSourced<ReleaseEvidenceRecordFact[]>;
  scope: ReleaseEvidenceSourced<ReleaseEvidenceWorkFact[]>;
  tests: ReleaseEvidenceSourced<ReleaseEvidenceTestFacts>;
}

// ---------------------------------------------------------------------------
// Pure derivation.
// ---------------------------------------------------------------------------

const NEGATIVE_RESULTS = new Set<string>([
  "failed",
  "blocked",
  "inconclusive",
  "not_reported",
]);

const releaseSource = (facts: ReleaseEvidenceFacts) => ({
  label: facts.release.name,
  recordId: facts.release.id,
  recordType: "Project Release" as const,
});

const isWorkOpen = (work: ReleaseEvidenceWorkFact) =>
  work.status !== "Done" && work.status !== "Canceled";

export function releaseOpenScopeWork(facts: ReleaseEvidenceFacts) {
  if (!facts.scope.available) {
    return [];
  }
  return facts.scope.value.filter(isWorkOpen);
}

interface Builder {
  attention: ReleaseEvidenceAttentionRow[];
  facts: ReleaseEvidenceFacts;
}

function attend(
  builder: Builder,
  section: ReleaseEvidenceSection,
  reason: ReleaseEvidenceAttentionReason,
  key: string,
  source: ReleaseEvidenceSourceRef,
  title: string,
  why: string,
) {
  builder.attention.push({
    reason,
    rowId: `attention:${reason}:${key}`,
    section,
    source,
    title,
    why,
  });
}

function unavailable(
  builder: Builder,
  section: ReleaseEvidenceSection,
  reason: string,
) {
  attend(
    builder,
    section,
    "source-unavailable",
    section,
    releaseSource(builder.facts),
    `${section} source is unavailable`,
    reason,
  );
  return reason;
}

function sectionState(
  section: ReleaseEvidenceSection,
  rows: ReleaseEvidenceRow[],
  unavailableReason: string | null,
): ReleaseEvidenceSectionState {
  return { count: rows.length, rows, section, unavailableReason };
}

function workSource(work: ReleaseEvidenceWorkFact): ReleaseEvidenceSourceRef {
  return {
    label: `${work.key} ${work.title}`,
    recordId: work.id,
    recordType: "Work",
  };
}

function scopeSection(builder: Builder) {
  const { scope } = builder.facts;
  if (!scope.available) {
    return sectionState(
      "Scope",
      [],
      unavailable(builder, "Scope", scope.reason),
    );
  }
  const rows = scope.value.map(
    (work): ReleaseEvidenceRow => ({
      details: [
        {
          label: "Expected Outcome",
          value: work.expectedOutcome?.trim() || "Not set",
        },
      ],
      rowId: `scope:${work.id}`,
      section: "Scope",
      source: workSource(work),
      state: work.status,
      title: `${work.key} ${work.title}`,
      why: "In this Project Release's scope.",
    }),
  );
  if (scope.value.length === 0) {
    attend(
      builder,
      "Scope",
      "missing-scope",
      builder.facts.release.id,
      releaseSource(builder.facts),
      "No Work in scope",
      "This Project Release has no Work in its scope.",
    );
  }
  for (const work of scope.value) {
    if (!work.expectedOutcome?.trim()) {
      attend(
        builder,
        "Scope",
        "missing-expected-outcome",
        work.id,
        workSource(work),
        `${work.key} has no Expected Outcome`,
        "A Work in scope has no Expected Outcome.",
      );
    }
  }
  return sectionState("Scope", rows, null);
}

function pullRequestRows(
  builder: Builder,
  pull: ReleaseEvidencePullRequestFact,
): ReleaseEvidenceRow[] {
  const section = "Pull requests and checks" as const;
  const rows: ReleaseEvidenceRow[] = [
    {
      details: [],
      rowId: `pull:${pull.recordId}`,
      section,
      source: {
        label: `#${pull.number} ${pull.title}`,
        recordId: pull.recordId,
        recordType: "Pull request",
      },
      state: pull.sourceState,
      title: `#${pull.number} ${pull.title}`,
      why: `Linked to Work in scope as ${pull.role}.`,
    },
  ];
  for (const check of pull.checks) {
    const checkSource = {
      label: `${check.name} on #${pull.number}`,
      recordId: `${pull.recordId}:${check.checkId}`,
      recordType: "Check" as const,
    };
    rows.push({
      details: [{ label: "Requirement", value: check.requirement }],
      rowId: `check:${pull.recordId}:${check.checkId}`,
      section,
      source: checkSource,
      state: check.outcome,
      title: check.name,
      why: `GitHub check on #${pull.number}, shown with its source state.`,
    });
    if (check.outcome === "Failed" || check.outcome === "Pending") {
      attend(
        builder,
        section,
        check.outcome === "Failed" ? "failed-check" : "pending-check",
        `${pull.recordId}:${check.checkId}`,
        checkSource,
        `${check.name} is ${check.outcome}`,
        `A GitHub check on #${pull.number} is ${check.outcome}.`,
      );
    }
  }
  return rows;
}

function attendMissingRequiredPullRequests(
  builder: Builder,
  pulls: ReleaseEvidencePullRequestFact[],
) {
  if (!builder.facts.scope.available) {
    return;
  }
  for (const work of builder.facts.scope.value) {
    const required = pulls.some(
      (pull) =>
        pull.role === "Required for completion" &&
        pull.workIds.includes(work.id),
    );
    if (!required) {
      attend(
        builder,
        "Pull requests and checks",
        "missing-required-pull-request",
        work.id,
        workSource(work),
        `${work.key} has no Required for completion Pull request`,
        "A Work in scope has no linked Pull request marked Required for completion.",
      );
    }
  }
}

function inconsistencyRows(builder: Builder): ReleaseEvidenceRow[] {
  const { inconsistencies, scope } = builder.facts;
  const section = "Pull requests and checks" as const;
  if (!inconsistencies.available) {
    unavailable(builder, section, inconsistencies.reason);
    return [];
  }
  return inconsistencies.value.map((item) => {
    const work = scope.available
      ? scope.value.find((entry) => entry.id === item.workId)
      : undefined;
    const source = work
      ? workSource(work)
      : {
          label: item.workId,
          recordId: item.workId,
          recordType: "Work" as const,
        };
    const key = `${item.workId}:${item.pullRequestRecordId ?? ""}`;
    attend(
      builder,
      section,
      "work-pull-request-inconsistency",
      key,
      source,
      item.summary,
      "A Work and its Pull request disagree.",
    );
    return {
      details: [],
      rowId: `inconsistency:${key}`,
      section,
      source,
      state: null,
      title: item.summary,
      why: "Work and Pull request disagree.",
    };
  });
}

function pullRequestSection(builder: Builder) {
  const { pullRequests } = builder.facts;
  const section = "Pull requests and checks" as const;
  if (!pullRequests.available) {
    return sectionState(
      section,
      [],
      unavailable(builder, section, pullRequests.reason),
    );
  }
  const rows = pullRequests.value.flatMap((pull) =>
    pullRequestRows(builder, pull),
  );
  attendMissingRequiredPullRequests(builder, pullRequests.value);
  return sectionState(section, [...rows, ...inconsistencyRows(builder)], null);
}

function recordSection(builder: Builder) {
  const { facts } = builder;
  const section = "Decisions and Risks" as const;
  const rows: ReleaseEvidenceRow[] = [];
  const reasons: string[] = [];
  if (facts.decisions.available) {
    for (const record of facts.decisions.value) {
      rows.push({
        details: [],
        rowId: `decision:${record.id}`,
        section,
        source: {
          label: record.title,
          recordId: record.id,
          recordType: "Decision",
        },
        state: record.state,
        title: record.title,
        why: "Related to this Project Release's scope.",
      });
    }
  } else {
    reasons.push(unavailable(builder, section, facts.decisions.reason));
  }
  if (facts.risks.available) {
    for (const record of facts.risks.value) {
      const source = {
        label: record.title,
        recordId: record.id,
        recordType: "Risk" as const,
      };
      rows.push({
        details: [],
        rowId: `risk:${record.id}`,
        section,
        source,
        state: record.state,
        title: record.title,
        why: record.open
          ? "Open Risk related to this Project Release."
          : "Risk related to this Project Release.",
      });
      if (record.open) {
        attend(
          builder,
          section,
          "open-risk",
          record.id,
          source,
          `${record.title} is open`,
          "An open Risk is related to this Project Release.",
        );
      }
    }
  } else {
    reasons.push(unavailable(builder, section, facts.risks.reason));
  }
  return sectionState(
    section,
    rows,
    reasons.length > 0 ? reasons.join(" ") : null,
  );
}

function sessionSource(
  test: ReleaseEvidenceSessionTestFact,
): ReleaseEvidenceSourceRef {
  return {
    label: test.sessionLabel,
    recordId: test.sessionId,
    recordType: "Test Session",
  };
}

function sessionTestRow(test: ReleaseEvidenceSessionTestFact) {
  const section = "Tests" as const;
  return {
    details: [
      { label: "Reported result", value: test.rawResult ?? "Not reported" },
      {
        label: "Normalized result",
        value: test.normalizedResult ?? "Not reported",
      },
      { label: "Source session", value: test.sessionLabel },
      { label: "Review", value: test.reviewState },
      ...(test.technicalContext
        ? [{ label: "Technical context", value: test.technicalContext }]
        : []),
      ...(test.reportedAt
        ? [{ label: "Reported at", value: test.reportedAt }]
        : []),
    ],
    rowId: `session-test:${test.id}`,
    section,
    // A Session Test opens its source Test Session, where its item lives.
    source: sessionSource(test),
    // The reported result is history; it is never labelled acceptance.
    state: test.normalizedResult,
    title: test.title,
    why: "Reported by a Test Session related to this Project Release (historical, not acceptance).",
  } satisfies ReleaseEvidenceRow;
}

interface PartialRows {
  reason: string | null;
  rows: ReleaseEvidenceRow[];
}

function plannedTestRows(tests: ReleaseEvidenceTestFacts) {
  const rows: ReleaseEvidenceRow[] = [];
  for (const item of tests.cases) {
    rows.push({
      details: [],
      rowId: `case:${item.id}`,
      section: "Tests",
      source: {
        label: item.title,
        recordId: item.id,
        recordType: "Planned Test Case",
      },
      state: null,
      title: item.title,
      why: "Planned Test Case related to this Project Release's scope.",
    });
  }
  for (const item of tests.handoffs) {
    rows.push({
      details: [],
      rowId: `handoff:${item.id}`,
      section: "Tests",
      source: {
        label: item.title,
        recordId: item.id,
        recordType: "Test Handoff",
      },
      state: null,
      title: item.title,
      why: "Test Handoff related to this Project Release's scope.",
    });
  }
  return rows;
}

function attendSessionTest(
  builder: Builder,
  test: ReleaseEvidenceSessionTestFact,
) {
  const source = sessionSource(test);
  if (test.normalizedResult && NEGATIVE_RESULTS.has(test.normalizedResult)) {
    attend(
      builder,
      "Tests",
      "negative-or-inconclusive-result",
      test.id,
      source,
      `${test.title} reported ${test.normalizedResult}`,
      "A reported result is negative or inconclusive.",
    );
  }
  if (test.reviewState === "Unreviewed") {
    attend(
      builder,
      "Tests",
      "unreviewed-report",
      test.id,
      source,
      `${test.title} is Unreviewed`,
      "A reported result has not been reviewed yet.",
    );
  }
}

function testRecordRows(builder: Builder): PartialRows {
  const { facts } = builder;
  if (!facts.tests.available) {
    return {
      reason: unavailable(builder, "Tests", facts.tests.reason),
      rows: [],
    };
  }
  const tests = facts.tests.value;
  const rows = plannedTestRows(tests);
  for (const test of tests.sessionTests) {
    rows.push(sessionTestRow(test));
    attendSessionTest(builder, test);
  }
  for (const change of tests.contextChanges) {
    attend(
      builder,
      "Tests",
      "context-change",
      change.id,
      releaseSource(facts),
      `${change.kind} context changed: ${change.label}`,
      `A ${change.kind} context changed at ${change.recordedAt}.`,
    );
  }
  if (
    tests.cases.length === 0 &&
    tests.handoffs.length === 0 &&
    tests.sessionTests.length === 0
  ) {
    attend(
      builder,
      "Tests",
      "missing-related-tests",
      facts.release.id,
      releaseSource(facts),
      "No related tests",
      "No Planned Test Case, Test Handoff or Session Test relates to this Project Release.",
    );
  }
  return { reason: null, rows };
}

function gapRows(builder: Builder): PartialRows {
  const { gaps } = builder.facts;
  if (!gaps.available) {
    return { reason: unavailable(builder, "Tests", gaps.reason), rows: [] };
  }
  const rows = gaps.value.map((gap): ReleaseEvidenceRow => {
    const source = {
      label: gap.title,
      recordId: gap.id,
      recordType: "Test Gap" as const,
    };
    attend(
      builder,
      "Tests",
      "open-test-gap",
      gap.id,
      source,
      `${gap.title} is open`,
      "An open Test Gap is related to this Project Release.",
    );
    return {
      details: [],
      rowId: `gap:${gap.id}`,
      section: "Tests",
      source,
      state: gap.state,
      title: gap.title,
      why: "Open Test Gap related to this Project Release.",
    };
  });
  return { reason: null, rows };
}

function assessmentRows(builder: Builder): PartialRows {
  const { assessment } = builder.facts;
  if (!assessment.available) {
    return {
      reason: unavailable(builder, "Tests", assessment.reason),
      rows: [],
    };
  }
  const latest = assessment.value;
  if (!latest) {
    return { reason: null, rows: [] };
  }
  const source = {
    label: `Test Assessment ${latest.assessedAt}`,
    recordId: latest.id,
    recordType: "Test Assessment" as const,
  };
  if (latest.newContextCount > 0) {
    attend(
      builder,
      "Tests",
      "new-context-since-assessment",
      latest.id,
      source,
      "New test context after the latest Test Assessment",
      `${latest.newContextCount} test context record(s) were added after the assessment.`,
    );
  }
  return {
    reason: null,
    rows: [
      {
        details: [
          { label: "Assessed at", value: latest.assessedAt },
          { label: "Decision", value: latest.decision },
        ],
        rowId: `assessment:${latest.id}`,
        section: "Tests",
        source,
        state: latest.decision,
        title: "Latest Test Assessment",
        why: "Most recent Test Assessment for this Project Release.",
      },
    ],
  };
}

function testSection(builder: Builder) {
  const parts = [
    testRecordRows(builder),
    gapRows(builder),
    assessmentRows(builder),
  ];
  const reasons = parts.flatMap((part) => (part.reason ? [part.reason] : []));
  return sectionState(
    "Tests",
    parts.flatMap((part) => part.rows),
    reasons.length > 0 ? reasons.join(" ") : null,
  );
}

function checklistSection(facts: ReleaseEvidenceFacts) {
  const rows = facts.checklist.map(
    (item): ReleaseEvidenceRow => ({
      details: [],
      rowId: `checklist:${item.id}`,
      section: "Checklist",
      source: releaseSource(facts),
      state: item.checked ? "Checked" : "Unchecked",
      title: item.text,
      why: "Your optional release checklist item. It does not gate publish.",
    }),
  );
  return sectionState("Checklist", rows, null);
}

function publishDiffSection(builder: Builder) {
  const { facts } = builder;
  const section = "Publish diff" as const;
  const diff = facts.publishDiff;
  if (!diff.available) {
    return sectionState(
      section,
      [],
      unavailable(builder, section, diff.reason),
    );
  }
  const source = {
    label: "Publish diff",
    recordId: facts.release.id,
    recordType: "Publish diff" as const,
  };
  const row: ReleaseEvidenceRow = {
    details: [
      {
        label: "Prepared changelog",
        value: diff.value.changelogPrepared ? "Present" : "Missing",
      },
      {
        label: "Approved snapshot",
        value: diff.value.snapshotApproved ? "Present" : "Missing",
      },
    ],
    rowId: `publish-diff:${facts.release.id}`,
    section,
    source,
    state: null,
    title: "Prepared changelog and approved snapshot",
    why: "Opens the approved snapshot contract; the pack does not produce a snapshot.",
  };
  if (!(diff.value.changelogPrepared && diff.value.snapshotApproved)) {
    attend(
      builder,
      section,
      "missing-publish-diff",
      facts.release.id,
      source,
      "Publish diff has a missing side",
      "A prepared changelog or an approved snapshot is missing, so there is nothing to compare.",
    );
  }
  return sectionState(section, [row], null);
}

/**
 * Derives the pack from owner facts. Pure: no clock, no score, no verdict.
 * Rows and attention come only from what the sources say; elapsed time alone
 * never creates one.
 */
export function deriveReleaseEvidencePack(
  facts: ReleaseEvidenceFacts,
): ReleaseEvidencePack {
  const builder: Builder = { attention: [], facts };
  const sections = [
    scopeSection(builder),
    pullRequestSection(builder),
    recordSection(builder),
    testSection(builder),
    checklistSection(facts),
    publishDiffSection(builder),
  ];
  const open = releaseOpenScopeWork(facts);
  if (facts.release.status === "Published" && open.length > 0) {
    for (const work of open) {
      attend(
        builder,
        "Scope",
        "published-release-open-scope",
        work.id,
        workSource(work),
        `${work.key} is still open`,
        "This Project Release is Published and the Work is still open in its scope.",
      );
    }
  }
  return {
    attention: builder.attention,
    checklist: facts.checklist,
    readOnly: facts.readOnly,
    release: facts.release,
    sections,
  };
}

export const releaseOpenScopeSignalId = (releaseId: string) =>
  `${RELEASE_OPEN_SCOPE_SIGNAL_TYPE}:${releaseId}`;

/**
 * The deduped signal for a Published release with open Work. `null` unless the
 * release is Published and the scope is readable with open Work. It names the
 * Work and the release; it blocks nothing and writes no status.
 */
export function deriveReleaseOpenScopeSignal(
  facts: ReleaseEvidenceFacts,
  closed: boolean,
): ReleaseOpenScopeSignal | null {
  const open = releaseOpenScopeWork(facts);
  if (facts.release.status !== "Published" || open.length === 0) {
    return null;
  }
  return {
    blocksPublish: false,
    closeable: true,
    closed,
    openWork: open.map((work) => ({
      id: work.id,
      key: work.key,
      title: work.title,
    })),
    releaseId: facts.release.id,
    signalId: releaseOpenScopeSignalId(facts.release.id),
    signalType: RELEASE_OPEN_SCOPE_SIGNAL_TYPE,
    sourcePath: `/projects/${facts.release.projectId}`,
  };
}

// ---------------------------------------------------------------------------
// Access contract. The only writes are the founder's own checklist and the
// signal close; there is no command for domain records, status or publish.
// ---------------------------------------------------------------------------

export interface ReleaseEvidenceAccess {
  addChecklistItem: (
    accountId: string,
    input: AddReleaseChecklistItemInput,
  ) => Promise<ReleaseEvidenceChecklistItem>;
  closeOpenScopeSignal: (
    accountId: string,
    input: CloseReleaseOpenScopeSignalInput,
  ) => Promise<void>;
  openScopeSignal: (
    accountId: string,
    input: ReleaseEvidencePackInput,
  ) => Promise<ReleaseOpenScopeSignal | null>;
  pack: (
    accountId: string,
    input: ReleaseEvidencePackInput,
  ) => Promise<ReleaseEvidencePack>;
  removeChecklistItem: (
    accountId: string,
    input: RemoveReleaseChecklistItemInput,
  ) => Promise<void>;
  setChecklistItem: (
    accountId: string,
    input: SetReleaseChecklistItemInput,
  ) => Promise<ReleaseEvidenceChecklistItem>;
}
