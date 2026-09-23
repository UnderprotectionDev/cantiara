import canonicalize from "canonicalize";
import { z } from "zod";

export const MUTATION_ACTOR_TYPES = [
  "User",
  "System automation",
  "GitHub",
  "Authorized integration",
] as const;

export type MutationActorType = (typeof MUTATION_ACTOR_TYPES)[number];

export const mutationActorTypeSchema = z.enum(MUTATION_ACTOR_TYPES);

const identifierSchema = z.string().trim().min(1).max(255);
const revisionSchema = z.number().int().nonnegative().safe();
const idempotencyKeySchema = identifierSchema;
const payloadFingerprintSchema = z
  .string()
  .regex(/^[0-9a-f]{64}$/i, "Payload fingerprint must be a SHA-256 digest.");

export const mutationPayloadSchema = z.json();

export type MutationPayload = z.infer<typeof mutationPayloadSchema>;

export const MUTATION_UNDO_KINDS = [
  "field",
  "relation",
  "view-metadata",
  "atomic-transform",
  "merge",
] as const;

export const MUTATION_UNDO_FORBIDDEN_KINDS = [
  "permanent-delete",
  "security-redaction",
  "external-system-mutation",
  "published-static-export",
] as const;

export const mutationUndoKindSchema = z.enum(MUTATION_UNDO_KINDS);

export type MutationUndoKind = (typeof MUTATION_UNDO_KINDS)[number];

export interface MutationMergeUndoMetadata {
  attributedRelationIds: string[];
  attributedValueKeys: string[];
  mergeId: string;
  retiredTargetId: string;
}

const mutationMergeUndoMetadataSchema = z
  .object({
    attributedRelationIds: z.array(identifierSchema),
    attributedValueKeys: z.array(identifierSchema),
    mergeId: identifierSchema,
    retiredTargetId: identifierSchema,
  })
  .strict();

export const mutationUndoMetadataSchema = z
  .object({
    after: mutationPayloadSchema,
    afterPresent: z.boolean().default(true),
    before: mutationPayloadSchema,
    beforePresent: z.boolean().default(true),
    kind: mutationUndoKindSchema,
    merge: mutationMergeUndoMetadataSchema.optional(),
    scope: identifierSchema,
  })
  .strict();

export interface MutationUndoMetadata {
  after: MutationPayload;
  afterPresent: boolean;
  before: MutationPayload;
  beforePresent: boolean;
  kind: MutationUndoKind;
  merge?: MutationMergeUndoMetadata;
  scope: string;
}

export const humanMutationEnvelopeSchema = z
  .object({
    baseRevision: revisionSchema,
    clientIdempotencyKey: idempotencyKeySchema,
  })
  .strict();

export type HumanMutationEnvelope = z.infer<typeof humanMutationEnvelopeSchema>;

export function canonicalizeMutationPayload(payload: MutationPayload): string {
  const result = canonicalize(payload);
  if (result === undefined) {
    throw new TypeError("Mutation payload must contain JSON values only.");
  }
  return result;
}

export async function fingerprintMutationPayload(
  payload: MutationPayload,
): Promise<string> {
  const encoded = new TextEncoder().encode(
    canonicalizeMutationPayload(payload),
  );
  const digest = await crypto.subtle.digest("SHA-256", encoded);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

const userMutationActorSchema = z
  .object({
    actorId: identifierSchema,
    type: z.literal("User"),
  })
  .strict();

const systemAutomationMutationActorSchema = z
  .object({
    actorId: identifierSchema,
    type: z.literal("System automation"),
  })
  .strict();

const githubMutationActorSchema = z
  .object({
    actorId: identifierSchema,
    type: z.literal("GitHub"),
  })
  .strict();

const authorizedIntegrationMutationActorSchema = z
  .object({
    actorId: identifierSchema,
    authorizingUserId: identifierSchema,
    type: z.literal("Authorized integration"),
  })
  .strict();

export const mutationActorSchema = z.discriminatedUnion("type", [
  userMutationActorSchema,
  systemAutomationMutationActorSchema,
  githubMutationActorSchema,
  authorizedIntegrationMutationActorSchema,
]);

export type MutationActor = z.infer<typeof mutationActorSchema>;
export type UserMutationActor = z.infer<typeof userMutationActorSchema>;
export type NonHumanMutationActor = Exclude<MutationActor, UserMutationActor>;

export const mutationSourceSchema = z
  .object({
    deliveryId: identifierSchema,
    payloadFingerprint: payloadFingerprintSchema,
    sourceId: identifierSchema,
  })
  .strict();

export type MutationSource = z.infer<typeof mutationSourceSchema>;

export const humanMutationCommandSchema = z
  .object({
    actor: userMutationActorSchema,
    baseRevision: revisionSchema,
    clientIdempotencyKey: idempotencyKeySchema,
    kind: z.literal("human"),
    payload: mutationPayloadSchema,
    targetId: identifierSchema,
  })
  .strict();

export type HumanMutationCommand<
  TPayload extends MutationPayload = MutationPayload,
> = Omit<z.infer<typeof humanMutationCommandSchema>, "payload"> & {
  payload: TPayload;
};

export const nonHumanMutationCommandSchema = z
  .object({
    actor: z.union([
      systemAutomationMutationActorSchema,
      githubMutationActorSchema,
      authorizedIntegrationMutationActorSchema,
    ]),
    kind: z.literal("non-human"),
    payload: mutationPayloadSchema,
    source: mutationSourceSchema,
    targetId: identifierSchema,
    targetRevision: revisionSchema,
  })
  .strict();

export type NonHumanMutationCommand<
  TPayload extends MutationPayload = MutationPayload,
> = Omit<z.infer<typeof nonHumanMutationCommandSchema>, "payload"> & {
  payload: TPayload;
};

export const mutationCommandSchema = z.discriminatedUnion("kind", [
  humanMutationCommandSchema,
  nonHumanMutationCommandSchema,
]);

export type MutationCommand<
  TPayload extends MutationPayload = MutationPayload,
> = HumanMutationCommand<TPayload> | NonHumanMutationCommand<TPayload>;

export type MutationOrigin =
  | {
      clientIdempotencyKey: string;
      kind: "human";
    }
  | {
      deliveryId: string;
      kind: "source";
      sourceId: string;
    };

export const mutationOriginSchema = z.discriminatedUnion("kind", [
  z
    .object({
      clientIdempotencyKey: idempotencyKeySchema,
      kind: z.literal("human"),
    })
    .strict(),
  z
    .object({
      deliveryId: identifierSchema,
      kind: z.literal("source"),
      sourceId: identifierSchema,
    })
    .strict(),
]);

export interface MutationTarget<TValue = MutationPayload> {
  id: string;
  revision: number;
  value: TValue;
}

export interface MutationReceipt<TValue = MutationPayload> {
  actor: MutationActor;
  committedAt: string;
  id: string;
  nextValue: TValue;
  origin: MutationOrigin;
  payloadFingerprint: string;
  previousValue: TValue;
  revision: number;
  targetId: string;
  undo?: MutationUndoMetadata;
  undoOf?: string;
}

export interface MutationIdempotencyKey {
  key: string;
  scope: string;
}

export const MUTATION_OPERATION_STATUSES = [
  "staged",
  "finalizing",
  "committed",
  "rolled-back",
] as const;

export const mutationOperationStatusSchema = z.enum(
  MUTATION_OPERATION_STATUSES,
);

export type MutationOperationStatus =
  (typeof MUTATION_OPERATION_STATUSES)[number];

export const MUTATION_ROLLBACK_REASONS = [
  "cancelled",
  "expired",
  "stale-base-revision",
  "target-not-found",
  "authorization",
  "scope",
  "quota",
  "apply-failed",
] as const;

export const mutationRollbackReasonSchema = z.enum(MUTATION_ROLLBACK_REASONS);

export type MutationRollbackReason = (typeof MUTATION_ROLLBACK_REASONS)[number];

export interface MutationRollbackReceipt<TValue = MutationPayload> {
  actor: MutationActor;
  completedAt: string;
  current?: MutationTarget<TValue>;
  expectedRevision: number;
  id: string;
  idempotencyKey: MutationIdempotencyKey;
  operationId: string;
  origin: MutationOrigin;
  payloadFingerprint: string;
  reason: MutationRollbackReason;
  status: "rolled-back";
  targetId: string;
}

export interface MutationStagedOperation<TValue = MutationPayload> {
  actor: MutationActor;
  completedAt: string | null;
  expectedRevision: number;
  expiresAt: string;
  id: string;
  idempotencyKey: MutationIdempotencyKey;
  origin: MutationOrigin;
  payloadFingerprint: string;
  receipt: MutationReceipt<TValue> | null;
  rollbackReceipt: MutationRollbackReceipt<TValue> | null;
  stagedAt: string;
  status: MutationOperationStatus;
  targetId: string;
  undo?: MutationUndoMetadata;
  undoOf?: string;
}

export type MutationOperationReference =
  | string
  | Pick<MutationStagedOperation, "id">;

export type MutationFinalizationReceipt<TValue = MutationPayload> =
  | {
      operation: MutationStagedOperation<TValue>;
      receipt: MutationReceipt<TValue>;
      status: "committed";
    }
  | {
      operation: MutationStagedOperation<TValue>;
      receipt: MutationRollbackReceipt<TValue>;
      status: "rolled-back";
    };

export interface MutationHistoryEntry<TValue = MutationPayload> {
  actor: MutationActor;
  id: string;
  nextValue: TValue;
  occurredAt: string;
  origin: MutationOrigin;
  payloadFingerprint: string;
  previousValue: TValue;
  revision: number;
  targetId: string;
  undo?: MutationUndoMetadata;
  undoOf?: string;
}

export interface MutationApplyContext<
  TValue,
  TPayload extends MutationPayload = MutationPayload,
> {
  committedAt: string;
  currentRevision: number;
  currentValue: TValue;
  payload: TPayload;
}

export type MutationApply<
  TValue,
  TPayload extends MutationPayload = MutationPayload,
> = (
  context: MutationApplyContext<TValue, TPayload>,
) => TValue | Promise<TValue>;

export interface MutationUndoApplyContext<TValue> {
  currentRevision: number;
  currentValue: TValue;
  nextValue: TValue;
  previousValue: TValue;
  undo: MutationUndoMetadata;
}

export type MutationUndoApply<TValue> = (
  context: MutationUndoApplyContext<TValue>,
) => TValue | Promise<TValue>;

export interface MutationOptions {
  undo?: unknown;
  undoOf?: string;
}

export interface MutationContract<TValue> {
  cancel?: (
    operation: MutationOperationReference,
  ) => Promise<MutationFinalizationReceipt<TValue>>;
  cleanupExpired?: (now?: Date) => Promise<number>;
  finalize?: <TPayload extends MutationPayload>(
    operation: MutationOperationReference,
    apply: MutationApply<TValue, TPayload>,
    command?: MutationCommand<TPayload>,
    options?: MutationOptions,
  ) => Promise<MutationFinalizationReceipt<TValue>>;
  findReceiptById?: (
    receiptId: string,
  ) => Promise<MutationReceipt<TValue> | null>;
  mutate: <TPayload extends MutationPayload>(
    command: MutationCommand<TPayload>,
    apply: MutationApply<TValue, TPayload>,
    options?: MutationOptions,
  ) => Promise<MutationReceipt<TValue>>;
  replay: <TPayload extends MutationPayload>(
    command: MutationCommand<TPayload>,
  ) => Promise<MutationReceipt<TValue> | null>;
  stage?: <TPayload extends MutationPayload>(
    command: MutationCommand<TPayload>,
    options?: MutationOptions,
  ) => Promise<MutationStagedOperation<TValue>>;
  undo?: <TPayload extends MutationPayload>(
    receipt: MutationReceipt<TValue>,
    command: MutationCommand<TPayload>,
    apply?: MutationUndoApply<TValue>,
  ) => Promise<MutationReceipt<TValue>>;
}

export interface MutationAtomicContract<TValue>
  extends MutationContract<TValue> {
  cancel: (
    operation: MutationOperationReference,
  ) => Promise<MutationFinalizationReceipt<TValue>>;
  cleanupExpired: (now?: Date) => Promise<number>;
  finalize: <TPayload extends MutationPayload>(
    operation: MutationOperationReference,
    apply: MutationApply<TValue, TPayload>,
    command?: MutationCommand<TPayload>,
    options?: MutationOptions,
  ) => Promise<MutationFinalizationReceipt<TValue>>;
  stage: <TPayload extends MutationPayload>(
    command: MutationCommand<TPayload>,
    options?: MutationOptions,
  ) => Promise<MutationStagedOperation<TValue>>;
  undo: <TPayload extends MutationPayload>(
    receipt: MutationReceipt<TValue>,
    command: MutationCommand<TPayload>,
    apply?: MutationUndoApply<TValue>,
  ) => Promise<MutationReceipt<TValue>>;
}

export const MUTATION_UI_LABELS = {
  cancel: "Cancel",
  conflict: "Conflict",
  currentValue: "Current value",
  finalizing: "Finalizing",
  retry: "Retry",
  undo: "Undo",
} as const;
