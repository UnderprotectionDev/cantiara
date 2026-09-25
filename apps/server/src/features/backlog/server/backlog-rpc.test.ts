import type { BacklogAccess, BacklogWork } from "@cantiara/api/backlog";
import type { Context } from "@cantiara/api/context";
import { appRouter } from "@cantiara/api/routers/index";
import { createRouterClient } from "@orpc/server";
import { describe, expect, test, vi } from "vitest";

const accountId = "account-1";
const projectId = "project-1";

describe("Backlog RPC", () => {
  test("reads prepared membership through the authenticated public interface", async () => {
    const preparedWork: BacklogWork[] = [
      {
        id: "work-1",
        key: "CANT-1",
        number: 1,
        plannedStartDate: null,
        status: "Not Started",
        targetDate: null,
        title: "Unplanned Work",
      },
      {
        id: "work-2",
        key: "CANT-2",
        number: 2,
        plannedStartDate: null,
        status: "Blocked",
        targetDate: null,
        title: "Planned Work",
      },
    ];
    const statesBeforeRead = preparedWork.map(({ id, status }) => ({
      id,
      status,
    }));
    const backlog: BacklogAccess = {
      list: vi.fn().mockResolvedValue({ projectId, revision: 0, workIds: [] }),
      listPrepared: vi.fn().mockResolvedValue(preparedWork),
    };
    const context = {
      auth: null,
      backlog,
      db: {} as Context["db"],
      session: {
        session: { id: "session-1" },
        user: { id: accountId },
      } as Context["session"],
    } as Context;
    const client = createRouterClient(appRouter, { context });

    await expect(client.projectBacklog({ projectId })).resolves.toEqual(
      preparedWork,
    );
    expect(backlog.listPrepared).toHaveBeenCalledExactlyOnceWith(
      accountId,
      projectId,
    );
    expect(preparedWork.map(({ id, status }) => ({ id, status }))).toEqual(
      statesBeforeRead,
    );
  });
});
