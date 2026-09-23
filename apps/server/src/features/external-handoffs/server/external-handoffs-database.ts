import {
  type CancelExternalExecutionHandoffInput,
  type ExternalExecutionHandoff,
  type ExternalExecutionHandoffHistoryEvent,
  type ExternalExecutionHandoffStartCommand,
  type ExternalExecutionHandoffsAccess,
  externalExecutionHandoffHistoryEventSchema,
  externalExecutionHandoffHistoryEventTypeSchema,
  externalExecutionHandoffSchema,
  externalExecutionHandoffSelectedVersionsSchema,
  externalExecutionHandoffStatusSchema,
  externalExecutionHandoffWorkSnapshotSchema,
  isTerminalExternalExecutionHandoffStatus,
  type RecordExternalExecutionHandoffPackageExportInput,
  renderExternalExecutionHandoffPackage,
} from "@cantiara/api/external-handoffs";
import { fingerprintMutationPayload } from "@cantiara/api/mutation-and-undo";
import type { Database } from "@cantiara/db";
import { user, workspace } from "@cantiara/db/schema/auth";
import { mutationHistory } from "@cantiara/db/schema/mutation";
import { project } from "@cantiara/db/schema/project";
import { work } from "@cantiara/db/schema/work";
import { workExternalExecutionHandoff } from "@cantiara/db/schema/work-external-handoff";
import { and, asc, eq, isNull, sql } from "drizzle-orm";

type HandoffRecord = typeof workExternalExecutionHandoff.$inferSelect;
type MutationHistoryRecord = typeof mutationHistory.$inferSelect;

const historyEventKind = "external-execution-handoff-history-event";

function historyPayload(
  eventType: ExternalExecutionHandoffHistoryEvent["eventType"],
  handoffId: string,
) {
  return { eventType, handoffId, kind: historyEventKind };
}

function historyEventFromRecord(
  record: Pick<
    MutationHistoryRecord,
    "actorId" | "id" | "nextValue" | "occurredAt"
  >,
): ExternalExecutionHandoffHistoryEvent | null {
  if (
    typeof record.nextValue !== "object" ||
    record.nextValue === null ||
    !("kind" in record.nextValue) ||
    record.nextValue.kind !== historyEventKind ||
    !("eventType" in record.nextValue) ||
    !("handoffId" in record.nextValue)
  ) {
    return null;
  }
  const eventType = externalExecutionHandoffHistoryEventTypeSchema.safeParse(
    record.nextValue.eventType,
  );
  if (!eventType.success || typeof record.nextValue.handoffId !== "string") {
    return null;
  }
  return externalExecutionHandoffHistoryEventSchema.parse({
    actorId: record.actorId,
    eventId: record.id,
    eventType: eventType.data,
    handoffId: record.nextValue.handoffId,
    occurredAt: record.occurredAt.toISOString(),
  });
}

async function handoffHistoryValues(input: {
  accountId: string;
  clientEventId: string;
  eventType: ExternalExecutionHandoffHistoryEvent["eventType"];
  handoffId: string;
  occurredAt: Date;
  reason?: string;
  revision: number;
  workId: string;
}) {
  const idempotencyPayload = {
    clientEventId: input.clientEventId,
    eventType: input.eventType,
    handoffId: input.handoffId,
    workId: input.workId,
  };
  const eventIdFingerprint =
    await fingerprintMutationPayload(idempotencyPayload);
  const payloadFingerprint = await fingerprintMutationPayload({
    ...idempotencyPayload,
    ...(input.reason === undefined ? {} : { reason: input.reason }),
  });
  const eventId = `external-handoff-event-${eventIdFingerprint}`;
  const event = externalExecutionHandoffHistoryEventSchema.parse({
    actorId: input.accountId,
    eventId,
    eventType: input.eventType,
    handoffId: input.handoffId,
    occurredAt: input.occurredAt.toISOString(),
  });

  return {
    event,
    history: {
      actorId: input.accountId,
      actorType: "User",
      clientIdempotencyKey: input.clientEventId,
      id: eventId,
      nextValue: historyPayload(input.eventType, input.handoffId),
      occurredAt: input.occurredAt,
      originKind: "human",
      payloadFingerprint,
      previousValue: { handoffId: input.handoffId, kind: historyEventKind },
      revision: input.revision,
      targetId: input.workId,
    },
  };
}

async function cancellationAlreadyApplied(
  executor: Pick<Database, "select">,
  handoff: HandoffRecord,
  historyValues: Awaited<ReturnType<typeof handoffHistoryValues>>,
  reason: string,
) {
  const [existingHistory] = await executor
    .select({
      actorId: mutationHistory.actorId,
      id: mutationHistory.id,
      nextValue: mutationHistory.nextValue,
      occurredAt: mutationHistory.occurredAt,
      payloadFingerprint: mutationHistory.payloadFingerprint,
    })
    .from(mutationHistory)
    .where(eq(mutationHistory.id, historyValues.event.eventId))
    .limit(1);
  if (!existingHistory) {
    return false;
  }
  if (
    existingHistory.payloadFingerprint !==
      historyValues.history.payloadFingerprint ||
    handoff.status !== "Canceled" ||
    handoff.cancellationReason !== reason
  ) {
    throw new ExternalExecutionHandoffIdempotencyConflictError();
  }
  if (!historyEventFromRecord(existingHistory)) {
    throw new ExternalExecutionHandoffIdempotencyConflictError();
  }
  return true;
}

async function findExistingHandoff(
  executor: Pick<Database, "select">,
  command: ExternalExecutionHandoffStartCommand,
  fingerprint: string,
) {
  const [existing] = await executor
    .select()
    .from(workExternalExecutionHandoff)
    .where(
      and(
        eq(workExternalExecutionHandoff.workId, command.workId),
        eq(
          workExternalExecutionHandoff.clientIdempotencyKey,
          command.clientIdempotencyKey,
        ),
      ),
    )
    .limit(1);
  if (!existing) {
    return null;
  }
  if (existing.payloadFingerprint !== fingerprint) {
    throw new ExternalExecutionHandoffIdempotencyConflictError();
  }
  return toExternalExecutionHandoff(existing);
}

async function recordHandoffCreationHistory(
  executor: Pick<Database, "insert">,
  handoff: HandoffRecord | undefined,
  input: {
    accountId: string;
    clientEventId: string;
    occurredAt: Date;
    revision: number;
    workId: string;
  },
) {
  if (!handoff) {
    return;
  }
  const startedHistory = await handoffHistoryValues({
    ...input,
    eventType: "external-execution-handoff-started",
    handoffId: handoff.handoffId,
  });
  const packageProducedHistory = await handoffHistoryValues({
    ...input,
    eventType: "external-execution-handoff-package-produced",
    handoffId: handoff.handoffId,
  });
  await executor
    .insert(mutationHistory)
    .values([startedHistory.history, packageProducedHistory.history]);
}

export class ExternalExecutionHandoffStaleWorkError extends Error {
  readonly code = "EXTERNAL_HANDOFF_STALE_WORK" as const;

  constructor() {
    super("Work changed after the handoff form was opened.");
    this.name = "ExternalExecutionHandoffStaleWorkError";
  }
}

export class ExternalExecutionHandoffIdempotencyConflictError extends Error {
  readonly code = "EXTERNAL_HANDOFF_IDEMPOTENCY_CONFLICT" as const;

  constructor() {
    super("The handoff idempotency key was reused with a different payload.");
    this.name = "ExternalExecutionHandoffIdempotencyConflictError";
  }
}

export class ExternalExecutionHandoffTerminalError extends Error {
  readonly code = "EXTERNAL_HANDOFF_TERMINAL" as const;

  constructor() {
    super("A terminal handoff cannot be changed.");
    this.name = "ExternalExecutionHandoffTerminalError";
  }
}

function assertHandoffIsNotTerminal(status: string) {
  const parsedStatus = externalExecutionHandoffStatusSchema.parse(status);
  if (isTerminalExternalExecutionHandoffStatus(parsedStatus)) {
    throw new ExternalExecutionHandoffTerminalError();
  }
}

function toExternalExecutionHandoff(
  record: HandoffRecord,
): ExternalExecutionHandoff {
  const selectedVersions = externalExecutionHandoffSelectedVersionsSchema.parse(
    record.selectedVersions,
  );
  return externalExecutionHandoffSchema.parse({
    cancellationReason: record.cancellationReason,
    constraints: record.constraints,
    createdAt: record.createdAt.toISOString(),
    executor: record.executor,
    expectedOutput: record.expectedOutput,
    githubContext: selectedVersions.githubContext,
    handoffId: record.handoffId,
    includeWork: selectedVersions.work !== null,
    packageMarkdown: record.packageMarkdown,
    packageProducedAt: record.packageProducedAt.toISOString(),
    purpose: record.purpose,
    selectedWorkRevision: selectedVersions.work?.revision ?? null,
    status: record.status,
    workId: record.workId,
  });
}

function workSnapshot(record: typeof work.$inferSelect) {
  return externalExecutionHandoffWorkSnapshotSchema.parse({
    description: record.description,
    id: record.id,
    key: record.key,
    revision: record.revision,
    status: record.status,
    targetDate: record.targetDate,
    title: record.title,
    type: record.type,
  });
}

function handoffPayloadFingerprint(
  command: ExternalExecutionHandoffStartCommand,
) {
  return fingerprintMutationPayload({
    baseRevision: command.baseRevision,
    constraints: command.constraints,
    executor: command.executor,
    expectedOutput: command.expectedOutput,
    githubContext: command.githubContext,
    includeWork: command.includeWork,
    purpose: command.purpose,
    workId: command.workId,
  });
}

export interface DatabaseExternalExecutionHandoffOptions {
  newId?: () => string;
  now?: () => Date;
}

export function createDatabaseExternalExecutionHandoffs(
  database: Database,
  options: DatabaseExternalExecutionHandoffOptions = {},
): ExternalExecutionHandoffsAccess {
  const now = options.now ?? (() => new Date());
  const newId = options.newId ?? (() => `handoff-${crypto.randomUUID()}`);

  async function ownedWork(
    executor: Pick<Database, "select">,
    accountId: string,
    workId: string,
    lock: boolean,
    includeArchived = false,
  ) {
    const query = executor
      .select({ record: work })
      .from(work)
      .innerJoin(project, eq(work.projectId, project.id))
      .innerJoin(workspace, eq(project.workspaceId, workspace.id))
      .innerJoin(user, eq(workspace.ownerAccountId, user.id))
      .where(
        and(
          eq(work.id, workId),
          eq(user.id, accountId),
          ...(includeArchived ? [] : [isNull(work.archivedAt)]),
          isNull(project.archivedAt),
        ),
      )
      .limit(1);
    const rows = lock ? await query.for("update") : await query;
    return rows[0]?.record ?? null;
  }

  return {
    cancel(accountId, input: CancelExternalExecutionHandoffInput) {
      return database.transaction(async (transaction) => {
        const [owner] = await transaction
          .select({ workId: workExternalExecutionHandoff.workId })
          .from(workExternalExecutionHandoff)
          .where(eq(workExternalExecutionHandoff.handoffId, input.handoffId))
          .limit(1);
        if (!owner) {
          return null;
        }
        const ownerWork = await ownedWork(
          transaction,
          accountId,
          owner.workId,
          true,
        );
        if (!ownerWork) {
          return null;
        }
        const [handoff] = await transaction
          .select()
          .from(workExternalExecutionHandoff)
          .where(eq(workExternalExecutionHandoff.handoffId, input.handoffId))
          .limit(1)
          .for("update");
        if (!handoff) {
          return null;
        }

        const reason = input.reason.trim();
        const historyValues = await handoffHistoryValues({
          accountId,
          clientEventId: input.clientEventId,
          eventType: "external-execution-handoff-canceled",
          handoffId: handoff.handoffId,
          occurredAt: now(),
          reason,
          revision: ownerWork.revision,
          workId: ownerWork.id,
        });
        if (
          await cancellationAlreadyApplied(
            transaction,
            handoff,
            historyValues,
            reason,
          )
        ) {
          return toExternalExecutionHandoff(handoff);
        }

        assertHandoffIsNotTerminal(handoff.status);

        const [canceled] = await transaction
          .update(workExternalExecutionHandoff)
          .set({ cancellationReason: reason, status: "Canceled" })
          .where(eq(workExternalExecutionHandoff.handoffId, handoff.handoffId))
          .returning();
        if (!canceled) {
          return null;
        }
        await transaction.insert(mutationHistory).values(historyValues.history);
        return toExternalExecutionHandoff(canceled);
      });
    },

    async list(accountId, workId) {
      const ownerWork = await ownedWork(
        database,
        accountId,
        workId,
        false,
        true,
      );
      if (!ownerWork) {
        return null;
      }
      const records = await database
        .select()
        .from(workExternalExecutionHandoff)
        .where(eq(workExternalExecutionHandoff.workId, workId))
        .orderBy(
          asc(workExternalExecutionHandoff.createdAt),
          asc(workExternalExecutionHandoff.handoffId),
        );
      return records.map(toExternalExecutionHandoff);
    },

    async listHistory(accountId, workId) {
      const ownerWork = await ownedWork(
        database,
        accountId,
        workId,
        false,
        true,
      );
      if (!ownerWork) {
        return null;
      }
      const records = await database
        .select({
          actorId: mutationHistory.actorId,
          id: mutationHistory.id,
          nextValue: mutationHistory.nextValue,
          occurredAt: mutationHistory.occurredAt,
        })
        .from(mutationHistory)
        .where(
          and(
            eq(mutationHistory.targetId, workId),
            sql`${mutationHistory.nextValue}->>'kind' = ${historyEventKind}`,
          ),
        )
        .orderBy(asc(mutationHistory.occurredAt), asc(mutationHistory.id));
      return records.flatMap((record) => {
        const event = historyEventFromRecord(record);
        return event ? [event] : [];
      });
    },

    async start(accountId, command) {
      const fingerprint = await handoffPayloadFingerprint(command);
      return database.transaction(async (transaction) => {
        const ownerWork = await ownedWork(
          transaction,
          accountId,
          command.workId,
          true,
        );
        if (!ownerWork) {
          return null;
        }

        const existing = await findExistingHandoff(
          transaction,
          command,
          fingerprint,
        );
        if (existing) {
          return existing;
        }

        if (ownerWork.revision !== command.baseRevision) {
          throw new ExternalExecutionHandoffStaleWorkError();
        }

        const producedAt = now();
        const handoffId = newId();
        const snapshot = workSnapshot(ownerWork);
        const packageInput = {
          constraints: command.constraints,
          executor: command.executor,
          expectedOutput: command.expectedOutput,
          githubContext: command.githubContext,
          includeWork: command.includeWork,
          purpose: command.purpose,
          workId: command.workId,
        };
        const packageMarkdown = renderExternalExecutionHandoffPackage({
          handoffId,
          input: packageInput,
          producedAt: producedAt.toISOString(),
          work: snapshot,
        });
        const selectedVersions =
          externalExecutionHandoffSelectedVersionsSchema.parse({
            githubContext: command.githubContext,
            work: command.includeWork
              ? {
                  recordId: ownerWork.id,
                  recordType: "Work",
                  revision: ownerWork.revision,
                }
              : null,
          });
        const [created] = await transaction
          .insert(workExternalExecutionHandoff)
          .values({
            clientIdempotencyKey: command.clientIdempotencyKey,
            constraints: command.constraints,
            createdAt: producedAt,
            createdByAccountId: accountId,
            executor: command.executor,
            expectedOutput: command.expectedOutput,
            handoffId,
            packageMarkdown,
            packageProducedAt: producedAt,
            payloadFingerprint: fingerprint,
            purpose: command.purpose,
            selectedVersions,
            status: "Open",
            workId: ownerWork.id,
          })
          .returning();
        await recordHandoffCreationHistory(transaction, created, {
          accountId,
          clientEventId: command.clientIdempotencyKey,
          occurredAt: producedAt,
          revision: ownerWork.revision,
          workId: ownerWork.id,
        });
        return created ? toExternalExecutionHandoff(created) : null;
      });
    },

    recordPackageExport(
      accountId,
      input: RecordExternalExecutionHandoffPackageExportInput,
    ) {
      return database.transaction(async (transaction) => {
        const [handoff] = await transaction
          .select({
            handoffId: workExternalExecutionHandoff.handoffId,
            workId: workExternalExecutionHandoff.workId,
          })
          .from(workExternalExecutionHandoff)
          .where(eq(workExternalExecutionHandoff.handoffId, input.handoffId))
          .limit(1);
        if (!handoff) {
          return null;
        }
        const ownerWork = await ownedWork(
          transaction,
          accountId,
          handoff.workId,
          true,
          true,
        );
        if (!ownerWork) {
          return null;
        }

        const historyValues = await handoffHistoryValues({
          accountId,
          clientEventId: input.clientEventId,
          eventType: "external-execution-handoff-package-exported",
          handoffId: handoff.handoffId,
          occurredAt: now(),
          revision: ownerWork.revision,
          workId: ownerWork.id,
        });
        const [inserted] = await transaction
          .insert(mutationHistory)
          .values(historyValues.history)
          .onConflictDoNothing()
          .returning({ id: mutationHistory.id });
        if (inserted) {
          return historyValues.event;
        }

        const [existing] = await transaction
          .select({
            actorId: mutationHistory.actorId,
            id: mutationHistory.id,
            nextValue: mutationHistory.nextValue,
            occurredAt: mutationHistory.occurredAt,
            payloadFingerprint: mutationHistory.payloadFingerprint,
          })
          .from(mutationHistory)
          .where(eq(mutationHistory.id, historyValues.event.eventId))
          .limit(1);
        if (
          existing?.payloadFingerprint !==
          historyValues.history.payloadFingerprint
        ) {
          throw new ExternalExecutionHandoffIdempotencyConflictError();
        }
        const existingEvent = existing
          ? historyEventFromRecord(existing)
          : null;
        if (!existingEvent) {
          throw new ExternalExecutionHandoffIdempotencyConflictError();
        }
        return existingEvent;
      });
    },
  };
}
