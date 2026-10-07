import {
  type FavoriteSource,
  FavoriteSourceUnavailableError,
  type FavoritesAccess,
  favoriteSourceSchema,
} from "@cantiara/api/favorites";
import type { Database } from "@cantiara/db";
import { workspace } from "@cantiara/db/schema/auth";
import { decision } from "@cantiara/db/schema/decision";
import { document } from "@cantiara/db/schema/document";
import { favoriteMembership } from "@cantiara/db/schema/favorites";
import { project } from "@cantiara/db/schema/project";
import { smartCollection } from "@cantiara/db/schema/smart-collection";
import { work } from "@cantiara/db/schema/work";
import { and, eq, isNull, or } from "drizzle-orm";

export function createDatabaseFavorites(database: Database): FavoritesAccess {
  async function ownedWorkspaceId(accountId: string) {
    const [record] = await database
      .select({ id: workspace.id })
      .from(workspace)
      .where(eq(workspace.ownerAccountId, accountId))
      .limit(1);
    return record?.id ?? null;
  }

  async function sourceExists(workspaceId: string, source: FavoriteSource) {
    const sourceId = source.sourceRecordId;
    switch (source.sourceRecordType) {
      case "Project":
        return (
          (
            await database
              .select({ id: project.id })
              .from(project)
              .where(
                and(
                  eq(project.id, sourceId),
                  eq(project.workspaceId, workspaceId),
                ),
              )
              .limit(1)
          ).length > 0
        );
      case "Document":
        return (
          (
            await database
              .select({ id: document.id })
              .from(document)
              .leftJoin(project, eq(document.projectId, project.id))
              .where(
                and(
                  eq(document.id, sourceId),
                  or(
                    eq(document.workspaceId, workspaceId),
                    eq(project.workspaceId, workspaceId),
                  ),
                ),
              )
              .limit(1)
          ).length > 0
        );
      case "Work":
        return (
          (
            await database
              .select({ id: work.id })
              .from(work)
              .innerJoin(project, eq(work.projectId, project.id))
              .where(
                and(
                  eq(work.id, sourceId),
                  eq(project.workspaceId, workspaceId),
                  isNull(work.trashedAt),
                ),
              )
              .limit(1)
          ).length > 0
        );
      case "Decision":
        return (
          (
            await database
              .select({ id: decision.id })
              .from(decision)
              .innerJoin(project, eq(decision.projectId, project.id))
              .where(
                and(
                  eq(decision.id, sourceId),
                  eq(project.workspaceId, workspaceId),
                ),
              )
              .limit(1)
          ).length > 0
        );
      case "Smart Collection":
        return (
          (
            await database
              .select({ id: smartCollection.id })
              .from(smartCollection)
              .innerJoin(project, eq(smartCollection.projectId, project.id))
              .where(
                and(
                  eq(smartCollection.id, sourceId),
                  eq(project.workspaceId, workspaceId),
                ),
              )
              .limit(1)
          ).length > 0
        );
      default:
        throw new FavoriteSourceUnavailableError();
    }
  }

  function membershipFilter(
    accountId: string,
    workspaceId: string,
    source: FavoriteSource,
  ) {
    return and(
      eq(favoriteMembership.accountId, accountId),
      eq(favoriteMembership.workspaceId, workspaceId),
      eq(favoriteMembership.sourceRecordId, source.sourceRecordId),
      eq(favoriteMembership.sourceRecordType, source.sourceRecordType),
    );
  }

  return {
    async add(accountId, input) {
      const source = favoriteSourceSchema.parse(input);
      const workspaceId = await ownedWorkspaceId(accountId);
      if (!(workspaceId && (await sourceExists(workspaceId, source)))) {
        throw new FavoriteSourceUnavailableError();
      }
      await database
        .insert(favoriteMembership)
        .values({ id: crypto.randomUUID(), accountId, workspaceId, ...source })
        .onConflictDoNothing();
    },
    async contains(accountId, input) {
      const source = favoriteSourceSchema.parse(input);
      const workspaceId = await ownedWorkspaceId(accountId);
      if (!workspaceId) {
        return false;
      }
      const [membership] = await database
        .select({ id: favoriteMembership.id })
        .from(favoriteMembership)
        .where(membershipFilter(accountId, workspaceId, source))
        .limit(1);
      return membership !== undefined;
    },
    async remove(accountId, input) {
      const source = favoriteSourceSchema.parse(input);
      const workspaceId = await ownedWorkspaceId(accountId);
      if (!workspaceId) {
        return;
      }
      await database
        .delete(favoriteMembership)
        .where(membershipFilter(accountId, workspaceId, source));
    },
  };
}
