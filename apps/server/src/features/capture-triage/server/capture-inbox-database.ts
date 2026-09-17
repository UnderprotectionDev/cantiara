import {
  type CaptureInboxItem,
  captureInboxItemSchema,
  type NormalizedCaptureInput,
} from "@cantiara/api/capture-triage";
import {
  fingerprintMutationPayload,
  type MutationContract,
  type MutationPayload,
  type MutationTarget,
} from "@cantiara/api/mutation-and-undo";
import type { Database } from "@cantiara/db";
import { captureInboxItem } from "@cantiara/db/schema/capture-triage";
import { mutationTarget } from "@cantiara/db/schema/mutation";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import type {
  MutationDatabaseExecutor,
  MutationDatabaseTargetAdapter,
} from "../../mutation-and-undo/server/mutation-contract-database";
import {
  CaptureInboxError,
  type CaptureInboxStore,
  type CaptureInboxWorkCreate,
  createCaptureInbox,
} from "./capture-inbox";

type CaptureInboxDatabaseRecord = typeof captureInboxItem.$inferSelect;
type MutationTargetDatabaseRecord = typeof mutationTarget.$inferSelect;

const captureMutationValueSchema = z
  .object({
    accountId: z.string().trim().min(1),
    clientIdempotencyKey: z.string().trim().min(1),
    item: captureInboxItemSchema,
    payloadFingerprint: z.string().regex(/^[0-9a-f]{64}$/i),
  })
  .strict();

type CaptureMutationValue = z.infer<typeof captureMutationValueSchema>;

function toCaptureInboxItem(
  record: CaptureInboxDatabaseRecord,
): CaptureInboxItem {
  return captureInboxItemSchema.parse({
    content: record.content,
    createdAt: record.createdAt.toISOString(),
    fields: record.fields,
    id: record.id,
    projectId: record.projectId,
    template: record.template,
  });
}

function capturePayload(input: NormalizedCaptureInput) {
  return {
    content: input.content,
    fields: input.fields,
    projectId: input.projectId,
    template: input.template,
  };
}

function findCaptureByIdempotencyKey(
  database: Database,
  accountId: string,
  clientIdempotencyKey: string,
) {
  return database.query.captureInboxItem.findFirst({
    where: and(
      eq(captureInboxItem.accountId, accountId),
      eq(captureInboxItem.clientIdempotencyKey, clientIdempotencyKey),
    ),
  });
}

function toMutationTarget(
  record: MutationTargetDatabaseRecord,
): MutationTarget<MutationPayload> {
  return {
    id: record.id,
    revision: record.revision,
    value: record.value as MutationPayload,
  };
}

function defaultMutationTarget(
  targetId: string,
): MutationTarget<MutationPayload> {
  return { id: targetId, revision: 0, value: {} };
}

async function insertCaptureMutationValue(
  executor: MutationDatabaseExecutor,
  value: CaptureMutationValue,
) {
  const [inserted] = await executor
    .insert(captureInboxItem)
    .values({
      accountId: value.accountId,
      clientIdempotencyKey: value.clientIdempotencyKey,
      content: value.item.content,
      createdAt: new Date(value.item.createdAt),
      fields: value.item.fields,
      id: value.item.id,
      payloadFingerprint: value.payloadFingerprint,
      projectId: value.item.projectId,
      template: value.item.template,
    })
    .onConflictDoNothing({
      target: [
        captureInboxItem.accountId,
        captureInboxItem.clientIdempotencyKey,
      ],
    })
    .returning();
  if (!inserted) {
    throw new CaptureInboxError(
      "CAPTURE_IDEMPOTENCY_CONFLICT",
      "The capture key was already used for different content.",
    );
  }
}

export const captureInboxMutationTarget: MutationDatabaseTargetAdapter<MutationPayload> =
  {
    async find(executor, targetId, lock) {
      const query = executor
        .select()
        .from(mutationTarget)
        .where(eq(mutationTarget.id, targetId))
        .limit(1);
      const records = lock ? await query.for("update") : await query;
      const [record] = records;
      return record
        ? toMutationTarget(record)
        : defaultMutationTarget(targetId);
    },

    async update(executor, input) {
      const value = captureMutationValueSchema.parse(input.nextValue);
      const [updated] = await executor
        .update(mutationTarget)
        .set({
          revision: input.expectedRevision + 1,
          updatedAt: input.committedAt,
          value: input.nextValue,
        })
        .where(
          and(
            eq(mutationTarget.id, input.targetId),
            eq(mutationTarget.revision, input.expectedRevision),
          ),
        )
        .returning();
      if (updated) {
        await insertCaptureMutationValue(executor, value);
        return toMutationTarget(updated);
      }

      const [inserted] = await executor
        .insert(mutationTarget)
        .values({
          id: input.targetId,
          revision: input.expectedRevision + 1,
          value: input.nextValue,
          updatedAt: input.committedAt,
        })
        .onConflictDoNothing()
        .returning();
      if (!inserted) {
        return null;
      }
      await insertCaptureMutationValue(executor, value);
      return toMutationTarget(inserted);
    },
  };

function replayExistingCapture(
  record: CaptureInboxDatabaseRecord | undefined,
  payloadFingerprint: string,
) {
  if (!record) {
    return;
  }
  if (record.payloadFingerprint !== payloadFingerprint) {
    throw new CaptureInboxError(
      "CAPTURE_IDEMPOTENCY_CONFLICT",
      "The capture key was already used for different content.",
    );
  }
  return toCaptureInboxItem(record);
}

export function createDatabaseCaptureInbox(
  database: Database,
  workCreate: CaptureInboxWorkCreate,
  mutationContract: MutationContract<MutationPayload>,
) {
  const store: CaptureInboxStore = {
    async insert(accountId, input) {
      const payloadFingerprint = await fingerprintMutationPayload(
        capturePayload(input),
      );
      if (input.clientIdempotencyKey) {
        const existing = await findCaptureByIdempotencyKey(
          database,
          accountId,
          input.clientIdempotencyKey,
        );
        const replayed = replayExistingCapture(existing, payloadFingerprint);
        if (replayed) {
          return replayed;
        }
      }

      const clientIdempotencyKey =
        input.clientIdempotencyKey ?? crypto.randomUUID();
      const item = captureInboxItemSchema.parse({
        content: input.content,
        createdAt: new Date().toISOString(),
        fields: input.fields,
        id: crypto.randomUUID(),
        projectId: input.projectId,
        template: input.template,
      });
      const nextValue = {
        accountId,
        clientIdempotencyKey,
        item,
        payloadFingerprint,
      } satisfies CaptureMutationValue;
      const receipt = await mutationContract.mutate(
        {
          actor: { actorId: accountId, type: "User" },
          baseRevision: 0,
          clientIdempotencyKey,
          kind: "human",
          payload: capturePayload(input),
          targetId: `capture-inbox:${accountId}:${clientIdempotencyKey}`,
        },
        () => nextValue,
      );
      return captureMutationValueSchema.parse(receipt.nextValue).item;
    },

    async list(accountId) {
      const records = await database.query.captureInboxItem.findMany({
        orderBy: [desc(captureInboxItem.createdAt)],
        where: eq(captureInboxItem.accountId, accountId),
      });
      return records.map(toCaptureInboxItem);
    },
  };

  return createCaptureInbox({ store, workCreate });
}
