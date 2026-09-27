import type {
  MutationPayload,
  MutationTarget,
} from "@cantiara/api/mutation-and-undo";
import {
  type RoadmapHorizonAccess,
  roadmapViewSchema,
  saveRoadmapViewInputSchema,
} from "@cantiara/api/roadmap-horizon";
import type { Database } from "@cantiara/db";
import { workspace } from "@cantiara/db/schema/auth";
import { project } from "@cantiara/db/schema/project";
import { workRelation } from "@cantiara/db/schema/relation";
import { roadmapView } from "@cantiara/db/schema/roadmap-horizon";
import { work } from "@cantiara/db/schema/work";
import { and, asc, eq, isNull } from "drizzle-orm";

import { MutationTargetNotFoundError } from "../../mutation-and-undo/server/mutation-contract";
import {
  createDatabaseMutationContract,
  type MutationDatabaseExecutor,
  type MutationDatabaseTargetAdapter,
} from "../../mutation-and-undo/server/mutation-contract-database";

interface RoadmapViewMutationValue {
  view: ReturnType<typeof roadmapViewSchema.parse> | null;
}
type RoadmapViewDatabaseRecord = typeof roadmapView.$inferSelect;

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

export function createDatabaseRoadmapHorizon(
  database: Database,
): RoadmapHorizonAccess {
  async function ownsProject(accountId: string, projectId: string) {
    return Boolean(
      await findOwnedProject(database, accountId, projectId, false),
    );
  }

  return {
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
