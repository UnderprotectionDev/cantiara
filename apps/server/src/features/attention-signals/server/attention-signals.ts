import {
  type AttentionSignalsAccess,
  deriveNotificationCenter,
  type EmitAttentionSignalInput,
  emitAttentionSignalInputSchema,
  isRegisteredAttentionSignalId,
  type ParsedEmitAttentionSignalInput,
  type StoredAttentionSignal,
  toAttentionSignal,
} from "@cantiara/api/attention-signals";

/**
 * Attention Signals behavior (spec 71): the registry gate and the Notification
 * Center read. Producers own trigger, negatives and close conditions; this
 * module only rejects unregistered ids, requires the exact source event and
 * target identity, dedupes on it and groups for presentation.
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

export interface AttentionSignalStore {
  /**
   * Writes the signal unless one with the same account, id, event and target
   * exists; resolves to the stored row and whether it was created.
   */
  insertIfAbsent: (
    accountId: string,
    signal: StoredAttentionSignal,
  ) => Promise<{ created: boolean; signal: StoredAttentionSignal }>;
  list: (accountId: string) => Promise<StoredAttentionSignal[]>;
}

export function createAttentionSignals(
  store: AttentionSignalStore,
  createId: () => string = () => crypto.randomUUID(),
): AttentionSignalsAccess {
  return {
    async center(accountId) {
      return deriveNotificationCenter(await store.list(accountId));
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
  };
}
