import {
  fingerprintMutationPayload,
  type MutationPayload,
} from "@cantiara/api/mutation-and-undo";
import {
  reconsiderWorkNotNowInputSchema,
  recordWorkNotNowInputSchema,
  WORK_NOT_NOW_GROUND_RECORD_TYPES,
  type WorkNotNowGround,
  type WorkNotNowSummary,
  type WorkNotNowTrail,
  workNotNowGroundSchema,
  workNotNowSummarySchema,
  workNotNowTrailSchema,
} from "@cantiara/api/work-not-now";
import type { Database } from "@cantiara/db";
import { workspace } from "@cantiara/db/schema/auth";
import { project } from "@cantiara/db/schema/project";
import { work } from "@cantiara/db/schema/work";
import { workNotNowTrail } from "@cantiara/db/schema/work-not-now";
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { cancelPlannedReviewLaterForWork } from "../../personal-reminders/server/personal-reminders-database";
import { createDatabaseRelations } from "../../relations/server/relations";

type WorkNotNowDatabaseRecord = typeof workNotNowTrail.$inferSelect;

const GROUND_RECORD_TYPES = new Set<string>(WORK_NOT_NOW_GROUND_RECORD_TYPES);

export class WorkNotNowConflictError extends Error {
  readonly code = "WORK_NOT_NOW_CONFLICT";

  constructor(message = "The Not now trail changed. Review it and try again.") {
    super(message);
    this.name = "WorkNotNowConflictError";
  }
}

export class WorkNotNowGroundUnavailableError extends Error {
  readonly code = "WORK_NOT_NOW_GROUND_UNAVAILABLE";

  constructor() {
    super("A selected supporting record is no longer available.");
    this.name = "WorkNotNowGroundUnavailableError";
  }
}

function toWorkNotNowTrail(record: WorkNotNowDatabaseRecord): WorkNotNowTrail {
  return workNotNowTrailSchema.parse({
    closedAt: record.closedAt?.toISOString() ?? null,
    closedBy: record.closedBy,
    closedByAccountId: record.closedByAccountId,
    condition: record.condition,
    createdAt: record.createdAt.toISOString(),
    createdByAccountId: record.createdByAccountId,
    grounds: record.grounds,
    id: record.id,
    reason: record.reason,
    revision: record.revision,
    status: record.status,
    workId: record.workId,
  });
}

async function findOwnedWork(
  executor: Pick<Database, "select">,
  accountId: string,
  workId: string,
  lock: boolean,
) {
  const [ownedWorkspace] = await executor
    .select({ id: workspace.id })
    .from(workspace)
    .where(eq(workspace.ownerAccountId, accountId))
    .limit(1);
  if (!ownedWorkspace) {
    return null;
  }

  const query = executor
    .select({ project, record: work })
    .from(work)
    .innerJoin(project, eq(work.projectId, project.id))
    .where(and(eq(work.id, workId), eq(project.workspaceId, ownedWorkspace.id)))
    .limit(1);
  const records = lock ? await query.for("update") : await query;
  return records[0] ?? null;
}

function workNotNowPayloadFingerprint(payload: MutationPayload) {
  return fingerprintMutationPayload(payload);
}

type OwnedWork = NonNullable<Awaited<ReturnType<typeof findOwnedWork>>>;

function canRecordWorkNotNow(target: OwnedWork) {
  return (
    target.project.archivedAt === null &&
    target.record.archivedAt === null &&
    target.record.status !== "Closed"
  );
}

function canReconsiderWorkNotNow(target: OwnedWork) {
  return (
    target.project.archivedAt === null && target.record.archivedAt === null
  );
}

function trailsForWork(executor: Pick<Database, "select">, workId: string) {
  return executor
    .select()
    .from(workNotNowTrail)
    .where(eq(workNotNowTrail.workId, workId))
    .orderBy(asc(workNotNowTrail.revision));
}

async function trailForCreateKey(
  executor: Pick<Database, "select">,
  workId: string,
  clientIdempotencyKey: string,
) {
  const [record] = await executor
    .select()
    .from(workNotNowTrail)
    .where(
      and(
        eq(workNotNowTrail.workId, workId),
        eq(workNotNowTrail.clientIdempotencyKey, clientIdempotencyKey),
      ),
    )
    .limit(1);
  return record;
}

async function trailForCloseKey(
  executor: Pick<Database, "select">,
  workId: string,
  clientIdempotencyKey: string,
) {
  const [record] = await executor
    .select()
    .from(workNotNowTrail)
    .where(
      and(
        eq(workNotNowTrail.workId, workId),
        eq(workNotNowTrail.closedByClientIdempotencyKey, clientIdempotencyKey),
      ),
    )
    .limit(1);
  return record;
}

function currentTrailRevision(trails: readonly WorkNotNowDatabaseRecord[]) {
  return trails.reduce(
    (revision, trail) => Math.max(revision, trail.revision),
    0,
  );
}

function assertCurrentRevision(actual: number, expected: number) {
  if (actual !== expected) {
    throw new WorkNotNowConflictError();
  }
}

function existingCreateResult(
  record: WorkNotNowDatabaseRecord,
  payloadFingerprint: string,
) {
  if (record.payloadFingerprint !== payloadFingerprint) {
    throw new WorkNotNowConflictError(
      "This Not now request key was already used for different content.",
    );
  }
  return toWorkNotNowTrail(record);
}

function assertCreateKeyWasNotUsedToClose(
  record: WorkNotNowDatabaseRecord | undefined,
) {
  if (record) {
    throw new WorkNotNowConflictError(
      "This request key was already used to close a Not now trail.",
    );
  }
}

function assertCloseKeyWasNotUsedToCreate(
  record: WorkNotNowDatabaseRecord | undefined,
) {
  if (record) {
    throw new WorkNotNowConflictError(
      "This request key was already used to record a Not now trail.",
    );
  }
}

function existingCloseResult(
  record: WorkNotNowDatabaseRecord,
  expected: {
    closedBy: "Reconsidering";
    payloadFingerprint: string;
    trailId: string;
  },
) {
  if (
    record.closedBy !== expected.closedBy ||
    record.closedByPayloadFingerprint !== expected.payloadFingerprint ||
    record.id !== expected.trailId
  ) {
    throw new WorkNotNowConflictError(
      "This Not now request key was already used for different content.",
    );
  }
  return toWorkNotNowTrail(record);
}

async function closeWorkNotNowTrail(
  executor: Pick<Database, "update">,
  args: {
    accountId: string;
    clientIdempotencyKey: string;
    closedBy: "Reconsidering" | "Replaced";
    closedByPayloadFingerprint: string;
    revision: number;
    status: "Reconsidered" | "Replaced";
    trailId: string;
  },
) {
  const [closed] = await executor
    .update(workNotNowTrail)
    .set({
      closedAt: new Date(),
      closedBy: args.closedBy,
      closedByAccountId: args.accountId,
      closedByClientIdempotencyKey: args.clientIdempotencyKey,
      closedByPayloadFingerprint: args.closedByPayloadFingerprint,
      revision: args.revision,
      status: args.status,
    })
    .where(
      and(
        eq(workNotNowTrail.id, args.trailId),
        eq(workNotNowTrail.status, "Active"),
      ),
    )
    .returning();
  if (!closed) {
    throw new WorkNotNowConflictError();
  }
  return closed;
}

async function resolveGrounds(
  database: Database,
  accountId: string,
  workId: string,
  relationIds: readonly string[],
): Promise<WorkNotNowGround[]> {
  if (relationIds.length === 0) {
    return [];
  }

  const relations = await createDatabaseRelations(database).list(accountId, {
    recordId: workId,
    recordType: "Work",
  });
  const selected = relationIds.map((relationId) => {
    const relation = relations.find((candidate) => candidate.id === relationId);
    if (!relation) {
      throw new WorkNotNowGroundUnavailableError();
    }
    let endpoint: typeof relation.target | null = null;
    if (relation.source.recordId === workId) {
      endpoint = relation.target;
    } else if (relation.target.recordId === workId) {
      endpoint = relation.source;
    }
    if (
      !endpoint ||
      endpoint.broken ||
      !GROUND_RECORD_TYPES.has(endpoint.recordType)
    ) {
      throw new WorkNotNowGroundUnavailableError();
    }
    return workNotNowGroundSchema.parse({
      key: endpoint.key,
      projectId: endpoint.projectId,
      recordId: endpoint.recordId,
      recordType: endpoint.recordType,
      relationId: relation.id,
      title:
        endpoint.title ??
        endpoint.label ??
        endpoint.key ??
        `${endpoint.recordType} ${endpoint.recordId}`,
    });
  });
  return selected;
}

export async function workNotNowSummariesForWorks(
  database: Database,
  workIds: readonly string[],
): Promise<Map<string, WorkNotNowSummary>> {
  const summaries = new Map<string, WorkNotNowSummary>();
  if (workIds.length === 0) {
    return summaries;
  }

  const records = await database
    .select()
    .from(workNotNowTrail)
    .where(inArray(workNotNowTrail.workId, [...new Set(workIds)]))
    .orderBy(asc(workNotNowTrail.revision));
  const trailsByWorkId = new Map<string, WorkNotNowTrail[]>();
  for (const record of records) {
    const current = trailsByWorkId.get(record.workId) ?? [];
    current.push(toWorkNotNowTrail(record));
    trailsByWorkId.set(record.workId, current);
  }

  for (const workId of workIds) {
    const trails = trailsByWorkId.get(workId) ?? [];
    const activeTrail =
      trails.find((trail) => trail.status === "Active") ?? null;
    summaries.set(
      workId,
      workNotNowSummarySchema.parse({
        activeTrail,
        revision: trails.reduce(
          (revision, trail) => Math.max(revision, trail.revision),
          0,
        ),
      }),
    );
  }
  return summaries;
}

export function createDatabaseWorkNotNow(database: Database) {
  return {
    async history(accountId: string, workId: string) {
      if (!(await findOwnedWork(database, accountId, workId, false))) {
        return null;
      }
      const records = await database
        .select()
        .from(workNotNowTrail)
        .where(eq(workNotNowTrail.workId, workId))
        .orderBy(desc(workNotNowTrail.revision));
      return records.map(toWorkNotNowTrail);
    },

    async record(
      accountId: string,
      rawInput: Parameters<typeof recordWorkNotNowInputSchema.parse>[0],
    ) {
      const input = recordWorkNotNowInputSchema.parse(rawInput);
      const {
        baseRevision,
        clientIdempotencyKey,
        reviewLaterHandling,
        ...payload
      } = input;
      const fingerprintPayload =
        reviewLaterHandling === "Keep Review later"
          ? payload
          : { ...payload, reviewLaterHandling };
      const payloadFingerprint =
        await workNotNowPayloadFingerprint(fingerprintPayload);

      return database.transaction(async (transaction) => {
        const target = await findOwnedWork(
          transaction,
          accountId,
          input.workId,
          true,
        );
        if (!target) {
          return null;
        }

        const existingCreate = await trailForCreateKey(
          transaction,
          input.workId,
          clientIdempotencyKey,
        );
        if (existingCreate) {
          return existingCreateResult(existingCreate, payloadFingerprint);
        }

        assertCreateKeyWasNotUsedToClose(
          await trailForCloseKey(
            transaction,
            input.workId,
            clientIdempotencyKey,
          ),
        );

        const priorRecords = await trailsForWork(transaction, input.workId);
        const currentRevision = currentTrailRevision(priorRecords);
        assertCurrentRevision(currentRevision, baseRevision);
        if (!canRecordWorkNotNow(target)) {
          return null;
        }

        const grounds = await resolveGrounds(
          database,
          accountId,
          input.workId,
          input.groundRelationIds,
        );
        const activeTrail = priorRecords.find(
          (trail) => trail.status === "Active",
        );
        let nextRevision = currentRevision + 1;

        if (activeTrail) {
          if (reviewLaterHandling === "Remove Review later") {
            await cancelPlannedReviewLaterForWork(transaction, {
              accountId,
              workId: input.workId,
            });
          }
          const closePayload = {
            clientIdempotencyKey,
            eventType: "Replaced",
            trailId: activeTrail.id,
            workId: input.workId,
          };
          const closedByPayloadFingerprint =
            await workNotNowPayloadFingerprint(closePayload);
          await closeWorkNotNowTrail(transaction, {
            accountId,
            clientIdempotencyKey,
            closedBy: "Replaced",
            closedByPayloadFingerprint,
            revision: nextRevision,
            status: "Replaced",
            trailId: activeTrail.id,
          });
          nextRevision += 1;
        }

        const [created] = await transaction
          .insert(workNotNowTrail)
          .values({
            clientIdempotencyKey,
            condition: input.condition,
            createdByAccountId: accountId,
            grounds,
            id: `not-now-${crypto.randomUUID()}`,
            payloadFingerprint,
            reason: input.reason,
            revision: nextRevision,
            workId: input.workId,
          })
          .returning();
        if (!created) {
          throw new Error("Not now trail was not recorded.");
        }
        return toWorkNotNowTrail(created);
      });
    },

    async reconsider(
      accountId: string,
      rawInput: Parameters<typeof reconsiderWorkNotNowInputSchema.parse>[0],
    ) {
      const input = reconsiderWorkNotNowInputSchema.parse(rawInput);
      const {
        baseRevision,
        clientIdempotencyKey,
        reviewLaterHandling,
        ...payload
      } = input;
      const fingerprintPayload =
        reviewLaterHandling === "Keep Review later"
          ? payload
          : { ...payload, reviewLaterHandling };
      const payloadFingerprint = await workNotNowPayloadFingerprint({
        ...fingerprintPayload,
        eventType: "Reconsidering",
      });

      return database.transaction(async (transaction) => {
        const target = await findOwnedWork(
          transaction,
          accountId,
          input.workId,
          true,
        );
        if (!target) {
          return null;
        }

        const existingClose = await trailForCloseKey(
          transaction,
          input.workId,
          clientIdempotencyKey,
        );
        if (existingClose) {
          return existingCloseResult(existingClose, {
            closedBy: "Reconsidering",
            payloadFingerprint,
            trailId: input.trailId,
          });
        }

        assertCloseKeyWasNotUsedToCreate(
          await trailForCreateKey(
            transaction,
            input.workId,
            clientIdempotencyKey,
          ),
        );

        const priorRecords = await trailsForWork(transaction, input.workId);
        const currentRevision = currentTrailRevision(priorRecords);
        assertCurrentRevision(currentRevision, baseRevision);
        if (!canReconsiderWorkNotNow(target)) {
          return null;
        }
        const activeTrail = priorRecords.find(
          (trail) => trail.id === input.trailId && trail.status === "Active",
        );
        if (!activeTrail) {
          throw new WorkNotNowConflictError();
        }

        if (reviewLaterHandling === "Remove Review later") {
          await cancelPlannedReviewLaterForWork(transaction, {
            accountId,
            workId: input.workId,
          });
        }
        const closed = await closeWorkNotNowTrail(transaction, {
          accountId,
          clientIdempotencyKey,
          closedBy: "Reconsidering",
          closedByPayloadFingerprint: payloadFingerprint,
          revision: currentRevision + 1,
          status: "Reconsidered",
          trailId: activeTrail.id,
        });
        return toWorkNotNowTrail(closed);
      });
    },
  };
}
