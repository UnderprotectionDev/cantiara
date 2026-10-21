import { fingerprintMutationPayload } from "@cantiara/api/mutation-and-undo";
import {
  type BindValidResultInput,
  bindValidResultInputSchema,
  type CommitBulkReviewInput,
  type CommitFollowUpInput,
  commitBulkReviewInputSchema,
  commitFollowUpInputSchema,
  type PreviewFollowUpInput,
  previewBulkReviewInputSchema,
  previewFollowUpInputSchema,
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
  type SupersedeInput,
  setItemReviewStateInputSchema,
  setSessionReviewStateInputSchema,
  supersedeInputSchema,
  type TestFollowUpLinkStored,
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
import {
  deriveConflicts,
  deriveContextChanges,
  FOLLOW_UP_STARTING_STATUS,
  followUpDescription,
  followUpTitle,
  resultKey,
  type SignalSession,
  supersedeClosesCycle,
  type TestFollowUpPlan,
  type TestFollowUpPreview,
  type TestResultBindingStored,
  viewSupersessions,
} from "@cantiara/api/test-review-signals";
import {
  deriveTestSummary,
  type TestSummaryInput,
  testSummaryInputSchema,
} from "@cantiara/api/test-review-summary";

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

/** The two ends are not the same specialist type, or not a Session Test. */
export class TestReviewSupersedeTypeMismatchError extends Error {
  readonly code = "TEST_REVIEW_SUPERSEDE_TYPE_MISMATCH" as const;

  constructor() {
    super("Supersedes relates two Session Tests of the same specialist type.");
    this.name = "TestReviewSupersedeTypeMismatchError";
  }
}

/** The relation would close a cycle; Supersedes is directed and acyclic. */
export class TestReviewSupersedeCycleError extends Error {
  readonly code = "TEST_REVIEW_SUPERSEDE_CYCLE" as const;

  constructor() {
    super("This Supersedes relation would close a cycle.");
    this.name = "TestReviewSupersedeCycleError";
  }
}

/** The bound result is not a usable result of that exact scenario version. */
export class TestReviewBindingInvalidError extends Error {
  readonly code = "TEST_REVIEW_BINDING_INVALID" as const;

  constructor() {
    super("Bind a usable result of the same exact scenario version.");
    this.name = "TestReviewBindingInvalidError";
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

interface LocatedItem {
  item: TestReviewStoredSession["items"][number];
  session: TestReviewStoredSession;
}

function locateItem(
  sessions: TestReviewStoredSession[],
  sessionTestId: string,
) {
  for (const session of sessions) {
    const item = session.items.find(({ id }) => id === sessionTestId);
    if (item) {
      return { item, session } satisfies LocatedItem;
    }
  }
  throw new TestReviewRecordNotFoundError(sessionTestId);
}

/** What the founder sees before `Create follow-up work` writes anything. */
async function followUpPlan(
  transaction: TestReviewTransaction,
  input: PreviewFollowUpInput,
  projectId: string,
): Promise<TestFollowUpPlan> {
  const parsed = previewFollowUpInputSchema.parse(input);
  const sessions = await transaction.listSessions();
  const resultEvents = await transaction.listResultEvents();
  const reviewEvents = await transaction.listEvents();
  const viewed = new Map(
    sessions.flatMap((session) =>
      viewSession(session, reviewEvents, resultEvents).items.map(
        (item) => [item.id, item] as const,
      ),
    ),
  );
  const located = parsed.sessionTestIds.map((id) => locateItem(sessions, id));
  const results = located.map(({ item, session }) => {
    const current = viewed.get(item.id)?.current;
    return {
      currentResult: current?.usable ? current.result : null,
      normalizedResult: item.normalizedResult,
      rawResult: viewed.get(item.id)?.rawResult ?? null,
      sessionId: session.id,
      sessionTestId: item.id,
      title: item.title,
    };
  });
  if (parsed.target.mode === "existing") {
    const found = await transaction.findFollowUpWork(parsed.target.workId);
    if (!found) {
      throw new TestReviewRecordNotFoundError(parsed.target.workId);
    }
    return {
      automaticRecords: "None",
      originatesFrom: null,
      originLocation: null,
      results,
      target: { mode: "existing", work: found },
    };
  }
  const [first] = located;
  if (!first) {
    throw new TestReviewRecordNotFoundError(parsed.sessionTestIds.join(","));
  }
  const label = sessionLabel(first.session);
  return {
    automaticRecords: "None",
    originatesFrom: {
      id: first.session.id,
      label,
      recordType: "Test Session",
    },
    originLocation: {
      id: first.item.id,
      recordType: "Session Test",
      sessionId: first.session.id,
      title: first.item.title,
    },
    results,
    target: {
      mode: "new",
      project: { id: projectId, name: transaction.projectName },
      work: {
        description:
          parsed.target.description?.trim() ||
          followUpDescription(label, results),
        startingStatus: FOLLOW_UP_STARTING_STATUS,
        title: parsed.target.title ?? followUpTitle(first.item),
        type: parsed.target.workType ?? "Task",
      },
    },
  };
}

async function previewOf(plan: TestFollowUpPlan): Promise<TestFollowUpPreview> {
  return {
    fingerprint: await fingerprintMutationPayload(
      plan as unknown as Parameters<typeof fingerprintMutationPayload>[0],
    ),
    plan,
  };
}

/**
 * Writes the one new Work when the target is new (Origin Location in its own
 * columns) and returns the links still to record; a retry yields none.
 */
async function followUpLinks(
  transaction: TestReviewTransaction,
  input: {
    accountId: string;
    fingerprint: string;
    plan: TestFollowUpPlan;
    workId: string;
  },
) {
  const { accountId, fingerprint, plan } = input;
  const existingLinks = await transaction.listFollowUps();
  const now = new Date().toISOString();
  const linkFor = (
    entry: TestFollowUpPlan["results"][number],
    toWorkId: string,
    mode: "Attached" | "Created",
  ): TestFollowUpLinkStored => ({
    actorAccountId: accountId,
    id: crypto.randomUUID(),
    mode,
    recordedAt: now,
    sessionId: entry.sessionId,
    sessionTestId: entry.sessionTestId,
    workId: toWorkId,
  });
  const alreadyLinked = (sessionTestId: string, linkedWorkId: string) =>
    existingLinks.some(
      (link) =>
        link.sessionTestId === sessionTestId && link.workId === linkedWorkId,
    );
  if (plan.target.mode === "existing") {
    const existingWorkId = plan.target.work.id;
    return plan.results
      .filter((entry) => !alreadyLinked(entry.sessionTestId, existingWorkId))
      .map((entry) => linkFor(entry, existingWorkId, "Attached"));
  }
  const [result] = plan.results;
  const { originatesFrom, originLocation } = plan;
  if (!(result && originatesFrom && originLocation)) {
    throw new TestReviewRecordNotFoundError(input.workId);
  }
  if (alreadyLinked(result.sessionTestId, input.workId)) {
    return [];
  }
  const { item } = locateItem(
    await transaction.listSessions(),
    result.sessionTestId,
  );
  await transaction.createFollowUpWork({
    description: plan.target.work.description,
    originComponentId: originLocation.id,
    originOwnerRecordId: originatesFrom.id,
    originSourceVersion:
      item.scenarioId && item.scenarioVersion
        ? `${item.scenarioId}@${item.scenarioVersion}`
        : null,
    payloadFingerprint: fingerprint,
    title: plan.target.work.title,
    type: plan.target.work.type,
    workId: input.workId,
  });
  return [linkFor(result, input.workId, "Created")];
}

function signalSessions(
  sessions: ReturnType<typeof viewSession>[],
): SignalSession[] {
  return sessions;
}

async function listOf(transaction: TestReviewTransaction) {
  const reviewEvents = await transaction.listEvents();
  const resultEvents = await transaction.listResultEvents();
  const sessions = [...(await transaction.listSessions())]
    .sort(
      (a, b) =>
        b.reportedAt.localeCompare(a.reportedAt) || a.id.localeCompare(b.id),
    )
    .map((session) => viewSession(session, reviewEvents, resultEvents));
  const edges = await transaction.listSupersessions();
  const bindings = await transaction.listBindings();
  return {
    bindings: [...bindings].sort((a, b) =>
      b.recordedAt.localeCompare(a.recordedAt),
    ),
    conflicts: deriveConflicts(signalSessions(sessions), edges, bindings),
    contextChanges: deriveContextChanges(signalSessions(sessions), edges),
    events: [...reviewEvents].sort(
      (a, b) =>
        b.recordedAt.localeCompare(a.recordedAt) || b.id.localeCompare(a.id),
    ),
    followUps: await transaction.listFollowUps(),
    readOnly: transaction.readOnly,
    resultEvents: viewResultEvents(resultEvents).reverse(),
    sessions,
    supersessions: viewSupersessions(signalSessions(sessions), edges),
  };
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
    async bindValidResult(accountId, rawInput: BindValidResultInput) {
      const input = bindValidResultInputSchema.parse(rawInput);
      return await write(accountId, input.projectId, async (transaction) => {
        const sessions = await transaction.listSessions();
        const reviewEvents = await transaction.listEvents();
        const resultEvents = await transaction.listResultEvents();
        const viewed = sessions.map((session) =>
          viewSession(session, reviewEvents, resultEvents),
        );
        const members = viewed.flatMap((session) =>
          session.items.filter(
            (item) =>
              item.scenarioId === input.scenarioId &&
              item.scenarioVersion === input.scenarioVersion &&
              item.current.usable &&
              resultKey(item.current.result) !== null,
          ),
        );
        if (!members.some((item) => item.id === input.sessionTestId)) {
          throw new TestReviewBindingInvalidError();
        }
        const binding: TestResultBindingStored = {
          actorAccountId: accountId,
          id: crypto.randomUUID(),
          judgedSessionTestIds: members.map((item) => item.id),
          reason: input.reason,
          recordedAt: new Date().toISOString(),
          scenarioId: input.scenarioId,
          scenarioVersion: input.scenarioVersion,
          sessionTestId: input.sessionTestId,
        };
        await transaction.appendBinding(binding);
        return { binding };
      });
    },

    async commitFollowUp(accountId, rawInput: CommitFollowUpInput) {
      const input = commitFollowUpInputSchema.parse(rawInput);
      return await write(accountId, input.projectId, async (transaction) => {
        const plan = await followUpPlan(
          transaction,
          {
            projectId: input.projectId,
            sessionTestIds: input.sessionTestIds,
            target: input.target,
          },
          input.projectId,
        );
        const { fingerprint } = await previewOf(plan);
        if (fingerprint !== input.previewFingerprint) {
          throw new TestReviewPreviewStaleError();
        }
        const links = await followUpLinks(transaction, {
          accountId,
          fingerprint,
          plan,
          workId: input.workId,
        });
        if (links.length === 0) {
          return { links: [], outcome: "unchanged" as const };
        }
        await transaction.appendFollowUpLinks(links);
        const ids = new Set(links.map((link) => link.id));
        return {
          links: (await transaction.listFollowUps()).filter((link) =>
            ids.has(link.id),
          ),
          outcome: "applied" as const,
        };
      });
    },

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
      return await read(accountId, projectId, listOf);
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

    async previewFollowUp(accountId, rawInput: PreviewFollowUpInput) {
      const input = previewFollowUpInputSchema.parse(rawInput);
      return await read(accountId, input.projectId, async (transaction) =>
        previewOf(await followUpPlan(transaction, input, input.projectId)),
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

    async summary(accountId, rawInput: TestSummaryInput) {
      const input = testSummaryInputSchema.parse(rawInput);
      return await read(accountId, input.projectId, async (transaction) => {
        const facts = await transaction.readSummaryFacts(input.scope);
        if (facts === null) {
          throw new TestReviewRecordNotFoundError(
            "id" in input.scope ? input.scope.id : input.projectId,
          );
        }
        return deriveTestSummary(facts, await listOf(transaction));
      });
    },

    async supersede(accountId, rawInput: SupersedeInput) {
      const input = supersedeInputSchema.parse(rawInput);
      return await write(accountId, input.projectId, async (transaction) => {
        if (
          input.newerRecordType !== input.olderRecordType ||
          input.newerRecordType !== "Session Test"
        ) {
          throw new TestReviewSupersedeTypeMismatchError();
        }
        const sessions = await transaction.listSessions();
        locateItem(sessions, input.newerSessionTestId);
        locateItem(sessions, input.olderSessionTestId);
        const edges = await transaction.listSupersessions();
        const existing = edges.find(
          (candidate) =>
            candidate.newerSessionTestId === input.newerSessionTestId &&
            candidate.olderSessionTestId === input.olderSessionTestId,
        );
        const edge = existing ?? {
          actorAccountId: accountId,
          id: crypto.randomUUID(),
          newerSessionTestId: input.newerSessionTestId,
          olderSessionTestId: input.olderSessionTestId,
          reason: input.reason,
          recordedAt: new Date().toISOString(),
        };
        if (
          !existing &&
          supersedeClosesCycle(
            edges,
            input.newerSessionTestId,
            input.olderSessionTestId,
          )
        ) {
          throw new TestReviewSupersedeCycleError();
        }
        if (!existing) {
          await transaction.appendSupersession(edge);
        }
        const reviewEvents = await transaction.listEvents();
        const resultEvents = await transaction.listResultEvents();
        const [supersession] = viewSupersessions(
          signalSessions(
            sessions.map((session) =>
              viewSession(session, reviewEvents, resultEvents),
            ),
          ),
          [edge],
        );
        if (!supersession) {
          throw new TestReviewRecordNotFoundError(edge.id);
        }
        return {
          outcome: existing ? ("unchanged" as const) : ("applied" as const),
          supersession,
        };
      });
    },
  };
}
