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
}

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
}

export interface MutationApplyContext<
  TValue,
  TPayload extends MutationPayload = MutationPayload,
> {
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

export interface MutationContract<TValue> {
  mutate: <TPayload extends MutationPayload>(
    command: MutationCommand<TPayload>,
    apply: MutationApply<TValue, TPayload>,
  ) => Promise<MutationReceipt<TValue>>;
}

export const MUTATION_UI_LABELS = {
  conflict: "Conflict",
  currentValue: "Current value",
  retry: "Retry",
} as const;
