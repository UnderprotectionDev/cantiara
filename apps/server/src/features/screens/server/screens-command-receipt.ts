import {
  fingerprintMutationPayload,
  mutationPayloadSchema,
} from "@cantiara/api/mutation-and-undo";
import type { LinkedBlockChangeResult } from "@cantiara/api/screens";
import type { Database } from "@cantiara/db";
import { mutationReceipt } from "@cantiara/db/schema/mutation";
import { and, eq, sql } from "drizzle-orm";

interface ScreenCommand<T> {
  accountId: string;
  clientIdempotencyKey?: string;
  expectedRevision?: number;
  operation:
    | "create"
    | "create-from-template"
    | "save-template"
    | "create-linked-block"
    | "apply-linked-block-change"
    | "save-version";
  payload: { value: unknown } | { fingerprint: string };
  revision?: (result: T) => number;
}

export class ScreenCommandConflictError extends Error {
  readonly code = "SCREEN_COMMAND_CONFLICT";

  constructor() {
    super("This Screen command was already used for different content.");
    this.name = "ScreenCommandConflictError";
  }
}

/** The caller verifies the Project scope and shares its write transaction. */
export async function commitScreenCommand<
  T extends { id: string } | LinkedBlockChangeResult,
>(
  transaction: Pick<Database, "execute" | "insert" | "select">,
  {
    accountId,
    clientIdempotencyKey,
    expectedRevision,
    operation,
    payload,
    revision,
  }: ScreenCommand<T>,
  create: () => Promise<T | null>,
): Promise<T | null> {
  if (!clientIdempotencyKey) {
    return create();
  }

  const idempotencyScope = `screen:${operation}:${accountId}`;
  const payloadFingerprint =
    "fingerprint" in payload
      ? payload.fingerprint
      : await fingerprintMutationPayload(
          mutationPayloadSchema.parse(payload.value),
        );
  // Serialize even conflicting commands that take a different Project lock.
  const lock = JSON.stringify([idempotencyScope, clientIdempotencyKey]);
  await transaction.execute(
    sql`select pg_advisory_xact_lock(hashtext(${lock}))`,
  );
  const [receipt] = await transaction
    .select({
      nextValue: mutationReceipt.nextValue,
      payloadFingerprint: mutationReceipt.payloadFingerprint,
    })
    .from(mutationReceipt)
    .where(
      and(
        eq(mutationReceipt.idempotencyScope, idempotencyScope),
        eq(mutationReceipt.idempotencyKey, clientIdempotencyKey),
      ),
    )
    .limit(1);
  if (receipt) {
    if (receipt.payloadFingerprint !== payloadFingerprint) {
      throw new ScreenCommandConflictError();
    }
    return receipt.nextValue as T;
  }

  const created = await create();
  if (!created) {
    return null;
  }
  await transaction.insert(mutationReceipt).values({
    actorId: accountId,
    actorType: "User",
    clientIdempotencyKey,
    committedAt: new Date(),
    expectedRevision: expectedRevision ?? 0,
    id: crypto.randomUUID(),
    idempotencyKey: clientIdempotencyKey,
    idempotencyScope,
    nextValue: created,
    originKind: "human",
    payloadFingerprint,
    previousValue: {},
    revision: revision?.(created) ?? 1,
    targetId: "id" in created ? created.id : created.definition.id,
  });
  return created;
}
