import { z } from "zod";

import { TEST_ASSESSMENT_NEW_CONTEXT_LABEL } from "./test-assessments";
import type {
  TestResultEvent,
  TestReviewList,
  TestReviewSession,
} from "./test-review";
import {
  resultKey,
  resultLabel,
  type TestFollowUpLink,
  type TestResultConflict,
  type TestReviewContextChange,
} from "./test-review-signals";

/**
 * Neutral test summary and Tests area sections of the Test Review seam
 * (spec 57 #416). Everything here is a live, derived read of records other
 * features own: no second summary record is stored, and no score, coverage,
 * quality value, overall pass/fail, waiver or release gate exists in the
 * contract (the schemas are `.strict()`, so none can be smuggled in). Every
 * section and attention item is its exact record list: a count is only
 * `records.length`, never a number without the records behind it. GitHub checks
 * are an external fact and never become a Test Session here. The summary does
 * not stand in for a Release Evidence Pack (spec 64).
 */

const identifierSchema = z.string().trim().min(1).max(255);

export const TEST_SUMMARY_LABEL = "Test Summary";
export const TESTS_OVERVIEW_LABEL = "Tests overview";
export const TEST_SUMMARY_ATTENTION_LABEL = "Attention";
export const TEST_SUMMARY_RECENT_LIMIT = 10;
export const TEST_SUMMARY_GITHUB_NOTE =
  "GitHub checks are external facts. They are not Test Sessions and are not counted here.";
export const TEST_SUMMARY_NEUTRAL_NOTE =
  "A neutral view of existing records. It is not a score, a coverage figure, a pass/fail verdict, a waiver, a release gate or a Release Evidence Pack.";

export const TEST_SUMMARY_SCOPE_KINDS = [
  "Project",
  "Feature",
  "Project Release",
] as const;
export type TestSummaryScopeKind = (typeof TEST_SUMMARY_SCOPE_KINDS)[number];

export const testSummaryScopeInputSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("Project") }).strict(),
  z.object({ id: identifierSchema, kind: z.literal("Feature") }).strict(),
  z
    .object({ id: identifierSchema, kind: z.literal("Project Release") })
    .strict(),
]);
export type TestSummaryScopeInput = z.input<typeof testSummaryScopeInputSchema>;

export const testSummaryInputSchema = z
  .object({ projectId: identifierSchema, scope: testSummaryScopeInputSchema })
  .strict();
export type TestSummaryInput = z.input<typeof testSummaryInputSchema>;

export const TEST_SUMMARY_RECORD_KINDS = [
  "Feature",
  "Project Release",
  "Planned Test Case",
  "Test Handoff",
  "Test Session",
  "Session Test",
  "Test Gap",
  "Follow-up Work",
  "Test Assessment",
] as const;

/** Reported provenance kept beside every Session Test row. */
export const summaryProvenanceSchema = z
  .object({
    context: z.record(z.string(), z.string()).nullable(),
    currentResult: z.string().nullable(),
    executorName: z.string(),
    normalizedResult: z.string().nullable(),
    rawResult: z.string().nullable(),
    reportedAt: z.string(),
    reporter: z.string().nullable(),
    reviewState: z.string(),
    sessionId: identifierSchema,
  })
  .strict();
export type TestSummaryProvenance = z.infer<typeof summaryProvenanceSchema>;

export const summaryRecordSchema = z
  .object({
    detail: z.string().nullable(),
    id: identifierSchema,
    kind: z.enum(TEST_SUMMARY_RECORD_KINDS),
    label: z.string(),
    provenance: summaryProvenanceSchema.nullable(),
  })
  .strict();
export type TestSummaryRecord = z.infer<typeof summaryRecordSchema>;

export const TEST_SUMMARY_SECTION_KEYS = [
  "scenarios",
  "handoffs",
  "sessions",
  "session-tests",
  "open-gaps",
  "follow-up-work",
  "latest-assessment",
  "unreviewed-reports",
  "follow-up-needed-results",
  "conflicting-results",
  "context-changed-results",
  "active-handoffs",
  "recent-sessions",
  "recent-assessments",
] as const;

export const TEST_SUMMARY_ATTENTION_KEYS = [
  "no-related-tests",
  "scenarios-without-results",
  "context-changed",
  "test-result-conflict",
  "failed-results",
  "blocked-results",
  "inconclusive-results",
  "skipped-results",
  "unreviewed-reports",
  "open-gaps",
  "new-context-after-assessment",
] as const;

const filterSchema = z
  .object({ label: z.string(), value: z.string() })
  .strict();

/**
 * One section: the exact set of records and the filters that produced it. A
 * count is `records.length`; there is no separate number to trust.
 */
export const summarySectionSchema = z
  .object({
    filters: z.array(filterSchema),
    key: z.enum([...TEST_SUMMARY_SECTION_KEYS, ...TEST_SUMMARY_ATTENTION_KEYS]),
    label: z.string(),
    records: z.array(summaryRecordSchema),
  })
  .strict();
export type TestSummarySection = z.infer<typeof summarySectionSchema>;

export const testSummarySchema = z
  .object({
    /** Source-linked neutral information; no level, rank or verdict. */
    attention: z.array(summarySectionSchema),
    scope: z
      .object({
        id: z.string().nullable(),
        kind: z.enum(TEST_SUMMARY_SCOPE_KINDS),
        label: z.string(),
      })
      .strict(),
    sections: z.array(summarySectionSchema),
  })
  .strict();
export type TestSummary = z.infer<typeof testSummarySchema>;

/** What the store reads for one scope; records other features own. */
export interface TestSummaryFacts {
  assessments: {
    assessedAt: string;
    decision: string;
    id: string;
    label: string;
  }[];
  gaps: { id: string; recordedAt: string; state: string; title: string }[];
  handoffs: { id: string; state: string; title: string }[];
  scenarios: { id: string; title: string; version: number }[];
  scope: { id: string | null; kind: TestSummaryScopeKind; label: string };
  /** Test Sessions in scope through a Handoff link; ignored for Project. */
  sessionIds: string[];
  /** Exact Session Tests in scope; ignored for the whole-Project scope. */
  sessionTestIds: string[];
}

export const OPEN_GAP_STATES: readonly string[] = ["Open", "Planned"];
export const ACTIVE_HANDOFF_STATES: readonly string[] = [
  "Ready to share",
  "Shared",
  "Result received",
];

export interface TestSummaryReview {
  conflicts: TestResultConflict[];
  contextChanges: TestReviewContextChange[];
  followUps: TestFollowUpLink[];
  resultEvents: TestResultEvent[];
  sessions: TestReviewSession[];
}

type ViewedSession = TestSummaryReview["sessions"][number];
type ViewedItem = ViewedSession["items"][number];

function section(
  key: TestSummarySection["key"],
  label: string,
  records: TestSummaryRecord[],
  filters: TestSummarySection["filters"],
): TestSummarySection {
  return { filters, key, label, records };
}

function sessionRecord(session: ViewedSession): TestSummaryRecord {
  return {
    detail: `${session.reviewState} · reported ${session.reportedAt}`,
    id: session.id,
    kind: "Test Session",
    // The current view promotes a head Correction's summary over the report.
    label:
      session.currentSummary ??
      session.summary ??
      `Test Session by ${session.executorName}`,
    provenance: null,
  };
}

function itemRecord(session: ViewedSession, item: ViewedItem) {
  return {
    detail: `${item.reviewState} · ${resultLabel(item.current.usable ? item.current.result : item.normalizedResult)}`,
    id: item.id,
    kind: "Session Test",
    label: item.title,
    provenance: {
      context: session.context,
      currentResult: item.current.usable ? item.current.result : null,
      executorName: session.executorName,
      normalizedResult: item.normalizedResult,
      rawResult: item.rawResult,
      reportedAt: session.reportedAt,
      reporter: session.reporter,
      reviewState: item.reviewState,
      sessionId: session.id,
    },
  } satisfies TestSummaryRecord;
}

function newestFirst<T extends { id: string }>(
  rows: T[],
  at: (row: T) => string,
) {
  return [...rows].sort(
    (a, b) => at(b).localeCompare(at(a)) || a.id.localeCompare(b.id),
  );
}

interface ScopedRecords {
  items: { item: ViewedItem; session: ViewedSession }[];
  sessions: ViewedSession[];
}

function scopedRecords(
  scopeKind: TestSummaryScopeKind,
  facts: TestSummaryFacts,
  sessions: ViewedSession[],
): ScopedRecords {
  if (scopeKind === "Project") {
    return {
      items: sessions.flatMap((session) =>
        session.items.map((item) => ({ item, session })),
      ),
      sessions,
    };
  }
  const itemIds = new Set(facts.sessionTestIds);
  const sessionIds = new Set(facts.sessionIds);
  const items = sessions.flatMap((session) =>
    session.items
      .filter((item) => itemIds.has(item.id))
      .map((item) => ({ item, session })),
  );
  for (const { session } of items) {
    sessionIds.add(session.id);
  }
  return {
    items,
    sessions: sessions.filter((session) => sessionIds.has(session.id)),
  };
}

function currentKey(item: ViewedItem) {
  return resultKey(item.current.usable ? item.current.result : null);
}

const NON_PASSING = [
  ["failed", "failed-results", "Failed"],
  ["blocked", "blocked-results", "Blocked"],
  ["inconclusive", "inconclusive-results", "Inconclusive"],
  ["skipped", "skipped-results", "Skipped"],
] as const;

function resultSections(scoped: ScopedRecords): TestSummarySection[] {
  return NON_PASSING.flatMap(([result, key, label]) => {
    const records = scoped.items
      .filter(({ item }) => currentKey(item) === result)
      .map(({ item, session }) => itemRecord(session, item));
    return records.length > 0
      ? [
          section(key, `${label} results`, records, [
            { label: "Current result", value: label },
          ]),
        ]
      : [];
  });
}

function gapRecord(gap: TestSummaryFacts["gaps"][number]): TestSummaryRecord {
  return {
    detail: gap.state,
    id: gap.id,
    kind: "Test Gap",
    label: gap.title,
    provenance: null,
  };
}

function handoffRecord(
  handoff: TestSummaryFacts["handoffs"][number],
): TestSummaryRecord {
  return {
    detail: handoff.state,
    id: handoff.id,
    kind: "Test Handoff",
    label: handoff.title,
    provenance: null,
  };
}

function assessmentRecord(
  assessment: TestSummaryFacts["assessments"][number],
): TestSummaryRecord {
  return {
    detail: `${assessment.decision} · assessed ${assessment.assessedAt}`,
    id: assessment.id,
    kind: "Test Assessment",
    label: assessment.label,
    provenance: null,
  };
}

function conflictItemIds(review: TestSummaryReview, scoped: ScopedRecords) {
  const inScope = new Set(scoped.items.map(({ item }) => item.id));
  return review.conflicts.flatMap((conflict) =>
    conflict.members.filter((member) => inScope.has(member.sessionTestId)),
  );
}

function itemById(scoped: ScopedRecords, id: string) {
  return scoped.items.find(({ item }) => item.id === id);
}

function projectSections(
  facts: TestSummaryFacts,
  review: TestSummaryReview,
  scoped: ScopedRecords,
): TestSummarySection[] {
  const conflictRecords = conflictItemIds(review, scoped).flatMap((member) => {
    const found = itemById(scoped, member.sessionTestId);
    return found ? [itemRecord(found.session, found.item)] : [];
  });
  const contextRecords = review.contextChanges.flatMap((change) => {
    const found = itemById(scoped, change.sessionTestId);
    return found ? [itemRecord(found.session, found.item)] : [];
  });
  return [
    section(
      "unreviewed-reports",
      "Unreviewed reports",
      scoped.sessions
        .filter((session) => session.reviewState === "Unreviewed")
        .map(sessionRecord),
      [{ label: "Review state", value: "Unreviewed" }],
    ),
    section(
      "follow-up-needed-results",
      "Follow-up needed results",
      scoped.items
        .filter(({ item }) => item.reviewState === "Follow-up needed")
        .map(({ item, session }) => itemRecord(session, item)),
      [{ label: "Review state", value: "Follow-up needed" }],
    ),
    section(
      "open-gaps",
      "Open and planned Test Gaps",
      facts.gaps
        .filter((gap) => OPEN_GAP_STATES.includes(gap.state))
        .map(gapRecord),
      [{ label: "State", value: "Open, Planned" }],
    ),
    // PRD 10 gives "awaiting-supersede" no separate definition: a result awaits
    // a `Supersedes` relation exactly while it is an active member of a
    // `test-result-conflict` (no Supersedes edge settles it), so the section
    // lists those members.
    section(
      "conflicting-results",
      "Conflicting or awaiting-supersede results",
      conflictRecords,
      [{ label: "Signal", value: "test-result-conflict" }],
    ),
    section(
      "context-changed-results",
      "Context-changed results",
      contextRecords,
      [{ label: "Signal", value: "Context changed" }],
    ),
    section(
      "active-handoffs",
      "Active Handoffs",
      facts.handoffs
        .filter((handoff) => ACTIVE_HANDOFF_STATES.includes(handoff.state))
        .map(handoffRecord),
      [{ label: "State", value: ACTIVE_HANDOFF_STATES.join(", ") }],
    ),
    section(
      "recent-sessions",
      "Recent sessions",
      newestFirst(scoped.sessions, (session) => session.reportedAt)
        .slice(0, TEST_SUMMARY_RECENT_LIMIT)
        .map(sessionRecord),
      [
        { label: "Order", value: "Newest reported first" },
        { label: "Limit", value: `Latest ${TEST_SUMMARY_RECENT_LIMIT}` },
      ],
    ),
    section(
      "recent-assessments",
      "Recent assessments",
      newestFirst(facts.assessments, (entry) => entry.assessedAt)
        .slice(0, TEST_SUMMARY_RECENT_LIMIT)
        .map(assessmentRecord),
      [
        { label: "Order", value: "Newest assessed first" },
        { label: "Limit", value: `Latest ${TEST_SUMMARY_RECENT_LIMIT}` },
      ],
    ),
  ];
}

function subjectSections(
  facts: TestSummaryFacts,
  review: TestSummaryReview,
  scoped: ScopedRecords,
): TestSummarySection[] {
  const inScope = new Set(scoped.items.map(({ item }) => item.id));
  const followUps = new Map(
    review.followUps
      .filter((link) => inScope.has(link.sessionTestId))
      .map((link) => [link.workId, link]),
  );
  const [latest] = newestFirst(facts.assessments, (entry) => entry.assessedAt);
  const scopeFilter = {
    label: "Scope",
    value: `${facts.scope.kind}: ${facts.scope.label}`,
  };
  return [
    section(
      "scenarios",
      "Planned Test Cases",
      facts.scenarios.map((scenario) => ({
        detail: `v${scenario.version}`,
        id: scenario.id,
        kind: "Planned Test Case",
        label: scenario.title,
        provenance: null,
      })),
      [scopeFilter],
    ),
    section("handoffs", "Test Handoffs", facts.handoffs.map(handoffRecord), [
      scopeFilter,
    ]),
    section("sessions", "Test Sessions", scoped.sessions.map(sessionRecord), [
      scopeFilter,
    ]),
    section(
      "session-tests",
      "Session Tests",
      scoped.items.map(({ item, session }) => itemRecord(session, item)),
      [scopeFilter],
    ),
    section(
      "open-gaps",
      "Open Test Gaps",
      facts.gaps
        .filter((gap) => OPEN_GAP_STATES.includes(gap.state))
        .map(gapRecord),
      [scopeFilter, { label: "State", value: "Open, Planned" }],
    ),
    section(
      "follow-up-work",
      "Follow-up work",
      [...followUps.values()].map((link) => ({
        detail: [link.workStatus, link.mode].filter(Boolean).join(" · "),
        id: link.workId,
        kind: "Follow-up Work" as const,
        label: [link.workKey, link.workTitle].filter(Boolean).join(" "),
        provenance: null,
      })),
      [scopeFilter],
    ),
    section(
      "latest-assessment",
      "Latest Test Assessment",
      latest ? [assessmentRecord(latest)] : [],
      [scopeFilter, { label: "Order", value: "Newest assessed first" }],
    ),
  ];
}

function newContextRecords(
  facts: TestSummaryFacts,
  review: TestSummaryReview,
  scoped: ScopedRecords,
): TestSummaryRecord[] {
  const [latest] = newestFirst(facts.assessments, (entry) => entry.assessedAt);
  if (!latest) {
    return [];
  }
  const after = (at: string) => Date.parse(at) > Date.parse(latest.assessedAt);
  const sessionIds = new Set(scoped.sessions.map((session) => session.id));
  const corrected = new Set(
    review.resultEvents
      .filter(
        (entry) => sessionIds.has(entry.sessionId) && after(entry.recordedAt),
      )
      .map((entry) => entry.sessionId),
  );
  return [
    ...scoped.sessions
      .filter(
        (session) => after(session.reportedAt) || corrected.has(session.id),
      )
      .map(sessionRecord),
    ...facts.gaps.filter((gap) => after(gap.recordedAt)).map(gapRecord),
  ];
}

function attentionSections(
  facts: TestSummaryFacts,
  review: TestSummaryReview,
  scoped: ScopedRecords,
): TestSummarySection[] {
  const attention: TestSummarySection[] = [];
  const hasAnyTest =
    facts.scenarios.length > 0 ||
    facts.handoffs.length > 0 ||
    scoped.sessions.length > 0;
  if (!hasAnyTest) {
    attention.push(
      section(
        "no-related-tests",
        "No related test records",
        [
          {
            detail: null,
            id: facts.scope.id ?? "",
            kind:
              facts.scope.kind === "Feature" ? "Feature" : "Project Release",
            label: facts.scope.label,
            provenance: null,
          },
        ],
        [
          {
            label: "Scope",
            value: `${facts.scope.kind}: ${facts.scope.label}`,
          },
        ],
      ),
    );
  }
  const boundScenarios = new Set(
    scoped.items.flatMap(({ item }) =>
      item.scenarioId ? [item.scenarioId] : [],
    ),
  );
  const unbound = facts.scenarios.filter(
    (scenario) => !boundScenarios.has(scenario.id),
  );
  if (unbound.length > 0) {
    attention.push(
      section(
        "scenarios-without-results",
        "Planned Test Cases without a reported result",
        unbound.map((scenario) => ({
          detail: `v${scenario.version}`,
          id: scenario.id,
          kind: "Planned Test Case" as const,
          label: scenario.title,
          provenance: null,
        })),
        [{ label: "Bound Session Tests", value: "None" }],
      ),
    );
  }
  const contextRecords = review.contextChanges.flatMap((change) => {
    const found = itemById(scoped, change.sessionTestId);
    return found ? [itemRecord(found.session, found.item)] : [];
  });
  if (contextRecords.length > 0) {
    attention.push(
      section("context-changed", "Context changed", contextRecords, [
        { label: "Signal", value: "Context changed" },
      ]),
    );
  }
  const conflictRecords = conflictItemIds(review, scoped).flatMap((member) => {
    const found = itemById(scoped, member.sessionTestId);
    return found ? [itemRecord(found.session, found.item)] : [];
  });
  if (conflictRecords.length > 0) {
    attention.push(
      section("test-result-conflict", "test-result-conflict", conflictRecords, [
        { label: "Signal", value: "test-result-conflict" },
      ]),
    );
  }
  attention.push(...resultSections(scoped));
  const unreviewed = scoped.sessions.filter(
    (session) => session.reviewState === "Unreviewed",
  );
  if (unreviewed.length > 0) {
    attention.push(
      section(
        "unreviewed-reports",
        "Unreviewed reports",
        unreviewed.map(sessionRecord),
        [{ label: "Review state", value: "Unreviewed" }],
      ),
    );
  }
  const openGaps = facts.gaps.filter((gap) =>
    OPEN_GAP_STATES.includes(gap.state),
  );
  if (openGaps.length > 0) {
    attention.push(
      section("open-gaps", "Open Test Gaps", openGaps.map(gapRecord), [
        { label: "State", value: "Open, Planned" },
      ]),
    );
  }
  const fresh = newContextRecords(facts, review, scoped);
  if (fresh.length > 0) {
    attention.push(
      section(
        "new-context-after-assessment",
        TEST_ASSESSMENT_NEW_CONTEXT_LABEL,
        fresh,
        [{ label: "Recorded after", value: "Latest Test Assessment" }],
      ),
    );
  }
  return attention;
}

/**
 * The live neutral summary of one scope. Pure: it reads the review list, the
 * facts of other features and nothing else, writes nothing, and the only
 * shapes it can return are record lists with the filters that produced them.
 */
export function deriveTestSummary(
  facts: TestSummaryFacts,
  review: Pick<
    TestReviewList,
    "conflicts" | "contextChanges" | "followUps" | "resultEvents" | "sessions"
  >,
): TestSummary {
  const scoped = scopedRecords(facts.scope.kind, facts, review.sessions);
  const isProject = facts.scope.kind === "Project";
  return {
    attention: isProject ? [] : attentionSections(facts, review, scoped),
    scope: facts.scope,
    sections: isProject
      ? projectSections(facts, review, scoped)
      : subjectSections(facts, review, scoped),
  };
}
