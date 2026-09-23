import type {
  MutationPayload,
  MutationTarget,
} from "@cantiara/api/mutation-and-undo";
import type {
  PrioritizationSession,
  PrioritizationSessionMutationContracts,
  PrioritizationSessionMutationValue,
} from "@cantiara/api/prioritization-sessions";
import {
  closePrioritizationSessionInputSchema,
  createPrioritizationSessionInputSchema,
  prioritizationSessionSchema,
  restorePrioritizationSessionInputSchema,
  trashPrioritizationSessionInputSchema,
  updatePrioritizationSessionOrderInputSchema,
} from "@cantiara/api/prioritization-sessions";
import type { Database } from "@cantiara/db";
import { workspace } from "@cantiara/db/schema/auth";
import {
  prioritizationSession,
  prioritizationSessionWork,
} from "@cantiara/db/schema/prioritization-session";
import { project } from "@cantiara/db/schema/project";
import { work } from "@cantiara/db/schema/work";
import { and, asc, eq, inArray } from "drizzle-orm";
import {
  createDatabaseMutationContract,
  type MutationDatabaseExecutor,
  type MutationDatabaseTargetAdapter,
} from "../../mutation-and-undo/server/mutation-contract-database";

type SessionUpdateInput = Parameters<
  MutationDatabaseTargetAdapter<PrioritizationSessionMutationValue>["update"]
>[1];
type SessionOperation =
  | "close"
  | "create"
  | "restore"
  | "trash"
  | "updateOrder";
type ExistingSessionOperation = Exclude<SessionOperation, "create">;
type SessionDatabaseRecord = typeof prioritizationSession.$inferSelect;

export class PrioritizationSessionProjectNotFoundError extends Error {
  readonly code = "PRIORITIZATION_SESSION_PROJECT_NOT_FOUND" as const;

  constructor(projectId: string) {
    super(`Project ${projectId} was not found.`);
    this.name = "PrioritizationSessionProjectNotFoundError";
  }
}

export class PrioritizationSessionWorkNotFoundError extends Error {
  readonly code = "PRIORITIZATION_SESSION_WORK_NOT_FOUND" as const;

  constructor(workId: string) {
    super(
      `Work ${workId} was not found in the Prioritization session Project.`,
    );
    this.name = "PrioritizationSessionWorkNotFoundError";
  }
}

export class PrioritizationSessionClosedError extends Error {
  readonly code = "PRIORITIZATION_SESSION_CLOSED" as const;

  constructor(sessionId: string) {
    super(`Prioritization session ${sessionId} is closed.`);
    this.name = "PrioritizationSessionClosedError";
  }
}

export class PrioritizationSessionTrashedError extends Error {
  readonly code = "PRIORITIZATION_SESSION_TRASHED" as const;

  constructor(sessionId: string) {
    super(`Prioritization session ${sessionId} is in Trash.`);
    this.name = "PrioritizationSessionTrashedError";
  }
}

export class PrioritizationSessionNotTrashedError extends Error {
  readonly code = "PRIORITIZATION_SESSION_NOT_TRASHED" as const;

  constructor(sessionId: string) {
    super(`Prioritization session ${sessionId} is not in Trash.`);
    this.name = "PrioritizationSessionNotTrashedError";
  }
}

function toPrioritizationSession(
  record: SessionDatabaseRecord,
  workIds: readonly string[],
): PrioritizationSession {
  return prioritizationSessionSchema.parse({
    closedAt: record.closedAt?.toISOString() ?? null,
    createdAt: record.createdAt.toISOString(),
    id: record.id,
    name: record.name,
    projectId: record.projectId,
    revision: record.revision,
    trashedAt: record.trashedAt?.toISOString() ?? null,
    updatedAt: record.updatedAt.toISOString(),
    workIds,
  });
}

async function findOwnedProject(
  executor: MutationDatabaseExecutor,
  accountId: string,
  projectId: string,
  lock: boolean,
) {
  const query = executor
    .select({ id: project.id })
    .from(project)
    .innerJoin(workspace, eq(workspace.id, project.workspaceId))
    .where(
      and(eq(project.id, projectId), eq(workspace.ownerAccountId, accountId)),
    )
    .limit(1);
  const records = lock ? await query.for("update") : await query;
  return records[0] ?? null;
}

async function workIdsOwnedByProject(
  executor: MutationDatabaseExecutor,
  projectId: string,
  workIds: readonly string[],
) {
  if (workIds.length === 0) {
    return new Set<string>();
  }
  const records = await executor
    .select({ id: work.id })
    .from(work)
    .where(and(eq(work.projectId, projectId), inArray(work.id, workIds)));
  return new Set(records.map((record) => record.id));
}

async function findSessionWorkIds(
  executor: MutationDatabaseExecutor,
  sessionId: string,
) {
  const records = await executor
    .select({ workId: prioritizationSessionWork.workId })
    .from(prioritizationSessionWork)
    .where(eq(prioritizationSessionWork.sessionId, sessionId))
    .orderBy(asc(prioritizationSessionWork.position));
  return records.map((record) => record.workId);
}

function assertSessionState(
  session: SessionDatabaseRecord,
  operation: ExistingSessionOperation,
) {
  if (operation === "restore") {
    if (!session.trashedAt) {
      throw new PrioritizationSessionNotTrashedError(session.id);
    }
    return;
  }
  if (session.trashedAt) {
    throw new PrioritizationSessionTrashedError(session.id);
  }
  if (
    (operation === "close" || operation === "updateOrder") &&
    session.closedAt
  ) {
    throw new PrioritizationSessionClosedError(session.id);
  }
}

async function findOwnedSession(
  executor: MutationDatabaseExecutor,
  accountId: string,
  sessionId: string,
  lock: boolean,
) {
  const query = executor
    .select({ session: prioritizationSession })
    .from(prioritizationSession)
    .innerJoin(project, eq(project.id, prioritizationSession.projectId))
    .innerJoin(workspace, eq(workspace.id, project.workspaceId))
    .where(
      and(
        eq(prioritizationSession.id, sessionId),
        eq(workspace.ownerAccountId, accountId),
      ),
    )
    .limit(1);
  const records = lock ? await query.for("update") : await query;
  return records[0]?.session ?? null;
}

async function findCreateTarget(
  executor: MutationDatabaseExecutor,
  accountId: string,
  targetId: string,
  payload: MutationPayload | undefined,
) {
  const parsed = createPrioritizationSessionInputSchema.safeParse(payload);
  if (!parsed.success) {
    return null;
  }
  if (
    !(await findOwnedProject(executor, accountId, parsed.data.projectId, false))
  ) {
    throw new PrioritizationSessionProjectNotFoundError(parsed.data.projectId);
  }
  const ownedWorkIds = await workIdsOwnedByProject(
    executor,
    parsed.data.projectId,
    parsed.data.workIds,
  );
  const missingWorkId = parsed.data.workIds.find(
    (workId) => !ownedWorkIds.has(workId),
  );
  if (missingWorkId) {
    throw new PrioritizationSessionWorkNotFoundError(missingWorkId);
  }
  return {
    id: targetId,
    revision: 0,
    value: { session: null },
  } satisfies MutationTarget<PrioritizationSessionMutationValue>;
}

function inputSessionId(
  operation: ExistingSessionOperation,
  payload: MutationPayload | undefined,
) {
  let schema:
    | typeof closePrioritizationSessionInputSchema
    | typeof restorePrioritizationSessionInputSchema
    | typeof trashPrioritizationSessionInputSchema
    | typeof updatePrioritizationSessionOrderInputSchema;
  if (operation === "close") {
    schema = closePrioritizationSessionInputSchema;
  } else if (operation === "restore") {
    schema = restorePrioritizationSessionInputSchema;
  } else if (operation === "trash") {
    schema = trashPrioritizationSessionInputSchema;
  } else {
    schema = updatePrioritizationSessionOrderInputSchema;
  }
  const parsed = schema.safeParse(payload);
  return parsed.success ? parsed.data.sessionId : null;
}

async function findExistingTarget(
  executor: MutationDatabaseExecutor,
  accountId: string,
  operation: ExistingSessionOperation,
  targetId: string,
  lock: boolean,
  payload: MutationPayload | undefined,
) {
  const payloadSessionId = inputSessionId(operation, payload);
  if (payload !== undefined && payloadSessionId !== targetId) {
    return null;
  }
  const record = await findOwnedSession(executor, accountId, targetId, lock);
  if (!record) {
    return null;
  }
  assertSessionState(record, operation);
  const workIds = await findSessionWorkIds(executor, targetId);
  if (operation === "updateOrder") {
    const parsed =
      updatePrioritizationSessionOrderInputSchema.safeParse(payload);
    if (!parsed.success) {
      return null;
    }
    const projectWorkIds = await workIdsOwnedByProject(
      executor,
      record.projectId,
      parsed.data.workIds,
    );
    const existingWorkIds = new Set(workIds);
    const unavailableWorkId = parsed.data.workIds.find(
      (workId) => !(projectWorkIds.has(workId) || existingWorkIds.has(workId)),
    );
    if (unavailableWorkId) {
      throw new PrioritizationSessionWorkNotFoundError(unavailableWorkId);
    }
  }
  return {
    id: record.id,
    revision: record.revision,
    value: { session: toPrioritizationSession(record, workIds) },
  } satisfies MutationTarget<PrioritizationSessionMutationValue>;
}

async function insertSessionWork(
  executor: MutationDatabaseExecutor,
  session: Pick<PrioritizationSession, "id" | "projectId" | "workIds">,
) {
  if (session.workIds.length === 0) {
    return;
  }
  await executor.insert(prioritizationSessionWork).values(
    session.workIds.map((workId, position) => ({
      id: crypto.randomUUID(),
      position,
      projectId: session.projectId,
      sessionId: session.id,
      workId,
    })),
  );
}

async function createSession(
  executor: MutationDatabaseExecutor,
  accountId: string,
  input: SessionUpdateInput,
) {
  const {
    nextValue: { session },
  } = input;
  if (!session) {
    return null;
  }
  const parsed = prioritizationSessionSchema.parse(session);
  if (!(await findOwnedProject(executor, accountId, parsed.projectId, true))) {
    throw new PrioritizationSessionProjectNotFoundError(parsed.projectId);
  }
  const ownedWorkIds = await workIdsOwnedByProject(
    executor,
    parsed.projectId,
    parsed.workIds,
  );
  const missingWorkId = parsed.workIds.find(
    (workId) => !ownedWorkIds.has(workId),
  );
  if (missingWorkId) {
    throw new PrioritizationSessionWorkNotFoundError(missingWorkId);
  }

  const [created] = await executor
    .insert(prioritizationSession)
    .values({
      closedAt: null,
      createdAt: input.committedAt,
      id: parsed.id,
      name: parsed.name,
      projectId: parsed.projectId,
      revision: input.expectedRevision + 1,
      trashedAt: null,
      updatedAt: input.committedAt,
    })
    .returning();
  if (!created) {
    return null;
  }
  await insertSessionWork(executor, parsed);
  const createdSession = toPrioritizationSession(created, parsed.workIds);
  return {
    id: input.targetId,
    revision: created.revision,
    value: { session: createdSession },
  } satisfies MutationTarget<PrioritizationSessionMutationValue>;
}

async function updateSession(
  executor: MutationDatabaseExecutor,
  accountId: string,
  operation: ExistingSessionOperation,
  input: SessionUpdateInput,
) {
  const current = await findOwnedSession(
    executor,
    accountId,
    input.targetId,
    true,
  );
  if (!current) {
    return null;
  }
  assertSessionState(current, operation);
  if (current.revision !== input.expectedRevision) {
    return null;
  }

  const nextSession = input.nextValue.session;
  if (!nextSession) {
    return null;
  }
  const parsed = prioritizationSessionSchema.parse(nextSession);
  if (operation === "updateOrder") {
    const existingWorkIds = await findSessionWorkIds(executor, current.id);
    const projectWorkIds = await workIdsOwnedByProject(
      executor,
      current.projectId,
      parsed.workIds,
    );
    const existingWorkIdSet = new Set(existingWorkIds);
    const missingWorkId = parsed.workIds.find(
      (workId) =>
        !(projectWorkIds.has(workId) || existingWorkIdSet.has(workId)),
    );
    if (missingWorkId) {
      throw new PrioritizationSessionWorkNotFoundError(missingWorkId);
    }
    await executor
      .delete(prioritizationSessionWork)
      .where(eq(prioritizationSessionWork.sessionId, current.id));
    await insertSessionWork(executor, parsed);
  }

  const updates = {
    revision: input.expectedRevision + 1,
    updatedAt: input.committedAt,
    ...(operation === "close" ? { closedAt: input.committedAt } : {}),
    ...(operation === "trash" ? { trashedAt: input.committedAt } : {}),
    ...(operation === "restore" ? { trashedAt: null } : {}),
  };
  const [updated] = await executor
    .update(prioritizationSession)
    .set(updates)
    .where(
      and(
        eq(prioritizationSession.id, current.id),
        eq(prioritizationSession.revision, input.expectedRevision),
      ),
    )
    .returning();
  if (!updated) {
    return null;
  }
  const workIds =
    operation === "updateOrder"
      ? parsed.workIds
      : await findSessionWorkIds(executor, current.id);
  return {
    id: input.targetId,
    revision: updated.revision,
    value: { session: toPrioritizationSession(updated, workIds) },
  } satisfies MutationTarget<PrioritizationSessionMutationValue>;
}

function createSessionTarget(
  accountId: string,
  operation: SessionOperation,
): MutationDatabaseTargetAdapter<PrioritizationSessionMutationValue> {
  return {
    find(executor, targetId, lock, context) {
      if (operation === "create") {
        return findCreateTarget(
          executor,
          accountId,
          targetId,
          context?.payload,
        );
      }
      return findExistingTarget(
        executor,
        accountId,
        operation,
        targetId,
        lock,
        context?.payload,
      );
    },
    update(executor, input) {
      return operation === "create"
        ? createSession(executor, accountId, input)
        : updateSession(executor, accountId, operation, input);
    },
  };
}

export function createDatabasePrioritizationSessionMutationContracts(
  database: Database,
): PrioritizationSessionMutationContracts {
  function contract(operation: SessionOperation, accountId: string) {
    return createDatabaseMutationContract<PrioritizationSessionMutationValue>(
      database,
      { target: createSessionTarget(accountId, operation) },
    );
  }

  return {
    close: (accountId) => contract("close", accountId),
    create: (accountId) => contract("create", accountId),
    restore: (accountId) => contract("restore", accountId),
    trash: (accountId) => contract("trash", accountId),
    updateOrder: (accountId) => contract("updateOrder", accountId),
  };
}
