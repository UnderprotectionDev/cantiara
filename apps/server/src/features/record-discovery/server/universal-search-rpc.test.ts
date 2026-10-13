import type { Context } from "@cantiara/api/context";
import { appRouter } from "@cantiara/api/routers/index";
import { createRouterClient } from "@orpc/server";
import { describe, expect, test, vi } from "vitest";

function createContext() {
  const search = vi.fn().mockResolvedValue([]);
  const context: Context = {
    accountAccess: {
      listSessions: async () => [],
      revokeOtherSessions: async () => undefined,
      revokeSession: async () => undefined,
    },
    accountPreferences: {
      get: () => Promise.reject(new Error("Not part of this test.")),
    },
    auth: null,
    db: {} as Context["db"],
    githubAvailability: { getStatus: () => "available" },
    session: {
      session: { id: "session-1" },
      user: { id: "account-1" },
    } as Context["session"],
    universalSearch: { search },
  };

  return { context, search };
}

describe("Universal Search RPC", () => {
  test("uses the authenticated Account", async () => {
    const { context, search } = createContext();
    const client = createRouterClient(appRouter, { context });

    await client.searchRecords({ query: "PostgreSQL" });

    expect(search).toHaveBeenCalledWith(
      "account-1",
      expect.objectContaining({ archived: false, query: "PostgreSQL" }),
    );
  });

  test("rejects unauthenticated access before querying records", async () => {
    const { context, search } = createContext();
    context.session = null;
    const client = createRouterClient(appRouter, { context });

    await expect(
      client.searchRecords({ query: "PostgreSQL" }),
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    expect(search).not.toHaveBeenCalled();
  });
});
