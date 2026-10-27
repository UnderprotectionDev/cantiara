import { createHash } from "node:crypto";

import {
  type AttentionFollowUpPreview,
  type AttentionSignal,
  type AttentionSignalsAccess,
  attentionSignalTargetSchema,
  buildAttentionFollowUpPlan,
  createAttentionFollowUpInputSchema,
  deriveNotificationCenter,
  type EmitAttentionSignalInput,
  emitAttentionSignalInputSchema,
  isRegisteredAttentionSignalId,
  markAttentionSignalInputSchema,
  type OpenAttentionSignalOutput,
  type ParsedEmitAttentionSignalInput,
  previewAttentionFollowUpInputSchema,
  type StoredAttentionSignal,
  sourceGroupKey,
  toAttentionSignal,
} from "@cantiara/api/attention-signals";

/**
 * Attention Signals behavior (spec 71): the registry gate and the Notification
 * Center. Producers own trigger, negatives and close conditions; this module
 * rejects unregistered ids, requires the exact source event and target
 * identity, dedupes on it, keeps read/closed apart from the source, opens the
 * exact event and previews `Create Follow-up Work`. It never writes a source.
 */

export class AttentionSignalNotRegisteredError extends Error {
  readonly code = "ATTENTION_SIGNAL_NOT_REGISTERED" as const;

  constructor(signalId: unknown) {
    super(`Attention signal id ${String(signalId)} is not registered.`);
    this.name = "AttentionSignalNotRegisteredError";
  }
}

export class AttentionSignalIdentityError extends Error {
  readonly code = "ATTENTION_SIGNAL_IDENTITY_REQUIRED" as const;

  constructor(
    message = "An attention signal needs an exact event and target.",
  ) {
    super(message);
    this.name = "AttentionSignalIdentityError";
  }
}

export class AttentionSignalNotFoundError extends Error {
  readonly code = "ATTENTION_SIGNAL_NOT_FOUND" as const;

  constructor(signalRowId: string) {
    super(`Notification ${signalRowId} was not found.`);
    this.name = "AttentionSignalNotFoundError";
  }
}

export class AttentionFollowUpProjectRequiredError extends Error {
  readonly code = "ATTENTION_FOLLOW_UP_PROJECT_REQUIRED" as const;

  constructor() {
    super("This notification has no Project to create follow-up work in.");
    this.name = "AttentionFollowUpProjectRequiredError";
  }
}

export class AttentionFollowUpProjectUnavailableError extends Error {
  readonly code = "ATTENTION_FOLLOW_UP_PROJECT_UNAVAILABLE" as const;

  constructor() {
    super("The Project is unavailable for new work.");
    this.name = "AttentionFollowUpProjectUnavailableError";
  }
}

export class AttentionFollowUpStaleError extends Error {
  readonly code = "ATTENTION_FOLLOW_UP_STALE" as const;

  constructor() {
    super("The follow-up preview changed; preview it again.");
    this.name = "AttentionFollowUpStaleError";
  }
}

export class AttentionFollowUpAttemptConflictError extends Error {
  readonly code = "ATTENTION_FOLLOW_UP_ATTEMPT_CONFLICT" as const;

  constructor() {
    super("That attempt already created work for a different notification.");
    this.name = "AttentionFollowUpAttemptConflictError";
  }
}

export interface AttentionFollowUpCommit {
  attemptId: string;
  fingerprint: string;
  plan: ReturnType<typeof buildAttentionFollowUpPlan>;
  signal: StoredAttentionSignal;
  workId: string;
}

export interface AttentionSignalStore {
  /**
   * Commits the one İş and its receipt atomically under the Project lock.
   * The same attempt id returns the first İş. `null` means the Project is
   * not the account's or is archived.
   */
  commitFollowUp: (
    accountId: string,
    commit: AttentionFollowUpCommit,
  ) => Promise<{ created: boolean; workId: string } | null>;
  find: (
    accountId: string,
    signalRowId: string,
  ) => Promise<StoredAttentionSignal | null>;
  /**
   * Writes the signal unless one with the same account, id, event and target
   * exists; resolves to the stored row and whether it was created.
   */
  insertIfAbsent: (
    accountId: string,
    signal: StoredAttentionSignal,
  ) => Promise<{ created: boolean; signal: StoredAttentionSignal }>;
  list: (accountId: string) => Promise<StoredAttentionSignal[]>;
  /** Writes the attention marks only. */
  setMarks: (
    accountId: string,
    signalRowId: string,
    marks: { closedAt?: string | null; readAt?: string | null },
  ) => Promise<StoredAttentionSignal | null>;
}

/**
 * Read-only port to the source owners. It answers only whether the record and
 * the exact event still resolve; it returns no content and has no write.
 */
export interface AttentionSourceResolver {
  event: (
    accountId: string,
    signal: StoredAttentionSignal,
  ) => Promise<"resolved" | "unresolved">;
  record: (
    accountId: string,
    group: StoredAttentionSignal["group"],
  ) => Promise<"deleted" | "present">;
}

/** Without a producer resolver nothing is claimed: records exist, events do not resolve. */
export const unresolvedSourceResolver: AttentionSourceResolver = {
  event: () => Promise.resolve("unresolved"),
  record: () => Promise.resolve("present"),
};

const fingerprintOf = (plan: ReturnType<typeof buildAttentionFollowUpPlan>) =>
  createHash("sha256").update(JSON.stringify(plan)).digest("hex");

export function createAttentionSignals(
  store: AttentionSignalStore,
  options: {
    createId?: () => string;
    now?: () => Date;
    resolver?: AttentionSourceResolver;
  } = {},
): AttentionSignalsAccess {
  const createId = options.createId ?? (() => crypto.randomUUID());
  const now = options.now ?? (() => new Date());
  const resolver = options.resolver ?? unresolvedSourceResolver;

  async function viewOf(
    accountId: string,
    stored: StoredAttentionSignal,
  ): Promise<AttentionSignal> {
    const record = await resolver.record(accountId, stored.group);
    return toAttentionSignal(stored, record === "deleted");
  }

  async function require(accountId: string, signalRowId: string) {
    const stored = await store.find(accountId, signalRowId);
    if (!stored) {
      throw new AttentionSignalNotFoundError(signalRowId);
    }
    return stored;
  }

  async function planOf(
    accountId: string,
    signalRowId: string,
    workType: "Bug" | "Research" | "Task",
  ) {
    const stored = await require(accountId, signalRowId);
    if (!stored.projectId) {
      throw new AttentionFollowUpProjectRequiredError();
    }
    const signal = await viewOf(accountId, stored);
    const plan = buildAttentionFollowUpPlan(signal, workType);
    return { plan, signal, stored };
  }

  return {
    async center(accountId) {
      const stored = await store.list(accountId);
      const groups = new Map(
        stored.map((row) => [sourceGroupKey(row.group), row.group]),
      );
      const deleted = new Set<string>();
      await Promise.all(
        [...groups].map(async ([key, group]) => {
          if ((await resolver.record(accountId, group)) === "deleted") {
            deleted.add(key);
          }
        }),
      );
      return deriveNotificationCenter(stored, deleted);
    },

    async createFollowUp(accountId, rawInput) {
      const input = createAttentionFollowUpInputSchema.parse(rawInput);
      const { plan, signal, stored } = await planOf(
        accountId,
        input.signalRowId,
        input.workType,
      );
      const fingerprint = fingerprintOf(plan);
      if (fingerprint !== input.fingerprint) {
        throw new AttentionFollowUpStaleError();
      }
      const committed = await store.commitFollowUp(accountId, {
        attemptId: input.attemptId,
        fingerprint,
        plan,
        signal: stored,
        workId: createId(),
      });
      if (!committed) {
        throw new AttentionFollowUpProjectUnavailableError();
      }
      // The signal is returned exactly as it was: the apply neither reads,
      // closes nor otherwise marks it, and the source is not written.
      return { created: committed.created, signal, workId: committed.workId };
    },

    async emit(accountId, rawInput: EmitAttentionSignalInput) {
      // Fail closed before any write: the registry is checked first so an
      // unknown id is a registry refusal, not a shape error.
      const requested = (rawInput as { signalId?: unknown } | null)?.signalId;
      if (!isRegisteredAttentionSignalId(requested)) {
        throw new AttentionSignalNotRegisteredError(requested);
      }
      const parsed = emitAttentionSignalInputSchema.safeParse(rawInput);
      if (!parsed.success) {
        throw new AttentionSignalIdentityError();
      }
      const input: ParsedEmitAttentionSignalInput = parsed.data;
      const result = await store.insertIfAbsent(accountId, {
        closedAt: null,
        eventId: input.eventId,
        group: input.group,
        id: createId(),
        occurredAt: new Date(input.occurredAt).toISOString(),
        projectId: input.projectId,
        readAt: null,
        reason: input.reason,
        signalId: input.signalId,
        targetId: input.targetId,
      });
      return {
        outcome: result.created ? "created" : "duplicate",
        signal: toAttentionSignal(result.signal),
      };
    },

    async mark(accountId, rawInput) {
      const input = markAttentionSignalInputSchema.parse(rawInput);
      const stamp = now().toISOString();
      const marks = {
        closed: { closedAt: stamp },
        read: { readAt: stamp },
        reopened: { closedAt: null },
        unread: { readAt: null },
      }[input.mark];
      const updated = await store.setMarks(accountId, input.signalRowId, marks);
      if (!updated) {
        throw new AttentionSignalNotFoundError(input.signalRowId);
      }
      return await viewOf(accountId, updated);
    },

    async open(accountId, rawInput): Promise<OpenAttentionSignalOutput> {
      const input = attentionSignalTargetSchema.parse(rawInput);
      const stored = await require(accountId, input.signalRowId);
      if ((await resolver.record(accountId, stored.group)) === "deleted") {
        return {
          explanation: "The source record was deleted.",
          outcome: "tombstone",
        };
      }
      if ((await resolver.event(accountId, stored)) === "resolved") {
        return {
          eventId: stored.eventId,
          group: stored.group,
          outcome: "event",
          targetId: stored.targetId,
        };
      }
      // Never retarget: the record opens and the missing exact event is named.
      return {
        explanation: `The exact source event ${stored.eventId} can no longer be found; the record is shown instead.`,
        group: stored.group,
        missingEventId: stored.eventId,
        outcome: "record",
      };
    },

    async previewFollowUp(
      accountId,
      rawInput,
    ): Promise<AttentionFollowUpPreview> {
      const input = previewAttentionFollowUpInputSchema.parse(rawInput);
      const { plan, stored } = await planOf(
        accountId,
        input.signalRowId,
        input.workType,
      );
      return {
        fingerprint: fingerprintOf(plan),
        relations: plan.relations,
        signalRowId: stored.id,
        work: {
          description: plan.description,
          projectId: stored.projectId as string,
          title: plan.title,
          type: plan.type,
        },
      };
    },
  };
}
