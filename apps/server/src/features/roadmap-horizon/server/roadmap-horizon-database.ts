import type {
  MutationPayload,
  MutationTarget,
} from "@cantiara/api/mutation-and-undo";
import {
  createMilestoneInputSchema,
  type Milestone,
  milestoneSchema,
  type RoadmapBlockerSource,
  type RoadmapHorizonAccess,
  roadmapViewSchema,
  saveRoadmapViewInputSchema,
  updateMilestoneInputSchema,
  updateMilestoneStatusInputSchema,
} from "@cantiara/api/roadmap-horizon";
import type { WorkProfile } from "@cantiara/api/work-lifecycle";
import type { Database } from "@cantiara/db";
import { workspace } from "@cantiara/db/schema/auth";
import { project } from "@cantiara/db/schema/project";
import { projectMilestone } from "@cantiara/db/schema/project-milestone";
import { workRelation } from "@cantiara/db/schema/relation";
import { roadmapView } from "@cantiara/db/schema/roadmap-horizon";
import { work } from "@cantiara/db/schema/work";
import { and, asc, eq, inArray, isNull } from "drizzle-orm";

import {
  MutationConflictError,
  MutationTargetNotFoundError,
} from "../../mutation-and-undo/server/mutation-contract";
import {
  createDatabaseMutationContract,
  type MutationDatabaseExecutor,
  type MutationDatabaseTargetAdapter,
} from "../../mutation-and-undo/server/mutation-contract-database";
import { createDatabaseWorkNotNow } from "./not-now-database";

interface RoadmapViewMutationValue {
  view: ReturnType<typeof roadmapViewSchema.parse> | null;
}
type RoadmapViewDatabaseRecord = typeof roadmapView.$inferSelect;
type ProjectMilestoneDatabaseRecord = typeof projectMilestone.$inferSelect;

interface ProjectMilestoneMutationValue {
  milestone: Milestone | null;
}

function toRoadmapView(record: RoadmapViewDatabaseRecord) {
  const { updatedAt: _updatedAt, ...value } = record;
  return roadmapViewSchema.parse(value);
}

function toTarget(
  record: RoadmapViewDatabaseRecord,
): MutationTarget<RoadmapViewMutationValue> {
  return {
    id: record.id,
    revision: record.revision,
    value: { view: toRoadmapView(record) },
  };
}

function emptyTarget(
  targetId: string,
): MutationTarget<RoadmapViewMutationValue> {
  return { id: targetId, revision: 0, value: { view: null } };
}

function toMilestone(record: ProjectMilestoneDatabaseRecord): Milestone {
  return milestoneSchema.parse({
    description: record.description,
    id: record.id,
    projectId: record.projectId,
    revision: record.revision,
    status: record.status,
    targetDate: record.targetDate,
    title: record.title,
  });
}

function toMilestoneTarget(
  record: ProjectMilestoneDatabaseRecord,
): MutationTarget<ProjectMilestoneMutationValue> {
  const milestone = toMilestone(record);
  return {
    id: record.id,
    revision: record.revision,
    value: { milestone },
  };
}

function emptyMilestoneTarget(
  targetId: string,
): MutationTarget<ProjectMilestoneMutationValue> {
  return { id: targetId, revision: 0, value: { milestone: null } };
}

function payloadProjectId(payload?: MutationPayload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return null;
  }
  const { projectId } = payload as Record<string, unknown>;
  return typeof projectId === "string" ? projectId : null;
}

async function findOwnedProject(
  executor: MutationDatabaseExecutor,
  accountId: string,
  projectId: string,
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
    .select()
    .from(project)
    .where(
      and(
        eq(project.id, projectId),
        eq(project.workspaceId, ownedWorkspace.id),
      ),
    )
    .limit(1);
  const records = lock ? await query.for("update") : await query;
  return records[0] ?? null;
}

function roadmapViewMutationTarget(
  accountId: string,
): MutationDatabaseTargetAdapter<RoadmapViewMutationValue> {
  return {
    committedValue(target) {
      return target.value;
    },

    find(executor, targetId, lock, context) {
      return findRoadmapViewTarget(
        executor,
        accountId,
        targetId,
        lock,
        payloadProjectId(context?.payload),
      );
    },

    async update(executor, input) {
      const nextView = input.nextValue.view;
      if (!nextView || nextView.id !== input.targetId) {
        return null;
      }

      const ownedProject = await findOwnedProject(
        executor,
        accountId,
        nextView.projectId,
        true,
      );
      if (!ownedProject || ownedProject.archivedAt !== null) {
        return null;
      }

      const values = {
        groupBy: nextView.groupBy,
        horizons: nextView.horizons,
        markBy: nextView.markBy,
        name: nextView.name,
        projectId: nextView.projectId,
        revision: input.expectedRevision + 1,
        types: nextView.types,
        updatedAt: input.committedAt,
      };
      if (input.expectedRevision === 0) {
        const [inserted] = await executor
          .insert(roadmapView)
          .values({ id: nextView.id, ...values })
          .onConflictDoNothing({ target: roadmapView.id })
          .returning();
        return inserted ? toTarget(inserted) : null;
      }

      const [updated] = await executor
        .update(roadmapView)
        .set(values)
        .where(
          and(
            eq(roadmapView.id, input.targetId),
            eq(roadmapView.projectId, nextView.projectId),
            eq(roadmapView.revision, input.expectedRevision),
          ),
        )
        .returning();
      return updated ? toTarget(updated) : null;
    },
  };
}

async function findRoadmapViewTarget(
  executor: MutationDatabaseExecutor,
  accountId: string,
  targetId: string,
  lock: boolean,
  requestedProjectId: string | null,
): Promise<MutationTarget<RoadmapViewMutationValue> | null> {
  let record: RoadmapViewDatabaseRecord | undefined;
  if (!requestedProjectId) {
    const [existing] = await executor
      .select()
      .from(roadmapView)
      .where(eq(roadmapView.id, targetId))
      .limit(1);
    record = existing;
    if (!record) {
      return null;
    }
  }
  const targetProjectId = requestedProjectId ?? record?.projectId;
  if (!targetProjectId) {
    return null;
  }

  const ownedProject = await findOwnedProject(
    executor,
    accountId,
    targetProjectId,
    lock,
  );
  if (!ownedProject || (lock && ownedProject.archivedAt !== null)) {
    return null;
  }

  const query = executor
    .select()
    .from(roadmapView)
    .where(eq(roadmapView.id, targetId))
    .limit(1);
  if (lock || !record) {
    [record] = lock ? await query.for("update") : await query;
  }
  if (!record) {
    return emptyTarget(targetId);
  }
  return record.projectId === targetProjectId ? toTarget(record) : null;
}

function projectMilestoneMutationTarget(
  accountId: string,
): MutationDatabaseTargetAdapter<ProjectMilestoneMutationValue> {
  return {
    committedValue(target) {
      return target.value;
    },

    find(executor, targetId, lock, context) {
      return findProjectMilestoneTarget(
        executor,
        accountId,
        targetId,
        lock,
        payloadProjectId(context?.payload),
      );
    },

    async update(executor, input) {
      const nextMilestone = input.nextValue.milestone;
      if (!nextMilestone || nextMilestone.id !== input.targetId) {
        return null;
      }

      const ownedProject = await findOwnedProject(
        executor,
        accountId,
        nextMilestone.projectId,
        true,
      );
      if (!ownedProject || ownedProject.archivedAt !== null) {
        return null;
      }

      const values = {
        description: nextMilestone.description,
        projectId: nextMilestone.projectId,
        revision: input.expectedRevision + 1,
        status: nextMilestone.status,
        targetDate: nextMilestone.targetDate,
        title: nextMilestone.title,
        updatedAt: input.committedAt,
      };
      if (input.expectedRevision === 0) {
        if (nextMilestone.status !== "Planned") {
          return null;
        }
        const [inserted] = await executor
          .insert(projectMilestone)
          .values({ id: nextMilestone.id, ...values })
          .onConflictDoNothing({ target: projectMilestone.id })
          .returning();
        return inserted ? toMilestoneTarget(inserted) : null;
      }

      const [updated] = await executor
        .update(projectMilestone)
        .set(values)
        .where(
          and(
            eq(projectMilestone.id, input.targetId),
            eq(projectMilestone.projectId, nextMilestone.projectId),
            eq(projectMilestone.revision, input.expectedRevision),
          ),
        )
        .returning();
      return updated ? toMilestoneTarget(updated) : null;
    },
  };
}

async function findProjectMilestoneTarget(
  executor: MutationDatabaseExecutor,
  accountId: string,
  targetId: string,
  lock: boolean,
  requestedProjectId: string | null,
): Promise<MutationTarget<ProjectMilestoneMutationValue> | null> {
  let record: ProjectMilestoneDatabaseRecord | undefined;
  if (!requestedProjectId) {
    const [existing] = await executor
      .select()
      .from(projectMilestone)
      .where(eq(projectMilestone.id, targetId))
      .limit(1);
    record = existing;
    if (!record) {
      return null;
    }
  }
  const targetProjectId = requestedProjectId ?? record?.projectId;
  if (!targetProjectId) {
    return null;
  }

  const ownedProject = await findOwnedProject(
    executor,
    accountId,
    targetProjectId,
    lock,
  );
  if (!ownedProject || (lock && ownedProject.archivedAt !== null)) {
    return null;
  }

  const query = executor
    .select()
    .from(projectMilestone)
    .where(eq(projectMilestone.id, targetId))
    .limit(1);
  if (lock || !record) {
    [record] = lock ? await query.for("update") : await query;
  }
  if (!record) {
    return emptyMilestoneTarget(targetId);
  }
  return record.projectId === targetProjectId
    ? toMilestoneTarget(record)
    : null;
}

function createProjectMilestoneMutation(database: Database, accountId: string) {
  return createDatabaseMutationContract<ProjectMilestoneMutationValue>(
    database,
    { target: projectMilestoneMutationTarget(accountId) },
  );
}

export function createDatabaseRoadmapHorizon(
  database: Database,
): RoadmapHorizonAccess {
  const workNotNow = createDatabaseWorkNotNow(database);
  async function ownsProject(accountId: string, projectId: string) {
    return Boolean(
      await findOwnedProject(database, accountId, projectId, false),
    );
  }

  return {
    async listActiveBlockers(accountId, projectId) {
      if (!(await ownsProject(accountId, projectId))) {
        return null;
      }
      const relations = await database
        .select({
          blockedWorkId: work.id,
          blockerWorkId: workRelation.sourceWorkId,
        })
        .from(workRelation)
        .innerJoin(
          work,
          and(
            eq(workRelation.targetRecordId, work.id),
            eq(workRelation.targetRecordType, "Work"),
          ),
        )
        .where(
          and(
            eq(work.projectId, projectId),
            isNull(work.archivedAt),
            eq(workRelation.targetProjectId, projectId),
            eq(workRelation.kind, "Blocks"),
            eq(workRelation.sourceRecordType, "Work"),
            eq(workRelation.targetRecordType, "Work"),
            eq(workRelation.blockingStatus, "Active"),
            isNull(workRelation.deletedAt),
          ),
        )
        .orderBy(asc(workRelation.createdAt), asc(workRelation.id));
      const blockerIds = [
        ...new Set(relations.map(({ blockerWorkId }) => blockerWorkId)),
      ];
      if (!blockerIds.length) {
        return [];
      }

      const sources = await database
        .select({
          archivedAt: work.archivedAt,
          id: work.id,
          key: work.key,
          projectId: work.projectId,
          status: work.status,
          title: work.title,
          type: work.type,
        })
        .from(work)
        .innerJoin(project, eq(work.projectId, project.id))
        .innerJoin(workspace, eq(project.workspaceId, workspace.id))
        .where(
          and(
            inArray(work.id, blockerIds),
            eq(workspace.ownerAccountId, accountId),
          ),
        );
      const sourcesById = new Map(sources.map((record) => [record.id, record]));

      return relations.flatMap(({ blockedWorkId, blockerWorkId }) => {
        const record = sourcesById.get(blockerWorkId);
        if (!record) {
          return [];
        }
        const blocker: RoadmapBlockerSource = {
          archivedAt: record.archivedAt?.toISOString() ?? null,
          id: record.id,
          key: record.key,
          projectId: record.projectId,
          status: record.status as WorkProfile["status"],
          title: record.title,
          type: record.type as WorkProfile["type"],
        };
        return [{ blockedWorkId, blocker }];
      });
    },
    ...workNotNow,
    async createMilestone(accountId, rawInput) {
      const input = createMilestoneInputSchema.parse(rawInput);
      const mutation = createProjectMilestoneMutation(database, accountId);
      try {
        const receipt = await mutation.mutate(
          {
            actor: { actorId: accountId, type: "User" },
            baseRevision: input.baseRevision,
            clientIdempotencyKey: input.clientIdempotencyKey,
            kind: "human",
            payload: {
              description: input.description,
              id: input.id,
              operation: "create",
              projectId: input.projectId,
              targetDate: input.targetDate,
              title: input.title,
            },
            targetId: input.id,
          },
          ({ currentRevision, currentValue }) => {
            if (currentValue.milestone) {
              throw new MutationConflictError(input.id);
            }
            return {
              milestone: milestoneSchema.parse({
                description: input.description,
                id: input.id,
                projectId: input.projectId,
                revision: currentRevision + 1,
                status: "Planned",
                targetDate: input.targetDate,
                title: input.title,
              }),
            };
          },
        );
        return receipt.nextValue.milestone;
      } catch (error) {
        if (error instanceof MutationTargetNotFoundError) {
          return null;
        }
        throw error;
      }
    },
    async listOrigins(accountId, projectId) {
      if (!(await ownsProject(accountId, projectId))) {
        return null;
      }
      const relations = await database
        .select({
          sourceResearchId: workRelation.sourceWorkId,
          targetFeatureId: workRelation.targetRecordId,
        })
        .from(workRelation)
        .innerJoin(work, eq(workRelation.sourceWorkId, work.id))
        .where(
          and(
            eq(workRelation.kind, "Origin"),
            eq(workRelation.sourceRecordType, "Work"),
            eq(workRelation.targetRecordType, "Work"),
            eq(workRelation.targetProjectId, projectId),
            eq(work.projectId, projectId),
            eq(work.type, "Research"),
            isNull(workRelation.deletedAt),
          ),
        );
      return relations;
    },
    async listMilestones(accountId, projectId) {
      if (!(await ownsProject(accountId, projectId))) {
        return null;
      }
      const records = await database
        .select()
        .from(projectMilestone)
        .where(eq(projectMilestone.projectId, projectId))
        .orderBy(
          asc(projectMilestone.targetDate),
          asc(projectMilestone.title),
          asc(projectMilestone.id),
        );
      return records.map(toMilestone);
    },
    async listViews(accountId, projectId) {
      if (!(await ownsProject(accountId, projectId))) {
        return null;
      }
      const records = await database
        .select()
        .from(roadmapView)
        .where(eq(roadmapView.projectId, projectId))
        .orderBy(asc(roadmapView.name));
      return records.map(toRoadmapView);
    },
    async updateMilestone(accountId, rawInput) {
      const input = updateMilestoneInputSchema.parse(rawInput);
      const mutation = createProjectMilestoneMutation(database, accountId);
      try {
        const receipt = await mutation.mutate(
          {
            actor: { actorId: accountId, type: "User" },
            baseRevision: input.baseRevision,
            clientIdempotencyKey: input.clientIdempotencyKey,
            kind: "human",
            payload: {
              description: input.description,
              milestoneId: input.milestoneId,
              operation: "update",
              projectId: input.projectId,
              targetDate: input.targetDate,
              title: input.title,
            },
            targetId: input.milestoneId,
          },
          ({ currentRevision, currentValue }) => {
            const current = currentValue.milestone;
            if (!current) {
              throw new MutationTargetNotFoundError(input.milestoneId);
            }
            return {
              milestone: milestoneSchema.parse({
                ...current,
                description: input.description,
                targetDate: input.targetDate,
                title: input.title,
                revision: currentRevision + 1,
              }),
            };
          },
          { undo: { kind: "field", scope: "milestone" } },
        );
        return receipt.nextValue.milestone;
      } catch (error) {
        if (error instanceof MutationTargetNotFoundError) {
          return null;
        }
        throw error;
      }
    },
    async updateMilestoneStatus(accountId, rawInput) {
      const input = updateMilestoneStatusInputSchema.parse(rawInput);
      const mutation = createProjectMilestoneMutation(database, accountId);
      try {
        const receipt = await mutation.mutate(
          {
            actor: { actorId: accountId, type: "User" },
            baseRevision: input.baseRevision,
            clientIdempotencyKey: input.clientIdempotencyKey,
            kind: "human",
            payload: {
              milestoneId: input.milestoneId,
              operation: "status",
              projectId: input.projectId,
              status: input.status,
            },
            targetId: input.milestoneId,
          },
          ({ currentRevision, currentValue }) => {
            const current = currentValue.milestone;
            if (!current) {
              throw new MutationTargetNotFoundError(input.milestoneId);
            }
            if (current.status !== "Planned") {
              throw new MutationConflictError(input.milestoneId);
            }
            return {
              milestone: milestoneSchema.parse({
                ...current,
                revision: currentRevision + 1,
                status: input.status,
              }),
            };
          },
          { undo: { kind: "field", scope: "milestone-status" } },
        );
        return receipt.nextValue.milestone;
      } catch (error) {
        if (error instanceof MutationTargetNotFoundError) {
          return null;
        }
        throw error;
      }
    },
    async saveView(accountId, input) {
      const parsed = saveRoadmapViewInputSchema.parse(input);
      const { baseRevision, clientIdempotencyKey, ...payload } = parsed;
      const mutation = createDatabaseMutationContract<RoadmapViewMutationValue>(
        database,
        { target: roadmapViewMutationTarget(accountId) },
      );

      try {
        const receipt = await mutation.mutate(
          {
            actor: { actorId: accountId, type: "User" },
            baseRevision,
            clientIdempotencyKey,
            kind: "human",
            payload,
            targetId: parsed.id,
          },
          ({ currentRevision }) => ({
            view: roadmapViewSchema.parse({
              ...payload,
              revision: currentRevision + 1,
            }),
          }),
          baseRevision > 0
            ? { undo: { kind: "view-metadata", scope: "view" } }
            : undefined,
        );
        return receipt.nextValue.view;
      } catch (error) {
        if (error instanceof MutationTargetNotFoundError) {
          return null;
        }
        throw error;
      }
    },
  };
}
