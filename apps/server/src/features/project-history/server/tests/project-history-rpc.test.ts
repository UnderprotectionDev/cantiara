import type { Context } from "@cantiara/api/context";
import { appRouter } from "@cantiara/api/routers/index";
import { createRouterClient } from "@orpc/server";
import { describe, expect, test } from "vitest";

import { createProjectHistory } from "../project-history";
import {
  createMemoryProjectHistory,
  emptyStorySources,
} from "../project-history-memory-store";

const ACCOUNT = "account-1";
const HISTORY_PROCEDURE = /history|story|activity/i;
const WRITE_PROCEDURE = /^(add|set|remove|create|update|delete|close|write)/i;
const ok = <T>(value: T) => ({ available: true as const, value });

function setup(authenticated = true) {
  const harness = createMemoryProjectHistory({
    accountId: ACCOUNT,
    features: new Map(),
    projects: new Map([
      [
        "project-1",
        {
          sources: {
            ...emptyStorySources(),
            Milestone: ok([
              {
                abandonmentRationale: null,
                occurredAt: "2026-05-01T00:00:00.000Z",
                source: {
                  label: "Alpha",
                  recordId: "m1",
                  recordType: "Milestone" as const,
                },
                state: "Reached",
                title: "Alpha",
              },
            ]),
          },
          works: [{ id: "task-1", key: "T-1", title: "Task", type: "Task" }],
        },
      ],
    ]),
  });
  const context = {
    projectHistory: createProjectHistory(harness.sources),
    session: authenticated
      ? { session: { id: "session" }, user: { id: ACCOUNT } }
      : null,
  } as unknown as Context;
  return createRouterClient(appRouter, { context });
}

describe("Project History RPC seam", () => {
  test("serves the Story Timeline to the signed-in account", async () => {
    const timeline = await setup().projectStoryTimeline({
      projectId: "project-1",
      scope: "Project",
    });
    expect(timeline.events.map((event) => event.title)).toEqual(["Alpha"]);
  });

  test("refuses a signed-out caller, another Project and non-Feature Work", async () => {
    await expect(
      setup(false).projectStoryTimeline({
        projectId: "project-1",
        scope: "Project",
      }),
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(
      setup().projectStoryTimeline({ projectId: "other", scope: "Project" }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(
      setup().projectStoryTimeline({
        projectId: "project-1",
        scope: "Feature",
        workId: "task-1",
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  test("rejects smuggled fields on the strict input", async () => {
    await expect(
      setup().projectStoryTimeline({
        projectId: "project-1",
        scope: "Project",
        status: "Closed",
      } as never),
    ).rejects.toBeDefined();
  });

  test("the history surface has one read procedure and no write", () => {
    const names = Object.keys(appRouter).filter((name) =>
      HISTORY_PROCEDURE.test(name),
    );
    expect(names).toContain("projectStoryTimeline");
    expect(names.filter((name) => WRITE_PROCEDURE.test(name))).toEqual([]);
  });
});
