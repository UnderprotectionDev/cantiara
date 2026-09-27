import {
  type RoadmapHorizonAccess,
  roadmapViewSchema,
  saveRoadmapViewInputSchema,
} from "@cantiara/api/roadmap-horizon";
import type { Database } from "@cantiara/db";
import { workspace } from "@cantiara/db/schema/auth";
import { project } from "@cantiara/db/schema/project";
import { roadmapView } from "@cantiara/db/schema/roadmap-horizon";
import { and, asc, eq } from "drizzle-orm";

export function createDatabaseRoadmapHorizon(
  database: Database,
): RoadmapHorizonAccess {
  async function ownsProject(accountId: string, projectId: string) {
    const [owned] = await database
      .select({ id: project.id })
      .from(project)
      .innerJoin(workspace, eq(project.workspaceId, workspace.id))
      .where(
        and(eq(project.id, projectId), eq(workspace.ownerAccountId, accountId)),
      )
      .limit(1);
    return Boolean(owned);
  }

  return {
    async listViews(accountId, projectId) {
      if (!(await ownsProject(accountId, projectId))) {
        return null;
      }
      const records = await database
        .select()
        .from(roadmapView)
        .where(eq(roadmapView.projectId, projectId))
        .orderBy(asc(roadmapView.name));
      return records.map(({ updatedAt: _updatedAt, ...record }) =>
        roadmapViewSchema.parse(record),
      );
    },
    async saveView(accountId, input) {
      const parsed = saveRoadmapViewInputSchema.parse(input);
      if (!(await ownsProject(accountId, parsed.projectId))) {
        return null;
      }
      const id = parsed.id ?? crypto.randomUUID();
      const value = { ...parsed, id };
      const [existing] = await database
        .select({ projectId: roadmapView.projectId })
        .from(roadmapView)
        .where(eq(roadmapView.id, id))
        .limit(1);
      if (existing && existing.projectId !== parsed.projectId) {
        return null;
      }
      if (existing) {
        await database
          .update(roadmapView)
          .set({
            groupBy: value.groupBy,
            horizons: value.horizons,
            markBy: value.markBy,
            name: value.name,
            types: value.types,
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(roadmapView.id, id),
              eq(roadmapView.projectId, parsed.projectId),
            ),
          );
      } else {
        await database.insert(roadmapView).values(value);
      }
      return roadmapViewSchema.parse(value);
    },
  };
}
