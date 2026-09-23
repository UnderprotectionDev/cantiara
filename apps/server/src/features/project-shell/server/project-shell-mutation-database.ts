import type { MutationTarget } from "@cantiara/api/mutation-and-undo";
import type {
  ProjectProfile,
  ProjectShellMutationContracts,
  ProjectShellMutationValue,
} from "@cantiara/api/project-shell";
import {
  projectLifecycleStatusSchema,
  resolveProjectShellConfiguration,
  starterConfigurationSchema,
} from "@cantiara/api/project-shell";
import type { Database } from "@cantiara/db";
import { workspace } from "@cantiara/db/schema/auth";
import { priorityMetricDefinition } from "@cantiara/db/schema/priority-metrics";
import { project, projectShortCode } from "@cantiara/db/schema/project";
import { and, eq } from "drizzle-orm";

import {
  createDatabaseMutationContract,
  type MutationDatabaseExecutor,
  type MutationDatabaseTargetAdapter,
} from "../../mutation-and-undo/server/mutation-contract-database";
import { starterPriorityMetricDefinitionValues } from "../../priority-metrics/server/priority-metrics-database";
import {
  ProjectShortCodeConflictError,
  ProjectShortCodeLockedError,
  ProjectWorkspaceNotFoundError,
} from "./project-shell";

type ProjectDatabaseRecord = typeof project.$inferSelect;
type ProjectShellMutationUpdateInput = Parameters<
  MutationDatabaseTargetAdapter<ProjectShellMutationValue>["update"]
>[1];

function toProfile(record: ProjectDatabaseRecord): ProjectProfile {
  const starterConfiguration = starterConfigurationSchema.parse(
    record.starterConfiguration,
  );
  return {
    configuration: resolveProjectShellConfiguration(
      record.configuration,
      starterConfiguration,
    ),
    createdAt: record.createdAt.toISOString(),
    id: record.id,
    logo: record.logo,
    name: record.name,
    problem: record.problem,
    purpose: record.purpose,
    revision: record.revision,
    scope: record.scope,
    shortCode: record.shortCode,
    shortCodeLocked: record.workCount > 0,
    starterConfiguration,
    status: projectLifecycleStatusSchema.parse(record.status),
    targetDate: record.targetDate,
    updatedAt: record.updatedAt.toISOString(),
  };
}

function toTarget(
  record: ProjectDatabaseRecord,
): MutationTarget<ProjectShellMutationValue> {
  return {
    id: record.id,
    revision: record.revision,
    value: { project: toProfile(record) },
  };
}

function emptyTarget(
  targetId: string,
): MutationTarget<ProjectShellMutationValue> {
  return {
    id: targetId,
    revision: 0,
    value: { project: null },
  };
}

async function findWorkspaceId(
  executor: MutationDatabaseExecutor,
  accountId: string,
) {
  const [record] = await executor
    .select({ id: workspace.id })
    .from(workspace)
    .where(eq(workspace.ownerAccountId, accountId))
    .limit(1);
  return record?.id ?? null;
}

async function findOwnedProject(
  executor: MutationDatabaseExecutor,
  accountId: string,
  projectId: string,
  lock: boolean,
) {
  const workspaceId = await findWorkspaceId(executor, accountId);
  if (!workspaceId) {
    return null;
  }

  const query = executor
    .select()
    .from(project)
    .where(and(eq(project.id, projectId), eq(project.workspaceId, workspaceId)))
    .limit(1);
  const records = lock ? await query.for("update") : await query;
  const [record] = records;
  return record ? { record, workspaceId } : null;
}

async function reserveShortCode(
  executor: MutationDatabaseExecutor,
  workspaceId: string,
  projectId: string,
  shortCode: string,
) {
  const [existing] = await executor
    .select({ projectId: projectShortCode.projectId })
    .from(projectShortCode)
    .where(
      and(
        eq(projectShortCode.workspaceId, workspaceId),
        eq(projectShortCode.shortCode, shortCode),
      ),
    )
    .limit(1);
  if (existing) {
    if (existing.projectId !== projectId) {
      throw new ProjectShortCodeConflictError(shortCode);
    }
    return;
  }

  const [reservation] = await executor
    .insert(projectShortCode)
    .values({
      id: crypto.randomUUID(),
      projectId,
      shortCode,
      workspaceId,
    })
    .onConflictDoNothing({
      target: [projectShortCode.workspaceId, projectShortCode.shortCode],
    })
    .returning({ id: projectShortCode.id });
  if (reservation) {
    return;
  }

  const [racedReservation] = await executor
    .select({ projectId: projectShortCode.projectId })
    .from(projectShortCode)
    .where(
      and(
        eq(projectShortCode.workspaceId, workspaceId),
        eq(projectShortCode.shortCode, shortCode),
      ),
    )
    .limit(1);
  if (racedReservation?.projectId !== projectId) {
    throw new ProjectShortCodeConflictError(shortCode);
  }
}

async function createProjectShellRecord(
  executor: MutationDatabaseExecutor,
  accountId: string,
  input: ProjectShellMutationUpdateInput,
  nextProject: ProjectProfile,
) {
  const workspaceId = await findWorkspaceId(executor, accountId);
  if (!workspaceId) {
    throw new ProjectWorkspaceNotFoundError(accountId);
  }

  const { committedAt } = input;
  const [created] = await executor
    .insert(project)
    .values({
      configuration: nextProject.configuration,
      createdAt: committedAt,
      id: nextProject.id,
      logo: nextProject.logo,
      name: nextProject.name,
      problem: nextProject.problem,
      purpose: nextProject.purpose,
      revision: input.expectedRevision + 1,
      scope: nextProject.scope,
      shortCode: nextProject.shortCode,
      starterConfiguration: nextProject.starterConfiguration,
      status: nextProject.status,
      targetDate: nextProject.targetDate,
      updatedAt: committedAt,
      workspaceId,
    })
    .onConflictDoNothing({
      target: [project.workspaceId, project.shortCode],
    })
    .returning();
  if (!created) {
    throw new ProjectShortCodeConflictError(nextProject.shortCode);
  }

  await reserveShortCode(
    executor,
    workspaceId,
    nextProject.id,
    nextProject.shortCode,
  );
  const priorityMetricValues = starterPriorityMetricDefinitionValues(
    nextProject.id,
    nextProject.starterConfiguration,
    committedAt,
  );
  if (priorityMetricValues) {
    await executor
      .insert(priorityMetricDefinition)
      .values(priorityMetricValues);
  }
  return toTarget(created);
}

async function updateProjectShellRecord(
  executor: MutationDatabaseExecutor,
  accountId: string,
  input: ProjectShellMutationUpdateInput,
  nextProject: ProjectProfile,
) {
  const ownedProject = await findOwnedProject(
    executor,
    accountId,
    input.targetId,
    true,
  );
  if (!ownedProject || nextProject.id !== ownedProject.record.id) {
    return null;
  }

  const shortCodeChanged =
    ownedProject.record.shortCode !== nextProject.shortCode;
  if (shortCodeChanged && ownedProject.record.workCount > 0) {
    throw new ProjectShortCodeLockedError();
  }

  if (shortCodeChanged) {
    await reserveShortCode(
      executor,
      ownedProject.workspaceId,
      ownedProject.record.id,
      nextProject.shortCode,
    );
  }

  const projectIdentity = and(
    eq(project.id, input.targetId),
    eq(project.workspaceId, ownedProject.workspaceId),
    eq(project.revision, input.expectedRevision),
  );
  const [updated] = await executor
    .update(project)
    .set({
      configuration: nextProject.configuration,
      revision: input.expectedRevision + 1,
      shortCode: nextProject.shortCode,
      updatedAt: input.committedAt,
    })
    .where(
      shortCodeChanged
        ? and(projectIdentity, eq(project.workCount, 0))
        : projectIdentity,
    )
    .returning();
  return updated ? toTarget(updated) : null;
}

function createProjectShellMutationTarget(
  accountId: string,
  operation: "create" | "update",
): MutationDatabaseTargetAdapter<ProjectShellMutationValue> {
  return {
    async find(executor, targetId, lock) {
      if (operation === "create") {
        return emptyTarget(targetId);
      }

      const ownedProject = await findOwnedProject(
        executor,
        accountId,
        targetId,
        lock,
      );
      return ownedProject ? toTarget(ownedProject.record) : null;
    },

    update(executor, input) {
      const nextProject = input.nextValue.project;
      if (!nextProject) {
        return Promise.resolve(null);
      }
      return operation === "create"
        ? createProjectShellRecord(executor, accountId, input, nextProject)
        : updateProjectShellRecord(executor, accountId, input, nextProject);
    },
  };
}

export function createDatabaseProjectShellMutationContracts(
  database: Database,
): ProjectShellMutationContracts {
  return {
    create: (accountId) =>
      createDatabaseMutationContract<ProjectShellMutationValue>(database, {
        target: createProjectShellMutationTarget(accountId, "create"),
      }),
    update: (accountId) =>
      createDatabaseMutationContract<ProjectShellMutationValue>(database, {
        target: createProjectShellMutationTarget(accountId, "update"),
      }),
  };
}
