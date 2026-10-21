import { z } from "zod";

import { TEST_REPORT_RESULT_LABELS, TEST_REPORT_RESULTS } from "./test-report";

/**
 * Superseding, conflict, context-change and follow-up rules of the Test Review
 * seam (spec 57 #415). Everything here is pure and derived from exact records:
 * a shared exact Planned Test Scenario version, an explicit `Supersedes`
 * relation, a recorded branch/commit/build, a bound Primary spec revision. No
 * title or text similarity, no clock and no last-write-wins is read, and
 * nothing here can create a Test Gap, a Handoff, a Bug or a notification.
 */

const identifierSchema = z.string().trim().min(1).max(255);

export const TEST_REVIEW_SUPERSEDES_LABEL = "Supersedes";
export const TEST_REVIEW_SUPERSEDED_LABEL = "Superseded";
export const TEST_REVIEW_CONTEXT_CHANGED_LABEL = "Context changed";
export const TEST_REVIEW_FOLLOW_UP_LABEL = "Create follow-up work";
export const TEST_RESULT_CONFLICT_SIGNAL = "test-result-conflict";

/** The only specialist type this seam relates; others are refused as a mismatch. */
export const TEST_REVIEW_SUPERSEDE_TYPES = ["Session Test"] as const;
export const supersedeRecordTypeSchema = z.enum([
  "Session Test",
  "Decision",
  "Experiment/Validation",
]);
export type SupersedeRecordType = z.infer<typeof supersedeRecordTypeSchema>;

/** Branch, commit and build are the exact keys a context mismatch can name. */
export const TEST_REVIEW_CONTEXT_KEYS = ["branch", "commit", "build"] as const;
export type TestReviewContextKey = (typeof TEST_REVIEW_CONTEXT_KEYS)[number];

export const boundSpecSchema = z
  .object({
    boundRevision: z.number().int().min(0),
    currentRevision: z.number().int().min(0),
    documentId: identifierSchema,
    title: z.string(),
  })
  .strict();
export type BoundSpec = z.infer<typeof boundSpecSchema>;

export const resultEndSchema = z
  .object({
    context: z.record(z.string(), z.string()).nullable(),
    currentResult: z.string().nullable(),
    executorName: z.string(),
    normalizedResult: z.string().nullable(),
    /** `null` once the reported value was redacted. */
    rawResult: z.string().nullable(),
    reportedAt: z.string(),
    sessionId: identifierSchema,
    sessionTestId: identifierSchema,
    title: z.string(),
  })
  .strict();
export type TestReviewResultEnd = z.infer<typeof resultEndSchema>;

export const contextDifferenceSchema = z
  .object({
    key: z.string(),
    /** `null` is unknown: the context was not recorded, never guessed. */
    newer: z.string().nullable(),
    older: z.string().nullable(),
  })
  .strict();
export type TestReviewContextDifference = z.infer<
  typeof contextDifferenceSchema
>;

export const supersessionSchema = z
  .object({
    actorAccountId: identifierSchema,
    difference: z.array(contextDifferenceSchema),
    id: identifierSchema,
    newer: resultEndSchema,
    older: resultEndSchema,
    reason: z.string().nullable(),
    recordedAt: z.string().datetime({ offset: true }),
  })
  .strict();
export type TestReviewSupersession = z.infer<typeof supersessionSchema>;

export interface TestSupersessionStored {
  actorAccountId: string;
  id: string;
  newerSessionTestId: string;
  olderSessionTestId: string;
  reason: string | null;
  recordedAt: string;
}

export interface TestResultBindingStored {
  actorAccountId: string;
  id: string;
  /** Exact Session Tests the founder judged when binding; later ones reopen. */
  judgedSessionTestIds: string[];
  reason: string | null;
  recordedAt: string;
  scenarioId: string;
  scenarioVersion: number;
  sessionTestId: string;
}

export const resultBindingSchema = z
  .object({
    actorAccountId: identifierSchema,
    id: identifierSchema,
    judgedSessionTestIds: z.array(z.string()),
    reason: z.string().nullable(),
    recordedAt: z.string().datetime({ offset: true }),
    scenarioId: identifierSchema,
    scenarioVersion: z.number().int().min(1),
    sessionTestId: identifierSchema,
  })
  .strict();

export const conflictMemberSchema = resultEndSchema
  .extend({ current: z.string() })
  .strict();
export type TestResultConflictMember = z.infer<typeof conflictMemberSchema>;

/** The derived `test-result-conflict` attention signal (Action Required). */
export const resultConflictSchema = z
  .object({
    members: z.array(conflictMemberSchema),
    presentation: z.literal("Action Required"),
    scenarioId: identifierSchema,
    scenarioVersion: z.number().int().min(1),
    signalId: z.string(),
  })
  .strict();
export type TestResultConflict = z.infer<typeof resultConflictSchema>;

export const contextChangeReasonSchema = z.discriminatedUnion("kind", [
  z
    .object({
      boundRevision: z.number().int(),
      currentRevision: z.number().int(),
      documentId: z.string(),
      kind: z.literal("Primary spec changed"),
      title: z.string(),
    })
    .strict(),
  z
    .object({
      key: z.enum(TEST_REVIEW_CONTEXT_KEYS),
      kind: z.literal("Technical context mismatch"),
      recorded: z.string(),
      target: z.string(),
    })
    .strict(),
]);
export type TestReviewContextChangeReason = z.infer<
  typeof contextChangeReasonSchema
>;

export const contextChangeSchema = z
  .object({
    label: z.literal("Context changed"),
    reasons: z.array(contextChangeReasonSchema).min(1),
    sessionId: identifierSchema,
    sessionTestId: identifierSchema,
    title: z.string(),
  })
  .strict();
export type TestReviewContextChange = z.infer<typeof contextChangeSchema>;

export const WORK_FOLLOW_UP_TYPES = [
  "Task",
  "Bug",
  "Research",
  "Improvement",
] as const;
export const followUpWorkTypeSchema = z.enum(WORK_FOLLOW_UP_TYPES);
export type FollowUpWorkType = z.infer<typeof followUpWorkTypeSchema>;
export const FOLLOW_UP_STARTING_STATUS = "Not Started";
export const FOLLOW_UP_SELECTION_MAX = 50;

export const followUpLinkSchema = z
  .object({
    actorAccountId: identifierSchema,
    id: identifierSchema,
    mode: z.enum(["Created", "Attached"]),
    recordedAt: z.string().datetime({ offset: true }),
    sessionId: identifierSchema,
    sessionTestId: identifierSchema,
    workId: identifierSchema,
    /** Live Work key, title and status; `null` once the Work is gone. */
    workKey: z.string().nullable(),
    workStatus: z.string().nullable(),
    workTitle: z.string().nullable(),
  })
  .strict();
export type TestFollowUpLink = z.infer<typeof followUpLinkSchema>;

export const followUpTargetInputSchema = z.discriminatedUnion("mode", [
  z
    .object({
      description: z.string().trim().max(5000).nullish(),
      mode: z.literal("new"),
      title: z.string().trim().min(1).max(255).optional(),
      workType: followUpWorkTypeSchema.optional(),
    })
    .strict(),
  z.object({ mode: z.literal("existing"), workId: identifierSchema }).strict(),
]);
export type FollowUpTargetInput = z.input<typeof followUpTargetInputSchema>;

const followUpResultSchema = z
  .object({
    currentResult: z.string().nullable(),
    normalizedResult: z.string().nullable(),
    rawResult: z.string().nullable(),
    sessionId: identifierSchema,
    sessionTestId: identifierSchema,
    title: z.string(),
  })
  .strict();

export const followUpPlanSchema = z
  .object({
    /** Nothing but the one Work or link below is written. */
    automaticRecords: z.literal("None"),
    /** `Originates from`: the owning Test Session. New Work only. */
    originatesFrom: z
      .object({
        id: identifierSchema,
        label: z.string(),
        recordType: z.literal("Test Session"),
      })
      .strict()
      .nullable(),
    /** Immutable `Origin Location`: the exact Session Test. New Work only. */
    originLocation: z
      .object({
        id: identifierSchema,
        recordType: z.literal("Session Test"),
        sessionId: identifierSchema,
        title: z.string(),
      })
      .strict()
      .nullable(),
    results: z.array(followUpResultSchema).min(1),
    target: z.discriminatedUnion("mode", [
      z
        .object({
          mode: z.literal("new"),
          project: z.object({ id: z.string(), name: z.string() }).strict(),
          work: z
            .object({
              description: z.string(),
              startingStatus: z.literal(FOLLOW_UP_STARTING_STATUS),
              title: z.string(),
              type: followUpWorkTypeSchema,
            })
            .strict(),
        })
        .strict(),
      z
        .object({
          mode: z.literal("existing"),
          work: z
            .object({
              id: identifierSchema,
              key: z.string(),
              status: z.string(),
              title: z.string(),
              type: z.string(),
            })
            .strict(),
        })
        .strict(),
    ]),
  })
  .strict();
export type TestFollowUpPlan = z.infer<typeof followUpPlanSchema>;

export const followUpPreviewSchema = z
  .object({ fingerprint: z.string(), plan: followUpPlanSchema })
  .strict();
export type TestFollowUpPreview = z.infer<typeof followUpPreviewSchema>;

export const followUpReceiptSchema = z
  .object({
    links: z.array(followUpLinkSchema),
    outcome: z.enum(["applied", "unchanged"]),
  })
  .strict();
export type TestFollowUpReceipt = z.infer<typeof followUpReceiptSchema>;

/** Wire value of a normalized result, whatever label form a store keeps. */
export function resultKey(value: string | null | undefined) {
  if (!value) {
    return null;
  }
  const key = value
    .trim()
    .toLowerCase()
    .replaceAll(/[\s-]+/g, "_");
  return (TEST_REPORT_RESULTS as readonly string[]).includes(key) ? key : null;
}

/** User label of a result; unknown values are shown as stored, never guessed. */
export function resultLabel(value: string | null | undefined) {
  const key = resultKey(value);
  return key
    ? TEST_REPORT_RESULT_LABELS[key as keyof typeof TEST_REPORT_RESULT_LABELS]
    : (value ?? "Not reported");
}

export function contextDifference(
  newer: Record<string, string> | null,
  older: Record<string, string> | null,
): TestReviewContextDifference[] {
  const keys = [
    ...new Set([...Object.keys(newer ?? {}), ...Object.keys(older ?? {})]),
  ].sort();
  return keys
    .map((key) => ({
      key,
      newer: newer?.[key] ?? null,
      older: older?.[key] ?? null,
    }))
    .filter((entry) => entry.newer !== entry.older);
}

/**
 * Whether adding `newer Supersedes older` closes a directed cycle: it does
 * when `newer` is already reachable from `older` along existing edges.
 */
export function supersedeClosesCycle(
  edges: Pick<
    TestSupersessionStored,
    "newerSessionTestId" | "olderSessionTestId"
  >[],
  newerId: string,
  olderId: string,
) {
  if (newerId === olderId) {
    return true;
  }
  const seen = new Set<string>([olderId]);
  const queue = [olderId];
  while (queue.length > 0) {
    const current = queue.shift() as string;
    for (const edge of edges) {
      if (edge.newerSessionTestId !== current) {
        continue;
      }
      if (edge.olderSessionTestId === newerId) {
        return true;
      }
      if (!seen.has(edge.olderSessionTestId)) {
        seen.add(edge.olderSessionTestId);
        queue.push(edge.olderSessionTestId);
      }
    }
  }
  return false;
}

/** Every record `from` supersedes, directly or through the chain. */
function supersededClosure(
  edges: Pick<
    TestSupersessionStored,
    "newerSessionTestId" | "olderSessionTestId"
  >[],
  from: string,
) {
  const reached = new Set<string>();
  const queue = [from];
  while (queue.length > 0) {
    const current = queue.shift() as string;
    for (const edge of edges) {
      if (
        edge.newerSessionTestId === current &&
        !reached.has(edge.olderSessionTestId)
      ) {
        reached.add(edge.olderSessionTestId);
        queue.push(edge.olderSessionTestId);
      }
    }
  }
  return reached;
}

/** Minimal viewed shapes the pure derivations read. */
export interface SignalItem {
  boundSpecs: BoundSpec[];
  current: { result: string | null; usable: boolean };
  id: string;
  normalizedResult: string | null;
  rawResult: string | null;
  scenarioId: string | null;
  scenarioVersion: number | null;
  title: string;
}

export interface SignalSession {
  context: Record<string, string> | null;
  executorName: string;
  id: string;
  items: SignalItem[];
  reportedAt: string;
  targetContext: Record<string, string> | null;
}

export function resultEnd(
  session: SignalSession,
  item: SignalItem,
): TestReviewResultEnd {
  return {
    context: session.context,
    currentResult: item.current.usable ? item.current.result : null,
    executorName: session.executorName,
    normalizedResult: item.normalizedResult,
    rawResult: item.rawResult,
    reportedAt: session.reportedAt,
    sessionId: session.id,
    sessionTestId: item.id,
    title: item.title,
  };
}

export function viewSupersessions(
  sessions: SignalSession[],
  edges: TestSupersessionStored[],
): TestReviewSupersession[] {
  const ends = new Map<string, TestReviewResultEnd>();
  for (const session of sessions) {
    for (const item of session.items) {
      ends.set(item.id, resultEnd(session, item));
    }
  }
  return [...edges]
    .sort(
      (a, b) =>
        b.recordedAt.localeCompare(a.recordedAt) || b.id.localeCompare(a.id),
    )
    .flatMap((edge) => {
      const newer = ends.get(edge.newerSessionTestId);
      const older = ends.get(edge.olderSessionTestId);
      return newer && older
        ? [
            {
              actorAccountId: edge.actorAccountId,
              difference: contextDifference(newer.context, older.context),
              id: edge.id,
              newer,
              older,
              reason: edge.reason,
              recordedAt: edge.recordedAt,
            },
          ]
        : [];
    });
}

interface ConflictMember {
  end: TestReviewResultEnd;
  id: string;
  key: string;
}

interface ConflictGroup {
  members: ConflictMember[];
  scenarioId: string;
  scenarioVersion: number;
}

function conflictGroups(sessions: SignalSession[]) {
  const groups = new Map<string, ConflictGroup>();
  for (const session of sessions) {
    for (const item of session.items) {
      const key = resultKey(item.current.usable ? item.current.result : null);
      if (
        item.scenarioId === null ||
        item.scenarioVersion === null ||
        key === null ||
        key === "not_reported"
      ) {
        continue;
      }
      const group = `${item.scenarioId}@${item.scenarioVersion}`;
      const entry = groups.get(group) ?? {
        members: [],
        scenarioId: item.scenarioId,
        scenarioVersion: item.scenarioVersion,
      };
      entry.members.push({ end: resultEnd(session, item), id: item.id, key });
      groups.set(group, entry);
    }
  }
  return [...groups.values()];
}

/** Members no other member supersedes: the results that still compete. */
function activeMembers(group: ConflictGroup, edges: TestSupersessionStored[]) {
  const settled = new Set<string>();
  for (const member of group.members) {
    for (const id of supersededClosure(edges, member.id)) {
      settled.add(id);
    }
  }
  return group.members.filter((member) => !settled.has(member.id));
}

/** The founder's newest binding closes the group while it still holds. */
function isBoundClosed(
  group: ConflictGroup,
  active: ConflictMember[],
  bindings: TestResultBindingStored[],
) {
  const [binding] = bindings
    .filter(
      (entry) =>
        entry.scenarioId === group.scenarioId &&
        entry.scenarioVersion === group.scenarioVersion,
    )
    .sort((a, b) => b.recordedAt.localeCompare(a.recordedAt));
  const bound = binding
    ? active.find((member) => member.id === binding.sessionTestId)
    : undefined;
  return Boolean(
    binding &&
      bound &&
      active.every(
        (member) =>
          binding.judgedSessionTestIds.includes(member.id) ||
          member.key === bound.key,
      ),
  );
}

/**
 * `test-result-conflict`: the same exact scenario version holds usable results
 * that differ, and no explicit `Supersedes` settles them. An item another
 * member supersedes (directly or through the chain) is settled and leaves the
 * comparison. A binding the founder made closes the signal while the bound
 * result stays usable and any later member agrees with it. The product never
 * picks a winner and never matches by title.
 */
export function deriveConflicts(
  sessions: SignalSession[],
  edges: TestSupersessionStored[],
  bindings: TestResultBindingStored[],
): TestResultConflict[] {
  const conflicts: TestResultConflict[] = [];
  for (const group of conflictGroups(sessions)) {
    const active = activeMembers(group, edges);
    if (
      new Set(active.map((member) => member.key)).size < 2 ||
      isBoundClosed(group, active, bindings)
    ) {
      continue;
    }
    conflicts.push({
      members: active
        .map((member) => ({
          ...member.end,
          current: resultLabel(member.key),
        }))
        .sort(
          (x, y) =>
            x.reportedAt.localeCompare(y.reportedAt) ||
            x.sessionTestId.localeCompare(y.sessionTestId),
        ),
      presentation: "Action Required",
      scenarioId: group.scenarioId,
      scenarioVersion: group.scenarioVersion,
      signalId: `${TEST_RESULT_CONFLICT_SIGNAL}:${group.scenarioId}:${group.scenarioVersion}`,
    });
  }
  return conflicts.sort((x, y) => x.signalId.localeCompare(y.signalId));
}

function contextReasons(session: SignalSession, item: SignalItem) {
  const reasons: TestReviewContextChangeReason[] = item.boundSpecs
    .filter((spec) => spec.currentRevision !== spec.boundRevision)
    .map((spec) => ({
      boundRevision: spec.boundRevision,
      currentRevision: spec.currentRevision,
      documentId: spec.documentId,
      kind: "Primary spec changed" as const,
      title: spec.title,
    }));
  for (const key of TEST_REVIEW_CONTEXT_KEYS) {
    const recorded = session.context?.[key];
    const target = session.targetContext?.[key];
    if (recorded && target && recorded !== target) {
      reasons.push({
        key,
        kind: "Technical context mismatch",
        recorded,
        target,
      });
    }
  }
  return reasons;
}

/**
 * `Context changed`: only a bound Primary spec revision that moved, or a
 * recorded branch/commit/build that differs from the target context. Elapsed
 * time and unrelated commits are never read, a missing recorded value is
 * unknown (not a mismatch), and the old result is never altered. Superseded
 * results are history and stay quiet.
 */
export function deriveContextChanges(
  sessions: SignalSession[],
  edges: TestSupersessionStored[],
): TestReviewContextChange[] {
  const superseded = new Set(edges.map((edge) => edge.olderSessionTestId));
  return sessions.flatMap((session) =>
    session.items
      .filter((item) => !superseded.has(item.id))
      .flatMap((item) => {
        const reasons = contextReasons(session, item);
        return reasons.length > 0
          ? [
              {
                label: TEST_REVIEW_CONTEXT_CHANGED_LABEL,
                reasons,
                sessionId: session.id,
                sessionTestId: item.id,
                title: item.title,
              },
            ]
          : [];
      }),
  );
}

/** True when no branch/commit/build was recorded: shown as unknown. */
export function technicalContextUnknown(
  context: Record<string, string> | null,
) {
  return !TEST_REVIEW_CONTEXT_KEYS.some((key) => Boolean(context?.[key]));
}

export function followUpTitle(item: Pick<SignalItem, "title">) {
  return `Follow up test: ${item.title}`.slice(0, 255);
}

export function followUpDescription(
  sessionLabel: string,
  results: { currentResult: string | null; title: string }[],
) {
  return [
    `Follow-up of ${results.length === 1 ? "a reported result" : "reported results"} in Test Session ${sessionLabel}.`,
    ...results.map(
      (result) =>
        `- ${result.title}: ${result.currentResult ? resultLabel(result.currentResult) : "No usable current result"}`,
    ),
  ].join("\n");
}
