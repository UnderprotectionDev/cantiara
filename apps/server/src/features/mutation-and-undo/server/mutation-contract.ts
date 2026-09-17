import type {
  MutationOrigin,
  NonHumanMutationActor,
} from "@cantiara/api/mutation-and-undo";
import {
  fingerprintMutationPayload,
  MUTATION_UI_LABELS,
  type MutationActor,
  type MutationApply,
  type MutationCommand,
  type MutationContract,
  type MutationPayload,
  type MutationReceipt,
  type MutationSource,
  type MutationTarget,
  mutationCommandSchema,
} from "@cantiara/api/mutation-and-undo";

export interface MutationIdempotencyKey {
  key: string;
  scope: string;
}

export interface MutationCommitInput<
  TValue,
  TPayload extends MutationPayload = MutationPayload,
> {
  actor: MutationActor;
  apply: MutationApply<TValue, TPayload>;
  committedAt: string;
  expectedRevision: number;
  historyId: string;
  idempotencyKey: MutationIdempotencyKey;
  origin: MutationOrigin;
  payload: TPayload;
  payloadFingerprint: string;
  receiptId: string;
  targetId: string;
}

export type MutationCommitResult<TValue> =
  | { receipt: MutationReceipt<TValue>; status: "committed" | "replayed" }
  | { status: "conflict" }
  | { current: MutationTarget<TValue>; status: "stale" }
  | { status: "target-not-found" };

export interface MutationContractStore<TValue> {
  commit: <TPayload extends MutationPayload>(
    input: MutationCommitInput<TValue, TPayload>,
  ) => Promise<MutationCommitResult<TValue>>;
  findReceipt: (
    key: MutationIdempotencyKey,
  ) => Promise<MutationReceipt<TValue> | null>;
  getTarget: (targetId: string) => Promise<MutationTarget<TValue> | null>;
}

export interface MutationSourceVerifier {
  verify: (input: {
    actor: NonHumanMutationActor;
    payload: MutationPayload;
    source: MutationSource;
  }) => boolean | Promise<boolean>;
}

export interface MutationContractOptions<TValue> {
  createId?: () => string;
  now?: () => Date;
  sourceVerifier?: MutationSourceVerifier;
  store: MutationContractStore<TValue>;
}

export class MutationConflictError extends Error {
  readonly code = "CONFLICT" as const;
  readonly label = MUTATION_UI_LABELS.conflict;
  readonly targetId: string;

  constructor(targetId: string) {
    super(MUTATION_UI_LABELS.conflict);
    this.name = "MutationConflictError";
    this.targetId = targetId;
  }
}

export class MutationPayloadFingerprintError extends Error {
  readonly code = "INVALID_PAYLOAD_FINGERPRINT" as const;

  constructor() {
    super("The payload fingerprint does not match the payload.");
    this.name = "MutationPayloadFingerprintError";
  }
}

export class MutationStaleBaseRevisionError<TValue> extends Error {
  readonly code = "STALE_BASE_REVISION" as const;
  readonly currentRevision: number;
  readonly currentValue: TValue;
  readonly label = MUTATION_UI_LABELS.currentValue;
  readonly targetId: string;

  constructor(target: MutationTarget<TValue>) {
    super(MUTATION_UI_LABELS.currentValue);
    this.name = "MutationStaleBaseRevisionError";
    this.currentRevision = target.revision;
    this.currentValue = target.value;
    this.targetId = target.id;
  }
}

export class MutationTargetNotFoundError extends Error {
  readonly code = "TARGET_NOT_FOUND" as const;
  readonly targetId: string;

  constructor(targetId: string) {
    super("Target record was not found.");
    this.name = "MutationTargetNotFoundError";
    this.targetId = targetId;
  }
}

export class MutationSourceVerificationError extends Error {
  readonly code = "UNVERIFIED_SOURCE" as const;

  constructor() {
    super("The mutation source could not be verified.");
    this.name = "MutationSourceVerificationError";
  }
}

export function mutationIdempotencyKey(
  command: MutationCommand,
): MutationIdempotencyKey {
  if (command.kind === "human") {
    return {
      key: command.clientIdempotencyKey,
      scope: `human:${command.actor.actorId}:${command.targetId}`,
    };
  }

  return {
    key: command.source.deliveryId,
    scope: `source:${command.source.sourceId}:${command.targetId}`,
  };
}

export function mutationOrigin(command: MutationCommand): MutationOrigin {
  if (command.kind === "human") {
    return {
      clientIdempotencyKey: command.clientIdempotencyKey,
      kind: "human",
    };
  }

  return {
    deliveryId: command.source.deliveryId,
    kind: "source",
    sourceId: command.source.sourceId,
  };
}

async function verifyNonHumanSource<TPayload extends MutationPayload>(
  command: MutationCommand<TPayload>,
  payloadFingerprint: string,
  sourceVerifier: MutationSourceVerifier | undefined,
) {
  if (command.kind !== "non-human") {
    return;
  }

  if (command.source.payloadFingerprint.toLowerCase() !== payloadFingerprint) {
    throw new MutationPayloadFingerprintError();
  }

  const verified = await sourceVerifier?.verify({
    actor: command.actor,
    payload: command.payload,
    source: command.source,
  });
  if (!verified) {
    throw new MutationSourceVerificationError();
  }
}

function replayReceiptOrThrow<TValue>(
  existing: MutationReceipt<TValue>,
  payloadFingerprint: string,
  targetId: string,
) {
  if (existing.payloadFingerprint !== payloadFingerprint) {
    throw new MutationConflictError(targetId);
  }
  return existing;
}

function receiptFromCommitResult<TValue>(
  result: MutationCommitResult<TValue>,
  targetId: string,
) {
  switch (result.status) {
    case "committed":
    case "replayed":
      return result.receipt;
    case "conflict":
      throw new MutationConflictError(targetId);
    case "stale":
      throw new MutationStaleBaseRevisionError(result.current);
    case "target-not-found":
      throw new MutationTargetNotFoundError(targetId);
    default:
      throw new Error("Unknown mutation commit result.");
  }
}

export function createMutationContract<TValue>({
  createId = () => crypto.randomUUID(),
  now = () => new Date(),
  sourceVerifier,
  store,
}: MutationContractOptions<TValue>): MutationContract<TValue> {
  const mutate = async <TPayload extends MutationPayload>(
    command: MutationCommand<TPayload>,
    apply: MutationApply<TValue, TPayload>,
  ): Promise<MutationReceipt<TValue>> => {
    const parsed = mutationCommandSchema.parse(
      command,
    ) as MutationCommand<TPayload>;
    const payloadFingerprint = await fingerprintMutationPayload(parsed.payload);
    await verifyNonHumanSource(parsed, payloadFingerprint, sourceVerifier);

    const idempotencyKey = mutationIdempotencyKey(parsed);
    const existing = await store.findReceipt(idempotencyKey);
    if (existing) {
      return replayReceiptOrThrow(
        existing,
        payloadFingerprint,
        parsed.targetId,
      );
    }

    const result = await store.commit({
      actor: parsed.actor,
      apply,
      committedAt: now().toISOString(),
      expectedRevision:
        parsed.kind === "human" ? parsed.baseRevision : parsed.targetRevision,
      historyId: createId(),
      idempotencyKey,
      origin: mutationOrigin(parsed),
      payload: parsed.payload,
      payloadFingerprint,
      receiptId: createId(),
      targetId: parsed.targetId,
    });
    return receiptFromCommitResult(result, parsed.targetId);
  };

  return {
    mutate,
  };
}
