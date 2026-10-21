import { z } from "zod";

import { TEST_REPORT_RESULTS } from "./test-report";
import {
  type BoundSpec,
  boundSpecSchema,
  contextChangeSchema,
  FOLLOW_UP_SELECTION_MAX,
  followUpLinkSchema,
  followUpTargetInputSchema,
  resultBindingSchema,
  resultConflictSchema,
  supersedeRecordTypeSchema,
  supersessionSchema,
  type TestFollowUpLink,
  type TestFollowUpPreview,
  type TestFollowUpReceipt,
  type TestResultBindingStored,
  type TestSupersessionStored,
} from "./test-review-signals";
import type {
  TestSummary,
  TestSummaryFacts,
  TestSummaryInput,
} from "./test-review-summary";

/**
 * Test Review seam (spec 57), independent lifecycle of session and item review.
 *
 * A Test Session (Test Oturumu) and each of its Session Tests (Oturum Testi)
 * carry their own review state. Setting one never writes the other, a review
 * never writes the reported raw or normalized result, and nothing here is a
 * release gate, a Project Release result, a Handoff transition, or a Test Gap.
 * The access has no archive, Trash or delete operation for a single Session
 * Test: the session and its items are one historical unit (spec 77).
 * Review and close are Kayıt geçmişi (record history), never Denetim kaydı.
 *
 * Correction, Withdrawal and security redaction are additive events bound to
 * the original Test Session or Session Test (spec 57 #414). The reported raw
 * and normalized result are never edited or deleted: the current view promotes
 * the newest chain entry while the original stays in history. A redaction
 * shows a contentless mark, time, reason and actor instead of the value, and
 * redacted evidence is not usable for current evaluation or export. None of
 * this is Trash, an account-closure card, or an in-place rewrite, and a later
 * event never rewinds a review state: a Closed record shows
 * `New context after close` instead.
 */

const identifierSchema = z.string().trim().min(1).max(255);

export const TEST_REVIEW_STATES = [
  "Unreviewed",
  "Reviewed",
  "Follow-up needed",
  "Closed",
] as const;
export type TestReviewState = (typeof TEST_REVIEW_STATES)[number];

/** A founder can move to these; `Unreviewed` is only where a record starts. */
export const TEST_REVIEW_SETTABLE_STATES = [
  "Reviewed",
  "Follow-up needed",
  "Closed",
] as const;
export type TestReviewSettableState =
  (typeof TEST_REVIEW_SETTABLE_STATES)[number];

/** States a closing session leaves visible as remaining exact records. */
export const TEST_REVIEW_OPEN_STATES = [
  "Unreviewed",
  "Follow-up needed",
] as const;

export const TEST_REVIEW_BULK_LABEL =
  "Mark session and selected results as reviewed";
export const TEST_REVIEW_REASON_MAX = 2000;
export const TEST_REVIEW_ITEM_SELECTION_MAX = 500;

const stateSchema = z.enum(TEST_REVIEW_STATES);
const settableStateSchema = z.enum(TEST_REVIEW_SETTABLE_STATES);
const reasonSchema = z
  .string()
  .trim()
  .max(TEST_REVIEW_REASON_MAX)
  .nullish()
  .transform((value) => (value ? value : null));

export const testReviewProjectInputSchema = z
  .object({ projectId: identifierSchema })
  .strict();

export const setSessionReviewStateInputSchema = z
  .object({
    projectId: identifierSchema,
    /** Kept with a close; an optional founder note, not a gate. */
    reason: reasonSchema,
    sessionId: identifierSchema,
    state: settableStateSchema,
  })
  .strict();
export type SetSessionReviewStateInput = z.input<
  typeof setSessionReviewStateInputSchema
>;

export const setItemReviewStateInputSchema = z
  .object({
    projectId: identifierSchema,
    reason: reasonSchema,
    sessionId: identifierSchema,
    sessionTestId: identifierSchema,
    state: settableStateSchema,
  })
  .strict();
export type SetItemReviewStateInput = z.input<
  typeof setItemReviewStateInputSchema
>;

export const previewSessionCloseInputSchema = z
  .object({ projectId: identifierSchema, sessionId: identifierSchema })
  .strict();
export type PreviewSessionCloseInput = z.infer<
  typeof previewSessionCloseInputSchema
>;

const selectionSchema = z
  .array(identifierSchema)
  .max(TEST_REVIEW_ITEM_SELECTION_MAX)
  .transform((ids) => [...new Set(ids)]);

export const previewBulkReviewInputSchema = z
  .object({
    projectId: identifierSchema,
    sessionId: identifierSchema,
    sessionTestIds: selectionSchema,
  })
  .strict();
export type PreviewBulkReviewInput = z.infer<
  typeof previewBulkReviewInputSchema
>;

export const TEST_REVIEW_RECORD_KINDS = [
  "Test Session",
  "Session Test",
] as const;
export type TestReviewRecordKind = (typeof TEST_REVIEW_RECORD_KINDS)[number];

/** One exact record the bulk action would change, as previewed. */
export const testReviewChangeSchema = z
  .object({
    from: stateSchema,
    id: identifierSchema,
    kind: z.enum(TEST_REVIEW_RECORD_KINDS),
    label: z.string(),
  })
  .strict();
export type TestReviewChange = z.infer<typeof testReviewChangeSchema>;

export const commitBulkReviewInputSchema = z
  .object({
    previewed: z
      .array(testReviewChangeSchema)
      .max(TEST_REVIEW_ITEM_SELECTION_MAX + 1),
    projectId: identifierSchema,
    sessionId: identifierSchema,
    sessionTestIds: selectionSchema,
  })
  .strict();
export type CommitBulkReviewInput = z.infer<typeof commitBulkReviewInputSchema>;

export const testReviewRemainingSchema = z
  .object({
    id: identifierSchema,
    state: stateSchema,
    title: z.string(),
  })
  .strict();
export type TestReviewRemaining = z.infer<typeof testReviewRemainingSchema>;

export const TEST_RESULT_EVENT_KINDS = [
  "Correction",
  "Withdrawal",
  "Redaction",
] as const;
export type TestResultEventKind = (typeof TEST_RESULT_EVENT_KINDS)[number];

/** What a redaction mark replaced; the value itself is never kept. */
export const TEST_RESULT_REDACTED_FIELDS = [
  "Reported result",
  "Session summary",
  "Event content",
] as const;
export type TestResultRedactedField =
  (typeof TEST_RESULT_REDACTED_FIELDS)[number];

export const TEST_REVIEW_NEW_CONTEXT_LABEL = "New context after close";
export const TEST_REVIEW_NOTE_MAX = 5000;

const requiredReasonSchema = z
  .string()
  .trim()
  .min(1, "A reason is required.")
  .max(TEST_REVIEW_REASON_MAX);
const optionalIdSchema = identifierSchema
  .nullish()
  .transform((value) => value ?? null);
const correctedResultSchema = z.enum(TEST_REPORT_RESULTS);

const eventTargetFields = {
  projectId: identifierSchema,
  /** Required reason: a result is never changed without a stated cause. */
  reason: requiredReasonSchema,
  sessionId: identifierSchema,
  /** `null` binds the event to the Test Session itself. */
  sessionTestId: optionalIdSchema,
};

export const recordCorrectionInputSchema = z
  .object({
    ...eventTargetFields,
    correctedResult: correctedResultSchema
      .nullish()
      .transform((value) => value ?? null),
    note: z
      .string()
      .trim()
      .max(TEST_REVIEW_NOTE_MAX)
      .nullish()
      .transform((value) => (value ? value : null)),
  })
  .strict()
  .refine(
    (input) => input.sessionTestId === null || input.correctedResult !== null,
    {
      message: "A corrected result is required for a Session Test.",
      path: ["correctedResult"],
    },
  )
  .refine((input) => input.sessionTestId !== null || input.note !== null, {
    message: "A note is required to correct a Test Session.",
    path: ["note"],
  });
export type RecordCorrectionInput = z.input<typeof recordCorrectionInputSchema>;

export const recordWithdrawalInputSchema = z.object(eventTargetFields).strict();
export type RecordWithdrawalInput = z.input<typeof recordWithdrawalInputSchema>;

/**
 * Redacts one value: a Correction or Withdrawal (`eventId`), the reported
 * result of a Session Test (`sessionTestId`) or the Test Session summary.
 */
export const recordRedactionInputSchema = z
  .object({
    ...eventTargetFields,
    eventId: optionalIdSchema,
  })
  .strict()
  .refine((input) => input.eventId === null || input.sessionTestId === null, {
    message: "Name either an event or a Session Test, not both.",
    path: ["eventId"],
  });
export type RecordRedactionInput = z.input<typeof recordRedactionInputSchema>;

export const testResultEventSchema = z
  .object({
    actorAccountId: identifierSchema,
    correctedResult: correctedResultSchema.nullable(),
    id: identifierSchema,
    kind: z.enum(TEST_RESULT_EVENT_KINDS),
    /** `null` once the content was redacted; the mark remains. */
    note: z.string().nullable(),
    /** The chain entry this one follows; `null` follows the original report. */
    previousEventId: z.string().nullable(),
    /** `null` once the content was redacted; a Redaction keeps its reason. */
    reason: z.string().nullable(),
    recordedAt: z.string().datetime({ offset: true }),
    /** True when a Redaction replaced this event's content. */
    redacted: z.boolean(),
    redactedEventId: z.string().nullable(),
    redactedField: z.enum(TEST_RESULT_REDACTED_FIELDS).nullable(),
    sessionId: identifierSchema,
    sessionTestId: z.string().nullable(),
  })
  .strict();
export type TestResultEvent = z.infer<typeof testResultEventSchema>;
export type TestResultStoredEvent = Omit<TestResultEvent, "redacted">;

export const testResultCurrentSchema = z
  .object({
    /** The Correction or Withdrawal that is the head of the chain. */
    eventId: z.string().nullable(),
    result: z.string().nullable(),
    source: z.enum(["Reported", "Correction", "Withdrawal"]),
    /** False for a withdrawn or redacted result: not current evidence or export. */
    usable: z.boolean(),
  })
  .strict();
export type TestResultCurrent = z.infer<typeof testResultCurrentSchema>;

export const testReviewItemSchema = z
  .object({
    boundSpecs: z.array(boundSpecSchema),
    current: testResultCurrentSchema,
    id: identifierSchema,
    /** Set while this item is Closed and a later event arrived. */
    newContextAfterClose: z.boolean(),
    normalizedResult: z.string().nullable(),
    position: z.number().int().nullable(),
    /** `null` when the reported value was redacted. */
    rawResult: z.string().nullable(),
    rawResultRedacted: z.boolean(),
    reviewState: stateSchema,
    /** Exact Planned Test Scenario version this result was bound to, if any. */
    scenarioId: z.string().nullable(),
    scenarioVersion: z.number().int().nullable(),
    title: z.string(),
  })
  .strict();
export type TestReviewItem = z.infer<typeof testReviewItemSchema>;

export const TEST_REVIEW_EVENT_ACTIONS = [
  "Review state set",
  "Bulk review",
] as const;

/** Kayıt geçmişi entry; additive, never edited. */
export const testReviewEventSchema = z
  .object({
    action: z.enum(TEST_REVIEW_EVENT_ACTIONS),
    actorAccountId: identifierSchema,
    batchId: z.string().nullable(),
    fromState: stateSchema,
    id: identifierSchema,
    reason: z.string().nullable(),
    recordedAt: z.string().datetime({ offset: true }),
    /** Exact open items kept when a session was closed; `null` otherwise. */
    remaining: z.array(testReviewRemainingSchema).nullable(),
    sessionId: identifierSchema,
    sessionTestId: z.string().nullable(),
    toState: stateSchema,
  })
  .strict();
export type TestReviewEvent = z.infer<typeof testReviewEventSchema>;

export const testReviewSessionSchema = z
  .object({
    /** Recorded technical context; `null` is shown as unknown, never guessed. */
    context: z.record(z.string(), z.string()).nullable(),
    executorName: z.string(),
    id: identifierSchema,
    items: z.array(testReviewItemSchema),
    /** Set while the session is Closed and a later event arrived. */
    newContextAfterClose: z.boolean(),
    projectId: identifierSchema,
    reportedAt: z.string().datetime({ offset: true }),
    /** Who reported it, as the acceptance recorded it; `null` when unknown. */
    reporter: z.string().nullable(),
    reviewState: stateSchema,
    /** `null` when the summary was redacted. */
    summary: z.string().nullable(),
    summaryRedacted: z.boolean(),
    /** Branch/commit/build the bound Handoff targeted; `null` when none. */
    targetContext: z.record(z.string(), z.string()).nullable(),
    withdrawn: z.boolean(),
  })
  .strict();
export type TestReviewSession = z.infer<typeof testReviewSessionSchema>;

export const testReviewListOutputSchema = z
  .object({
    bindings: z.array(resultBindingSchema),
    conflicts: z.array(resultConflictSchema),
    contextChanges: z.array(contextChangeSchema),
    events: z.array(testReviewEventSchema),
    followUps: z.array(followUpLinkSchema),
    /** Archived Projects are read-only. */
    readOnly: z.boolean(),
    /** Correction, Withdrawal and Redaction chain (Kayıt geçmişi), newest first. */
    resultEvents: z.array(testResultEventSchema),
    sessions: z.array(testReviewSessionSchema),
    supersessions: z.array(supersessionSchema),
  })
  .strict();
export type TestReviewList = z.infer<typeof testReviewListOutputSchema>;

export const testReviewReceiptSchema = z
  .object({
    /** `unchanged` means the state was already the requested one: nothing was written. */
    outcome: z.enum(["applied", "unchanged"]),
    /** Exact items still `Unreviewed` / `Follow-up needed` when a session closed. */
    remaining: z.array(testReviewRemainingSchema),
  })
  .strict();
export type TestReviewReceipt = z.infer<typeof testReviewReceiptSchema>;

export const testReviewClosePreviewSchema = z
  .object({
    remaining: z.array(testReviewRemainingSchema),
    sessionState: stateSchema,
  })
  .strict();
export type TestReviewClosePreview = z.infer<
  typeof testReviewClosePreviewSchema
>;

export const testReviewBulkPreviewSchema = z
  .object({
    changes: z.array(testReviewChangeSchema),
    /** Selected or parent records already `Reviewed`; the commit leaves them. */
    unchanged: z.array(testReviewChangeSchema),
  })
  .strict();
export type TestReviewBulkPreview = z.infer<typeof testReviewBulkPreviewSchema>;

export const testReviewBulkReceiptSchema = z
  .object({
    changed: z.array(testReviewChangeSchema),
    outcome: z.enum(["applied", "unchanged"]),
  })
  .strict();
export type TestReviewBulkReceipt = z.infer<typeof testReviewBulkReceiptSchema>;

export const testResultEventReceiptSchema = z
  .object({ event: testResultEventSchema })
  .strict();
export type TestResultEventReceipt = z.infer<
  typeof testResultEventReceiptSchema
>;

/**
 * `Supersedes` between exact Session Tests (spec 57 #415). Both ends must be
 * Session Tests of this Project: a mismatched specialist type is refused, a
 * cycle is refused, and neither historical result is written.
 */
export const supersedeInputSchema = z
  .object({
    newerRecordType: supersedeRecordTypeSchema.default("Session Test"),
    newerSessionTestId: identifierSchema,
    olderRecordType: supersedeRecordTypeSchema.default("Session Test"),
    olderSessionTestId: identifierSchema,
    projectId: identifierSchema,
    reason: reasonSchema,
  })
  .strict();
export type SupersedeInput = z.input<typeof supersedeInputSchema>;

export const supersedeReceiptSchema = z
  .object({
    outcome: z.enum(["applied", "unchanged"]),
    supersession: supersessionSchema,
  })
  .strict();
export type SupersedeReceipt = z.infer<typeof supersedeReceiptSchema>;

/** Binds the valid result of one exact scenario version; closes the conflict. */
export const bindValidResultInputSchema = z
  .object({
    projectId: identifierSchema,
    reason: reasonSchema,
    scenarioId: identifierSchema,
    scenarioVersion: z.number().int().min(1),
    sessionTestId: identifierSchema,
  })
  .strict();
export type BindValidResultInput = z.input<typeof bindValidResultInputSchema>;

export const bindValidResultReceiptSchema = z
  .object({ binding: resultBindingSchema })
  .strict();
export type BindValidResultReceipt = z.infer<
  typeof bindValidResultReceiptSchema
>;

const followUpSelectionSchema = z
  .array(identifierSchema)
  .min(1)
  .max(FOLLOW_UP_SELECTION_MAX)
  .transform((ids) => [...new Set(ids)]);

/**
 * `Create follow-up work`. A new Work takes exactly one result (it originates
 * from that result); an existing Work takes several results of one root cause.
 */
export const previewFollowUpInputSchema = z
  .object({
    projectId: identifierSchema,
    sessionTestIds: followUpSelectionSchema,
    target: followUpTargetInputSchema,
  })
  .strict()
  .refine(
    (input) =>
      input.target.mode === "existing" || input.sessionTestIds.length === 1,
    {
      message: "New follow-up work originates from exactly one result.",
      path: ["sessionTestIds"],
    },
  );
export type PreviewFollowUpInput = z.input<typeof previewFollowUpInputSchema>;

export const commitFollowUpInputSchema = z
  .object({
    previewFingerprint: z.string().trim().length(64),
    projectId: identifierSchema,
    sessionTestIds: followUpSelectionSchema,
    target: followUpTargetInputSchema,
    /** Identity of the one new Work; a retry with the same id creates nothing new. */
    workId: identifierSchema,
  })
  .strict()
  .refine(
    (input) =>
      input.target.mode === "existing" || input.sessionTestIds.length === 1,
    {
      message: "New follow-up work originates from exactly one result.",
      path: ["sessionTestIds"],
    },
  );
export type CommitFollowUpInput = z.input<typeof commitFollowUpInputSchema>;

/** An existing Work a result can attach to. */
export interface TestReviewFollowUpWork {
  id: string;
  key: string;
  status: string;
  title: string;
  type: string;
}

export interface TestFollowUpLinkStored {
  actorAccountId: string;
  id: string;
  mode: "Created" | "Attached";
  recordedAt: string;
  sessionId: string;
  sessionTestId: string;
  workId: string;
}

export interface TestReviewCreateWorkInput {
  description: string;
  originComponentId: string;
  originOwnerRecordId: string;
  originSourceVersion: string | null;
  payloadFingerprint: string;
  title: string;
  type: string;
  workId: string;
}

export interface TestReviewStoredItem {
  /** Primary spec revisions the scenario version was bound to, live head beside. */
  boundSpecs: BoundSpec[];
  id: string;
  normalizedResult: string | null;
  position: number | null;
  rawResult: string | null;
  reviewState: TestReviewState;
  scenarioId: string | null;
  scenarioVersion: number | null;
  title: string;
}

export interface TestReviewStoredSession {
  context: Record<string, string> | null;
  executorName: string;
  id: string;
  items: TestReviewStoredItem[];
  projectId: string;
  reportedAt: string;
  reporter?: string | null;
  reviewState: TestReviewState;
  summary: string | null;
  targetContext: Record<string, string> | null;
}

export type TestReviewStoredEvent = TestReviewEvent;

export interface TestReviewTransaction {
  appendBinding: (binding: TestResultBindingStored) => Promise<void>;
  appendEvents: (events: TestReviewStoredEvent[]) => Promise<void>;
  appendFollowUpLinks: (links: TestFollowUpLinkStored[]) => Promise<void>;
  appendResultEvents: (events: TestResultStoredEvent[]) => Promise<void>;
  appendSupersession: (edge: TestSupersessionStored) => Promise<void>;
  /**
   * Opens the one new Work of `Create follow-up work` with its Origin
   * Location. The only Work write this seam has; resolves to the Work key.
   */
  createFollowUpWork: (input: TestReviewCreateWorkInput) => Promise<string>;
  /**
   * The narrow security-redaction exception: clears the content of one
   * Correction or Withdrawal. The event, its time and actor stay.
   */
  eraseResultEventContent: (eventId: string) => Promise<void>;
  /** An existing, open İş of this Project; Features and trashed Works excluded. */
  findFollowUpWork: (workId: string) => Promise<TestReviewFollowUpWork | null>;
  findSession: (sessionId: string) => Promise<TestReviewStoredSession | null>;
  listBindings: () => Promise<TestResultBindingStored[]>;
  listEvents: () => Promise<TestReviewStoredEvent[]>;
  /** Links with the live Work key, title and status beside them. */
  listFollowUps: () => Promise<TestFollowUpLink[]>;
  /** Oldest first, in the order the events were appended. */
  listResultEvents: () => Promise<TestResultStoredEvent[]>;
  listSessions: () => Promise<TestReviewStoredSession[]>;
  listSupersessions: () => Promise<TestSupersessionStored[]>;
  projectName: string;
  readOnly: boolean;
  /**
   * Read-only facts of other features for one summary scope (Planned Test
   * Cases, Handoffs, Test Gaps, Test Assessments and which Session Tests are
   * related). `null` when the Feature or Project Release is not in this
   * Project. It has no write counterpart: the summary never writes.
   */
  readSummaryFacts: (
    scope: TestSummaryInput["scope"],
  ) => Promise<TestSummaryFacts | null>;
  /** Writes only the review state of the given Session Tests. */
  writeItemStates: (ids: string[], state: TestReviewState) => Promise<void>;
  /** Writes only the review state of the Test Session row. */
  writeSessionState: (id: string, state: TestReviewState) => Promise<void>;
}

export interface TestReviewStore {
  /** Resolves to `null` when the account does not own the Project. */
  run: <T>(
    accountId: string,
    projectId: string,
    mode: "read" | "write",
    work: (transaction: TestReviewTransaction) => Promise<T>,
  ) => Promise<T | null>;
}

/**
 * Exactly these members. There is no archive, trash, delete, publish-gate,
 * Project Release, Handoff or Test Gap operation on this seam.
 */
export interface TestReviewAccess {
  bindValidResult: (
    accountId: string,
    input: BindValidResultInput,
  ) => Promise<BindValidResultReceipt>;
  commitBulkReview: (
    accountId: string,
    input: CommitBulkReviewInput,
  ) => Promise<TestReviewBulkReceipt>;
  commitFollowUp: (
    accountId: string,
    input: CommitFollowUpInput,
  ) => Promise<TestFollowUpReceipt>;
  list: (accountId: string, projectId: string) => Promise<TestReviewList>;
  previewBulkReview: (
    accountId: string,
    input: PreviewBulkReviewInput,
  ) => Promise<TestReviewBulkPreview>;
  previewFollowUp: (
    accountId: string,
    input: PreviewFollowUpInput,
  ) => Promise<TestFollowUpPreview>;
  previewSessionClose: (
    accountId: string,
    input: PreviewSessionCloseInput,
  ) => Promise<TestReviewClosePreview>;
  recordCorrection: (
    accountId: string,
    input: RecordCorrectionInput,
  ) => Promise<TestResultEventReceipt>;
  recordRedaction: (
    accountId: string,
    input: RecordRedactionInput,
  ) => Promise<TestResultEventReceipt>;
  recordWithdrawal: (
    accountId: string,
    input: RecordWithdrawalInput,
  ) => Promise<TestResultEventReceipt>;
  setItemReviewState: (
    accountId: string,
    input: SetItemReviewStateInput,
  ) => Promise<TestReviewReceipt>;
  setSessionReviewState: (
    accountId: string,
    input: SetSessionReviewStateInput,
  ) => Promise<TestReviewReceipt>;
  /** Live neutral Test Summary (or Tests overview) of one scope; read only. */
  summary: (accountId: string, input: TestSummaryInput) => Promise<TestSummary>;
  supersede: (
    accountId: string,
    input: SupersedeInput,
  ) => Promise<SupersedeReceipt>;
}

function eventHead(
  events: TestResultStoredEvent[],
  sessionId: string,
  sessionTestId: string | null,
) {
  const chain = events.filter(
    (entry) =>
      entry.kind !== "Redaction" &&
      entry.sessionId === sessionId &&
      entry.sessionTestId === sessionTestId,
  );
  const followed = new Set(chain.map((entry) => entry.previousEventId));
  return chain.findLast((entry) => !followed.has(entry.id)) ?? null;
}

/** The newest Correction or Withdrawal of one record, `null` for the original. */
export function resultChainHead(
  events: TestResultStoredEvent[],
  sessionId: string,
  sessionTestId: string | null,
) {
  return eventHead(events, sessionId, sessionTestId);
}

export function redactedEventIds(events: TestResultStoredEvent[]) {
  return new Set(
    events.flatMap((entry) =>
      entry.kind === "Redaction" && entry.redactedEventId
        ? [entry.redactedEventId]
        : [],
    ),
  );
}

function isRedacted(
  events: TestResultStoredEvent[],
  field: TestResultRedactedField,
  sessionId: string,
  sessionTestId: string | null,
) {
  return events.some(
    (entry) =>
      entry.kind === "Redaction" &&
      entry.redactedField === field &&
      entry.sessionId === sessionId &&
      entry.sessionTestId === sessionTestId,
  );
}

/** `recordedAt` of the newest event that moved this record to `Closed`. */
function closedAt(
  reviewEvents: TestReviewStoredEvent[],
  sessionId: string,
  sessionTestId: string | null,
) {
  let latest: string | null = null;
  for (const entry of reviewEvents) {
    if (
      entry.sessionId === sessionId &&
      entry.sessionTestId === sessionTestId &&
      entry.toState === "Closed" &&
      (latest === null || entry.recordedAt > latest)
    ) {
      latest = entry.recordedAt;
    }
  }
  return latest;
}

/**
 * The review view of one stored session: the original report stays intact
 * and the chain head is promoted as the current result. Redacted values are
 * replaced by the mark and never leave this function. A Closed record that
 * received a Correction, Withdrawal or Redaction after it was closed carries
 * `newContextAfterClose`; its review state is never changed here.
 */
export function viewSession(
  session: TestReviewStoredSession,
  reviewEvents: TestReviewStoredEvent[],
  resultEvents: TestResultStoredEvent[],
): TestReviewSession {
  const sessionClosedAt =
    session.reviewState === "Closed"
      ? closedAt(reviewEvents, session.id, null)
      : null;
  const ownEvents = resultEvents.filter(
    (entry) => entry.sessionId === session.id,
  );
  const erased = redactedEventIds(ownEvents);
  const laterThan = (since: string | null, scope: TestResultStoredEvent[]) =>
    since !== null && scope.some((entry) => entry.recordedAt > since);
  const sessionHead = eventHead(ownEvents, session.id, null);
  return {
    executorName: session.executorName,
    id: session.id,
    context: session.context,
    items: session.items.map((item) => {
      const rawResultRedacted = isRedacted(
        ownEvents,
        "Reported result",
        session.id,
        item.id,
      );
      const head = eventHead(ownEvents, session.id, item.id);
      const itemEvents = ownEvents.filter(
        (entry) => entry.sessionTestId === item.id,
      );
      let current: TestResultCurrent = {
        eventId: null,
        result: item.normalizedResult,
        source: "Reported",
        usable: !rawResultRedacted,
      };
      if (head?.kind === "Withdrawal") {
        current = {
          eventId: head.id,
          result: null,
          source: "Withdrawal",
          usable: false,
        };
      } else if (head) {
        const result = erased.has(head.id) ? null : head.correctedResult;
        current = {
          eventId: head.id,
          result,
          source: "Correction",
          usable: result !== null,
        };
      }
      return {
        boundSpecs: item.boundSpecs,
        current,
        id: item.id,
        newContextAfterClose:
          item.reviewState === "Closed" &&
          laterThan(closedAt(reviewEvents, session.id, item.id), itemEvents),
        normalizedResult: item.normalizedResult,
        position: item.position,
        rawResult: rawResultRedacted ? null : item.rawResult,
        rawResultRedacted,
        reviewState: item.reviewState,
        scenarioId: item.scenarioId,
        scenarioVersion: item.scenarioVersion,
        title: item.title,
      };
    }),
    newContextAfterClose: laterThan(sessionClosedAt, ownEvents),
    projectId: session.projectId,
    reportedAt: session.reportedAt,
    reporter: session.reporter ?? null,
    reviewState: session.reviewState,
    summary: isRedacted(ownEvents, "Session summary", session.id, null)
      ? null
      : session.summary,
    summaryRedacted: isRedacted(ownEvents, "Session summary", session.id, null),
    targetContext: session.targetContext,
    withdrawn: sessionHead?.kind === "Withdrawal",
  };
}

/** The chain as shown: redacted content replaced by the mark. */
export function viewResultEvents(
  resultEvents: TestResultStoredEvent[],
): TestResultEvent[] {
  const erased = redactedEventIds(resultEvents);
  return resultEvents.map((entry) =>
    erased.has(entry.id)
      ? {
          ...entry,
          correctedResult: null,
          note: null,
          reason: null,
          redacted: true,
        }
      : { ...entry, redacted: false },
  );
}

/** Items a closing session leaves behind, in report order. */
export function remainingOpenItems(
  session: Pick<TestReviewStoredSession, "items">,
): TestReviewRemaining[] {
  return [...session.items]
    .sort(
      (a, b) =>
        (a.position ?? 0) - (b.position ?? 0) || a.id.localeCompare(b.id),
    )
    .filter((item) =>
      (TEST_REVIEW_OPEN_STATES as readonly string[]).includes(item.reviewState),
    )
    .map((item) => ({
      id: item.id,
      state: item.reviewState,
      title: item.title,
    }));
}
