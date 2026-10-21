import { z } from "zod";

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

export const testReviewItemSchema = z
  .object({
    id: identifierSchema,
    normalizedResult: z.string().nullable(),
    position: z.number().int().nullable(),
    rawResult: z.string().nullable(),
    reviewState: stateSchema,
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
    executorName: z.string(),
    id: identifierSchema,
    items: z.array(testReviewItemSchema),
    projectId: identifierSchema,
    reportedAt: z.string().datetime({ offset: true }),
    reviewState: stateSchema,
    summary: z.string().nullable(),
  })
  .strict();
export type TestReviewSession = z.infer<typeof testReviewSessionSchema>;

export const testReviewListOutputSchema = z
  .object({
    events: z.array(testReviewEventSchema),
    /** Archived Projects are read-only. */
    readOnly: z.boolean(),
    sessions: z.array(testReviewSessionSchema),
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

export interface TestReviewStoredItem {
  id: string;
  normalizedResult: string | null;
  position: number | null;
  rawResult: string | null;
  reviewState: TestReviewState;
  title: string;
}

export interface TestReviewStoredSession {
  executorName: string;
  id: string;
  items: TestReviewStoredItem[];
  projectId: string;
  reportedAt: string;
  reviewState: TestReviewState;
  summary: string | null;
}

export type TestReviewStoredEvent = TestReviewEvent;

export interface TestReviewTransaction {
  appendEvents: (events: TestReviewStoredEvent[]) => Promise<void>;
  findSession: (sessionId: string) => Promise<TestReviewStoredSession | null>;
  listEvents: () => Promise<TestReviewStoredEvent[]>;
  listSessions: () => Promise<TestReviewStoredSession[]>;
  readOnly: boolean;
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
  commitBulkReview: (
    accountId: string,
    input: CommitBulkReviewInput,
  ) => Promise<TestReviewBulkReceipt>;
  list: (accountId: string, projectId: string) => Promise<TestReviewList>;
  previewBulkReview: (
    accountId: string,
    input: PreviewBulkReviewInput,
  ) => Promise<TestReviewBulkPreview>;
  previewSessionClose: (
    accountId: string,
    input: PreviewSessionCloseInput,
  ) => Promise<TestReviewClosePreview>;
  setItemReviewState: (
    accountId: string,
    input: SetItemReviewStateInput,
  ) => Promise<TestReviewReceipt>;
  setSessionReviewState: (
    accountId: string,
    input: SetSessionReviewStateInput,
  ) => Promise<TestReviewReceipt>;
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
