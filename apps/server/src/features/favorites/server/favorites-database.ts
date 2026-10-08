import {
  type FavoriteEntry,
  type FavoriteSource,
  FavoriteSourceUnavailableError,
  type FavoritesAccess,
  favoriteSourceSchema,
} from "@cantiara/api/favorites";
import type { Database } from "@cantiara/db";
import { workspace } from "@cantiara/db/schema/auth";
import { favoriteMembership } from "@cantiara/db/schema/favorites";
import { and, asc, eq } from "drizzle-orm";
import {
  favoriteSourceExists,
  readFavoriteSources,
} from "./favorites-sources-database";

export function createDatabaseFavorites(database: Database): FavoritesAccess {
  async function ownedWorkspaceId(accountId: string) {
    const [record] = await database
      .select({ id: workspace.id })
      .from(workspace)
      .where(eq(workspace.ownerAccountId, accountId))
      .limit(1);
    return record?.id ?? null;
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

  async function readEntries(
    accountId: string,
    source?: FavoriteSource,
  ): Promise<FavoriteEntry[]> {
    const workspaceId = await ownedWorkspaceId(accountId);
    if (!workspaceId) {
      return [];
    }
    const memberships = await database
      .select({
        sourceRecordId: favoriteMembership.sourceRecordId,
        sourceRecordType: favoriteMembership.sourceRecordType,
        addedAt: favoriteMembership.createdAt,
      })
      .from(favoriteMembership)
      .where(
        and(
          eq(favoriteMembership.accountId, accountId),
          eq(favoriteMembership.workspaceId, workspaceId),
          source ? membershipFilter(accountId, workspaceId, source) : undefined,
        ),
      )
      .orderBy(asc(favoriteMembership.createdAt), asc(favoriteMembership.id));
    return readFavoriteSources(database, workspaceId, memberships);
  }

  return {
    list: (accountId) => readEntries(accountId),
    async open(accountId, input) {
      const source = favoriteSourceSchema.parse(input);
      const [entry] = await readEntries(accountId, source);
      if (!entry) {
        throw new FavoriteSourceUnavailableError();
      }
      return entry;
    },
    async add(accountId, input) {
      const source = favoriteSourceSchema.parse(input);
      const workspaceId = await ownedWorkspaceId(accountId);
      if (
        !(
          workspaceId &&
          (await favoriteSourceExists(database, workspaceId, source))
        )
      ) {
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
