import type {
  MutationMergeUndoMetadata,
  MutationOrigin,
  NonHumanMutationActor,
} from "@cantiara/api/mutation-and-undo";
import {
  canonicalizeMutationPayload,
  fingerprintMutationPayload,
  MUTATION_UI_LABELS,
  MUTATION_UNDO_FORBIDDEN_KINDS,
  MUTATION_UNDO_KINDS,
  type MutationActor,
  type MutationApply,
  type MutationAtomicContract,
  type MutationCommand,
  type MutationFinalizationReceipt,
  type MutationIdempotencyKey,
  type MutationOperationReference,
  type MutationOptions,
  type MutationPayload,
  type MutationReceipt,
  type MutationRollbackReason,
  type MutationRollbackReceipt,
  type MutationSource,
  type MutationStagedOperation,
  type MutationTarget,
  type MutationUndoApply,
  type MutationUndoKind,
  type MutationUndoMetadata,
  mutationCommandSchema,
  mutationUndoMetadataSchema,
} from "@cantiara/api/mutation-and-undo";

export type { MutationIdempotencyKey } from "@cantiara/api/mutation-and-undo";

export interface MutationUndoPlan {
  after?: MutationPayload;
  before?: MutationPayload;
  kind: MutationUndoKind;
  merge?: MutationMergeUndoMetadata;
  scope: string;
}

export interface MutationBarrierContext<TValue, TTransaction = unknown> {
  actor: MutationActor;
  expectedRevision: number;
  idempotencyKey: MutationIdempotencyKey;
  operationId?: string;
  origin: MutationOrigin;
  payload: MutationPayload;
  payloadFingerprint: string;
  target: MutationTarget<TValue> | null;
  targetId: string;
  transaction?: TTransaction;
}

export interface MutationBarrierChecks<TValue, TTransaction = unknown> {
  authorization?: (
    context: MutationBarrierContext<TValue, TTransaction>,
  ) => boolean | Promise<boolean>;
  quota?: (
    context: MutationBarrierContext<TValue, TTransaction>,
  ) => boolean | Promise<boolean>;
  scope?: (
    context: MutationBarrierContext<TValue, TTransaction>,
  ) => boolean | Promise<boolean>;
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
  undo?: MutationUndoPlan;
  undoOf?: string;
}

export interface MutationStageInput<
  TPayload extends MutationPayload = MutationPayload,
> {
  actor: MutationActor;
  expectedRevision: number;
  expiresAt: string;
  historyId: string;
  idempotencyKey: MutationIdempotencyKey;
  operationId: string;
  origin: MutationOrigin;
  payload: TPayload;
  payloadFingerprint: string;
  receiptId: string;
  stagedAt: string;
  targetId: string;
  undo?: MutationUndoPlan;
  undoOf?: string;
}

export interface MutationStagedRecord<TValue = MutationPayload>
  extends MutationStagedOperation<TValue> {
  historyId: string;
  payload: MutationPayload | undefined;
  receiptId: string;
}

export interface MutationFinalizeInput<
  TValue,
  TPayload extends MutationPayload = MutationPayload,
  TTransaction = unknown,
> extends MutationCommitInput<TValue, TPayload> {
  barrierChecks?: MutationBarrierChecks<TValue, TTransaction>;
  operationId: string;
}

export interface MutationCancelInput {
  completedAt: string;
  operationId: string;
  reason: MutationRollbackReason;
}

export type MutationStageResult<TValue> =
  | { operation: MutationStagedRecord<TValue>; status: "staged" }
  | {
      operation: MutationStagedRecord<TValue>;
      status: "committed" | "finalizing" | "rolled-back";
    }
  | { status: "conflict" };

export type MutationFinalizeResult<TValue> =
  | {
      operation: MutationStagedRecord<TValue>;
      receipt: MutationReceipt<TValue>;
      status: "committed";
    }
  | {
      operation: MutationStagedRecord<TValue>;
      receipt: MutationRollbackReceipt<TValue>;
      status: "rolled-back";
    }
  | { operationId: string; status: "finalizing" }
  | { status: "conflict" };

export type MutationCommitResult<TValue> =
  | { receipt: MutationReceipt<TValue>; status: "committed" | "replayed" }
  | { status: "conflict" }
  | { current: MutationTarget<TValue>; status: "stale" }
  | { status: "target-not-found" };

export interface MutationContractStore<TValue, TTransaction = unknown> {
  cancel?: (
    input: MutationCancelInput,
  ) => Promise<MutationFinalizeResult<TValue>>;
  cleanupExpired?: (now: Date) => Promise<number>;
  commit: <TPayload extends MutationPayload>(
    input: MutationCommitInput<TValue, TPayload>,
  ) => Promise<MutationCommitResult<TValue>>;
  finalize?: <TPayload extends MutationPayload>(
    input: MutationFinalizeInput<TValue, TPayload, TTransaction>,
  ) => Promise<MutationFinalizeResult<TValue>>;
  findReceipt: (
    key: MutationIdempotencyKey,
  ) => Promise<MutationReceipt<TValue> | null>;
  findStagedOperation?: (
    operationId: string,
  ) => Promise<MutationStagedRecord<TValue> | null>;
  getTarget: (targetId: string) => Promise<MutationTarget<TValue> | null>;
  stage?: <TPayload extends MutationPayload>(
    input: MutationStageInput<TPayload>,
  ) => Promise<MutationStageResult<TValue>>;
}

export interface MutationAtomicContractStore<TValue, TTransaction = unknown>
  extends Omit<
    MutationContractStore<TValue, TTransaction>,
    "cancel" | "cleanupExpired" | "finalize" | "findStagedOperation" | "stage"
  > {
  cancel: (
    input: MutationCancelInput,
  ) => Promise<MutationFinalizeResult<TValue>>;
  cleanupExpired: (now: Date) => Promise<number>;
  finalize: <TPayload extends MutationPayload>(
    input: MutationFinalizeInput<TValue, TPayload, TTransaction>,
  ) => Promise<MutationFinalizeResult<TValue>>;
  findStagedOperation: (
    operationId: string,
  ) => Promise<MutationStagedRecord<TValue> | null>;
  stage: <TPayload extends MutationPayload>(
    input: MutationStageInput<TPayload>,
  ) => Promise<MutationStageResult<TValue>>;
}

export interface MutationSourceVerifier {
  verify: (input: {
    actor: NonHumanMutationActor;
    payload: MutationPayload;
    source: MutationSource;
  }) => boolean | Promise<boolean>;
}

export interface MutationContractOptions<TValue, TTransaction = unknown> {
  barrierChecks?: MutationBarrierChecks<TValue, TTransaction>;
  createId?: () => string;
  now?: () => Date;
  sourceVerifier?: MutationSourceVerifier;
  stagingTtlMs?: number;
  store: MutationAtomicContractStore<TValue, TTransaction>;
}

export class MutationConflictError extends Error {
  readonly code = "CONFLICT" as const;
  readonly label = MUTATION_UI_LABELS.conflict;
  readonly current?: MutationTarget<unknown>;
  readonly currentRevision?: number;
  readonly currentValue?: unknown;
  readonly targetId: string;

  constructor(targetId: string, current?: MutationTarget<unknown>) {
    super(MUTATION_UI_LABELS.conflict);
    this.name = "MutationConflictError";
    this.current = current;
    this.currentRevision = current?.revision;
    this.currentValue = current?.value;
    this.targetId = targetId;
  }
}

export type MutationUndoNotSupportedReason =
  | "forbidden-kind"
  | "invalid-plan"
  | "merge-requires-apply"
  | "not-recorded"
  | "non-human-actor";

export class MutationUndoNotSupportedError extends Error {
  readonly code = "UNDO_NOT_SUPPORTED" as const;
  readonly label = MUTATION_UI_LABELS.undo;
  readonly kind: string | undefined;
  readonly reason: MutationUndoNotSupportedReason;
  readonly targetId: string | undefined;

  constructor(
    reason: MutationUndoNotSupportedReason,
    options: { kind?: string; targetId?: string } = {},
  ) {
    super(MUTATION_UI_LABELS.undo);
    this.name = "MutationUndoNotSupportedError";
    this.kind = options.kind;
    this.reason = reason;
    this.targetId = options.targetId;
  }
}

export class MutationUndoConflictError<TValue> extends MutationConflictError {
  readonly sourceReceiptId: string;
  readonly scope: string;

  constructor(
    current: MutationTarget<TValue>,
    sourceReceiptId: string,
    scope: string,
  ) {
    super(current.id, current as MutationTarget<unknown>);
    this.name = "MutationUndoConflictError";
    this.scope = scope;
    this.sourceReceiptId = sourceReceiptId;
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

export class MutationFinalizingError extends Error {
  readonly code = "FINALIZING" as const;
  readonly label = MUTATION_UI_LABELS.finalizing;
  readonly operationId: string;

  constructor(operationId: string) {
    super(MUTATION_UI_LABELS.finalizing);
    this.name = "MutationFinalizingError";
    this.operationId = operationId;
  }
}

export class MutationApplyFailedError extends Error {
  readonly code = "APPLY_FAILED" as const;
  readonly cause: unknown;

  constructor(cause: unknown, options: ErrorOptions = { cause }) {
    super("The mutation apply step failed.", options);
    this.name = "MutationApplyFailedError";
    this.cause = cause;
  }
}

export class MutationOperationNotFoundError extends Error {
  readonly code = "OPERATION_NOT_FOUND" as const;
  readonly operationId: string;

  constructor(operationId: string) {
    super("Mutation operation was not found.");
    this.name = "MutationOperationNotFoundError";
    this.operationId = operationId;
  }
}

function mutationUndoScopeSegments(scope: string): string[] {
  if (scope === "$") {
    return [];
  }
  if (scope.startsWith("/")) {
    return scope
      .slice(1)
      .split("/")
      .map((segment) => segment.replaceAll("~1", "/").replaceAll("~0", "~"));
  }
  return scope.split(".");
}

function mutationUndoScopeValue(
  value: unknown,
  scope: string,
): MutationPayload {
  let current = value;
  for (const segment of mutationUndoScopeSegments(scope)) {
    if (current === null || typeof current !== "object") {
      return null;
    }
    current = (current as Record<string, unknown>)[segment];
    if (current === undefined) {
      return null;
    }
  }
  return current as MutationPayload;
}

function mutationUndoScopeValueEqual(
  left: MutationPayload,
  right: MutationPayload,
): boolean {
  return (
    canonicalizeMutationPayload(left) === canonicalizeMutationPayload(right)
  );
}

function replaceMutationUndoScope<TValue>(
  value: TValue,
  scope: string,
  replacement: MutationPayload,
): TValue {
  const segments = mutationUndoScopeSegments(scope);
  if (segments.length === 0) {
    return replacement as TValue;
  }

  const copy = structuredClone(value);
  let current: unknown = copy;
  for (const [index, segment] of segments.entries()) {
    if (current === null || typeof current !== "object") {
      throw new MutationUndoNotSupportedError("invalid-plan", { kind: scope });
    }
    if (segment === "__proto__" || segment === "constructor") {
      throw new MutationUndoNotSupportedError("invalid-plan", { kind: scope });
    }
    const container = current as Record<string, unknown>;
    if (index === segments.length - 1) {
      container[segment] = replacement;
      break;
    }
    const next = container[segment];
    if (next === null || typeof next !== "object") {
      throw new MutationUndoNotSupportedError("invalid-plan", { kind: scope });
    }
    current = next;
  }
  return copy;
}

function assertMutationUndoPlan(
  plan: unknown,
  targetId?: string,
): asserts plan is MutationUndoPlan {
  if (plan === null || typeof plan !== "object") {
    throw new MutationUndoNotSupportedError("invalid-plan", { targetId });
  }

  const candidate = plan as Partial<MutationUndoPlan>;
  const kind = candidate.kind as string | undefined;
  if (
    kind &&
    (MUTATION_UNDO_FORBIDDEN_KINDS as readonly string[]).includes(kind)
  ) {
    throw new MutationUndoNotSupportedError("forbidden-kind", {
      kind,
      targetId,
    });
  }
  if (!(kind && (MUTATION_UNDO_KINDS as readonly string[]).includes(kind))) {
    throw new MutationUndoNotSupportedError("invalid-plan", { kind, targetId });
  }
  if (typeof candidate.scope !== "string" || candidate.scope.trim() === "") {
    throw new MutationUndoNotSupportedError("invalid-plan", { kind, targetId });
  }
  if (kind === "merge") {
    if (!candidate.merge) {
      throw new MutationUndoNotSupportedError("invalid-plan", {
        kind,
        targetId,
      });
    }
    const parsed = mutationUndoMetadataSchema.safeParse({
      after: candidate.after ?? null,
      before: candidate.before ?? null,
      kind,
      merge: candidate.merge,
      scope: candidate.scope,
    });
    if (!parsed.success) {
      throw new MutationUndoNotSupportedError("invalid-plan", {
        kind,
        targetId,
      });
    }
  }
}

export function materializeMutationUndoMetadata<TValue>(
  plan: MutationUndoPlan,
  previousValue: TValue,
  nextValue: TValue,
): MutationUndoMetadata {
  assertMutationUndoPlan(plan);
  const metadata = {
    after: plan.after ?? mutationUndoScopeValue(nextValue, plan.scope),
    before: plan.before ?? mutationUndoScopeValue(previousValue, plan.scope),
    kind: plan.kind,
    ...(plan.merge ? { merge: plan.merge } : {}),
    scope: plan.scope,
  } satisfies MutationUndoMetadata;
  return mutationUndoMetadataSchema.parse(metadata);
}

export function serializeMutationUndoPlan(
  plan: MutationUndoPlan,
): Record<string, unknown> {
  assertMutationUndoPlan(plan);
  return {
    ...(plan.after === undefined ? {} : { after: plan.after }),
    ...(plan.before === undefined ? {} : { before: plan.before }),
    kind: plan.kind,
    ...(plan.merge ? { merge: plan.merge } : {}),
    scope: plan.scope,
  };
}

function mutationMutationOptions(
  options: MutationOptions | MutationUndoPlan | undefined,
): MutationOptions {
  if (!options) {
    return {};
  }
  if ("kind" in options && "scope" in options) {
    return { undo: options };
  }
  return options;
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

function operationFromRecord<TValue>(
  record: MutationStagedRecord<TValue>,
): MutationStagedOperation<TValue> {
  return {
    actor: record.actor,
    completedAt: record.completedAt,
    expectedRevision: record.expectedRevision,
    expiresAt: record.expiresAt,
    id: record.id,
    idempotencyKey: record.idempotencyKey,
    origin: record.origin,
    payloadFingerprint: record.payloadFingerprint,
    receipt: record.receipt,
    rollbackReceipt: record.rollbackReceipt,
    stagedAt: record.stagedAt,
    status: record.status,
    targetId: record.targetId,
    ...(record.undo ? { undo: record.undo } : {}),
    ...(record.undoOf ? { undoOf: record.undoOf } : {}),
  };
}

function finalizationFromResult<TValue>(
  result: MutationFinalizeResult<TValue>,
  targetId: string,
): MutationFinalizationReceipt<TValue> {
  switch (result.status) {
    case "committed":
      return {
        operation: operationFromRecord(result.operation),
        receipt: result.receipt,
        status: "committed",
      };
    case "rolled-back":
      return {
        operation: operationFromRecord(result.operation),
        receipt: result.receipt,
        status: "rolled-back",
      };
    case "conflict":
      throw new MutationConflictError(targetId);
    case "finalizing":
      throw new MutationFinalizingError(result.operationId);
    default:
      throw new Error("Unknown mutation finalization result.");
  }
}

function operationIdFromReference(
  operation: MutationOperationReference,
): string {
  return typeof operation === "string" ? operation : operation.id;
}

function commandFromStagedRecord<TValue, TPayload extends MutationPayload>(
  record: MutationStagedRecord<TValue>,
): MutationCommand<TPayload> {
  if (record.payload === undefined) {
    throw new Error("A staged mutation has no payload to finalize.");
  }

  if (record.origin.kind === "human") {
    return {
      actor: record.actor as Extract<MutationActor, { type: "User" }>,
      baseRevision: record.expectedRevision,
      clientIdempotencyKey: record.origin.clientIdempotencyKey,
      kind: "human",
      payload: record.payload as TPayload,
      targetId: record.targetId,
    };
  }

  return {
    actor: record.actor as Exclude<MutationActor, { type: "User" }>,
    kind: "non-human",
    payload: record.payload as TPayload,
    source: {
      deliveryId: record.origin.deliveryId,
      payloadFingerprint: record.payloadFingerprint,
      sourceId: record.origin.sourceId,
    },
    targetId: record.targetId,
    targetRevision: record.expectedRevision,
  };
}

function commandMatchesStagedRecord<TValue, TPayload extends MutationPayload>(
  command: MutationCommand<TPayload>,
  record: MutationStagedRecord<TValue>,
  payloadFingerprint: string,
) {
  const key = mutationIdempotencyKey(command);
  const expectedRevision =
    command.kind === "human" ? command.baseRevision : command.targetRevision;
  return (
    key.key === record.idempotencyKey.key &&
    key.scope === record.idempotencyKey.scope &&
    payloadFingerprint === record.payloadFingerprint &&
    expectedRevision === record.expectedRevision &&
    command.targetId === record.targetId
  );
}

export function createMutationContract<TValue, TTransaction = unknown>({
  barrierChecks,
  createId = () => crypto.randomUUID(),
  now = () => new Date(),
  sourceVerifier,
  stagingTtlMs = 24 * 60 * 60 * 1000,
  store,
}: MutationContractOptions<
  TValue,
  TTransaction
>): MutationAtomicContract<TValue> {
  const mutate = async <TPayload extends MutationPayload>(
    command: MutationCommand<TPayload>,
    apply: MutationApply<TValue, TPayload>,
    options?: MutationOptions | MutationUndoPlan,
  ): Promise<MutationReceipt<TValue>> => {
    const mutationOptions = mutationMutationOptions(options);
    const undoPlan = mutationOptions.undo;
    if (undoPlan) {
      assertMutationUndoPlan(undoPlan);
    }
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
      undo: undoPlan as MutationUndoPlan | undefined,
      undoOf: mutationOptions.undoOf,
    });
    return receiptFromCommitResult(result, parsed.targetId);
  };

  const undo = async <TPayload extends MutationPayload>(
    receipt: MutationReceipt<TValue>,
    command: MutationCommand<TPayload>,
    apply?: MutationUndoApply<TValue>,
  ): Promise<MutationReceipt<TValue>> => {
    const metadata = receipt.undo;
    if (!metadata) {
      throw new MutationUndoNotSupportedError("not-recorded", {
        targetId: receipt.targetId,
      });
    }
    const parsed = mutationCommandSchema.parse(
      command,
    ) as MutationCommand<TPayload>;
    if (parsed.kind !== "human" || parsed.actor.type !== "User") {
      throw new MutationUndoNotSupportedError("non-human-actor", {
        targetId: receipt.targetId,
      });
    }
    if (parsed.targetId !== receipt.targetId) {
      throw new MutationConflictError(receipt.targetId);
    }
    if (metadata.kind === "merge" && !apply) {
      throw new MutationUndoNotSupportedError("merge-requires-apply", {
        kind: metadata.kind,
        targetId: receipt.targetId,
      });
    }

    const inverse: MutationApply<TValue, TPayload> = ({
      currentRevision,
      currentValue,
    }) => {
      const current = {
        id: receipt.targetId,
        revision: currentRevision,
        value: currentValue,
      } satisfies MutationTarget<TValue>;
      const currentScope = mutationUndoScopeValue(currentValue, metadata.scope);
      if (!mutationUndoScopeValueEqual(currentScope, metadata.after)) {
        throw new MutationUndoConflictError(
          current,
          receipt.id,
          metadata.scope,
        );
      }
      if (apply) {
        return apply({
          currentRevision,
          currentValue,
          nextValue: receipt.nextValue,
          previousValue: receipt.previousValue,
          undo: metadata,
        });
      }
      return replaceMutationUndoScope(
        currentValue,
        metadata.scope,
        metadata.before,
      );
    };

    const result = await mutate(parsed, inverse, { undoOf: receipt.id });
    return result;
  };

  const stage = async <TPayload extends MutationPayload>(
    command: MutationCommand<TPayload>,
    options?: MutationOptions | MutationUndoPlan,
  ): Promise<MutationStagedOperation<TValue>> => {
    const atomicStore = store;
    const mutationOptions = mutationMutationOptions(options);
    const undoPlan = mutationOptions.undo;
    if (undoPlan) {
      assertMutationUndoPlan(undoPlan);
    }
    const parsed = mutationCommandSchema.parse(
      command,
    ) as MutationCommand<TPayload>;
    const payloadFingerprint = await fingerprintMutationPayload(parsed.payload);
    await verifyNonHumanSource(parsed, payloadFingerprint, sourceVerifier);

    const stagedAt = now();
    const result = await atomicStore.stage({
      actor: parsed.actor,
      expectedRevision:
        parsed.kind === "human" ? parsed.baseRevision : parsed.targetRevision,
      expiresAt: new Date(stagedAt.getTime() + stagingTtlMs).toISOString(),
      historyId: createId(),
      idempotencyKey: mutationIdempotencyKey(parsed),
      operationId: createId(),
      origin: mutationOrigin(parsed),
      payload: parsed.payload,
      payloadFingerprint,
      receiptId: createId(),
      stagedAt: stagedAt.toISOString(),
      targetId: parsed.targetId,
      undo: undoPlan as MutationUndoPlan | undefined,
      undoOf: mutationOptions.undoOf,
    });

    if (result.status === "conflict") {
      throw new MutationConflictError(parsed.targetId);
    }
    return operationFromRecord(result.operation);
  };

  const finalize = async <TPayload extends MutationPayload>(
    operation: MutationOperationReference,
    apply: MutationApply<TValue, TPayload>,
    command?: MutationCommand<TPayload>,
    options?: MutationOptions | MutationUndoPlan,
    // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: Finalize coordinates command validation, durable replay, policy checks, and rollback recovery.
  ): Promise<MutationFinalizationReceipt<TValue>> => {
    const atomicStore = store;
    const mutationOptions = mutationMutationOptions(options);
    const undoPlan = mutationOptions.undo;
    if (undoPlan) {
      assertMutationUndoPlan(undoPlan);
    }
    const operationId = operationIdFromReference(operation);
    const staged = await atomicStore.findStagedOperation(operationId);
    if (!staged) {
      throw new MutationOperationNotFoundError(operationId);
    }

    if (command) {
      const parsed = mutationCommandSchema.parse(
        command,
      ) as MutationCommand<TPayload>;
      const payloadFingerprint = await fingerprintMutationPayload(
        parsed.payload,
      );
      if (
        !commandMatchesStagedRecord<TValue, TPayload>(
          parsed,
          staged,
          payloadFingerprint,
        )
      ) {
        throw new MutationConflictError(staged.targetId);
      }
    }

    if (staged.status === "committed" || staged.status === "rolled-back") {
      if (staged.status === "committed" && staged.receipt) {
        return {
          operation: operationFromRecord(staged),
          receipt: staged.receipt,
          status: "committed",
        };
      }
      if (staged.status === "rolled-back" && staged.rollbackReceipt) {
        return {
          operation: operationFromRecord(staged),
          receipt: staged.rollbackReceipt,
          status: "rolled-back",
        };
      }
      throw new Error("Finalized mutation operation has no durable receipt.");
    }
    const parsed = command
      ? (mutationCommandSchema.parse(command) as MutationCommand<TPayload>)
      : commandFromStagedRecord<TValue, TPayload>(staged);
    const payloadFingerprint = await fingerprintMutationPayload(parsed.payload);
    if (payloadFingerprint !== staged.payloadFingerprint) {
      throw new MutationConflictError(staged.targetId);
    }

    const finalizationChecks: MutationBarrierChecks<TValue, TTransaction> = {
      authorization: async (context) => {
        try {
          await verifyNonHumanSource(
            parsed,
            payloadFingerprint,
            sourceVerifier,
          );
        } catch {
          return false;
        }
        return barrierChecks?.authorization
          ? barrierChecks.authorization(context)
          : false;
      },
      quota: async (context) =>
        barrierChecks?.quota ? barrierChecks.quota(context) : false,
      scope: async (context) =>
        barrierChecks?.scope ? barrierChecks.scope(context) : false,
    };

    const applyWithFailureBoundary: MutationApply<TValue, TPayload> = async (
      context,
    ) => {
      try {
        return await apply(context);
      } catch (cause) {
        throw new MutationApplyFailedError(cause, { cause });
      }
    };

    let result: MutationFinalizeResult<TValue>;
    try {
      result = await atomicStore.finalize({
        actor: staged.actor,
        apply: applyWithFailureBoundary,
        barrierChecks: finalizationChecks,
        committedAt: now().toISOString(),
        expectedRevision: staged.expectedRevision,
        historyId: staged.historyId,
        idempotencyKey: staged.idempotencyKey,
        operationId,
        origin: staged.origin,
        payload: parsed.payload,
        payloadFingerprint: staged.payloadFingerprint,
        receiptId: staged.receiptId,
        targetId: staged.targetId,
        undo: undoPlan as MutationUndoPlan | undefined,
        undoOf: mutationOptions.undoOf,
      });
    } catch (error) {
      if (!(error instanceof MutationApplyFailedError)) {
        throw error;
      }

      let rollback: MutationFinalizeResult<TValue>;
      try {
        rollback = await atomicStore.cancel({
          completedAt: now().toISOString(),
          operationId,
          reason: "apply-failed",
        });
      } catch (rollbackError) {
        throw new MutationApplyFailedError(error, { cause: rollbackError });
      }
      return finalizationFromResult(rollback, staged.targetId);
    }
    return finalizationFromResult(result, staged.targetId);
  };

  const cancel = async (
    operation: MutationOperationReference,
  ): Promise<MutationFinalizationReceipt<TValue>> => {
    const atomicStore = store;
    const operationId = operationIdFromReference(operation);
    const staged = await atomicStore.findStagedOperation(operationId);
    if (!staged) {
      throw new MutationOperationNotFoundError(operationId);
    }
    const result = await atomicStore.cancel({
      completedAt: now().toISOString(),
      operationId,
      reason: "cancelled",
    });
    return finalizationFromResult(result, staged.targetId);
  };

  const cleanupExpired = (at = now()): Promise<number> => {
    const atomicStore = store;
    return atomicStore.cleanupExpired(at);
  };

  return {
    cancel,
    cleanupExpired,
    finalize,
    mutate,
    stage,
    undo,
  };
}
