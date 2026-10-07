import type { Context } from "@cantiara/api/context";
import {
  FavoriteSourceUnavailableError,
  type FavoritesAccess,
} from "@cantiara/api/favorites";
import { appRouter } from "@cantiara/api/routers/index";
import { createRouterClient } from "@orpc/server";
import { describe, expect, test, vi } from "vitest";

const accountId = "founder-account";
const source = {
  sourceRecordId: "decision-1",
  sourceRecordType: "Decision",
} as const;

function testClient(
  favorites: FavoritesAccess,
  session: Context["session"] | null,
) {
  const context = {
    auth: null,
    db: {} as Context["db"],
    favorites,
    session,
  } as Context;
  return createRouterClient(appRouter, { context });
}

describe("Favorites membership RPC", () => {
  test("maps an unavailable source to a user-facing NOT_FOUND", async () => {
    const favorites: FavoritesAccess = {
      add: vi.fn().mockRejectedValue(new FavoriteSourceUnavailableError()),
      contains: vi.fn().mockResolvedValue(false),
      remove: vi.fn().mockResolvedValue(undefined),
    };
    const client = testClient(favorites, {
      session: { id: "session-1" },
      user: { id: accountId },
    } as Context["session"]);

    await expect(client.addToFavorites(source)).rejects.toMatchObject({
      code: "NOT_FOUND",
      message: "Source record is unavailable.",
    });
    expect(favorites.add).toHaveBeenCalledWith(accountId, source);
  });

  test("binds add, membership, and remove to the authenticated Account", async () => {
    const favorites: FavoritesAccess = {
      add: vi.fn().mockResolvedValue(undefined),
      contains: vi.fn().mockResolvedValue(true),
      remove: vi.fn().mockResolvedValue(undefined),
    };
    const client = testClient(favorites, {
      session: { id: "session-1" },
      user: { id: accountId },
    } as Context["session"]);

    await expect(client.addToFavorites(source)).resolves.toEqual({
      status: true,
    });
    await expect(client.favoriteMembership(source)).resolves.toEqual({
      isFavorite: true,
    });
    await expect(client.removeFromFavorites(source)).resolves.toEqual({
      status: true,
    });
    for (const operation of ["add", "contains", "remove"] as const) {
      expect(favorites[operation]).toHaveBeenCalledWith(accountId, source);
    }
    await expect(
      testClient(favorites, null).addToFavorites(source),
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });
});
