import {
  type BacklogStore,
  projectBacklogOrderSchema,
} from "@cantiara/api/backlog";
import type { Database } from "@cantiara/db";
import { workspace } from "@cantiara/db/schema/auth";
import { projectBacklogOrder } from "@cantiara/db/schema/backlog";
import { project } from "@cantiara/db/schema/project";
import { work } from "@cantiara/db/schema/work";
import { and, asc, eq } from "drizzle-orm";
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
      const [ownedProject] = await database
        .select({ id: project.id })
        .from(project)
        .where(
          and(eq(project.id, projectId), eq(project.workspaceId, workspaceId)),
        )
        .limit(1);
      if (!ownedProject) {
        return null;
      }

      const [storedOrder] = await database
        .select()
        .from(projectBacklogOrder)
        .where(eq(projectBacklogOrder.projectId, projectId))
        .limit(1);
      const workRecords = await database
        .select({ archivedAt: work.archivedAt, id: work.id })
        .from(work)
        .where(eq(work.projectId, projectId))
        .orderBy(asc(work.number));
      const activeIds = new Set(
        workRecords
          .filter((record) => record.archivedAt === null)
          .map((record) => record.id),
      );
      const orderedIds = normalizeBacklogOrder(
        storedOrder?.workIds ?? [],
        workRecords.map((record) => record.id),
      ).filter((workId) => activeIds.has(workId));

      return projectBacklogOrderSchema.parse({
        projectId,
        revision: storedOrder?.revision ?? 0,
        workIds: orderedIds,
      });
    },
  };
}
