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
  findReceiptById: (
    receiptId: string,
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

interface MutationUndoScopeSnapshot {
  present: boolean;
  value: MutationPayload;
}

function mutationUndoScopeSnapshotFromSegments(
  value: unknown,
  segments: string[],
): MutationUndoScopeSnapshot {
  let current = value;
  for (const segment of segments) {
    if (current === null || typeof current !== "object") {
      return { present: false, value: null };
    }
    if (!Object.hasOwn(current, segment)) {
      return { present: false, value: null };
    }
    current = (current as Record<string, unknown>)[segment];
  }
  return { present: true, value: current as MutationPayload };
}

function mutationUndoScopeSnapshot(
  value: unknown,
  scope: string,
): MutationUndoScopeSnapshot {
  return mutationUndoScopeSnapshotFromSegments(
    value,
    mutationUndoScopeSegments(scope),
  );
}

function mutationUndoScopeSnapshotEqual(
  left: MutationUndoScopeSnapshot,
  right: MutationUndoScopeSnapshot,
): boolean {
  if (left.present !== right.present) {
    return false;
  }
  return (
    canonicalizeMutationPayload(left.value) ===
    canonicalizeMutationPayload(right.value)
  );
}

function mutationMergeAttributedValuesEqual(
  currentValue: unknown,
  afterValue: unknown,
  attributedValueKeys: readonly string[],
) {
  return attributedValueKeys.every((key) =>
    mutationUndoScopeSnapshotEqual(
      mutationUndoScopeSnapshot(currentValue, key),
      mutationUndoScopeSnapshot(afterValue, key),
    ),
  );
}

function isEmptyUndoObject(value: unknown): boolean {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    Object.keys(value).length === 0
  );
}

function pruneUndoScopeAncestors<TValue>(
  value: TValue,
  segments: string[],
  previousValue: unknown,
): TValue {
  for (let index = segments.length - 2; index >= 0; index -= 1) {
    const prefix = segments.slice(0, index + 1);
    const previousAncestor = mutationUndoScopeSnapshotFromSegments(
      previousValue,
      prefix,
    );
    if (previousAncestor.present) {
      break;
    }

    const currentAncestor = mutationUndoScopeSnapshotFromSegments(
      value,
      prefix,
    );
    if (
      !(currentAncestor.present && isEmptyUndoObject(currentAncestor.value))
    ) {
      break;
    }

    const parent = mutationUndoScopeSnapshotFromSegments(
      value,
      prefix.slice(0, -1),
    );
    if (
      !parent.present ||
      parent.value === null ||
      typeof parent.value !== "object"
    ) {
      break;
    }
    delete (parent.value as Record<string, unknown>)[prefix.at(-1) as string];
  }
  return value;
}

function replaceMutationUndoScope<TValue>(
  value: TValue,
  scope: string,
  replacement: MutationPayload,
  replacementPresent: boolean,
  previousValue: unknown,
): TValue {
  const segments = mutationUndoScopeSegments(scope);
  if (segments.length === 0) {
    if (!replacementPresent) {
      throw new MutationUndoNotSupportedError("invalid-plan", { kind: scope });
    }
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
      if (replacementPresent) {
        container[segment] = replacement;
      } else {
        delete container[segment];
      }
      break;
    }
    const next = container[segment];
    if (next === null || typeof next !== "object") {
      throw new MutationUndoNotSupportedError("invalid-plan", { kind: scope });
    }
    current = next;
  }
  return replacementPresent
    ? copy
    : pruneUndoScopeAncestors(copy, segments, previousValue);
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
  if (kind === "merge" && !candidate.merge) {
    throw new MutationUndoNotSupportedError("invalid-plan", {
      kind,
      targetId,
    });
  }
  const parsed = mutationUndoMetadataSchema.safeParse({
    after: candidate.after ?? null,
    before: candidate.before ?? null,
    kind,
    ...(candidate.merge ? { merge: candidate.merge } : {}),
    scope: candidate.scope,
  });
  if (!parsed.success) {
    throw new MutationUndoNotSupportedError("invalid-plan", {
      kind,
      targetId,
    });
  }
}

export function materializeMutationUndoMetadata<TValue>(
  plan: MutationUndoPlan,
  previousValue: TValue,
  nextValue: TValue,
): MutationUndoMetadata {
  assertMutationUndoPlan(plan);
  const after = mutationUndoScopeSnapshot(nextValue, plan.scope);
  const before = mutationUndoScopeSnapshot(previousValue, plan.scope);
  const metadata = {
    after: plan.after === undefined ? after.value : plan.after,
    afterPresent: after.present,
    before: plan.before === undefined ? before.value : plan.before,
    beforePresent: before.present,
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
  const prepare = async <TPayload extends MutationPayload>(
    command: MutationCommand<TPayload>,
  ) => {
    const parsed = mutationCommandSchema.parse(
      command,
    ) as MutationCommand<TPayload>;
    const payloadFingerprint = await fingerprintMutationPayload(parsed.payload);
    await verifyNonHumanSource(parsed, payloadFingerprint, sourceVerifier);
    return {
      idempotencyKey: mutationIdempotencyKey(parsed),
      parsed,
      payloadFingerprint,
    };
  };

  const replay = async <TPayload extends MutationPayload>(
    command: MutationCommand<TPayload>,
  ): Promise<MutationReceipt<TValue> | null> => {
    const { idempotencyKey, parsed, payloadFingerprint } =
      await prepare(command);
    const existing = await store.findReceipt(idempotencyKey);
    return existing
      ? replayReceiptOrThrow(existing, payloadFingerprint, parsed.targetId)
      : null;
  };

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
    const { idempotencyKey, parsed, payloadFingerprint } =
      await prepare(command);
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
    const sourceReceipt = await store.findReceiptById(receipt.id);
    const metadata = sourceReceipt?.undo;
    if (!(sourceReceipt && metadata)) {
      throw new MutationUndoNotSupportedError("not-recorded", {
        targetId: receipt.targetId,
      });
    }
    const parsed = mutationCommandSchema.parse(
      command,
    ) as MutationCommand<TPayload>;
    if (parsed.kind !== "human" || parsed.actor.type !== "User") {
      throw new MutationUndoNotSupportedError("non-human-actor", {
        targetId: sourceReceipt.targetId,
      });
    }
    if (parsed.targetId !== sourceReceipt.targetId) {
      throw new MutationConflictError(sourceReceipt.targetId);
    }
    if (metadata.kind === "merge" && !apply) {
      throw new MutationUndoNotSupportedError("merge-requires-apply", {
        kind: metadata.kind,
        targetId: sourceReceipt.targetId,
      });
    }

    const inverse: MutationApply<TValue, TPayload> = ({
      currentRevision,
      currentValue,
    }) => {
      const current = {
        id: sourceReceipt.targetId,
        revision: currentRevision,
        value: currentValue,
      } satisfies MutationTarget<TValue>;
      const currentScope = mutationUndoScopeSnapshot(
        currentValue,
        metadata.scope,
      );
      const undoScopeMatches =
        metadata.kind === "merge" && metadata.merge
          ? mutationMergeAttributedValuesEqual(
              currentValue,
              sourceReceipt.nextValue,
              metadata.merge.attributedValueKeys,
            )
          : mutationUndoScopeSnapshotEqual(currentScope, {
              present: metadata.afterPresent,
              value: metadata.after,
            });
      if (!undoScopeMatches) {
        throw new MutationUndoConflictError(
          current,
          sourceReceipt.id,
          metadata.scope,
        );
      }
      if (apply) {
        return apply({
          currentRevision,
          currentValue,
          nextValue: sourceReceipt.nextValue,
          previousValue: sourceReceipt.previousValue,
          undo: metadata,
        });
      }
      return replaceMutationUndoScope(
        currentValue,
        metadata.scope,
        metadata.before,
        metadata.beforePresent,
        sourceReceipt.previousValue,
      );
    };

    const result = await mutate(parsed, inverse, { undoOf: sourceReceipt.id });
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
    findReceiptById: (receiptId: string) => store.findReceiptById(receiptId),
    mutate,
    replay,
    stage,
    undo,
  };
}
