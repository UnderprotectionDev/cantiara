import {
  type BacklogStore,
  type BacklogWork,
  backlogWorkSchema,
  projectBacklogOrderSchema,
} from "@cantiara/api/backlog";
import {
  WORK_OPEN_STATUS_OPTIONS,
  workOpenStatusSchema,
} from "@cantiara/api/work-lifecycle";
import type { Database } from "@cantiara/db";
import { workspace } from "@cantiara/db/schema/auth";
import { projectBacklogOrder } from "@cantiara/db/schema/backlog";
import { project } from "@cantiara/db/schema/project";
import { work } from "@cantiara/db/schema/work";
import { and, asc, eq, inArray, isNull } from "drizzle-orm";
import { isBacklogMember } from "./backlog-membership";
import { normalizeBacklogOrder } from "./backlog-order";

export function createDatabaseBacklog(database: Database): BacklogStore {
  return {
    async findWorkspaceId(accountId) {
      const [record] = await database
        .select({ id: workspace.id })
        .from(workspace)
        .where(eq(workspace.ownerAccountId, accountId))
        .limit(1);
      return record?.id ?? null;
    },

    async list(workspaceId, projectId) {
      const storedOrder = await findProjectBacklogOrder(
        database,
        workspaceId,
        projectId,
      );
      if (storedOrder === null) {
        return null;
      }

      const workRecords = await database
        .select({
          archivedAt: work.archivedAt,
          id: work.id,
          status: work.status,
          trashedAt: work.trashedAt,
        })
        .from(work)
        .where(eq(work.projectId, projectId))
        .orderBy(asc(work.number));
      const activeIds = new Set(
        workRecords.filter(isBacklogMember).map((record) => record.id),
      );
      const orderedIds = normalizeBacklogOrder(
        storedOrder.workIds,
        workRecords.map((record) => record.id),
      ).filter((workId) => activeIds.has(workId));

      return projectBacklogOrderSchema.parse({
        projectId,
        revision: storedOrder.revision,
        workIds: orderedIds,
      });
    },

    async listPrepared(workspaceId, projectId): Promise<BacklogWork[] | null> {
      const storedOrder = await findProjectBacklogOrder(
        database,
        workspaceId,
        projectId,
      );
      if (storedOrder === null) {
        return null;
      }

      const records = await database
        .select({
          id: work.id,
          key: work.key,
          number: work.number,
          plannedStartDate: work.plannedStartDate,
          status: work.status,
          targetDate: work.targetDate,
          title: work.title,
        })
        .from(work)
        .where(
          and(
            eq(work.projectId, projectId),
            isNull(work.archivedAt),
            isNull(work.trashedAt),
            inArray(work.status, WORK_OPEN_STATUS_OPTIONS),
          ),
        )
        .orderBy(asc(work.number));
      const workById = new Map(
        records.map((record) => [
          record.id,
          backlogWorkSchema.parse({
            ...record,
            status: workOpenStatusSchema.parse(record.status),
          }),
        ]),
      );
      const orderedIds = normalizeBacklogOrder(
        storedOrder.workIds,
        records.map((record) => record.id),
      );
      return orderedIds
        .map((workId) => workById.get(workId))
        .filter((record): record is BacklogWork => record !== undefined);
    },
  };
}

async function findProjectBacklogOrder(
  database: Database,
  workspaceId: string,
  projectId: string,
) {
  const [ownedProject] = await database
    .select({ id: project.id })
    .from(project)
    .where(and(eq(project.id, projectId), eq(project.workspaceId, workspaceId)))
    .limit(1);
  if (!ownedProject) {
    return null;
  }

  const [storedOrder] = await database
    .select()
    .from(projectBacklogOrder)
    .where(eq(projectBacklogOrder.projectId, projectId))
    .limit(1);
  return storedOrder ?? { projectId, revision: 0, workIds: [] };
}
