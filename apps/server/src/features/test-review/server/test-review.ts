import {
  type CommitBulkReviewInput,
  commitBulkReviewInputSchema,
  previewBulkReviewInputSchema,
  previewSessionCloseInputSchema,
  type RecordCorrectionInput,
  type RecordRedactionInput,
  type RecordWithdrawalInput,
  recordCorrectionInputSchema,
  recordRedactionInputSchema,
  recordWithdrawalInputSchema,
  redactedEventIds,
  remainingOpenItems,
  resultChainHead,
  type SetItemReviewStateInput,
  type SetSessionReviewStateInput,
  setItemReviewStateInputSchema,
  setSessionReviewStateInputSchema,
  type TestResultEventReceipt,
  type TestResultRedactedField,
  type TestResultStoredEvent,
  type TestReviewAccess,
  type TestReviewChange,
  type TestReviewState,
  type TestReviewStore,
  type TestReviewStoredEvent,
  type TestReviewStoredSession,
  type TestReviewTransaction,
  testReviewProjectInputSchema,
  viewResultEvents,
  viewSession,
} from "@cantiara/api/test-review";

export class TestReviewProjectNotFoundError extends Error {
  readonly code = "TEST_REVIEW_PROJECT_NOT_FOUND" as const;

  constructor(projectId: string) {
    super(`Project ${projectId} was not found.`);
    this.name = "TestReviewProjectNotFoundError";
  }
}

export class TestReviewProjectReadOnlyError extends Error {
  readonly code = "TEST_REVIEW_PROJECT_READ_ONLY" as const;

  constructor(projectId: string) {
    super(`Project ${projectId} is archived and read-only.`);
    this.name = "TestReviewProjectReadOnlyError";
  }
}

/** The Test Session or Session Test is not a record of this Project or session. */
export class TestReviewRecordNotFoundError extends Error {
  readonly code = "TEST_REVIEW_RECORD_NOT_FOUND" as const;

  constructor(id: string) {
    super(`Record ${id} was not found in this Test Session.`);
    this.name = "TestReviewRecordNotFoundError";
  }
}

/** The record's reported value or event content is already redacted. */
export class TestReviewAlreadyRedactedError extends Error {
  readonly code = "TEST_REVIEW_ALREADY_REDACTED" as const;

  constructor() {
    super("This value was already redacted.");
    this.name = "TestReviewAlreadyRedactedError";
  }
}

/** The record was already withdrawn; only a Correction can follow. */
export class TestReviewAlreadyWithdrawnError extends Error {
  readonly code = "TEST_REVIEW_ALREADY_WITHDRAWN" as const;

  constructor() {
    super("This record was already withdrawn.");
    this.name = "TestReviewAlreadyWithdrawnError";
  }
}

/** The records changed since the preview was shown; nothing was written. */
export class TestReviewPreviewStaleError extends Error {
  readonly code = "TEST_REVIEW_PREVIEW_STALE" as const;

  constructor() {
    super("The records changed since the preview. Preview again to confirm.");
    this.name = "TestReviewPreviewStaleError";
  }
}

const REVIEWED: TestReviewState = "Reviewed";

function sessionLabel(session: TestReviewStoredSession) {
  return (
    session.summary?.trim() || `${session.executorName}, ${session.reportedAt}`
  );
}

function event(
  session: TestReviewStoredSession,
  accountId: string,
  fields: Pick<
    TestReviewStoredEvent,
    "action" | "batchId" | "fromState" | "reason" | "remaining" | "toState"
  > & { sessionTestId: string | null },
): TestReviewStoredEvent {
  return {
    ...fields,
    actorAccountId: accountId,
    id: crypto.randomUUID(),
    recordedAt: new Date().toISOString(),
    sessionId: session.id,
  };
}

async function requireSession(
  transaction: TestReviewTransaction,
  sessionId: string,
) {
  const session = await transaction.findSession(sessionId);
  if (!session) {
    throw new TestReviewRecordNotFoundError(sessionId);
  }
  return session;
}

/** The records a bulk action would change, in the order they are shown. */
function bulkChanges(
  session: TestReviewStoredSession,
  sessionTestIds: string[],
) {
  const selected = new Set(sessionTestIds);
  for (const id of selected) {
    if (!session.items.some((item) => item.id === id)) {
      throw new TestReviewRecordNotFoundError(id);
    }
  }
  const candidates: TestReviewChange[] = [
    {
      from: session.reviewState,
      id: session.id,
      kind: "Test Session",
      label: sessionLabel(session),
    },
    ...[...session.items]
      .sort(
        (a, b) =>
          (a.position ?? 0) - (b.position ?? 0) || a.id.localeCompare(b.id),
      )
      .filter((item) => selected.has(item.id))
      .map(
        (item): TestReviewChange => ({
          from: item.reviewState,
          id: item.id,
          kind: "Session Test",
          label: item.title,
        }),
      ),
  ];
  return {
    changes: candidates.filter((record) => record.from !== REVIEWED),
    unchanged: candidates.filter((record) => record.from === REVIEWED),
  };
}

/**
 * Resolves the record a Correction or Withdrawal binds to and the chain entry
 * it follows. The reported result itself is never written.
 */
async function resolveResultTarget(
  transaction: TestReviewTransaction,
  input: { sessionId: string; sessionTestId: string | null },
) {
  const session = await requireSession(transaction, input.sessionId);
  if (
    input.sessionTestId !== null &&
    !session.items.some((item) => item.id === input.sessionTestId)
  ) {
    throw new TestReviewRecordNotFoundError(input.sessionTestId);
  }
  const head = resultChainHead(
    await transaction.listResultEvents(),
    session.id,
    input.sessionTestId,
  );
  return { head, session };
}

/** What a redaction replaces, refusing a value that is already a mark. */
function redactionTarget(
  session: TestReviewStoredSession,
  existing: TestResultStoredEvent[],
  input: { eventId: string | null; sessionTestId: string | null },
): { field: TestResultRedactedField; sessionTestId: string | null } {
  if (input.eventId !== null) {
    const target = existing.find(
      (entry) =>
        entry.id === input.eventId &&
        entry.sessionId === session.id &&
        entry.kind !== "Redaction",
    );
    if (!target) {
      throw new TestReviewRecordNotFoundError(input.eventId);
    }
    if (redactedEventIds(existing).has(target.id)) {
      throw new TestReviewAlreadyRedactedError();
    }
    return { field: "Event content", sessionTestId: target.sessionTestId };
  }
  const { sessionTestId } = input;
  if (
    sessionTestId !== null &&
    !session.items.some((item) => item.id === sessionTestId)
  ) {
    throw new TestReviewRecordNotFoundError(sessionTestId);
  }
  const field: TestResultRedactedField =
    sessionTestId === null ? "Session summary" : "Reported result";
  if (
    existing.some(
      (entry) =>
        entry.kind === "Redaction" &&
        entry.redactedField === field &&
        entry.sessionId === session.id &&
        entry.sessionTestId === sessionTestId,
    )
  ) {
    throw new TestReviewAlreadyRedactedError();
  }
  return { field, sessionTestId };
}

function resultEvent(
  accountId: string,
  fields: Pick<
    TestResultStoredEvent,
    | "correctedResult"
    | "kind"
    | "note"
    | "previousEventId"
    | "reason"
    | "redactedEventId"
    | "redactedField"
    | "sessionId"
    | "sessionTestId"
  >,
): TestResultStoredEvent {
  return {
    ...fields,
    actorAccountId: accountId,
    id: crypto.randomUUID(),
    recordedAt: new Date().toISOString(),
  };
}

async function receipt(
  transaction: TestReviewTransaction,
  id: string,
): Promise<TestResultEventReceipt> {
  const events = viewResultEvents(await transaction.listResultEvents());
  const found = events.find((entry) => entry.id === id);
  if (!found) {
    throw new TestReviewRecordNotFoundError(id);
  }
  return { event: found };
}

function sameChange(a: TestReviewChange, b: TestReviewChange) {
  return a.id === b.id && a.kind === b.kind && a.from === b.from;
}

export function createTestReview(store: TestReviewStore): TestReviewAccess {
  async function read<T>(
    accountId: string,
    projectId: string,
    work: (transaction: TestReviewTransaction) => Promise<T>,
  ) {
    const result = await store.run(accountId, projectId, "read", work);
    if (result === null) {
      throw new TestReviewProjectNotFoundError(projectId);
    }
    return result;
  }

  async function write<T>(
    accountId: string,
    projectId: string,
    work: (transaction: TestReviewTransaction) => Promise<T>,
  ) {
    const result = await store.run(
      accountId,
      projectId,
      "write",
      (transaction) => {
        if (transaction.readOnly) {
          throw new TestReviewProjectReadOnlyError(projectId);
        }
        return work(transaction);
      },
    );
    if (result === null) {
      throw new TestReviewProjectNotFoundError(projectId);
    }
    return result;
  }

  return {
    async commitBulkReview(accountId, rawInput: CommitBulkReviewInput) {
      const input = commitBulkReviewInputSchema.parse(rawInput);
      return await write(accountId, input.projectId, async (transaction) => {
        const session = await requireSession(transaction, input.sessionId);
        const { changes } = bulkChanges(session, input.sessionTestIds);
        // Every record that still needs a change must be one the founder saw
        // with the same state; records already Reviewed are simply left.
        for (const change of changes) {
          if (!input.previewed.some((seen) => sameChange(seen, change))) {
            throw new TestReviewPreviewStaleError();
          }
        }
        if (changes.length === 0) {
          return { changed: [], outcome: "unchanged" as const };
        }
        const batchId = crypto.randomUUID();
        const itemIds = changes
          .filter((change) => change.kind === "Session Test")
          .map((change) => change.id);
        if (itemIds.length > 0) {
          await transaction.writeItemStates(itemIds, REVIEWED);
        }
        if (changes.some((change) => change.kind === "Test Session")) {
          await transaction.writeSessionState(session.id, REVIEWED);
        }
        await transaction.appendEvents(
          changes.map((change) =>
            event(session, accountId, {
              action: "Bulk review",
              batchId,
              fromState: change.from,
              reason: null,
              remaining: null,
              sessionTestId: change.kind === "Session Test" ? change.id : null,
              toState: REVIEWED,
            }),
          ),
        );
        return { changed: changes, outcome: "applied" as const };
      });
    },

    async list(accountId, rawProjectId) {
      const { projectId } = testReviewProjectInputSchema.parse({
        projectId: rawProjectId,
      });
      return await read(accountId, projectId, async (transaction) => {
        const reviewEvents = await transaction.listEvents();
        const resultEvents = await transaction.listResultEvents();
        return {
          events: [...reviewEvents].sort(
            (a, b) =>
              b.recordedAt.localeCompare(a.recordedAt) ||
              b.id.localeCompare(a.id),
          ),
          readOnly: transaction.readOnly,
          resultEvents: viewResultEvents(resultEvents).reverse(),
          sessions: [...(await transaction.listSessions())]
            .sort(
              (a, b) =>
                b.reportedAt.localeCompare(a.reportedAt) ||
                a.id.localeCompare(b.id),
            )
            .map((session) => viewSession(session, reviewEvents, resultEvents)),
        };
      });
    },

    async previewBulkReview(accountId, rawInput) {
      const input = previewBulkReviewInputSchema.parse(rawInput);
      return await read(accountId, input.projectId, async (transaction) =>
        bulkChanges(
          await requireSession(transaction, input.sessionId),
          input.sessionTestIds,
        ),
      );
    },

    async previewSessionClose(accountId, rawInput) {
      const input = previewSessionCloseInputSchema.parse(rawInput);
      return await read(accountId, input.projectId, async (transaction) => {
        const session = await requireSession(transaction, input.sessionId);
        return {
          remaining: remainingOpenItems(session),
          sessionState: session.reviewState,
        };
      });
    },

    async recordCorrection(accountId, rawInput: RecordCorrectionInput) {
      const input = recordCorrectionInputSchema.parse(rawInput);
      return await write(accountId, input.projectId, async (transaction) => {
        const { head, session } = await resolveResultTarget(transaction, input);
        const added = resultEvent(accountId, {
          correctedResult: input.correctedResult,
          kind: "Correction",
          note: input.note,
          previousEventId: head?.id ?? null,
          reason: input.reason,
          redactedEventId: null,
          redactedField: null,
          sessionId: session.id,
          sessionTestId: input.sessionTestId,
        });
        await transaction.appendResultEvents([added]);
        return await receipt(transaction, added.id);
      });
    },

    async recordRedaction(accountId, rawInput: RecordRedactionInput) {
      const input = recordRedactionInputSchema.parse(rawInput);
      return await write(accountId, input.projectId, async (transaction) => {
        const session = await requireSession(transaction, input.sessionId);
        const { field, sessionTestId } = redactionTarget(
          session,
          await transaction.listResultEvents(),
          input,
        );
        const added = resultEvent(accountId, {
          correctedResult: null,
          kind: "Redaction",
          note: null,
          previousEventId: null,
          reason: input.reason,
          redactedEventId: input.eventId,
          redactedField: field,
          sessionId: session.id,
          sessionTestId,
        });
        await transaction.appendResultEvents([added]);
        if (input.eventId !== null) {
          await transaction.eraseResultEventContent(input.eventId);
        }
        return await receipt(transaction, added.id);
      });
    },

    async recordWithdrawal(accountId, rawInput: RecordWithdrawalInput) {
      const input = recordWithdrawalInputSchema.parse(rawInput);
      return await write(accountId, input.projectId, async (transaction) => {
        const { head, session } = await resolveResultTarget(transaction, input);
        if (head?.kind === "Withdrawal") {
          throw new TestReviewAlreadyWithdrawnError();
        }
        const added = resultEvent(accountId, {
          correctedResult: null,
          kind: "Withdrawal",
          note: null,
          previousEventId: head?.id ?? null,
          reason: input.reason,
          redactedEventId: null,
          redactedField: null,
          sessionId: session.id,
          sessionTestId: input.sessionTestId,
        });
        await transaction.appendResultEvents([added]);
        return await receipt(transaction, added.id);
      });
    },

    async setItemReviewState(accountId, rawInput: SetItemReviewStateInput) {
      const input = setItemReviewStateInputSchema.parse(rawInput);
      return await write(accountId, input.projectId, async (transaction) => {
        const session = await requireSession(transaction, input.sessionId);
        const item = session.items.find(({ id }) => id === input.sessionTestId);
        if (!item) {
          throw new TestReviewRecordNotFoundError(input.sessionTestId);
        }
        if (item.reviewState === input.state) {
          return { outcome: "unchanged" as const, remaining: [] };
        }
        await transaction.writeItemStates([item.id], input.state);
        await transaction.appendEvents([
          event(session, accountId, {
            action: "Review state set",
            batchId: null,
            fromState: item.reviewState,
            reason: input.reason,
            remaining: null,
            sessionTestId: item.id,
            toState: input.state,
          }),
        ]);
        return { outcome: "applied" as const, remaining: [] };
      });
    },

    async setSessionReviewState(
      accountId,
      rawInput: SetSessionReviewStateInput,
    ) {
      const input = setSessionReviewStateInputSchema.parse(rawInput);
      return await write(accountId, input.projectId, async (transaction) => {
        const session = await requireSession(transaction, input.sessionId);
        if (session.reviewState === input.state) {
          return { outcome: "unchanged" as const, remaining: [] };
        }
        // Closing is never gated: the exact open items are kept, not required.
        const remaining =
          input.state === "Closed" ? remainingOpenItems(session) : [];
        await transaction.writeSessionState(session.id, input.state);
        await transaction.appendEvents([
          event(session, accountId, {
            action: "Review state set",
            batchId: null,
            fromState: session.reviewState,
            reason: input.reason,
            remaining: input.state === "Closed" ? remaining : null,
            sessionTestId: null,
            toState: input.state,
          }),
        ]);
        return { outcome: "applied" as const, remaining };
      });
    },
  };
}
