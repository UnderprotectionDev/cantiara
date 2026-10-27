import type { AttentionSignalsAccess } from "@cantiara/api/attention-signals";
import type { PublicRoadmapRecordFact } from "@cantiara/api/attention-signals-public-roadmap";
import type { Database } from "@cantiara/db";
import { projectPublicRoadmapReview } from "@cantiara/db/schema/attention-signals";
import { workspace } from "@cantiara/db/schema/auth";
import { project } from "@cantiara/db/schema/project";
import { and, eq } from "drizzle-orm";
import {
  createPublicRoadmapReview,
  type PublicRoadmapFacts,
  type PublicRoadmapReviewStore,
} from "./public-roadmap-review";

const owned = (accountId: string, projectId: string) =>
  and(eq(project.id, projectId), eq(workspace.ownerAccountId, accountId));

export function createDatabasePublicRoadmapReviewStore(
  database: Database,
): PublicRoadmapReviewStore {
  return {
    async get(accountId, projectId) {
      const [row] = await database
        .select({
          archivedAt: project.archivedAt,
          days: projectPublicRoadmapReview.intervalDays,
        })
        .from(project)
        .innerJoin(workspace, eq(workspace.id, project.workspaceId))
        .leftJoin(
          projectPublicRoadmapReview,
          eq(projectPublicRoadmapReview.projectId, project.id),
        )
        .where(owned(accountId, projectId));
      return row
        ? { days: row.days ?? null, readOnly: row.archivedAt !== null }
        : undefined;
    },

    async listConfigured(accountId) {
      return await database
        .select({
          days: projectPublicRoadmapReview.intervalDays,
          projectId: projectPublicRoadmapReview.projectId,
        })
        .from(projectPublicRoadmapReview)
        .innerJoin(
          project,
          eq(project.id, projectPublicRoadmapReview.projectId),
        )
        .innerJoin(workspace, eq(workspace.id, project.workspaceId))
        .where(eq(workspace.ownerAccountId, accountId));
    },

    async set(accountId, projectId, days) {
      const [row] = await database
        .select({ id: project.id })
        .from(project)
        .innerJoin(workspace, eq(workspace.id, project.workspaceId))
        .where(owned(accountId, projectId));
      if (!row) {
        return false;
      }
      if (days === null) {
        await database
          .delete(projectPublicRoadmapReview)
          .where(eq(projectPublicRoadmapReview.projectId, projectId));
        return true;
      }
      await database
        .insert(projectPublicRoadmapReview)
        .values({ intervalDays: days, projectId })
        .onConflictDoUpdate({
          set: { intervalDays: days, updatedAt: new Date() },
          target: projectPublicRoadmapReview.projectId,
        });
      return true;
    },
  };
}

/**
 * Public Roadmap publishing (the Dış yüzey snapshot of a Project's Roadmap)
 * has no per-record store yet, so this adapter reports no public records and
 * no signal can be due. The publishing owner replaces it when it ships; the
 * rule and the port stay as they are.
 */
export const noPublicRoadmapFacts: PublicRoadmapFacts = {
  read: (): Promise<PublicRoadmapRecordFact[]> => Promise.resolve([]),
};

export function createDatabasePublicRoadmapReview(
  database: Database,
  attention: AttentionSignalsAccess,
  facts: PublicRoadmapFacts = noPublicRoadmapFacts,
) {
  return createPublicRoadmapReview(
    createDatabasePublicRoadmapReviewStore(database),
    facts,
    attention,
  );
}
