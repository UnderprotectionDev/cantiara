import { DEFAULT_ACCOUNT_PREFERENCES } from "@cantiara/api/account-preferences";
import type { Context } from "@cantiara/api/context";
import { appRouter } from "@cantiara/api/routers/index";
import type { WorkspaceOverviewLayout } from "@cantiara/api/workspace-overview";
import { buildWorkspaceOverview } from "@cantiara/api/workspace-overview";
import { createRouterClient } from "@orpc/server";
import { describe, expect, test } from "vitest";

describe("Workspace Overview RPC", () => {
  test("reads and saves the authenticated Workspace presentation", async () => {
    const overview = buildWorkspaceOverview({ projects: [] });
    const calls: Array<{
      accountId: string;
      layout: WorkspaceOverviewLayout;
    }> = [];
    const context = {
      accountAccess: {
        listSessions: async () => [],
        revokeOtherSessions: async () => undefined,
        revokeSession: async () => undefined,
      },
      accountPreferences: {
        get: async () => ({
          ...DEFAULT_ACCOUNT_PREFERENCES,
          isSaved: false,
          revision: 0,
          savedAt: null,
        }),
      },
      auth: null,
      db: {} as Context["db"],
      githubAvailability: { getStatus: () => "available" as const },
      session: {
        session: { id: "session-1" },
        user: { id: "account-1" },
      } as Context["session"],
      workspaceOverview: {
        get: (accountId: string) => {
          expect(accountId).toBe("account-1");
          return Promise.resolve(overview);
        },
        savePresentation: (accountId, presentation) => {
          calls.push({ accountId, layout: presentation.layout });
          return Promise.resolve(overview);
        },
      },
    } satisfies Context;
    const client = createRouterClient(appRouter, { context });

    await expect(client.workspaceOverview()).resolves.toEqual(overview);
    await expect(
      client.saveWorkspaceOverviewPresentation({
        layout: {
          hidden: ["upcoming"],
          order: ["recent-work", "active-projects"],
        },
        liveBlockSources: [],
        version: 1,
      }),
    ).resolves.toEqual(overview);

    expect(calls).toEqual([
      {
        accountId: "account-1",
        layout: {
          hidden: ["upcoming"],
          order: ["recent-work", "active-projects"],
        },
      },
    ]);
  });
});
