import {
  type CancelExternalExecutionHandoffInput,
  type ConfirmExternalExecutionHandoffReconcileInput,
  confirmExternalExecutionHandoffReconcileInputSchema,
  type ExternalExecutionHandoff,
  type ExternalExecutionHandoffHistoryEvent,
  type ExternalExecutionHandoffReconcilePreview,
  type ExternalExecutionHandoffRelatedWork,
  type ExternalExecutionHandoffStartCommand,
  type ExternalExecutionHandoffsAccess,
  externalExecutionHandoffHistoryEventSchema,
  externalExecutionHandoffHistoryEventTypeSchema,
  externalExecutionHandoffReconcileDecisionSchema,
  externalExecutionHandoffReconcilePreviewSchema,
  externalExecutionHandoffRelatedWorkSchema,
  externalExecutionHandoffResultInputSchema,
  externalExecutionHandoffResultSchema,
  externalExecutionHandoffSchema,
  externalExecutionHandoffSelectedVersionsSchema,
  externalExecutionHandoffStatusSchema,
  externalExecutionHandoffWorkSnapshotSchema,
  isTerminalExternalExecutionHandoffStatus,
  type PreviewExternalExecutionHandoffReconcileInput,
  previewExternalExecutionHandoffReconcileInputSchema,
  type RecordExternalExecutionHandoffPackageExportInput,
  type RecordExternalExecutionHandoffReturnInput,
  recordExternalExecutionHandoffReturnInputSchema,
  renderExternalExecutionHandoffPackage,
} from "@cantiara/api/external-handoffs";
import { fingerprintMutationPayload } from "@cantiara/api/mutation-and-undo";
import type { RelationCreatePreviewInput } from "@cantiara/api/relations";
import type { Database } from "@cantiara/db";
import { user, workspace } from "@cantiara/db/schema/auth";
import { mutationHistory } from "@cantiara/db/schema/mutation";
import { project } from "@cantiara/db/schema/project";
import { work } from "@cantiara/db/schema/work";
import { workExternalExecutionHandoff } from "@cantiara/db/schema/work-external-handoff";
import { and, asc, eq, inArray, isNull, ne, sql } from "drizzle-orm";

import { createDatabaseRelations } from "../../relations/server/relations";
import { createDatabaseWorkLifecycle } from "../../work-lifecycle/server/work-lifecycle-database";

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

export class ExternalExecutionHandoffReturnUnavailableError extends Error {
  readonly code = "EXTERNAL_HANDOFF_RETURN_UNAVAILABLE" as const;

  constructor() {
    super("This handoff cannot accept a return in its current state.");
    this.name = "ExternalExecutionHandoffReturnUnavailableError";
  }
}

export class ExternalExecutionHandoffReconcilePreviewRequiredError extends Error {
  readonly code = "EXTERNAL_HANDOFF_RECONCILE_PREVIEW_REQUIRED" as const;

  constructor() {
    super("Review the current reconcile preview before confirming.");
    this.name = "ExternalExecutionHandoffReconcilePreviewRequiredError";
  }
}

export class ExternalExecutionHandoffReconcileUnavailableError extends Error {
  readonly code = "EXTERNAL_HANDOFF_RECONCILE_UNAVAILABLE" as const;

  constructor() {
    super("This handoff cannot be reconciled in its current state.");
    this.name = "ExternalExecutionHandoffReconcileUnavailableError";
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
    reconcileDecision: record.reconcileDecision
      ? externalExecutionHandoffReconcileDecisionSchema.parse(
          record.reconcileDecision,
        )
      : null,
    result: record.result
      ? externalExecutionHandoffResultSchema.parse(record.result)
      : null,
    selectedWorkRevision: selectedVersions.work?.revision ?? null,
    status: record.status,
    workId: record.workId,
  });
}

function relationPreviewInput(
  workId: string,
  proposal: PreviewExternalExecutionHandoffReconcileInput["proposedRelations"][number],
): RelationCreatePreviewInput {
  const blockedBy = proposal.kind === "Blocked by";
  const kind = (() => {
    switch (proposal.kind) {
      case "Blocked by":
        return "Blocks";
      default:
        return proposal.kind;
    }
  })();
  return {
    kind,
    source: {
      recordId: blockedBy ? proposal.targetWorkId : workId,
      recordType: "Work",
    },
    target: {
      recordId: blockedBy ? workId : proposal.targetWorkId,
      recordType: "Work",
    },
  };
}

async function reconcilePreview(
  database: Database,
  accountId: string,
  handoff: HandoffRecord,
  ownerWork: typeof work.$inferSelect,
  rawPlan: Pick<
    PreviewExternalExecutionHandoffReconcileInput,
    "followUpWorks" | "proposedRelations"
  >,
): Promise<ExternalExecutionHandoffReconcilePreview> {
  const plan = previewExternalExecutionHandoffReconcileInputSchema
    .pick({ followUpWorks: true, proposedRelations: true })
    .parse(rawPlan);
  const targetWorkIds = [
    ...new Set(plan.proposedRelations.map((proposal) => proposal.targetWorkId)),
  ];
  if (targetWorkIds.length > 0) {
    const sameProjectTargets = await database
      .select({ id: work.id })
      .from(work)
      .where(
        and(
          eq(work.projectId, ownerWork.projectId),
          inArray(work.id, targetWorkIds),
          ne(work.id, ownerWork.id),
          isNull(work.archivedAt),
        ),
      );
    if (sameProjectTargets.length !== targetWorkIds.length) {
      throw new ExternalExecutionHandoffReconcileUnavailableError();
    }
  }
  const relationAccess = createDatabaseRelations(database);
  const relationPreviews = await Promise.all(
    plan.proposedRelations.map(async (proposal) => {
      const relation = await relationAccess.previewCreate(
        accountId,
        relationPreviewInput(ownerWork.id, proposal),
      );
      const selectedWork =
        proposal.kind === "Blocked by" ? relation.source : relation.target;
      return {
        id: proposal.id,
        kind: proposal.kind,
        sourceLabel: ownerWork.key,
        sourceWorkId: ownerWork.id,
        target: {
          id: selectedWork.recordId,
          key: selectedWork.key,
          status: selectedWork.status,
          title: selectedWork.title,
          type: selectedWork.workType,
        },
      };
    }),
  );
  const [ownerProject] = await database
    .select({ id: project.id, name: project.name })
    .from(project)
    .where(eq(project.id, ownerWork.projectId))
    .limit(1);
  if (!ownerProject) {
    throw new ExternalExecutionHandoffReconcileUnavailableError();
  }

  const previewContents = {
    followUpWorks: plan.followUpWorks.map((followUpWork) => ({
      ...followUpWork,
      projectId: ownerProject.id,
      projectName: ownerProject.name,
      relatedToWorkId: ownerWork.id,
      relationKind: "Origin",
    })),
    handoffId: handoff.handoffId,
    proposedRelations: relationPreviews,
  };
  const previewId = `external-handoff-reconcile-${await fingerprintMutationPayload(
    {
      accountId,
      ...previewContents,
      result: externalExecutionHandoffResultSchema.parse(handoff.result),
    },
  )}`;
  return externalExecutionHandoffReconcilePreviewSchema.parse({
    ...previewContents,
    previewId,
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

interface ReconcileWriteResult {
  createdFollowUpWorks: Array<{ id: string; key: string; title: string }>;
  createdRelations: Array<{
    id: string;
    kind: "Related" | "Origin" | "Blocks";
    sourceWorkId: string;
    targetWorkId: string;
  }>;
}

function reconciledHandoffReplay(
  existing: ExternalExecutionHandoff,
  input: ConfirmExternalExecutionHandoffReconcileInput,
  selectedRelationIds: readonly string[],
  selectedFollowUpWorkIds: readonly string[],
) {
  if (existing.status !== "Reconciled" || !existing.reconcileDecision) {
    return null;
  }
  const decision = existing.reconcileDecision;
  if (
    decision.previewId === input.previewId &&
    JSON.stringify(decision.selectedRelationIds) ===
      JSON.stringify(selectedRelationIds) &&
    JSON.stringify(decision.selectedFollowUpWorkIds) ===
      JSON.stringify(selectedFollowUpWorkIds)
  ) {
    return existing;
  }
  throw new ExternalExecutionHandoffIdempotencyConflictError();
}

async function applyReconcileWrites(
  database: Database,
  input: {
    accountId: string;
    handoff: HandoffRecord;
    ownerWork: typeof work.$inferSelect;
    preview: ExternalExecutionHandoffReconcilePreview;
    proposedRelations: ConfirmExternalExecutionHandoffReconcileInput["proposedRelations"];
    selectedFollowUpWorkIds: readonly string[];
    selectedRelationIds: readonly string[];
  },
): Promise<ReconcileWriteResult> {
  const relationAccess = createDatabaseRelations(database);
  const workLifecycle = createDatabaseWorkLifecycle(database);
  const selectedFollowUpWorkIds = new Set(input.selectedFollowUpWorkIds);
  const selectedRelationIds = new Set(input.selectedRelationIds);
  const createdRelations: ReconcileWriteResult["createdRelations"] = [];
  const createdFollowUpWorks: ReconcileWriteResult["createdFollowUpWorks"] = [];

  // These writes share the transaction and project revision, so apply them in order.
  for (const proposedWork of input.preview.followUpWorks) {
    if (!selectedFollowUpWorkIds.has(proposedWork.id)) {
      continue;
    }
    // biome-ignore lint/performance/noAwaitInLoops: Work creation advances the project revision used by the next creation.
    const [ownerProject] = await database
      .select({ revision: project.revision })
      .from(project)
      .where(eq(project.id, input.ownerWork.projectId))
      .limit(1)
      .for("update");
    if (!ownerProject) {
      throw new ExternalExecutionHandoffReconcileUnavailableError();
    }

    const workIdempotencyKey = `external-handoff-follow-up-${await fingerprintMutationPayload(
      {
        handoffId: input.handoff.handoffId,
        previewId: input.preview.previewId,
        proposalId: proposedWork.id,
      },
    )}`;
    const createdWork = await workLifecycle.create(input.accountId, {
      baseRevision: ownerProject.revision,
      clientIdempotencyKey: workIdempotencyKey,
      description: proposedWork.description,
      effort: null,
      plannedStartDate: null,
      projectId: input.ownerWork.projectId,
      targetDate: null,
      title: proposedWork.title,
      type: proposedWork.type,
    });
    createdFollowUpWorks.push({
      id: createdWork.id,
      key: createdWork.key,
      title: createdWork.title,
    });

    const originInput: RelationCreatePreviewInput = {
      kind: "Origin",
      source: { recordId: createdWork.id, recordType: "Work" },
      target: { recordId: input.ownerWork.id, recordType: "Work" },
    };
    const relationPreview = await relationAccess.previewCreate(
      input.accountId,
      originInput,
    );
    await relationAccess.create(input.accountId, {
      baseRevision: relationPreview.baseRevision,
      clientIdempotencyKey: `external-handoff-origin-${await fingerprintMutationPayload(
        {
          handoffId: input.handoff.handoffId,
          previewId: input.preview.previewId,
          proposalId: proposedWork.id,
        },
      )}`,
      kind: "Origin",
      previewId: relationPreview.previewId,
      source: originInput.source,
      target: originInput.target,
    });
    createdRelations.push({
      id: relationPreview.previewId,
      kind: "Origin",
      sourceWorkId: createdWork.id,
      targetWorkId: input.ownerWork.id,
    });
  }

  // Relation writes are sequential so each proposal is checked against prior selections.
  for (const proposedRelation of input.proposedRelations) {
    if (!selectedRelationIds.has(proposedRelation.id)) {
      continue;
    }
    const relationInput = relationPreviewInput(
      input.ownerWork.id,
      proposedRelation,
    );
    // biome-ignore lint/performance/noAwaitInLoops: relation uniqueness is revalidated after every selected write.
    const relationPreview = await relationAccess.previewCreate(
      input.accountId,
      relationInput,
    );
    await relationAccess.create(input.accountId, {
      baseRevision: relationPreview.baseRevision,
      clientIdempotencyKey: `external-handoff-relation-${await fingerprintMutationPayload(
        {
          handoffId: input.handoff.handoffId,
          previewId: input.preview.previewId,
          proposalId: proposedRelation.id,
        },
      )}`,
      kind: relationPreview.kind,
      previewId: relationPreview.previewId,
      source: relationInput.source,
      target: relationInput.target,
    });
    createdRelations.push({
      id: relationPreview.previewId,
      kind: relationPreview.kind as "Related" | "Origin" | "Blocks",
      sourceWorkId: relationInput.source.recordId,
      targetWorkId: relationInput.target.recordId,
    });
  }

  return { createdFollowUpWorks, createdRelations };
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

    async listRelatedWorks(
      accountId,
      workId,
    ): Promise<ExternalExecutionHandoffRelatedWork[] | null> {
      const ownerWork = await ownedWork(database, accountId, workId, false);
      if (!ownerWork) {
        return null;
      }
      const candidates = await database
        .select({
          id: work.id,
          key: work.key,
          status: work.status,
          title: work.title,
          type: work.type,
        })
        .from(work)
        .where(
          and(
            eq(work.projectId, ownerWork.projectId),
            ne(work.id, ownerWork.id),
            isNull(work.archivedAt),
          ),
        )
        .orderBy(asc(work.number), asc(work.id));
      return candidates.map((candidate) =>
        externalExecutionHandoffRelatedWorkSchema.parse(candidate),
      );
    },

    async previewReconcile(accountId, rawInput) {
      const input =
        previewExternalExecutionHandoffReconcileInputSchema.parse(rawInput);
      const [handoff] = await database
        .select()
        .from(workExternalExecutionHandoff)
        .where(eq(workExternalExecutionHandoff.handoffId, input.handoffId))
        .limit(1);
      if (!handoff) {
        return null;
      }
      const ownerWork = await ownedWork(
        database,
        accountId,
        handoff.workId,
        false,
      );
      if (!ownerWork) {
        return null;
      }
      if (handoff.status !== "Result returned" || !handoff.result) {
        throw new ExternalExecutionHandoffReconcileUnavailableError();
      }
      return reconcilePreview(database, accountId, handoff, ownerWork, input);
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

    confirmReconcile(
      accountId,
      rawInput: ConfirmExternalExecutionHandoffReconcileInput,
    ) {
      const input =
        confirmExternalExecutionHandoffReconcileInputSchema.parse(rawInput);
      const selectedRelationIds = [...input.selectedRelationIds].sort();
      const selectedFollowUpWorkIds = [...input.selectedFollowUpWorkIds].sort();

      return database.transaction(async (transaction) => {
        const [handoff] = await transaction
          .select()
          .from(workExternalExecutionHandoff)
          .where(eq(workExternalExecutionHandoff.handoffId, input.handoffId))
          .limit(1)
          .for("update");
        if (!handoff) {
          return null;
        }
        const ownerWork = await ownedWork(
          transaction,
          accountId,
          handoff.workId,
          true,
        );
        if (!ownerWork) {
          return null;
        }

        const existing = toExternalExecutionHandoff(handoff);
        const replay = reconciledHandoffReplay(
          existing,
          input,
          selectedRelationIds,
          selectedFollowUpWorkIds,
        );
        if (replay) {
          return replay;
        }
        if (existing.status !== "Result returned" || !existing.result) {
          throw new ExternalExecutionHandoffReconcileUnavailableError();
        }

        const databaseView = transaction as unknown as Database;
        const preview = await reconcilePreview(
          databaseView,
          accountId,
          handoff,
          ownerWork,
          input,
        );
        if (preview.previewId !== input.previewId) {
          throw new ExternalExecutionHandoffReconcilePreviewRequiredError();
        }

        const { createdFollowUpWorks, createdRelations } =
          await applyReconcileWrites(databaseView, {
            accountId,
            handoff,
            ownerWork,
            preview,
            proposedRelations: input.proposedRelations,
            selectedFollowUpWorkIds,
            selectedRelationIds,
          });

        const confirmedAt = now();
        const decisionId = `external-handoff-decision-${await fingerprintMutationPayload(
          {
            handoffId: handoff.handoffId,
            previewId: preview.previewId,
            selectedFollowUpWorkIds,
            selectedRelationIds,
          },
        )}`;
        const reconcileDecision =
          externalExecutionHandoffReconcileDecisionSchema.parse({
            confirmedAt: confirmedAt.toISOString(),
            confirmedBy: accountId,
            createdFollowUpWorks,
            createdRelations,
            decisionId,
            previewId: preview.previewId,
            selectedFollowUpWorkIds,
            selectedRelationIds,
          });
        const historyValues = await handoffHistoryValues({
          accountId,
          clientEventId: input.clientEventId,
          eventType: "external-execution-handoff-reconciled",
          handoffId: handoff.handoffId,
          occurredAt: confirmedAt,
          revision: ownerWork.revision,
          workId: ownerWork.id,
        });
        await transaction.insert(mutationHistory).values(historyValues.history);
        const [updated] = await transaction
          .update(workExternalExecutionHandoff)
          .set({ reconcileDecision, status: "Reconciled" })
          .where(eq(workExternalExecutionHandoff.handoffId, handoff.handoffId))
          .returning();
        return updated ? toExternalExecutionHandoff(updated) : null;
      });
    },

    async recordReturn(
      accountId,
      rawInput: RecordExternalExecutionHandoffReturnInput,
    ) {
      const input =
        recordExternalExecutionHandoffReturnInputSchema.parse(rawInput);
      const resultInput = externalExecutionHandoffResultInputSchema.parse({
        changedAssumptions: input.changedAssumptions,
        executorSummary: input.executorSummary,
        externalLinks: input.externalLinks,
        openQuestions: input.openQuestions,
        producedEvidence: input.producedEvidence,
      });
      const inputFingerprint = await fingerprintMutationPayload(resultInput);

      return database.transaction(async (transaction) => {
        const [record] = await transaction
          .select()
          .from(workExternalExecutionHandoff)
          .where(eq(workExternalExecutionHandoff.handoffId, input.handoffId))
          .limit(1)
          .for("update");
        if (!record) {
          return null;
        }
        const ownerWork = await ownedWork(
          transaction,
          accountId,
          record.workId,
          true,
        );
        if (!ownerWork) {
          return null;
        }

        const handoff = toExternalExecutionHandoff(record);
        if (handoff.result) {
          const { returnedAt: _returnedAt, ...existingResultInput } =
            handoff.result;
          if (
            (await fingerprintMutationPayload(existingResultInput)) ===
            inputFingerprint
          ) {
            return handoff;
          }
          throw new ExternalExecutionHandoffIdempotencyConflictError();
        }
        if (handoff.status !== "Open") {
          throw new ExternalExecutionHandoffReturnUnavailableError();
        }

        const returnedAt = now();
        const result = {
          ...resultInput,
          returnedAt: returnedAt.toISOString(),
        };
        const [updated] = await transaction
          .update(workExternalExecutionHandoff)
          .set({ result, status: "Result returned" })
          .where(eq(workExternalExecutionHandoff.handoffId, input.handoffId))
          .returning();
        if (!updated) {
          throw new ExternalExecutionHandoffReturnUnavailableError();
        }

        const historyValues = await handoffHistoryValues({
          accountId,
          clientEventId: input.clientEventId,
          eventType: "external-execution-handoff-return-recorded",
          handoffId: input.handoffId,
          occurredAt: returnedAt,
          revision: ownerWork.revision,
          workId: ownerWork.id,
        });
        await transaction.insert(mutationHistory).values(historyValues.history);
        return toExternalExecutionHandoff(updated);
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
