import {
  type PrioritizationSession,
  type PrioritizationSessionStore,
  prioritizationSessionSchema,
} from "@cantiara/api/prioritization-sessions";
import type { Database } from "@cantiara/db";
import { workspace } from "@cantiara/db/schema/auth";
import {
  prioritizationSession,
  prioritizationSessionWork,
} from "@cantiara/db/schema/prioritization-session";
import { project } from "@cantiara/db/schema/project";
import { and, asc, desc, eq, inArray } from "drizzle-orm";

type SessionRecord = typeof prioritizationSession.$inferSelect;

function toPrioritizationSession(
  record: SessionRecord,
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

export function createDatabasePrioritizationSessions(
  database: Database,
): PrioritizationSessionStore {
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

      const records = await database
        .select()
        .from(prioritizationSession)
        .where(eq(prioritizationSession.projectId, projectId))
        .orderBy(
          desc(prioritizationSession.createdAt),
          desc(prioritizationSession.id),
        );
      if (records.length === 0) {
        return [];
      }

      const items = await database
        .select({
          position: prioritizationSessionWork.position,
          sessionId: prioritizationSessionWork.sessionId,
          workId: prioritizationSessionWork.workId,
        })
        .from(prioritizationSessionWork)
        .where(
          inArray(
            prioritizationSessionWork.sessionId,
            records.map((record) => record.id),
          ),
        )
        .orderBy(asc(prioritizationSessionWork.position));
      const workIdsBySessionId = new Map<string, string[]>();
      for (const item of items) {
        const workIds = workIdsBySessionId.get(item.sessionId) ?? [];
        workIds.push(item.workId);
        workIdsBySessionId.set(item.sessionId, workIds);
      }

      return records.map((record) =>
        toPrioritizationSession(
          record,
          workIdsBySessionId.get(record.id) ?? [],
        ),
      );
    },
  };
}
